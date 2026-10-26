import "dotenv/config";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { signPolicyAttestation } from "./memory-store";
import { createMockProvider, type MockProvider } from "./mock-provider";
import {
  ORCHESTRATOR_POLICY_KEY,
  createOrchestratorState,
  openPaymentAttempt,
  readBooking,
  recordPayment,
  reconcileTimedOut,
  reserve,
  type ReserveCommand,
} from "./orchestrator";
import { signPaymentProof, type RawPaymentNotice } from "./payment";
import { idrFromBigInt, idrToBigInt } from "./idr-amount";
import { openPostgresCommerceStore } from "./postgres-store";
import { createRegistry } from "./registry";
import {
  QA_DATABASE_NAME,
  createDisposableQaDatabase,
  destructiveQaDecision,
  redactDatabaseText,
  type DisposableQaDatabase,
} from "./qa-database";

const NOW = "2026-10-26T10:00:00.000Z";
const PAY_SECRET = "test-payment-connection";
const PARTIAL_INDEXES = [
  "CcBooking_live_slot",
  "CcBooking_provider_ref",
  "CcProviderConnection_scope",
  "CcProviderCredential_one_active",
  "CcPaymentLedger_provider_ref",
  "CcPaymentLedger_one_live_capture",
];
const PREEXISTING_DRIFT = [
  'DROP INDEX "LoyaltyBirthdayWaSend_tenantId_voucherCode_idx"',
  'DROP INDEX "LoyaltyRedemption_tenantId_voucherCode_idx"',
  'ALTER TABLE "BroadcastFeeConfig" ALTER COLUMN "id" SET DEFAULT \'default\'',
  'ALTER INDEX "LoyaltyRedemption_tenantId_memberPhone_kind_periodKey_tierKey_k" RENAME TO "LoyaltyRedemption_tenantId_memberPhone_kind_periodKey_tierK_key"',
];

