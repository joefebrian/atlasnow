/**
 * Two independent Prisma clients against one disposable QA database.
 * These tests are the concurrency evidence. settleConcurrent() is not.
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
  reconcileTimedOut,
  reserve,
  type ReserveCommand,
} from "./orchestrator";
import { openPostgresCommerceStore } from "./postgres-store";
import { createRegistry } from "./registry";
import {
  QA_DATABASE_NAME,
  createDisposableQaDatabase,
  redactDatabaseText,
  type DisposableQaDatabase,
} from "./qa-database";

const NOW = "2026-10-26T10:00:00.000Z";

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

function harness(
  provider: MockProvider,
  store: Awaited<ReturnType<typeof openPostgresCommerceStore>>,
  tenantId = "tenant-a",
  providerId = "provider-a",
) {
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

function providerFor(tenantId: string, providerId = "provider-a") {
  return createMockProvider({ boundTenantId: tenantId, providerId, mode: "NATIVE", supportsHold: true });
}

async function liveCount(client: PrismaClient, tenantId: string, slotKey: string) {
  const rows = await client.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM "CcBooking"
    WHERE "tenantId" = ${tenantId} AND "slotKey" = ${slotKey} AND "state" IN ('HELD', 'CONFIRMED')
  `;
  return Number(rows[0]?.count ?? 0);
}

describe("PostgreSQL booking workers", () => {
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
    for (const row of [
      ["tenant-a", "loc-a"],
      ["tenant-b", "loc-b"],
    ] as const) {
      await clientA.tenant.create({ data: { id: row[0], name: row[0], slug: row[0] } });
      await clientA.location.create({
        data: { id: row[1], atlasLocationId: `${row[0]}-${row[1]}`, tenantId: row[0], name: row[1] },
      });
    }
    await clientA.location.create({
      data: { id: "loc-a2", atlasLocationId: "tenant-a-loc-a2", tenantId: "tenant-a", name: "loc-a2" },
    });
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

  it("1. one of two workers wins the same tenant and idempotency key", async () => {
    const provider = providerFor("tenant-a");
    const input = command({ idempotencyKey: "workers-same-key", offeringId: "offer-same-key" });
    const [first, second] = await Promise.all([
      reserve(input, harness(provider, storeA)),
      reserve(input, harness(provider, storeB)),
    ]);
    const results = [first, second];
    const summary = results.map((row) => `${row.ok}:${row.replay}:${row.code}:${row.resolutionRequired}`).join(" | ");
    const winners = results.filter((row) => row.ok && row.replay === false);
    assert.equal(winners.length, 1, summary);
    assert.equal(results.filter((row) => row.replay).length, 1, summary);
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, 1, summary);
    const slotKey = "tenant-a:loc-a:offer-same-key:2026-11-01T09:00:00.000Z";
    assert.equal(await liveCount(clientA, "tenant-a", slotKey), 1);
    const clash = await reserve(command({ idempotencyKey: "workers-same-key", offeringId: "offer-other-hash" }), harness(provider, storeB));
    assert.equal(clash.code, "IDEMPOTENCY_CONFLICT");
    assert.equal(await liveCount(clientB, "tenant-a", slotKey), 1);
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, 1);
  });

  it("consumes an authoritative absence on exactly one worker", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "NATIVE",
      supportsHold: true,
      timeoutOn: ["holdReservation"],
    });
    const input = command({ idempotencyKey: "workers-absence", offeringId: "offer-absence" });
    const first = await reserve(input, harness(provider, storeA));
    assert.equal(first.resolutionRequired, true);
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, 1);
    const noted = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-a", providerId: "provider-a", idempotencyKey: "workers-absence" },
      harness(provider, storeA),
    );
    assert.equal(noted.resolutionRequired, true, noted.message);
    const holdsBefore = provider.calls.filter((call) => call === "holdReservation").length;
    const [left, right] = await Promise.all([
      reserve(input, harness(provider, storeA)),
      reserve(input, harness(provider, storeB)),
    ]);
    const summary = [left, right].map((row) => `${row.ok}:${row.replay}:${row.code}`).join(" | ");
    assert.equal([left, right].filter((row) => row.replay === false).length, 1, summary);
    assert.equal([left, right].filter((row) => row.replay === true).length, 1, summary);
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, holdsBefore + 1, summary);
    assert.equal(await liveCount(clientA, "tenant-a", "tenant-a:loc-a:offer-absence:2026-11-01T09:00:00.000Z"), 0);
  });

  it("2. two tenants reserve concurrently", async () => {
    const providerA = providerFor("tenant-a");
    const providerB = providerFor("tenant-b", "provider-b");
    const [left, right] = await Promise.all([
      reserve(command({ idempotencyKey: "workers-tenant-a", offeringId: "offer-tenant-a" }), harness(providerA, storeA)),
      reserve(
        command({
          actor: actor("tenant-b"),
          tenantId: "tenant-b",
          locationId: "loc-b",
          providerId: "provider-b",
          idempotencyKey: "workers-tenant-b",
          offeringId: "offer-tenant-b",
        }),
        harness(providerB, storeB, "tenant-b", "provider-b"),
      ),
    ]);
    assert.equal(left.ok, true, left.message);
    assert.equal(right.ok, true, right.message);
    const listed = await storeA.bookings.list(actor("tenant-a"), "tenant-a", "loc-a");
    assert.equal(listed.ok, true);
    if (listed.ok) assert.equal(listed.value.some((row) => row.tenantId !== "tenant-a"), false);
    const foreign = await storeB.bookings.findByExternalRef(actor("tenant-b"), "tenant-b", "provider-a", left.booking?.providerReference ?? "missing");
    assert.equal(foreign.ok, false);
    assert.equal(await liveCount(clientA, "tenant-a", "tenant-a:loc-a:offer-tenant-a:2026-11-01T09:00:00.000Z"), 1);
    assert.equal(await liveCount(clientB, "tenant-b", "tenant-b:loc-b:offer-tenant-b:2026-11-01T09:00:00.000Z"), 1);
  });

  it("3. one tenant reserves two outlets concurrently", async () => {
    const provider = providerFor("tenant-a");
    const [first, second] = await Promise.all([
      reserve(command({ idempotencyKey: "workers-outlet-a", offeringId: "offer-outlet-a", locationId: "loc-a" }), harness(provider, storeA)),
      reserve(command({ idempotencyKey: "workers-outlet-a2", offeringId: "offer-outlet-a2", locationId: "loc-a2" }), harness(provider, storeB)),
    ]);
    assert.equal(first.ok, true, first.message);
    assert.equal(second.ok, true, second.message);
    assert.equal(first.booking?.locationId, "loc-a");
    assert.equal(second.booking?.locationId, "loc-a2");
    const rows = await clientA.ccBooking.findMany({
      where: { tenantId: "tenant-a", idempotencyKey: { in: ["workers-outlet-a", "workers-outlet-a2"] } },
    });
    assert.deepEqual(rows.map((row) => row.locationId).sort(), ["loc-a", "loc-a2"]);
  });

  it("4. one live slot remains when two keys race", async () => {
    const providerA = providerFor("tenant-a");
    const providerB = providerFor("tenant-a");
    const slot = { offeringId: "offer-workers-slot", startsAt: "2026-12-01T09:00:00.000Z" };
    const [first, second] = await Promise.all([
      reserve(command({ ...slot, idempotencyKey: "workers-slot-1" }), harness(providerA, storeA)),
      reserve(command({ ...slot, idempotencyKey: "workers-slot-2" }), harness(providerB, storeB)),
    ]);
    const results = [first, second];
    const summary = results.map((row) => `${row.ok}:${row.code}:${row.message}`).join(" | ");
    assert.equal(results.filter((row) => row.ok).length, 1, summary);
    const slotKey = "tenant-a:loc-a:offer-workers-slot:2026-12-01T09:00:00.000Z";
    assert.equal(await liveCount(clientA, "tenant-a", slotKey), 1, summary);
  });

  it("5. a provider commit before the local write stays recoverable", async () => {
    const provider = providerFor("tenant-a");
    const input = command({ idempotencyKey: "workers-local-fail", offeringId: "offer-local-fail" });
    await assert.rejects(() => reserve(input, { ...harness(provider, storeA), crash: { beforePersist() { throw new Error("local write did not start"); } } }));
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, 1);
    assert.equal(await liveCount(clientA, "tenant-a", "tenant-a:loc-a:offer-local-fail:2026-11-01T09:00:00.000Z"), 0);
    const snap = await storeB.exportSnapshot();
    assert.equal(snap.inflight.some((row) => row.idempotencyKey === "workers-local-fail"), true);
    const recovered = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-a", providerId: "provider-a", idempotencyKey: "workers-local-fail" },
      harness(provider, storeB),
    );
    assert.equal(recovered.ok, true, recovered.message);
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, 1);
    assert.equal(await liveCount(clientA, "tenant-a", "tenant-a:loc-a:offer-local-fail:2026-11-01T09:00:00.000Z"), 1);
  });

  it("6. a crash after claim does not call the provider again", async () => {
    const provider = providerFor("tenant-a");
    const input = command({ idempotencyKey: "workers-after-claim", offeringId: "offer-after-claim" });
    await assert.rejects(() => reserve(input, { ...harness(provider, storeA), crash: { afterClaim() { throw new Error("crash after claim"); } } }));
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, 0);
    const snap = await storeA.exportSnapshot();
    assert.equal(snap.inflight.some((row) => row.idempotencyKey === "workers-after-claim"), true);
    assert.equal(snap.bookings.some((row) => row.idempotencyKey === "workers-after-claim"), false);
    const replay = await reserve(input, harness(provider, storeB));
    assert.equal(replay.replay, true);
    assert.equal(replay.resolutionRequired, true);
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, 0);
  });

  it("7. a new client sees an unresolved reservation", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "NATIVE",
      supportsHold: true,
      commitThen: "RETRYABLE",
    });
    const input = command({ idempotencyKey: "workers-restart", offeringId: "offer-restart" });
    const pending = await reserve(input, harness(provider, storeA));
    assert.equal(pending.resolutionRequired, true);
    const callsBefore = provider.calls.length;
    await clientB.$disconnect();
    clientB = new PrismaClient({ datasources: { db: { url: qa.databaseUrl } } });
    storeB = await openPostgresCommerceStore({ client: clientB, qa, policyValidatorKey: ORCHESTRATOR_POLICY_KEY });
    const snap = await storeB.exportSnapshot();
    assert.equal(snap.inflight.some((row) => row.idempotencyKey === "workers-restart"), true);
    assert.equal(snap.bookings.some((row) => row.idempotencyKey === "workers-restart"), false);
    const replay = await reserve(input, harness(provider, storeB));
    assert.equal(replay.replay, true);
    assert.equal(provider.calls.length, callsBefore);
    const recovered = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-a", providerId: "provider-a", idempotencyKey: "workers-restart" },
      harness(provider, storeB),
    );
    assert.equal(recovered.ok, true, recovered.message);
    assert.equal(await liveCount(clientB, "tenant-a", "tenant-a:loc-a:offer-restart:2026-11-01T09:00:00.000Z"), 1);
    assert.equal(recovered.transaction?.transactionRef, pending.transaction?.transactionRef);
  });

  it("8. concurrent reconciliation stores one provider booking", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "NATIVE",
      supportsHold: true,
      commitThen: "RETRYABLE",
    });
    const pending = await reserve(command({ idempotencyKey: "workers-reconcile", offeringId: "offer-reconcile" }), harness(provider, storeA));
    assert.equal(pending.resolutionRequired, true);
    const commandIn = { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-a", providerId: "provider-a", idempotencyKey: "workers-reconcile" };
    const [left, right] = await Promise.all([
      reconcileTimedOut(commandIn, harness(provider, storeA)),
      reconcileTimedOut(commandIn, harness(provider, storeB)),
    ]);
    const summary = [left, right].map((row) => `${row.ok}:${row.replay}:${row.code}:${row.message}`).join(" | ");
    assert.equal([left, right].filter((row) => row.ok).length >= 1, true, summary);
    assert.equal(await liveCount(clientA, "tenant-a", "tenant-a:loc-a:offer-reconcile:2026-11-01T09:00:00.000Z"), 1, summary);
    const rows = await clientA.ccBooking.findMany({ where: { tenantId: "tenant-a", idempotencyKey: "workers-reconcile" } });
    assert.equal(rows.length, 1, summary);
    assert.equal(rows[0]?.transactionRef, pending.transaction?.transactionRef);
  });

  it("9. cancel and reschedule cannot both commit", async () => {
    const provider = providerFor("tenant-a");
    const booked = await reserve(command({ idempotencyKey: "workers-race-cancel", offeringId: "offer-race-cancel" }), harness(provider, storeA));
    assert.equal(booked.ok, true, booked.message);
    const bookingRef = booked.booking?.bookingRef ?? "";
    const storedBefore = await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "workers-race-cancel" } });
    const version = storedBefore?.version ?? 0;
    const [cancelled, rescheduled] = await Promise.all([
      cancelReservation({ actor: actor("tenant-a"), bookingRef, idempotencyKey: "workers-cancel" }, harness(provider, storeA)),
      storeB.bookings.requestReschedule(actor("tenant-a"), {
        tenantId: "tenant-a",
        bookingRef,
        expectedVersion: version,
        nextSlotKey: "tenant-a:loc-a:offer-race-cancel:2099-01-01T00:00:00.000Z",
      }),
    ]);
    const cancelWon = cancelled.ok === true;
    const moveWon = rescheduled.ok === true;
    assert.equal(Number(cancelWon) + Number(moveWon), 1, `${cancelled.ok}:${"code" in cancelled ? cancelled.code : ""} | ${rescheduled.ok}:${rescheduled.ok ? "" : rescheduled.code}`);
    const saved = await clientA.ccBooking.findUnique({ where: { tenantId_bookingRef: { tenantId: "tenant-a", bookingRef } } });
    assert.equal(saved?.version, version + 1);
    if (saved?.state === "CANCELLED") assert.equal(saved.pendingSlotKey, null);
    if (saved?.pendingSlotKey) assert.equal(saved.state, "HELD");

    const second = await reserve(command({ idempotencyKey: "workers-race-commit", offeringId: "offer-race-commit" }), harness(provider, storeA));
    assert.equal(second.ok, true, second.message);
    const secondRef = second.booking?.bookingRef ?? "";
    const secondBefore = await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "workers-race-commit" } });
    const requested = await storeA.bookings.requestReschedule(actor("tenant-a"), {
      tenantId: "tenant-a",
      bookingRef: secondRef,
      expectedVersion: secondBefore?.version ?? 0,
      nextSlotKey: "tenant-a:loc-a:offer-moved:2099-02-01T00:00:00.000Z",
    });
    assert.equal(requested.ok, true, requested.ok ? "" : requested.message);
    const pendingVersion = requested.ok ? requested.value.version : 0;
    const [moved, closed] = await Promise.all([
      storeA.bookings.commitReschedule(actor("tenant-a"), { tenantId: "tenant-a", bookingRef: secondRef, expectedVersion: pendingVersion }),
      cancelReservation({ actor: actor("tenant-a"), bookingRef: secondRef, idempotencyKey: "workers-cancel-2" }, harness(provider, storeB)),
    ]);
    assert.equal(Number(moved.ok) + Number(closed.ok), 1, `${moved.ok}:${moved.ok ? moved.value.state : moved.code} | ${closed.ok}:${closed.code}`);
    const after = await clientB.ccBooking.findUnique({ where: { tenantId_bookingRef: { tenantId: "tenant-a", bookingRef: secondRef } } });
    assert.equal(after?.version, pendingVersion + 1);
    if (after?.state === "CANCELLED") assert.equal(after.pendingSlotKey, null);
    if (moved.ok) assert.equal(after?.slotKey, "tenant-a:loc-a:offer-moved:2099-02-01T00:00:00.000Z");
  });

  it("10. tenant A is not serialized by the global lock or by tenant B", async () => {
    const providerB = providerFor("tenant-b", "provider-b");
    const existing = await reserve(
      command({
        actor: actor("tenant-b"),
        tenantId: "tenant-b",
        locationId: "loc-b",
        providerId: "provider-b",
        idempotencyKey: "workers-unrelated",
        offeringId: "offer-unrelated",
      }),
      harness(providerB, storeB, "tenant-b", "provider-b"),
    );
    assert.equal(existing.ok, true, existing.message);
    const before = await clientB.ccBooking.findFirst({ where: { tenantId: "tenant-b", idempotencyKey: "workers-unrelated" } });
    assert.ok(before);
    let held = false;
    const rowLock = clientB.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "CcBooking" WHERE "tenantId" = 'tenant-b' AND "bookingRef" = ${before.bookingRef} FOR UPDATE`;
      held = true;
      await tx.$queryRaw`SELECT pg_sleep(1.0)::text AS slept`;
    });
    while (!held) await new Promise((resolve) => setTimeout(resolve, 10));
    const providerA = providerFor("tenant-a");
    const started = Date.now();
    const written = await reserve(command({ idempotencyKey: "workers-during-b", offeringId: "offer-during-b" }), harness(providerA, storeA));
    const elapsed = Date.now() - started;
    assert.equal(written.ok, true, written.message);
    assert.ok(elapsed < 700, `tenant A waited ${elapsed}ms on tenant B's row`);
    await rowLock;
    const after = await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-b", idempotencyKey: "workers-unrelated" } });
    assert.equal(after?.version, before.version);
    assert.equal(after?.state, before.state);

    let locked = false;
    const globalLock = clientA.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('atlasnow-cc'), hashtext('qa'))`;
      locked = true;
      await tx.$queryRaw`SELECT pg_sleep(1.2)::text AS slept`;
    });
    while (!locked) await new Promise((resolve) => setTimeout(resolve, 10));
    const locks = await clientB.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM pg_locks
      WHERE locktype = 'advisory'
        AND classid = hashtext('atlasnow-cc')::oid
        AND objid = hashtext('qa')::oid
        AND granted
    `;
    assert.equal(Number(locks[0]?.count ?? 0), 1);
    const providerA2 = providerFor("tenant-a");
    const globalStarted = Date.now();
    const duringLock = await reserve(command({ idempotencyKey: "workers-during-lock", offeringId: "offer-during-lock" }), harness(providerA2, storeB));
    const globalElapsed = Date.now() - globalStarted;
    assert.equal(duringLock.ok, true, duringLock.message);
    assert.ok(globalElapsed < 800, `booking write waited ${globalElapsed}ms on pg_advisory_xact_lock(atlasnow-cc, qa)`);
    await globalLock;

    await clientA.$executeRaw`
      UPDATE "CcBooking"
      SET "holdExpiresAt" = '2020-01-01T00:00:00.000Z', "holdExpiryOwner" = 'PROVIDER'
      WHERE "tenantId" = 'tenant-a' AND "idempotencyKey" = 'workers-during-lock'
    `;
    const expired = await storeA.bookings.expireDue(actor("tenant-a"), "tenant-a", "loc-a", "2026-10-26T12:00:00.000Z");
    assert.equal(expired.ok, true, expired.ok ? "" : expired.message);
    if (expired.ok) assert.equal(expired.value.expired >= 1, true);
    const unrelated = await clientB.ccBooking.findFirst({ where: { tenantId: "tenant-b", idempotencyKey: "workers-unrelated" } });
    assert.equal(unrelated?.state, before.state);
    const own = await clientA.ccBooking.findFirst({ where: { tenantId: "tenant-a", idempotencyKey: "workers-during-lock" } });
    assert.equal(own?.state, "EXPIRED");
  });
});
