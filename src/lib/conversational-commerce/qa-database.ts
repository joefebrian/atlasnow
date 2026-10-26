/**
 * Disposable PostgreSQL for conversational-commerce QA.
 * Localhost is not enough. A target must be a new atlasnow_cc_qa_* database
 * on the loopback server this process just checked, with an owner marker.
 * This module never migrates or drops the database named in DATABASE_URL.
 */

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export const QA_DATABASE_NAME = /^atlasnow_cc_qa_[a-z0-9]{8,32}$/;
const APPLICATION_NAME = "atlasnow-cc-qa";
const FORBIDDEN_NAMES = new Set([
  "atlasnow",
  "postgres",
  "template0",
  "template1",
  "production",
  "prod",
  "atlasnow_prod",
  "atlas",
]);
const createdNames = new Set<string>();

export type QaIdentity = {
  hostname: string;
  databaseName: string;
  pinnedPort: number;
  observedPort: number;
  currentDatabase: string;
  applicationName: string;
  markerCount: number;
  markerToken: string | null;
  expectedToken: string;
  runId: string;
  markerRunId: string | null;
  knownNames: readonly string[];
};

export function redactDatabaseText(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://redacted");
}

export function destructiveQaDecision(input: QaIdentity): { ok: true } | { ok: false; reason: string } {
  if (input.hostname !== "localhost" && input.hostname !== "127.0.0.1") {
    return { ok: false, reason: "QA host is not loopback." };
  }
  if (!QA_DATABASE_NAME.test(input.databaseName) || FORBIDDEN_NAMES.has(input.databaseName) || input.databaseName.includes("prod")) {
    return { ok: false, reason: "QA database name is not a disposable name." };
  }
  if (!input.knownNames.includes(input.databaseName)) {
    return { ok: false, reason: "This process did not create that database." };
  }
  if (input.currentDatabase !== input.databaseName) {
    return { ok: false, reason: "Connected database is not the disposable QA database." };
  }
  if (!Number.isInteger(input.pinnedPort) || input.observedPort !== input.pinnedPort) {
    return { ok: false, reason: "PostgreSQL server port does not match the server that created the database." };
  }
  if (input.applicationName !== APPLICATION_NAME) {
    return { ok: false, reason: "PostgreSQL application_name is not the QA client." };
  }
  if (input.markerCount !== 1 || input.markerToken !== input.expectedToken || input.markerRunId !== input.runId) {
    return { ok: false, reason: "QA ownership marker does not match this process." };
  }
  return { ok: true };
}

type IdentityRow = {
  current_database: string;
  port: number;
  application_name: string;
};

export type DisposableQaDatabase = {
  databaseName: string;
  /** Full URL for Prisma. Do not log it. */
  databaseUrl: string;
  runId: string;
  ownerToken: string;
  pinnedPort: number;
  installOwnerMarker(): Promise<void>;
  assertIdentity(client: IdentityClient): Promise<void>;
  drop(): Promise<void>;
};

type IdentityClient = {
  $queryRawUnsafe: PrismaClient["$queryRawUnsafe"];
};

function fail(message: string): never {
  throw new Error(redactDatabaseText(message));
}

function adminCoordinates(): { hostname: string; port: string; adminUrl: string; databaseUrlFor: (name: string) => string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) fail("DATABASE_URL is required as loopback admin coordinates for a disposable QA database.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail("DATABASE_URL could not be parsed.");
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    fail("Refusing to open a QA database because DATABASE_URL is not loopback.");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    fail("QA admin coordinates must be a PostgreSQL URL.");
  }
  const sourceName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!sourceName) fail("DATABASE_URL has no database name to ignore.");
  if (QA_DATABASE_NAME.test(sourceName)) fail("Refusing to adopt the disposable database named by DATABASE_URL.");
  const databaseUrlFor = (name: string) => {
    const next = new URL(url.toString());
    next.pathname = `/${name}`;
    next.searchParams.set("application_name", APPLICATION_NAME);
    return next.toString();
  };
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  admin.searchParams.set("application_name", APPLICATION_NAME);
  return { hostname: url.hostname, port: url.port, adminUrl: admin.toString(), databaseUrlFor };
}

async function identityOf(client: { $queryRawUnsafe: PrismaClient["$queryRawUnsafe"] }): Promise<IdentityRow> {
  const rows = await client.$queryRawUnsafe<IdentityRow[]>(
    "SELECT current_database() AS current_database, inet_server_port() AS port, current_setting('application_name') AS application_name",
  );
  const row = rows[0];
  if (!row) fail("PostgreSQL did not return its identity.");
  return { current_database: row.current_database, port: Number(row.port), application_name: row.application_name };
}