function actor(tenantId: string, locationIds: readonly string[] | null = null) {
  return { tenantId, locationIds };
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
  const registered = registry.register({
    tenantId,
    locationId: null,
    providerId,
    mode: provider.getCapabilities().mode,
    provider,
  });
  assert.equal(registered.ok, true);
  return { registry, state: createOrchestratorState({ persistence: store }), now: NOW };
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
    child.stdout?.on("data", (chunk) => {
      log += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      log += chunk.toString();
    });
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

describe("disposable QA database guards", () => {
  it("rejects a non-loopback host, a production name, and a mismatched owner", () => {
    const base = {
      hostname: "127.0.0.1",
      databaseName: "atlasnow_cc_qa_abc12345",
      pinnedPort: 5432,
      observedPort: 5432,
      currentDatabase: "atlasnow_cc_qa_abc12345",
      applicationName: "atlasnow-cc-qa",
      markerCount: 1,
      markerToken: "token",
      expectedToken: "token",
      runId: "run",
      markerRunId: "run",
      knownNames: ["atlasnow_cc_qa_abc12345"],
    };
    assert.equal(destructiveQaDecision(base).ok, true);
    assert.equal(destructiveQaDecision({ ...base, hostname: "10.0.0.8" }).ok, false);
    assert.equal(destructiveQaDecision({ ...base, databaseName: "atlasnow", currentDatabase: "atlasnow" }).ok, false);
    assert.equal(destructiveQaDecision({ ...base, databaseName: "atlasnow_prod", currentDatabase: "atlasnow_prod" }).ok, false);
    assert.equal(destructiveQaDecision({ ...base, knownNames: [] }).ok, false);
    assert.equal(destructiveQaDecision({ ...base, currentDatabase: "atlasnow" }).ok, false);
    assert.equal(destructiveQaDecision({ ...base, observedPort: 5433 }).ok, false);
    assert.equal(destructiveQaDecision({ ...base, markerCount: 0, markerToken: null }).ok, false);
    assert.equal(destructiveQaDecision({ ...base, markerToken: "other" }).ok, false);
    assert.equal(idrToBigInt(1_000_000_000), BigInt(1_000_000_000));
    assert.throws(() => idrToBigInt(1_000_000_001));
    assert.throws(() => idrToBigInt(10.5));
    const unsafe = BigInt("9007199254740992");
    assert.throws(() => idrFromBigInt(unsafe));
    assert.equal(Number.isSafeInteger(Number(unsafe)), false);
  });
});

describe("PostgreSQL conversational persistence", () => {
  let qa: DisposableQaDatabase;
  let client: PrismaClient;
  let store: Awaited<ReturnType<typeof openPostgresCommerceStore>>;
  let sourceMigrations = 0;

  before(async () => {
    sourceMigrations = await sourceMigrationCount();
    qa = await createDisposableQaDatabase();
    await migrate(qa.databaseUrl);
    await qa.installOwnerMarker();
    client = new PrismaClient({ datasources: { db: { url: qa.databaseUrl } } });
    await qa.assertIdentity(client);
    for (const row of [
      ["tenant-a", "loc-a"],
      ["tenant-b", "loc-b"],
      ["tenant-c", "loc-c"],
    ] as const) {
      await client.tenant.create({ data: { id: row[0], name: row[0], slug: row[0] } });
      await client.location.create({
        data: { id: row[1], atlasLocationId: `${row[0]}-${row[1]}`, tenantId: row[0], name: row[1] },
      });
    }
    await client.location.create({
      data: { id: "loc-a2", atlasLocationId: "tenant-a-loc-a2", tenantId: "tenant-a", name: "loc-a2" },
    });
    store = await openPostgresCommerceStore({ client, qa, policyValidatorKey: ORCHESTRATOR_POLICY_KEY });
    await allowGoods(store, "tenant-a");
    await allowGoods(store, "tenant-b");
  });

  after(async () => {
    await client?.$disconnect();
    if (qa) await qa.drop();
    assert.equal(await sourceMigrationCount(), sourceMigrations);
  });

  it("lets one claim win and keeps the other as a replay", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true });
    const left = harness(provider, store);
    const right = harness(provider, store);
    const input = command({ idempotencyKey: "race-1", offeringId: "offer-race" });
    const [first, second] = await Promise.all([
      reserve(input, left),
      reserve(input, right),
    ]);
    const results = [first, second];
    const summary = results.map((row) => `${row.ok}:${row.replay}:${row.code}:${row.resolutionRequired}`).join(" | ");
    const winners = results.filter((row) => row.ok && row.replay === false);
    const losers = results.filter((row) => row.replay && row !== winners[0]);
    assert.equal(winners.length, 1, summary);
    assert.equal(losers.length, 1, summary);
    assert.equal(losers[0]?.ok === true || losers[0]?.resolutionRequired === true, true, summary);
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, 1, summary);
    const snap = await store.exportSnapshot();
    assert.equal(snap.bookings.filter((row) => row.idempotencyKey === "race-1").length, 1);
    const clash = await reserve(command({ idempotencyKey: "race-1", offeringId: "offer-other" }), harness(provider, store));
    assert.equal(clash.code, "IDEMPOTENCY_CONFLICT");
    assert.equal((await store.exportSnapshot()).bookings.filter((row) => row.idempotencyKey === "race-1").length, 1);
  });

  it("holds one live slot per provider and allows another provider the same key", async () => {
    const providerA = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true });
    const providerB = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-b", mode: "NATIVE", supportsHold: true });
    const slot = { offeringId: "offer-shared-slot", startsAt: "2026-11-02T09:00:00.000Z" };
    const first = await reserve(command({ ...slot, idempotencyKey: "slot-a", providerId: "provider-a" }), harness(providerA, store));
    const second = await reserve(command({ ...slot, idempotencyKey: "slot-b", providerId: "provider-a" }), harness(providerA, store));
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.code, "CONFLICT");
    const other = await reserve(command({ ...slot, idempotencyKey: "slot-c", providerId: "provider-b" }), harness(providerB, store, "tenant-a", "provider-b"));
    assert.equal(other.ok, true, other.message);
    const snap = await store.exportSnapshot();
    const held = snap.bookings.filter((row) => row.slotKey.endsWith("offer-shared-slot:2026-11-02T09:00:00.000Z") && (row.state === "HELD" || row.state === "CONFIRMED"));
    assert.equal(held.length, 2);
    assert.deepEqual(held.map((row) => row.providerId).sort(), ["provider-a", "provider-b"]);
  });

  it("keeps uncertain provider outcomes pending and adopts one booking on the original transaction", async () => {
    const retryable = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true, commitThen: "RETRYABLE" });
    const retry = await reserve(command({ idempotencyKey: "retryable-1", offeringId: "offer-retry" }), harness(retryable, store));
    assert.equal(retry.ok, false);
    assert.equal(retry.resolutionRequired, true);
    let snap = await store.exportSnapshot();
    assert.equal(snap.transactions.find((row) => row.tenantId === "tenant-a" && row.transactionRef === retry.transaction?.transactionRef)?.state, "PENDING_RESOLUTION");
    assert.equal(snap.bookings.some((row) => row.idempotencyKey === "retryable-1"), false);
    assert.equal(snap.inflight.some((row) => row.idempotencyKey === "retryable-1"), true);

    const unavailable = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true, commitThen: "UNAVAILABLE" });
    const down = await reserve(command({ idempotencyKey: "unavailable-1", offeringId: "offer-down" }), harness(unavailable, store));
    assert.equal(down.resolutionRequired, true);
    assert.equal((await store.exportSnapshot()).bookings.some((row) => row.idempotencyKey === "unavailable-1"), false);

    const blank = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-blank", mode: "EXTERNAL_API", commitThen: "INCOMPLETE_REFERENCE" });
    const missing = await reserve(command({ idempotencyKey: "blank-ref", offeringId: "offer-blank", providerId: "provider-blank" }), harness(blank, store, "tenant-a", "provider-blank"));
    assert.equal(missing.resolutionRequired, true);
    assert.equal((await store.exportSnapshot()).bookings.some((row) => row.idempotencyKey === "blank-ref"), false);

    const callsBefore = retryable.calls.length;
    await client.$disconnect();
    const revived = new PrismaClient({ datasources: { db: { url: qa.databaseUrl } } });
    const revivedStore = await openPostgresCommerceStore({ client: revived, qa, policyValidatorKey: ORCHESTRATOR_POLICY_KEY });
    snap = await revivedStore.exportSnapshot();
    assert.equal(snap.inflight.some((row) => row.idempotencyKey === "retryable-1"), true);
    const replay = await reserve(command({ idempotencyKey: "retryable-1", offeringId: "offer-retry" }), harness(retryable, revivedStore));
    assert.equal(replay.replay, true);
    assert.equal(retryable.calls.length, callsBefore);
    const recovered = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-a", providerId: "provider-a", idempotencyKey: "retryable-1" },
      harness(retryable, revivedStore),
    );
    assert.equal(recovered.ok, true, recovered.message);
    const again = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-a", providerId: "provider-a", idempotencyKey: "retryable-1" },
      harness(retryable, revivedStore),
    );
    assert.equal(again.ok, true);
    assert.equal(again.replay, true);
    snap = await revivedStore.exportSnapshot();
    const adopted = snap.bookings.filter((row) => row.idempotencyKey === "retryable-1");
    assert.equal(adopted.length, 1);
    assert.equal(adopted[0]?.transactionRef, retry.transaction?.transactionRef);
    await revived.$disconnect();
    client = new PrismaClient({ datasources: { db: { url: qa.databaseUrl } } });
    store = await openPostgresCommerceStore({ client, qa, policyValidatorKey: ORCHESTRATOR_POLICY_KEY });
  });

  it("closes a definitive no-commit without a transaction reference", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "NATIVE",
      supportsHold: true,
      unavailableOn: ["holdReservation"],
    });
    const denied = await reserve(command({ idempotencyKey: "no-commit-1", offeringId: "offer-nocommit" }), harness(provider, store));
    assert.equal(denied.ok, false);
    assert.equal(denied.resolutionRequired, false);
    const snap = await store.exportSnapshot();
    const row = snap.idempotency.find((item) => item.idempotencyKey === "no-commit-1");
    assert.equal(row?.status, "COMPLETED");
    assert.equal(row?.transactionRef, null);
    assert.equal(snap.inflight.some((item) => item.idempotencyKey === "no-commit-1"), false);
    const stored = await client.ccIdempotency.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "no-commit-1" } });
    assert.equal(stored?.transactionRef, null);
  });

  it("isolates tenants, rejects a foreign location, and rejects a location that disagrees with the transaction", async () => {
    const providerA = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true });
    const providerB = createMockProvider({ boundTenantId: "tenant-b", providerId: "provider-b", mode: "NATIVE", supportsHold: true });
    const left = await reserve(command({ idempotencyKey: "same-ref", offeringId: "offer-tenant" }), harness(providerA, store));
    const right = await reserve(
      command({ actor: actor("tenant-b"), tenantId: "tenant-b", locationId: "loc-b", providerId: "provider-b", idempotencyKey: "same-ref", offeringId: "offer-tenant" }),
      harness(providerB, store, "tenant-b", "provider-b"),
    );
    assert.equal(left.ok, true, left.message);
    assert.equal(right.ok, true, right.message);
    await client.ccBooking.update({
      where: { tenantId_bookingRef: { tenantId: "tenant-a", bookingRef: left.booking?.bookingRef ?? "" } },
      data: { bookingRef: "BK-SAME" },
    }).catch(() => undefined);
    await client.$executeRaw`
      UPDATE "CcBooking" SET "bookingRef" = 'BK-SAME' WHERE "tenantId" = 'tenant-a' AND "idempotencyKey" = 'same-ref'
    `;
    await client.$executeRaw`
      UPDATE "CcBooking" SET "bookingRef" = 'BK-SAME' WHERE "tenantId" = 'tenant-b' AND "idempotencyKey" = 'same-ref'
    `;
    const readA = await readBooking(createOrchestratorState({ persistence: store }), actor("tenant-a"), "BK-SAME");
    const readB = await readBooking(createOrchestratorState({ persistence: store }), actor("tenant-b"), "BK-SAME");
    const hidden = await readBooking(createOrchestratorState({ persistence: store }), actor("tenant-c"), "BK-SAME");
    assert.equal(readA.ok, true);
    assert.equal(readB.ok, true);
    assert.equal(hidden.ok, false);
    if (!hidden.ok) assert.equal(hidden.code, "CROSS_TENANT");
    const wrongOutlet = await reserve(command({ actor: actor("tenant-a", ["loc-b"]), idempotencyKey: "wrong-outlet", offeringId: "offer-outlet" }), harness(providerA, store));
    assert.equal(wrongOutlet.code, "LOCATION_FORBIDDEN");

    await assert.rejects(() => client.ccTransaction.create({
      data: {
        tenantId: "tenant-a",
        transactionRef: "CTX-FOREIGN-LOC",
        locationId: "loc-b",
        providerId: "provider-a",
        state: "PENDING_RESOLUTION",
        paymentStatus: "NOT_STARTED",
        verifiedPaid: false,
        version: 1,
      },
    }));
    const txn = left.transaction?.transactionRef ?? "";
    await assert.rejects(() => client.$executeRaw`
      INSERT INTO "CcBooking" (
        "tenantId", "bookingRef", "locationId", "transactionRef", "providerId", "providerMode", "slotKey", "state",
        "providerReference", "referenceAuthoritative", "idempotencyKey", "holdExpiryOwner", "version"
      ) VALUES (
        'tenant-a', 'BK-MISMATCH', 'loc-a2', ${txn}, 'provider-a', 'NATIVE', 'mismatch-slot', 'HELD',
        NULL, false, 'mismatch-key', 'PROVIDER', 1
      )
    `);
    const sameLocation = await client.$executeRaw`
      INSERT INTO "CcPaymentAttempt" (
        "tenantId", "attemptRef", "locationId", "transactionRef", "providerId", "providerMode", "expectedAmountIdr", "currency", "version"
      ) VALUES (
        'tenant-a', 'attempt-location-ok', 'loc-a', ${txn}, 'pay-provider', 'MERCHANT_PAYMENT_GATEWAY', 10000, 'IDR', 1
      )
    `;
    assert.equal(Number(sameLocation), 1);
    await client.ccPaymentAttempt.delete({ where: { tenantId_attemptRef: { tenantId: "tenant-a", attemptRef: "attempt-location-ok" } } });
  });

  it("dedupes payment events, rejects a second live capture, and leaves the booking unchanged", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE", supportsHold: true });
    const booked = await reserve(command({ idempotencyKey: "pay-1", offeringId: "offer-pay" }), harness(provider, store));
    assert.equal(booked.ok, true, booked.message);
    const transactionRef = booked.transaction?.transactionRef ?? "";
    const state = createOrchestratorState({ persistence: store });
    const opened = await openPaymentAttempt(state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-pay-1",
      providerId: "pay-provider",
      expectedAmountIdr: 10000,
    });
    assert.equal(opened.ok, true);
    const notice: RawPaymentNotice = {
      eventId: "pay-event-1",
      type: "payment.paid",
      evidence: "VERIFIED_PROVIDER_EVENT",
      amountIdr: 10000,
      currency: "IDR",
      occurredAt: NOW,
      providerReference: "pay-ref-1",
      sequence: 1,
      tenantId: "tenant-a",
      providerId: "pay-provider",
      attemptRef: "attempt-pay-1",
      transactionRef,
    };
    const paid = await recordPayment(state, actor("tenant-a"), {
      transactionRef,
      notice,
      proof: proofFor(notice),
      connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
    }, NOW);
    assert.equal(paid.ok, true);
    const duplicate = await recordPayment(state, actor("tenant-a"), {
      transactionRef,
      notice,
      proof: proofFor(notice),
      connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
    }, NOW);
    assert.equal(duplicate.ok, true);
    if (duplicate.ok) assert.equal(duplicate.effect, "duplicate");
    const snap = await store.exportSnapshot();
    assert.equal(snap.ledgerEvents.filter((row) => row.attemptRef === "attempt-pay-1").length, 1);
    assert.equal(snap.bookings.find((row) => row.idempotencyKey === "pay-1")?.state, "HELD");
    const second = await openPaymentAttempt(state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-pay-2",
      providerId: "pay-provider",
      expectedAmountIdr: 10000,
    });
    assert.equal(second.ok, true);
    const otherNotice = { ...notice, eventId: "pay-event-2", attemptRef: "attempt-pay-2", providerReference: "pay-ref-2" };
    const blocked = await recordPayment(state, actor("tenant-a"), {
      transactionRef,
      notice: otherNotice,
      proof: proofFor(otherNotice),
      connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
    }, NOW);
    assert.equal(blocked.ok, false);
    const refundNotice = { ...notice, eventId: "pay-refund-1", type: "payment.refunded" as const };
    const refunded = await recordPayment(state, actor("tenant-a"), {
      transactionRef,
      notice: refundNotice,
      proof: proofFor(refundNotice),
      connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
    }, NOW);
    assert.equal(refunded.ok, true);
    const chargeNotice = { ...notice, eventId: "pay-cb-1", type: "payment.chargeback" as const, providerReference: "pay-ref-1" };
    await recordPayment(state, actor("tenant-a"), {
      transactionRef,
      notice: chargeNotice,
      proof: proofFor(chargeNotice),
      connection: { tenantId: "tenant-a", providerId: "pay-provider", secret: PAY_SECRET },
    }, NOW);
    assert.equal((await store.exportSnapshot()).bookings.find((row) => row.idempotencyKey === "pay-1")?.state, "HELD");
    const overflow = await openPaymentAttempt(state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-overflow",
      providerId: "pay-provider",
      expectedAmountIdr: 1_000_000_001,
    });
    assert.equal(overflow.ok, false);
    const fraction = await openPaymentAttempt(state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-fraction",
      providerId: "pay-provider",
      expectedAmountIdr: 10.5,
    });
    assert.equal(fraction.ok, false);
  });

  it("does not coerce a BIGINT above the safe integer range", async () => {
    await client.$executeRaw`ALTER TABLE "CcPaymentEvent" DROP CONSTRAINT "CcPaymentEvent_amount_safe"`;
    await client.$executeRaw`
      INSERT INTO "CcPaymentAttempt" (
        "tenantId", "attemptRef", "locationId", "transactionRef", "providerId", "providerMode", "expectedAmountIdr", "currency", "version"
      )
      SELECT "tenantId", 'attempt-unsafe', "locationId", "transactionRef", 'pay-provider', 'MERCHANT_PAYMENT_GATEWAY', 10000, 'IDR', 1
      FROM "CcTransaction" WHERE "tenantId" = 'tenant-a' LIMIT 1
    `;
    await client.$executeRaw`
      INSERT INTO "CcPaymentEvent" (
        "tenantId", "attemptRef", "eventId", "type", "amountIdr", "providerReference", "occurredAt"
      ) VALUES (
        'tenant-a', 'attempt-unsafe', 'unsafe-event', 'payment.paid', 9007199254740992, 'unsafe-ref', ${new Date(NOW)}
      )
    `;
    await assert.rejects(async () => {
      await store.exportSnapshot();
    });
    await client.ccPaymentEvent.delete({ where: { tenantId_attemptRef_eventId: { tenantId: "tenant-a", attemptRef: "attempt-unsafe", eventId: "unsafe-event" } } });
    await client.ccPaymentAttempt.delete({ where: { tenantId_attemptRef: { tenantId: "tenant-a", attemptRef: "attempt-unsafe" } } });
    await client.$executeRaw`
      ALTER TABLE "CcPaymentEvent" ADD CONSTRAINT "CcPaymentEvent_amount_safe"
      CHECK ("amountIdr" >= 0 AND "amountIdr" <= 9007199254740991)
    `;
  });

  it("dedupes webhook event ids per connection and rejects credential bytes", async () => {
    const first = await store.connections.register(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-a",
      providerId: "hook-a",
      kind: "PAYMENT",
      mode: "MERCHANT_PAYMENT_GATEWAY",
      capabilities: {
        providerId: "hook-a",
        supportsHold: false,
        mock: true,
        guaranteesIdempotency: false,
        absenceConsistencyRequirement: null,
        holdExpiryOwner: "NONE",
        issuesAuthoritativeReference: false,
      },
    });
    const second = await store.connections.register(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-a",
      providerId: "hook-b",
      kind: "PAYMENT",
      mode: "MERCHANT_PAYMENT_GATEWAY",
      capabilities: {
        providerId: "hook-b",
        supportsHold: false,
        mock: true,
        guaranteesIdempotency: false,
        absenceConsistencyRequirement: null,
        holdExpiryOwner: "NONE",
        issuesAuthoritativeReference: false,
      },
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    const left = await store.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", connectionId: first.value.connectionId, eventId: "evt-same", eventType: "payment.paid" });
    const right = await store.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", connectionId: second.value.connectionId, eventId: "evt-same", eventType: "payment.paid" });
    assert.equal(left.ok && right.ok, true);
    const hooks = (await store.exportSnapshot()).webhooks.filter((row) => row.eventId === "evt-same");
    assert.equal(hooks.length, 2);
    const secret = await store.connections.registerCredential(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: first.value.connectionId,
      purpose: "API",
      credentialRef: "cred_visible",
      plaintext: "super-secret",
    });
    assert.equal(secret.ok, false);
    if (!secret.ok) assert.equal(secret.code, "SECRET_REJECTED");
    const cipher = await store.connections.registerCredential(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: first.value.connectionId,
      purpose: "API",
      credentialRef: "cred_cipher",
      ciphertext: "cipher-text",
    });
    assert.equal(cipher.ok, false);
    if (!cipher.ok) assert.equal(cipher.code, "SECRET_REJECTED");
    assert.equal(await client.commerceProduct.count(), 0);
  });

  it("rolls back a connection registered inside an atomic write that does not succeed", async () => {
    const counts = async (db: PrismaClient) => ({
      connections: await db.ccProviderConnection.count(),
      intents: await db.ccIntent.count(),
      transactions: await db.ccTransaction.count(),
      bookings: await db.ccBooking.count(),
      idempotency: await db.ccIdempotency.count(),
      inflight: await db.ccInflight.count(),
      events: await db.ccTransactionEvent.count(),
      attempts: await db.ccPaymentAttempt.count(),
      ledgers: await db.ccPaymentLedger.count(),
      paymentEvents: await db.ccPaymentEvent.count(),
      credentials: await db.ccProviderCredential.count(),
      webhooks: await db.ccWebhookEvent.count(),
      externalRefs: await db.ccExternalRef.count(),
      touchpoints: await db.ccTouchpoint.count(),
      aggregates: await db.ccAttributionAggregate.count(),
      policy: await db.ccPolicyEvidence.count(),
    });
    const inspect = async () => {
      const probe = new PrismaClient({ datasources: { db: { url: qa.databaseUrl } } });
      try {
        await qa.assertIdentity(probe);
        return counts(probe);
      } finally {
        await probe.$disconnect();
      }
    };
    const connectionInput = (providerId: string) => ({
      tenantId: "tenant-a",
      locationId: "loc-a" as string | null,
      providerId,
      kind: "BOOKING" as const,
      mode: "NATIVE" as const,
      capabilities: {
        providerId,
        supportsHold: true,
        mock: true,
        guaranteesIdempotency: false,
        absenceConsistencyRequirement: null,
        holdExpiryOwner: "NONE" as const,
        issuesAuthoritativeReference: false,
      },
    });
    const intentInput = (intentRef: string) => ({
      intentRef,
      tenantId: "tenant-a",
      locationId: "loc-a" as string | null,
      experience: "WHATSAPP_CATALOG" as const,
      intentType: "BOOKING_REQUEST" as const,
      qualified: false,
      customerRef: null,
      commerceOrderRef: null,
    });

    const beforeFailure = await inspect();
    const failed = await store.runAtomic(async (ports) => {
      const registered = await ports.connections.register(actor("tenant-a"), connectionInput("atomic-fail-provider"));
      if (!registered.ok) return registered;
      const saved = await ports.intents.save(actor("tenant-a"), intentInput("intent-atomic-fail"));
      if (!saved.ok) return saved;
      return ports.transactions.compareAndSwap(actor("tenant-a"), {
        tenantId: "tenant-a",
        transactionRef: "tx-atomic-fail-missing",
        expectedVersion: 1,
      });
    });
    assert.equal(failed.ok, false);
    if (failed.ok) return;
    assert.equal(failed.code, "NOT_FOUND");
    assert.equal(failed.message, "Transaction not found.");
    assert.deepEqual(await inspect(), beforeFailure);
    assert.equal(await client.ccProviderConnection.count({ where: { providerId: "atomic-fail-provider" } }), 0);

    const beforeThrow = await inspect();
    await assert.rejects(
      () => store.runAtomic(async (ports) => {
        const registered = await ports.connections.register(actor("tenant-a"), connectionInput("atomic-throw-provider"));
        if (!registered.ok) return registered;
        const saved = await ports.intents.save(actor("tenant-a"), intentInput("intent-atomic-throw"));
        if (!saved.ok) return saved;
        throw new Error("atomic-rollback-probe");
      }),
      /atomic-rollback-probe/,
    );
    assert.deepEqual(await inspect(), beforeThrow);
    assert.equal(await client.ccProviderConnection.count({ where: { providerId: "atomic-throw-provider" } }), 0);

    const committed = await store.runAtomic(async (ports) => {
      const registered = await ports.connections.register(actor("tenant-a"), connectionInput("atomic-ok-provider"));
      if (!registered.ok) return registered;
      return ports.intents.save(actor("tenant-a"), intentInput("intent-atomic-ok"));
    });
    assert.equal(committed.ok, true, committed.ok ? "" : committed.message);
    const after = await inspect();
    assert.equal(after.connections, beforeThrow.connections + 1);
    assert.equal(after.intents, beforeThrow.intents + 1);
    assert.equal(after.transactions, beforeThrow.transactions);
    const probe = new PrismaClient({ datasources: { db: { url: qa.databaseUrl } } });
    try {
      await qa.assertIdentity(probe);
      const connection = await probe.ccProviderConnection.findFirst({ where: { tenantId: "tenant-a", providerId: "atomic-ok-provider" } });
      const intent = await probe.ccIntent.findFirst({ where: { tenantId: "tenant-a", intentRef: "intent-atomic-ok" } });
      assert.equal(connection?.kind, "BOOKING");
      assert.equal(intent?.intentType, "BOOKING_REQUEST");
    } finally {
      await probe.$disconnect();
    }
  });

  it("keeps the reviewed partial indexes and rejects unrelated schema drift", async () => {
    const indexes = await client.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname IN (
        'CcBooking_live_slot', 'CcBooking_provider_ref', 'CcProviderConnection_scope',
        'CcProviderCredential_one_active', 'CcPaymentLedger_provider_ref', 'CcPaymentLedger_one_live_capture'
      )
    `;
    assert.equal(indexes.length, PARTIAL_INDEXES.length);
    const live = indexes.find((row) => row.indexname === "CcBooking_live_slot");
    assert.match(live?.indexdef ?? "", /providerId/);
    assert.match(live?.indexdef ?? "", /HELD/);
    const migrations = path.join(process.cwd(), "prisma/migrations");
    for (const folder of readdirSync(migrations)) {
      const file = path.join(migrations, folder, "migration.sql");
      if (!statSync(path.join(migrations, folder)).isDirectory()) continue;
      const sql = readFileSync(file, "utf8");
      for (const name of PARTIAL_INDEXES) assert.equal(sql.includes(`DROP INDEX "${name}"`), false, folder);
    }
    const diff = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [
        path.join(process.cwd(), "node_modules/prisma/build/index.js"),
        "migrate",
        "diff",
        "--from-url",
        qa.databaseUrl,
        "--to-schema-datamodel",
        "prisma/schema.prisma",
        "--script",
      ], { env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" } });
      let text = "";
      child.stdout?.on("data", (chunk) => {
        text += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        text += chunk.toString();
      });
      child.on("exit", (code) => {
        if (code === 0) resolve(text);
        else reject(new Error(redactDatabaseText(text).slice(-1500)));
      });
    });
    const statements = diff.split(";").map((part) => part.replace(/--[^\n]*/g, "").trim()).filter(Boolean);
    const allowed = (statement: string) => {
      if (PREEXISTING_DRIFT.some((line) => statement.replace(/\s+/g, " ").includes(line.replace(/\s+/g, " ")))) return true;
      if (/^DROP INDEX "(CcBooking_live_slot|CcBooking_provider_ref|CcProviderConnection_scope|CcProviderCredential_one_active|CcPaymentLedger_provider_ref|CcPaymentLedger_one_live_capture)"/.test(statement)) return true;
      if (/^DROP TRIGGER "(CcBooking_location_match|CcPaymentAttempt_location_match|CcInflight_location_match)"/.test(statement)) return true;
      if (/^DROP FUNCTION "cc_assert_same_location"/.test(statement)) return true;
      if (/^ALTER TABLE "Cc(PaymentAttempt|PaymentLedger|PaymentEvent)" DROP CONSTRAINT "Cc(PaymentAttempt|PaymentLedger|PaymentEvent)_(amount_safe|currency_idr)"/.test(statement)) return true;
      if (statement.replace(/\s+/g, " ") === 'DROP TABLE "cc_qa_owner"') return true;
      return false;
    };
    const unexpected = statements.filter((statement) => !allowed(statement));
    assert.deepEqual(unexpected, []);
    const persistenceSql = readFileSync(path.join(migrations, "20261026140000_cc_persistence", "migration.sql"), "utf8");
    for (const name of PARTIAL_INDEXES) {
      assert.match(persistenceSql, new RegExp(`CREATE UNIQUE INDEX "${name}"`));
      assert.equal(statements.some((statement) => statement.includes(`DROP INDEX "${name}"`) && !allowed(statement)), false, name);
    }
  });
});
