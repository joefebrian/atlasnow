/**
 * Two Prisma clients. Booking, payment, webhook, and attribution run together.
 * settleConcurrent() is not the evidence. The global advisory lock is not taken by a writer.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { signPolicyAttestation } from "./memory-store";
import { createMockProvider, type MockProvider } from "./mock-provider";
import {
  ORCHESTRATOR_POLICY_KEY,
  cancelReservation,
  createOrchestratorState,
  openPaymentAttempt,
  recordPayment,
  reserve,
  type ReserveCommand,
} from "./orchestrator";
import { signPaymentProof, type RawPaymentNotice } from "./payment";
import { openPostgresCommerceStore } from "./postgres-store";
import { createRegistry } from "./registry";
import { QA_DATABASE_NAME, createDisposableQaDatabase, redactDatabaseText, type DisposableQaDatabase } from "./qa-database";

const NOW = "2026-10-26T10:00:00.000Z";
const PAY_SECRET = "test-payment-connection";

function actor(tenantId: string) {
  return { tenantId, locationIds: null };
}

function command(overrides: Partial<ReserveCommand> = {}): ReserveCommand {
  return {
    actor: actor("tenant-a"),
    tenantId: "tenant-a",
    locationId: "loc-a",
    providerId: "provider-a",
    offeringId: "offer-1",
    startsAt: "2026-11-01T09:00:00.000Z",
    idempotencyKey: "reserve-1",
    experience: "WHATSAPP_CATALOG",
    category: "GENERAL_GOODS",
    merchantEligibility: "ELIGIBLE",
    approvalEvidence: { source: "META_COMMERCE_POLICY", status: "VERIFIED", reference: "policy-record-1" },
    merchantConfirmed: false,
    ...overrides,
  };
}

function harness(provider: MockProvider, store: Awaited<ReturnType<typeof openPostgresCommerceStore>>, tenantId = "tenant-a", providerId = "provider-a") {
  const registry = createRegistry();
  const registered = registry.register({ tenantId, locationId: null, providerId, mode: provider.getCapabilities().mode, provider });
  assert.equal(registered.ok, true);
  return { registry, state: createOrchestratorState({ persistence: store }), now: NOW };
}

function proofFor(notice: RawPaymentNotice) {
  const fields = {
    tenantId: notice.tenantId,
    providerId: notice.providerId,
    attemptRef: notice.attemptRef,
    transactionRef: notice.transactionRef,
    providerReference: notice.providerReference ?? "",
    currency: "IDR" as const,
    amountIdr: notice.amountIdr,
    eventId: notice.eventId,
    type: notice.type,
    occurredAt: notice.occurredAt,
    sequence: notice.sequence,
  };
  return { ...fields, signature: signPaymentProof(PAY_SECRET, fields) };
}

function noticeFor(transactionRef: string, attemptRef: string, eventId: string, type: RawPaymentNotice["type"], providerReference: string, tenantId = "tenant-a"): RawPaymentNotice {
  return {
    eventId,
    type,
    evidence: "VERIFIED_PROVIDER_EVENT",
    amountIdr: 10000,
    currency: "IDR",
    occurredAt: NOW,
    providerReference,
    sequence: 1,
    tenantId,
    providerId: "pay-provider",
    attemptRef,
    transactionRef,
  };
}

async function allowGoods(store: Awaited<ReturnType<typeof openPostgresCommerceStore>>, tenantId: string) {
  const fields = {
    tenantId,
    offeringCategory: "GENERAL_GOODS" as const,
    experience: "WHATSAPP_CATALOG" as const,
    processId: "orchestrator-compat-fixture",
    reference: "orchestrator-compat-goods-catalog",
    outcome: "VERIFIED" as const,
  };
  const saved = await store.policy.submit(actor(tenantId), tenantId, { offeringCategory: fields.offeringCategory, experience: fields.experience }, {
    kind: "AUTHORIZED_PROCESS",
    processId: fields.processId,
    reference: fields.reference,
    outcome: fields.outcome,
    attestation: signPolicyAttestation(ORCHESTRATOR_POLICY_KEY, fields),
  });
  assert.equal(saved.ok, true, saved.ok ? "" : saved.message);
}

function stageQaMigrations() {
  const root = mkdtempSync(path.join(tmpdir(), "atlasnow-cc-qa-"));
  const migrations = path.join(root, "migrations");
  mkdirSync(migrations);
  cpSync(path.join(process.cwd(), "prisma/migrations/migration_lock.toml"), path.join(migrations, "migration_lock.toml"));
  cpSync(path.join(process.cwd(), "prisma/schema.prisma"), path.join(root, "schema.prisma"));
  const tracked = spawnGit(["ls-files", "--", "prisma/migrations"]);
  const folders = new Set<string>();
  for (const line of tracked.split("\n")) {
    const match = line.match(/^prisma\/migrations\/([^/]+)\//);
    if (match && match[1] !== "migration_lock.toml") folders.add(match[1]);
  }
  folders.add("20261026120000_cc_location_tenant_key");
  folders.add("20261026140000_cc_persistence");
  for (const folder of folders) {
    if (folder.startsWith("20261004120000") || folder.startsWith("20261004143000")) continue;
    const from = path.join(process.cwd(), "prisma/migrations", folder);
    if (!statSync(from).isDirectory()) continue;
    cpSync(from, path.join(migrations, folder), { recursive: true });
  }
  return root;
}

function spawnGit(args: string[]) {
  const result = spawnSync("git", args, { cwd: process.cwd(), encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "git ls-files failed");
  return result.stdout;
}

function migrate(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("refusing to migrate a non-loopback database");
  if (!QA_DATABASE_NAME.test(url.pathname.replace(/^\//, ""))) throw new Error("refusing to migrate a database outside the QA pattern");
  const root = stageQaMigrations();
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(root, "schema.prisma")], {
      env: { ...process.env, DATABASE_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout?.on("data", (chunk) => { log += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { log += chunk.toString(); });
    child.on("exit", (code) => {
      rmSync(root, { recursive: true, force: true });
      if (code === 0) resolve();
      else reject(new Error(redactDatabaseText(log).slice(-1500)));
    });
  });
}

async function sourceMigrationCount() {
  const raw = process.env.DATABASE_URL || "";
  const url = new URL(raw);
  if ((url.hostname !== "localhost" && url.hostname !== "127.0.0.1") || url.pathname !== "/atlasnow") {
    throw new Error("QA coordinates must be the loopback atlasnow admin database, which this test does not migrate.");
  }
  const client = new PrismaClient({ datasources: { db: { url: raw } } });
  try {
    const rows = await client.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int AS count FROM "_prisma_migrations"');
    return Number(rows[0]?.count ?? 0);
  } finally {
    await client.$disconnect();
  }
}

async function rowsFor(client: PrismaClient, tenantId: string) {
  const [bookings, events, transactions] = await Promise.all([
    client.ccBooking.count({ where: { tenantId } }),
    client.ccPaymentEvent.count({ where: { tenantId } }),
    client.ccTransaction.count({ where: { tenantId } }),
  ]);
  return { bookings, events, transactions };
}

describe("PostgreSQL cross-module workers", () => {
  let qa: DisposableQaDatabase;
  let clientA: PrismaClient;
  let clientB: PrismaClient;
  let storeA: Awaited<ReturnType<typeof openPostgresCommerceStore>>;
  let storeB: Awaited<ReturnType<typeof openPostgresCommerceStore>>;
  let sourceMigrations = 0;

  before(async () => {
    sourceMigrations = await sourceMigrationCount();
    qa = await createDisposableQaDatabase();
    await migrate(qa.databaseUrl);
    await qa.installOwnerMarker();
    clientA = new PrismaClient({ datasources: { db: { url: qa.databaseUrl } } });
    clientB = new PrismaClient({ datasources: { db: { url: qa.databaseUrl } } });
    await qa.assertIdentity(clientA);
    await qa.assertIdentity(clientB);
    for (const row of [["tenant-a", "loc-a"], ["tenant-b", "loc-b"]] as const) {
      await clientA.tenant.create({ data: { id: row[0], name: row[0], slug: row[0] } });
      await clientA.location.create({ data: { id: row[1], atlasLocationId: `${row[0]}-${row[1]}`, tenantId: row[0], name: row[1] } });
    }
    await clientA.location.create({ data: { id: "loc-a2", atlasLocationId: "tenant-a-loc-a2", tenantId: "tenant-a", name: "loc-a2" } });
    storeA = await openPostgresCommerceStore({ client: clientA, qa, policyValidatorKey: ORCHESTRATOR_POLICY_KEY });
    storeB = await openPostgresCommerceStore({ client: clientB, qa, policyValidatorKey: ORCHESTRATOR_POLICY_KEY });
    await allowGoods(storeA, "tenant-a");
    await allowGoods(storeA, "tenant-b");
  });

  after(async () => {
    await clientA?.$disconnect();
    await clientB?.$disconnect();
    if (qa) await qa.drop();
    assert.equal(await sourceMigrationCount(), sourceMigrations);
  });

  async function book(tenantId: string, locationId: string, providerId: string, idempotencyKey: string, offeringId: string) {
    const provider = createMockProvider({ boundTenantId: tenantId, providerId, mode: "NATIVE", supportsHold: true });
    const input = command({
      actor: actor(tenantId),
      tenantId,
      locationId,
      providerId,
      idempotencyKey,
      offeringId,
    });
    const saved = await reserve(input, harness(provider, storeA, tenantId, providerId));
    assert.equal(saved.ok, true, saved.message);
    if (!saved.ok) throw new Error(saved.message);
    return { provider, saved, input };
  }

  it("1. tenant A books while tenant B records a payment", async () => {
    const booked = await book("tenant-b", "loc-b", "provider-b", "cross-b-pay", "offer-b-pay");
    const transactionRef = booked.saved.transaction?.transactionRef ?? "";
    const opened = await openPaymentAttempt(harness(booked.provider, storeB, "tenant-b", "provider-b").state, actor("tenant-b"), {
      transactionRef,
      attemptRef: "attempt-b-1",
      providerId: "pay-provider",
      expectedAmountIdr: 10000,
    });
    assert.equal(opened.ok, true, opened.ok ? "" : opened.code);
    const beforeA = await rowsFor(clientA, "tenant-a");
    const notice = noticeFor(transactionRef, "attempt-b-1", "evt-b-paid", "payment.paid", "pay-b-1", "tenant-b");
    const providerA = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true });
    const [reserved, paid] = await Promise.all([
      reserve(command({ idempotencyKey: "cross-a-while-b-pays", offeringId: "offer-a-while-b" }), harness(providerA, storeA)),
      recordPayment(harness(booked.provider, storeB, "tenant-b", "provider-b").state, actor("tenant-b"), {
        transactionRef,
        notice,
        proof: proofFor(notice),
        connection: { tenantId: "tenant-b", providerId: "pay-provider", secret: PAY_SECRET },
      }, NOW),
    ]);
    assert.equal(reserved.ok, true, reserved.message);
    assert.equal(paid.ok, true, paid.ok ? "" : paid.code);
    assert.equal((await rowsFor(clientA, "tenant-a")).bookings, beforeA.bookings + 1);
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-a" } }), 0);
    assert.equal(await clientB.ccPaymentEvent.count({ where: { tenantId: "tenant-b", attemptRef: "attempt-b-1" } }), 1);
    assert.equal(await clientB.ccBooking.count({ where: { tenantId: "tenant-b", idempotencyKey: "cross-b-pay" } }), 1);
    const hidden = await storeA.bookings.findByExternalRef(actor("tenant-a"), "tenant-a", "provider-b", booked.saved.booking?.providerReference ?? "missing");
    assert.equal(hidden.ok, false);
  });

  it("2. a booking cancel and a payment event both keep their fields", async () => {
    const booked = await book("tenant-a", "loc-a", "provider-a", "cross-cancel-pay", "offer-cancel-pay");
    const transactionRef = booked.saved.transaction?.transactionRef ?? "";
    const bookingRef = booked.saved.booking?.bookingRef ?? "";
    const state = harness(booked.provider, storeA).state;
    const opened = await openPaymentAttempt(state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-cancel-pay",
      providerId: "pay-provider",
      expectedAmountIdr: 10000,
    });
    assert.equal(opened.ok, true);
    const notice = noticeFor(transactionRef, "attempt-cancel-pay", "evt-cancel-pay", "payment.paid", "pay-cancel-1");
    const [cancelled, paid] = await Promise.all([
      cancelReservation({ actor: actor("tenant-a"), bookingRef, idempotencyKey: "cross-cancel-pay" }, harness(booked.provider, storeB)),
      recordPayment(harness(booked.provider, storeA).state, actor("tenant-a"), {
        transactionRef,
        notice,
        proof: proofFor(notice),
        connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
      }, NOW),
    ]);
    assert.equal(cancelled.ok, true, cancelled.message);
    assert.equal(paid.ok, true, paid.ok ? "" : paid.code);
    const booking = await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-cancel-pay" } });
    const transaction = await clientA.ccTransaction.findUnique({ where: { tenantId_transactionRef: { tenantId: "tenant-a", transactionRef } } });
    assert.equal(booking?.state, "CANCELLED");
    assert.equal(transaction?.state, "CLOSED");
    assert.equal(transaction?.paymentStatus, "PAID");
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-a", attemptRef: "attempt-cancel-pay" } }), 1);
  });

  it("3. two payment events for one attempt count the capture once", async () => {
    const booked = await book("tenant-a", "loc-a", "provider-a", "cross-two-events", "offer-two-events");
    const transactionRef = booked.saved.transaction?.transactionRef ?? "";
    const opened = await openPaymentAttempt(harness(booked.provider, storeA).state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-two",
      providerId: "pay-provider",
      expectedAmountIdr: 10000,
    });
    assert.equal(opened.ok, true);
    const firstNotice = noticeFor(transactionRef, "attempt-two", "evt-two-a", "payment.paid", "pay-two");
    const secondNotice = noticeFor(transactionRef, "attempt-two", "evt-two-b", "payment.paid", "pay-two");
    const [first, second] = await Promise.all([
      recordPayment(harness(booked.provider, storeA).state, actor("tenant-a"), {
        transactionRef, notice: firstNotice, proof: proofFor(firstNotice), connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
      }, NOW),
      recordPayment(harness(booked.provider, storeB).state, actor("tenant-a"), {
        transactionRef, notice: secondNotice, proof: proofFor(secondNotice), connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
      }, NOW),
    ]);
    const effects = [first, second].map((row) => row.ok ? row.effect : row.code).join(",");
    assert.equal([first, second].filter((row) => row.ok && row.effect === "applied").length, 1, effects);
    assert.equal([first, second].filter((row) => row.ok && row.effect === "duplicate").length, 1, effects);
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-a", attemptRef: "attempt-two" } }), 1);
    const net = await storeB.payments.net(actor("tenant-a"), "tenant-a", transactionRef);
    assert.equal(net.ok, true);
    if (net.ok) assert.equal(net.value.netRevenueIdr, 10000);
    const booking = await clientB.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-two-events" } });
    assert.equal(booking?.state, "HELD");
  });

  it("4. one webhook survives two workers and a rejected event stays unapplied", async () => {
    const registered = await storeA.connections.register(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-a",
      providerId: "hook-cross",
      kind: "PAYMENT",
      mode: "MERCHANT_PAYMENT_GATEWAY",
      capabilities: {
        providerId: "hook-cross",
        supportsHold: false,
        mock: true,
        guaranteesIdempotency: false,
        absenceConsistencyRequirement: null,
        holdExpiryOwner: "NONE",
        issuesAuthoritativeReference: false,
      },
    });
    assert.equal(registered.ok, true);
    if (!registered.ok) return;
    const input = { tenantId: "tenant-a", connectionId: registered.value.connectionId, eventId: "evt-cross-hook", eventType: "payment.paid" };
    const [left, right] = await Promise.all([
      storeA.webhooks.accept(actor("tenant-a"), input),
      storeB.webhooks.accept(actor("tenant-a"), input),
    ]);
    assert.equal(left.ok && right.ok, true);
    assert.equal([left, right].filter((row) => row.ok && row.replay).length, 1);
    assert.equal(await clientA.ccWebhookEvent.count({ where: { tenantId: "tenant-a", eventId: "evt-cross-hook" } }), 1);
    const dedupeKey = left.ok ? left.value.dedupeKey : "";
    const [marked, again] = await Promise.all([
      storeA.webhooks.markApplied(actor("tenant-a"), "tenant-a", dedupeKey),
      storeB.webhooks.markApplied(actor("tenant-a"), "tenant-a", dedupeKey),
    ]);
    assert.equal(marked.ok && again.ok, true);
    const saved = await clientB.ccWebhookEvent.findUnique({ where: { dedupeKey } });
    assert.equal(saved?.status, "APPLIED");
    const rejected = await storeA.webhooks.accept(actor("tenant-a"), { ...input, eventId: " " });
    assert.equal(rejected.ok, false);
    assert.equal(await clientA.ccWebhookEvent.count({ where: { tenantId: "tenant-a", eventId: " " } }), 0);
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-a", eventId: "evt-cross-hook" } }), 0);
  });

  it("5. a refund and a transaction close both remain", async () => {
    const booked = await book("tenant-a", "loc-a", "provider-a", "cross-refund", "offer-refund");
    const transactionRef = booked.saved.transaction?.transactionRef ?? "";
    const state = harness(booked.provider, storeA).state;
    assert.equal((await openPaymentAttempt(state, actor("tenant-a"), {
      transactionRef, attemptRef: "attempt-refund", providerId: "pay-provider", expectedAmountIdr: 10000,
    })).ok, true);
    const paid = noticeFor(transactionRef, "attempt-refund", "evt-refund-paid", "payment.paid", "pay-refund");
    assert.equal((await recordPayment(state, actor("tenant-a"), {
      transactionRef, notice: paid, proof: proofFor(paid), connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
    }, NOW)).ok, true);
    const before = await clientA.ccTransaction.findUnique({ where: { tenantId_transactionRef: { tenantId: "tenant-a", transactionRef } } });
    const refund = noticeFor(transactionRef, "attempt-refund", "evt-refund", "payment.refunded", "pay-refund");
    const [refunded, closed] = await Promise.all([
      recordPayment(harness(booked.provider, storeA).state, actor("tenant-a"), {
        transactionRef, notice: refund, proof: proofFor(refund), connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
      }, NOW),
      storeB.transactions.compareAndSwap(actor("tenant-a"), {
        tenantId: "tenant-a",
        transactionRef,
        expectedVersion: before?.version ?? 0,
        state: "CLOSED",
      }),
    ]);
    assert.equal(refunded.ok, true, refunded.ok ? "" : refunded.code);
    let finalClose = closed;
    if (!finalClose.ok && finalClose.code === "VERSION_CONFLICT") {
      const fresh = await clientA.ccTransaction.findUnique({ where: { tenantId_transactionRef: { tenantId: "tenant-a", transactionRef } } });
      finalClose = await storeB.transactions.compareAndSwap(actor("tenant-a"), {
        tenantId: "tenant-a",
        transactionRef,
        expectedVersion: fresh?.version ?? 0,
        state: "CLOSED",
      });
    }
    assert.equal(finalClose.ok, true, finalClose.ok ? "" : finalClose.message);
    const transaction = await clientA.ccTransaction.findUnique({ where: { tenantId_transactionRef: { tenantId: "tenant-a", transactionRef } } });
    assert.equal(transaction?.state, "CLOSED");
    assert.equal(transaction?.paymentStatus, "REFUNDED");
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-a", attemptRef: "attempt-refund" } }), 2);
    const booking = await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-refund" } });
    assert.equal(booking?.state, "HELD");
    const net = await storeA.payments.net(actor("tenant-a"), "tenant-a", transactionRef);
    assert.equal(net.ok, true);
    if (net.ok) assert.equal(net.value.netRevenueIdr, 0);
  });

  it("6. a booking write and a policy update do not erase each other", async () => {
    const beforeB = await rowsFor(clientA, "tenant-b");
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true });
    const fields = {
      tenantId: "tenant-a",
      offeringCategory: "GENERAL_GOODS" as const,
      experience: "WHATSAPP_CATALOG" as const,
      processId: "orchestrator-compat-fixture",
      reference: "cross-policy-revision",
      outcome: "VERIFIED" as const,
    };
    const [reserved, policy] = await Promise.all([
      reserve(command({ idempotencyKey: "cross-policy-book", offeringId: "offer-policy" }), harness(provider, storeA)),
      storeB.policy.submit(actor("tenant-a"), "tenant-a", { offeringCategory: fields.offeringCategory, experience: fields.experience }, {
        kind: "AUTHORIZED_PROCESS",
        processId: fields.processId,
        reference: fields.reference,
        outcome: fields.outcome,
        attestation: signPolicyAttestation(ORCHESTRATOR_POLICY_KEY, fields),
      }),
    ]);
    assert.equal(reserved.ok, true, reserved.message);
    assert.equal(policy.ok, true, policy.ok ? "" : policy.message);
    const booking = await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-policy-book" } });
    const evidence = await clientB.ccPolicyEvidence.findUnique({
      where: { tenantId_offeringCategory_experience: { tenantId: "tenant-a", offeringCategory: "GENERAL_GOODS", experience: "WHATSAPP_CATALOG" } },
    });
    assert.equal(booking?.state, "HELD");
    assert.equal(evidence?.reference, "cross-policy-revision");
    assert.equal(evidence?.status, "VERIFIED");
    assert.deepEqual(await rowsFor(clientB, "tenant-b"), beforeB);
  });

  it("7. credential rotation leaves an unrelated booking in place", async () => {
    const booked = await book("tenant-a", "loc-a", "provider-a", "cross-cred-book", "offer-cred");
    const connection = await storeA.connections.resolve(actor("tenant-a"), "tenant-a", "loc-a", "provider-a", "BOOKING");
    assert.equal(connection.ok, true);
    if (!connection.ok) return;
    const registered = await storeA.connections.registerCredential(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: connection.value.connectionId,
      purpose: "API",
      credentialRef: "cred_cross_api",
    });
    assert.equal(registered.ok, true, registered.ok ? "" : registered.message);
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true });
    const [rotated, reserved] = await Promise.all([
      storeB.connections.rotateCredential(actor("tenant-a"), {
        tenantId: "tenant-a",
        connectionId: connection.value.connectionId,
        purpose: "API",
        credentialRef: "cred_cross_api_2",
      }),
      reserve(command({ idempotencyKey: "cross-cred-other", offeringId: "offer-cred-other" }), harness(provider, storeA)),
    ]);
    assert.equal(rotated.ok, true, rotated.ok ? "" : rotated.message);
    assert.equal(reserved.ok, true, reserved.message);
    const active = await clientA.ccProviderCredential.findUnique({ where: { credentialRef: "cred_cross_api_2" } });
    const previous = await clientA.ccProviderCredential.findUnique({ where: { credentialRef: "cred_cross_api" } });
    assert.equal(active?.status, "ACTIVE");
    assert.equal(previous?.status, "ROTATING");
    assert.equal(await clientB.ccProviderCredential.count({ where: { ciphertext: { not: null } } }), 0);
    assert.equal((await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-cred-book" } }))?.bookingRef, booked.saved.booking?.bookingRef);
    assert.equal((await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-cred-other" } }))?.state, "HELD");
  });

  it("8. erasure at one outlet leaves the other outlet's booking", async () => {
    const booked = await book("tenant-a", "loc-a", "provider-a", "cross-erase-book", "offer-erase");
    const transactionRef = booked.saved.transaction?.transactionRef ?? "";
    const touch = await storeA.attribution.saveTouchpoint(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-a",
      transactionRef,
      intentRef: null,
      bookingRef: booked.saved.booking?.bookingRef ?? null,
      attemptRef: null,
      ctwaClid: "ctwa-cross",
    });
    assert.equal(touch.ok, true, touch.ok ? "" : touch.message);
    if (!touch.ok) return;
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true });
    const [erased, reserved] = await Promise.all([
      storeA.attribution.eraseIdentifiers(actor("tenant-a"), "tenant-a", touch.value.touchpointId, "customer request", "2026-10-26T12:00:00.000Z"),
      reserve(command({ idempotencyKey: "cross-erase-other", offeringId: "offer-erase-other", locationId: "loc-a2" }), harness(provider, storeB)),
    ]);
    assert.equal(erased.ok, true, erased.ok ? "" : erased.message);
    assert.equal(reserved.ok, true, reserved.message);
    const saved = await clientB.ccTouchpoint.findUnique({ where: { touchpointId: touch.value.touchpointId } });
    assert.equal(saved?.ctwaClid, null);
    assert.equal(saved?.erasureReason, "customer request");
    assert.equal((await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-erase-book" } }))?.state, "HELD");
    assert.equal((await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-erase-other" } }))?.locationId, "loc-a2");
  });

  it("9. a rejected second capture writes no ledger event", async () => {
    const booked = await book("tenant-a", "loc-a", "provider-a", "cross-rollback", "offer-rollback");
    const transactionRef = booked.saved.transaction?.transactionRef ?? "";
    const state = harness(booked.provider, storeA).state;
    assert.equal((await openPaymentAttempt(state, actor("tenant-a"), {
      transactionRef, attemptRef: "attempt-live", providerId: "pay-provider", expectedAmountIdr: 10000,
    })).ok, true);
    const paid = noticeFor(transactionRef, "attempt-live", "evt-live", "payment.paid", "pay-live");
    assert.equal((await recordPayment(state, actor("tenant-a"), {
      transactionRef, notice: paid, proof: proofFor(paid), connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
    }, NOW)).ok, true);
    assert.equal((await openPaymentAttempt(state, actor("tenant-a"), {
      transactionRef, attemptRef: "attempt-second", providerId: "pay-provider", expectedAmountIdr: 10000,
    })).ok, true);
    const other = noticeFor(transactionRef, "attempt-second", "evt-second", "payment.paid", "pay-second");
    const blocked = await recordPayment(harness(booked.provider, storeB).state, actor("tenant-a"), {
      transactionRef, notice: other, proof: proofFor(other), connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
    }, NOW);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, "ATTEMPT_CONFLICT");
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-a", attemptRef: "attempt-second" } }), 0);
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-a", attemptRef: "attempt-live" } }), 1);
    const transaction = await clientB.ccTransaction.findUnique({ where: { tenantId_transactionRef: { tenantId: "tenant-a", transactionRef } } });
    assert.equal(transaction?.paymentStatus, "PAID");
    assert.equal((await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-rollback" } }))?.state, "HELD");
  });

  it("10. two tenants mix booking, payment, webhook, and attribution", async () => {
    const bookedA = await book("tenant-a", "loc-a", "provider-a", "cross-mix-a", "offer-mix-a");
    const bookedB = await book("tenant-b", "loc-b", "provider-b", "cross-mix-b", "offer-mix-b");
    const transactionRef = bookedB.saved.transaction?.transactionRef ?? "";
    assert.equal((await openPaymentAttempt(harness(bookedB.provider, storeB, "tenant-b", "provider-b").state, actor("tenant-b"), {
      transactionRef, attemptRef: "attempt-mix-b", providerId: "pay-provider", expectedAmountIdr: 10000,
    })).ok, true);
    const hook = await storeB.connections.register(actor("tenant-b"), {
      tenantId: "tenant-b",
      locationId: "loc-b",
      providerId: "hook-mix",
      kind: "PAYMENT",
      mode: "MERCHANT_PAYMENT_GATEWAY",
      capabilities: {
        providerId: "hook-mix",
        supportsHold: false,
        mock: true,
        guaranteesIdempotency: false,
        absenceConsistencyRequirement: null,
        holdExpiryOwner: "NONE",
        issuesAuthoritativeReference: false,
      },
    });
    assert.equal(hook.ok, true);
    if (!hook.ok) return;
    const notice = noticeFor(transactionRef, "attempt-mix-b", "evt-mix-b", "payment.paid", "pay-mix-b", "tenant-b");
    const providerA = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true });
    const [reserved, paid, touch, accepted, aggregate] = await Promise.all([
      reserve(command({ idempotencyKey: "cross-mix-a2", offeringId: "offer-mix-a2" }), harness(providerA, storeA)),
      recordPayment(harness(bookedB.provider, storeB, "tenant-b", "provider-b").state, actor("tenant-b"), {
        transactionRef, notice, proof: proofFor(notice), connection: { tenantId: "tenant-b", providerId: "pay-provider", secret: PAY_SECRET },
      }, NOW),
      storeA.attribution.saveTouchpoint(actor("tenant-a"), {
        tenantId: "tenant-a",
        locationId: "loc-a",
        transactionRef: bookedA.saved.transaction?.transactionRef ?? "",
        intentRef: null,
        bookingRef: bookedA.saved.booking?.bookingRef ?? null,
        attemptRef: null,
        ctwaClid: "ctwa-mix",
      }),
      storeA.webhooks.accept(actor("tenant-b"), {
        tenantId: "tenant-b",
        connectionId: hook.value.connectionId,
        eventId: "evt-mix-hook",
        eventType: "payment.paid",
      }),
      storeB.attribution.saveAggregate(actor("tenant-a"), {
        tenantId: "tenant-a",
        locationId: "loc-a",
        channel: "GOOGLE_SEARCH",
        count: 4,
      }),
    ]);
    assert.equal(reserved.ok, true, reserved.message);
    assert.equal(paid.ok, true, paid.ok ? "" : paid.code);
    assert.equal(touch.ok, true, touch.ok ? "" : touch.message);
    assert.equal(accepted.ok, true, accepted.ok ? "" : accepted.message);
    assert.equal(aggregate.ok, true, aggregate.ok ? "" : aggregate.message);
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-b", attemptRef: "attempt-mix-b" } }), 1);
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-a", eventId: "evt-mix-b" } }), 0);
    assert.equal(await clientB.ccWebhookEvent.count({ where: { tenantId: "tenant-b", eventId: "evt-mix-hook" } }), 1);
    assert.equal((await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "cross-mix-a" } }))?.state, "HELD");
    assert.equal((await clientB.ccBooking.findFirst({ where: { tenantId: "tenant-b", idempotencyKey: "cross-mix-b" } }))?.state, "HELD");
    const found = await storeA.bookings.findByExternalRef(actor("tenant-a"), "tenant-a", "provider-b", bookedB.saved.booking?.providerReference ?? "missing");
    assert.equal(found.ok, false);
  });

  it("a payment write does not wait on the former global advisory lock", async () => {
    const booked = await book("tenant-a", "loc-a", "provider-a", "cross-lock", "offer-lock");
    const transactionRef = booked.saved.transaction?.transactionRef ?? "";
    assert.equal((await openPaymentAttempt(harness(booked.provider, storeA).state, actor("tenant-a"), {
      transactionRef, attemptRef: "attempt-lock", providerId: "pay-provider", expectedAmountIdr: 10000,
    })).ok, true);
    const beforeB = await rowsFor(clientB, "tenant-b");
    let locked = false;
    const globalLock = clientB.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('atlasnow-cc'), hashtext('qa'))`;
      locked = true;
      await tx.$queryRaw`SELECT pg_sleep(1.2)::text AS slept`;
    });
    while (!locked) await new Promise((resolve) => setTimeout(resolve, 10));
    const locks = await clientA.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM pg_locks
      WHERE locktype = 'advisory'
        AND classid = hashtext('atlasnow-cc')::oid
        AND objid = hashtext('qa')::oid
        AND granted
    `;
    assert.equal(Number(locks[0]?.count ?? 0), 1);
    const notice = noticeFor(transactionRef, "attempt-lock", "evt-during-lock", "payment.paid", "pay-during-lock");
    const started = Date.now();
    const paid = await recordPayment(harness(booked.provider, storeA).state, actor("tenant-a"), {
      transactionRef, notice, proof: proofFor(notice), connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
    }, NOW);
    const elapsed = Date.now() - started;
    assert.equal(paid.ok, true, paid.ok ? "" : paid.code);
    assert.ok(elapsed < 800, `payment write waited ${elapsed}ms on pg_advisory_xact_lock(atlasnow-cc, qa)`);
    await globalLock;
    assert.equal(await clientA.ccPaymentEvent.count({ where: { tenantId: "tenant-a", eventId: "evt-during-lock" } }), 1);
    assert.deepEqual(await rowsFor(clientA, "tenant-b"), beforeB);
  });
});