export async function createDisposableQaDatabase(): Promise<DisposableQaDatabase> {
  const coords = adminCoordinates();
  const databaseName = `atlasnow_cc_qa_${randomBytes(12).toString("hex")}`;
  if (!QA_DATABASE_NAME.test(databaseName) || FORBIDDEN_NAMES.has(databaseName)) {
    fail("Generated QA database name failed its own pattern.");
  }
  const runId = randomBytes(16).toString("hex");
  const ownerToken = randomBytes(32).toString("hex");
  const databaseUrl = coords.databaseUrlFor(databaseName);
  const admin = new PrismaClient({ datasources: { db: { url: coords.adminUrl } } });
  let pinnedPort = 0;
  try {
    const adminIdentity = await identityOf(admin);
    if (adminIdentity.current_database !== "postgres") fail("QA admin connection must use the postgres maintenance database.");
    if (adminIdentity.application_name !== APPLICATION_NAME) fail("QA admin connection lost application_name.");
    // Pin the port PostgreSQL reports. A Docker forward can publish 5433 while inet_server_port() is 5432.
    pinnedPort = adminIdentity.port;
    if (!Number.isInteger(pinnedPort) || pinnedPort < 1) fail("PostgreSQL did not report a server port.");
    const existing = await admin.$queryRawUnsafe<Array<{ datname: string }>>(
      "SELECT datname FROM pg_database WHERE datname = $1",
      databaseName,
    );
    if (existing.length > 0) fail("Refusing to adopt an existing database.");
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    createdNames.add(databaseName);
  } catch (error) {
    await admin.$disconnect().catch(() => undefined);
    fail(error instanceof Error ? error.message : "QA database creation failed.");
  }

  const probe = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const created = await identityOf(probe);
    if (created.current_database !== databaseName || created.port !== pinnedPort || created.application_name !== APPLICATION_NAME) {
      fail("Disposable database identity did not match the database this process created.");
    }
  } catch (error) {
    await probe.$disconnect().catch(() => undefined);
    await admin.$disconnect().catch(() => undefined);
    fail(error instanceof Error ? error.message : "QA database identity check failed.");
  } finally {
    await probe.$disconnect().catch(() => undefined);
  }

  let markerInstalled = false;
  async function assertConnection(client: IdentityClient, requireMarker: boolean) {
    const row = await identityOf(client);
    let markerCount = 0;
    let markerToken: string | null = null;
    let markerRunId: string | null = null;
    if (requireMarker) {
      const marker = await client.$queryRawUnsafe<Array<{ token: string; run_id: string; count: number }>>(
        "SELECT token, run_id, COUNT(*) OVER ()::int AS count FROM cc_qa_owner",
      );
      markerCount = marker.length === 0 ? 0 : Number(marker[0]?.count ?? 0);
      markerToken = marker.length === 1 ? marker[0]?.token ?? null : null;
      markerRunId = marker.length === 1 ? marker[0]?.run_id ?? null : null;
    }
    const decision = destructiveQaDecision({
      hostname: coords.hostname,
      databaseName,
      pinnedPort,
      observedPort: row.port,
      currentDatabase: row.current_database,
      applicationName: row.application_name,
      markerCount: requireMarker ? markerCount : 1,
      markerToken: requireMarker ? markerToken : ownerToken,
      expectedToken: ownerToken,
      runId,
      markerRunId: requireMarker ? markerRunId : runId,
      knownNames: [...createdNames],
    });
    if (!decision.ok) fail(decision.reason);
    if (requireMarker && !markerInstalled) fail("QA ownership marker is not installed.");
  }
  const handle: DisposableQaDatabase = {
    databaseName,
    databaseUrl,
    runId,
    ownerToken,
    pinnedPort,
    async installOwnerMarker() {
      const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      try {
        await assertConnection(client, false);
        await client.$executeRawUnsafe(
          "CREATE TABLE IF NOT EXISTS cc_qa_owner (token TEXT PRIMARY KEY, run_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())",
        );
        const count = await client.$queryRawUnsafe<Array<{ count: number }>>("SELECT COUNT(*)::int AS count FROM cc_qa_owner");
        if (Number(count[0]?.count ?? 0) > 0) fail("Refusing to replace an existing QA ownership marker.");
        await client.$executeRawUnsafe("INSERT INTO cc_qa_owner (token, run_id) VALUES ($1, $2)", ownerToken, runId);
        markerInstalled = true;
        await assertConnection(client, true);
      } finally {
        await client.$disconnect();
      }
    },
    async assertIdentity(client) {
      await assertConnection(client, true);
    },
    async drop() {
      const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      try {
        await handle.assertIdentity(client);
      } catch (error) {
        await client.$disconnect().catch(() => undefined);
        fail(error instanceof Error ? error.message : "Refusing to drop a database that failed the identity check.");
      }
      await client.$disconnect();
      try {
        await admin.$executeRawUnsafe(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          databaseName,
        );
        const still = await admin.$queryRawUnsafe<Array<{ datname: string }>>("SELECT datname FROM pg_database WHERE datname = $1", databaseName);
        if (still.length !== 1 || still[0]?.datname !== databaseName) fail("Refusing to drop because the database identity changed.");
        if (!QA_DATABASE_NAME.test(databaseName) || !createdNames.has(databaseName)) {
          fail("Refusing to drop a database this process does not own.");
        }
        await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
        createdNames.delete(databaseName);
      } catch (error) {
        fail(error instanceof Error ? error.message : "QA database drop failed.");
      } finally {
        await admin.$disconnect().catch(() => undefined);
      }
    },
  };
  return handle;
}
