import "dotenv/config";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, cpSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const DB_NAME = "atlasnow_slice25";
const AUTH_SECRET = "slice25-release-test-secret";
const QA_ID = "commerceqa20261023tenant";
const OTHER_ID = "slice25-other-brand";
const OMITTED = "20261024180000_commerce_orders";
const PORT = 3465;

const INBOX_SQL: Record<string, string> = {
  "20261004120000_wa_message_image": `-- AlterTable
ALTER TABLE "WaMessage" ADD COLUMN "mediaImage" BYTEA,
ADD COLUMN "mediaMime" TEXT NOT NULL DEFAULT '';
`,
  "20261004143000_inbox_image_retention": `-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "inboxImageRetentionDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "WaMessage" ADD COLUMN "inboxImage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mediaPurgedAt" TIMESTAMP(3);

UPDATE "WaMessage"
SET "inboxImage" = true
WHERE "mediaMime" <> ''
   OR "body" = '[image]'
   OR "body" LIKE '[image,%';
`,
};

function localDb() {
  try {
    const host = new URL(process.env.DATABASE_URL || "").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function redact(text: string) {
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://redacted");
}

function withDatabase(raw: string, name: string) {
  const url = new URL(raw);
  url.pathname = `/${name}`;
  return url.toString();
}

function stageMigrations(root: string) {
  const source = path.join(process.cwd(), "prisma");
  const migrations = path.join(root, "migrations");
  mkdirSync(migrations, { recursive: true });
  cpSync(path.join(source, "migrations", "migration_lock.toml"), path.join(migrations, "migration_lock.toml"));
  cpSync(path.join(source, "schema.prisma"), path.join(root, "schema.prisma"));
  for (const entry of readdirSync(path.join(source, "migrations"))) {
    if (entry === OMITTED || entry === "migration_lock.toml") continue;
    const from = path.join(source, "migrations", entry);
    if (!statSync(from).isDirectory()) continue;
    cpSync(from, path.join(migrations, entry), { recursive: true });
  }
  for (const [name, sql] of Object.entries(INBOX_SQL)) {
    const folder = path.join(migrations, name);
    if (existsSync(folder)) continue;
    mkdirSync(folder);
    writeFileSync(path.join(folder, "migration.sql"), sql);
  }
  return migrations;
}

function stageApp() {
  const app = mkdtempSync(path.join(tmpdir(), "atlasnow-slice25-app-"));
  cpSync(path.join(process.cwd(), "src"), path.join(app, "src"), { recursive: true });
  cpSync(path.join(process.cwd(), "public"), path.join(app, "public"), { recursive: true });
  symlinkSync(path.join(process.cwd(), "node_modules"), path.join(app, "node_modules"));
  for (const name of ["package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", "next-env.d.ts"]) {
    cpSync(path.join(process.cwd(), name), path.join(app, name));
  }
  return app;
}

function stop(child: ChildProcess | null) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function sessionCookie() {
  const token = await new SignJWT({
    userId: "slice25-user",
    email: "slice25-qa@p2plabs.local",
    name: "Slice 25",
    tenantId: "slice25-agency",
    tenantSlug: "p2p-labs",
    tenantName: "P2P Labs",
    tenantType: "AGENCY",
    role: "SUPER_ADMIN",
    isAgencyStaff: true,
    isPlatformAdmin: true,
    mode: "agency",
    agencyId: null,
    locationId: null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(AUTH_SECRET));
  return `atlasnow_session=${token}`;
}

describe("slice 2.5 release database", { skip: localDb() ? false : "local database only" }, () => {
  it("serves commerce without the orders table", { timeout: 480_000 }, async () => {
    const base = process.env.DATABASE_URL || "";
    const admin = new PrismaClient({ datasources: { db: { url: withDatabase(base, "postgres") } } });
    const sliceUrl = withDatabase(base, DB_NAME);
    const slice = new PrismaClient({ datasources: { db: { url: sliceUrl } } });
    const schemaDir = mkdtempSync(path.join(tmpdir(), "atlasnow-slice25-prisma-"));
    const appDir = stageApp();
    const logs = { text: "" };
    let server: ChildProcess | null = null;
    try {
      await admin.$queryRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid()`
      );
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
      await admin.$executeRawUnsafe(`CREATE DATABASE "${DB_NAME}"`);

      const migrations = stageMigrations(schemaDir);
      const migrated = spawn(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(schemaDir, "schema.prisma")], {
        env: { ...process.env, DATABASE_URL: sliceUrl },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let migrateLog = "";
      migrated.stdout?.on("data", (chunk) => {
        migrateLog += chunk.toString();
      });
      migrated.stderr?.on("data", (chunk) => {
        migrateLog += chunk.toString();
      });
      const migrateCode = await new Promise<number>((resolve) => migrated.on("exit", (code) => resolve(code ?? 1)));
      assert.equal(migrateCode, 0, redact(migrateLog).slice(-1500));

      const staged = readdirSync(migrations).filter((name) => statSync(path.join(migrations, name)).isDirectory()).sort();
      const recorded = await slice.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name`;
      const applied = recorded.map((row) => row.migration_name).sort();
      assert.deepEqual(applied, staged);
      assert.equal(applied.includes(OMITTED), false);
      assert.equal(applied.includes("20261024100000_commerce_batch_poll"), true);
      assert.equal(applied.includes("20261024200000_commerce_catalog_import"), true);
      assert.equal(applied.includes("20261024220000_commerce_catalog_feed"), true);
      assert.equal(applied.includes("20261004120000_wa_message_image"), true);
      assert.equal(applied.includes("20261004143000_inbox_image_retention"), true);

      const columns = await slice.$queryRaw<Array<{ table_name: string; column_name: string }>>`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE (table_name = 'CommerceCatalogLink' AND column_name = 'lastImportedAt')
          OR (table_name = 'CommerceProduct' AND column_name = 'publicUrl')
          OR (table_name = 'CommerceCatalogLink' AND column_name = 'sourceSnapshot')
          OR (table_name = 'CommerceConnection' AND column_name = 'catalogVertical')
          OR (table_name = 'Tenant' AND column_name = 'inboxImageRetentionDays')
          OR (table_name = 'WaMessage' AND column_name IN ('mediaImage', 'mediaMime', 'inboxImage', 'mediaPurgedAt'))
      `;
      const have = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
      for (const name of [
        "CommerceCatalogLink.lastImportedAt",
        "CommerceProduct.publicUrl",
        "CommerceCatalogLink.sourceSnapshot",
        "CommerceConnection.catalogVertical",
        "Tenant.inboxImageRetentionDays",
        "WaMessage.mediaImage",
        "WaMessage.mediaMime",
        "WaMessage.inboxImage",
        "WaMessage.mediaPurgedAt",
      ]) {
        assert.equal(have.has(name), true, name);
      }
      const reg = await slice.$queryRaw<Array<{ name: string | null }>>`SELECT to_regclass('public."CommerceOrder"')::text AS name`;
      assert.equal(reg[0]?.name, null);

      await slice.user.create({
        data: { id: "slice25-user", email: "slice25-qa@p2plabs.local", passwordHash: "not-a-login", name: "Slice 25" },
      });
      await slice.tenant.create({ data: { id: "slice25-agency", name: "P2P Labs", slug: "p2p-labs", type: "AGENCY" } });
      await slice.tenant.create({
        data: { id: QA_ID, name: "AtlasNow Commerce QA", slug: "atlasnow-commerce-qa", type: "CLIENT", agencyId: "slice25-agency" },
      });
      await slice.tenant.create({
        data: { id: OTHER_ID, name: "Slice Other Brand", slug: "slice25-other-brand", type: "CLIENT", agencyId: "slice25-agency" },
      });
      await slice.membership.create({
        data: { userId: "slice25-user", tenantId: "slice25-agency", role: "SUPER_ADMIN", status: "ACTIVE" },
      });
      const product = await slice.commerceProduct.create({
        data: { tenantId: QA_ID, sku: "ATLASNOW-QA-SHAPE-001", name: "QA shape", unitPriceIdr: 28780, publicUrl: "https://example.com/qa-shape" },
      });

      const childEnv: NodeJS.ProcessEnv = {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        NODE_ENV: "development",
        DATABASE_URL: sliceUrl,
        AUTH_SECRET,
        PORT: String(PORT),
        NEXT_TELEMETRY_DISABLED: "1",
      };
      server = spawn(process.execPath, [path.join(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", String(PORT)], {
        cwd: appDir,
        env: childEnv,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const collect = (chunk: Buffer) => {
        logs.text += chunk.toString();
      };
      server.stdout?.on("data", collect);
      server.stderr?.on("data", collect);
      const started = Date.now();
      let up = false;
      while (Date.now() - started < 180_000) {
        if (server.exitCode != null) break;
        try {
          const probe = await fetch(`http://127.0.0.1:${PORT}/login`, { redirect: "manual" });
          if (probe.status < 500) {
            up = true;
            break;
          }
        } catch {
          // server still booting
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      assert.equal(up, true, redact(logs.text).slice(-1500));

      const cookie = await sessionCookie();
      const headers = { cookie };
      async function get(pathname: string) {
        const response = await fetch(`http://127.0.0.1:${PORT}${pathname}`, { headers, redirect: "manual" });
        const text = await response.text();
        return { status: response.status, text, location: response.headers.get("location") };
      }
      const qaPage = await get(`/commerce?client=${QA_ID}`);
      assert.equal(qaPage.status, 200, `${qaPage.status} ${qaPage.location || ""} ${qaPage.text.slice(0, 240)}`);
      assert.match(qaPage.text, /Order capture is off/);
      const otherPage = await get(`/commerce?client=${OTHER_ID}`);
      assert.equal(otherPage.status, 200, `${otherPage.status} ${otherPage.location || ""} ${otherPage.text.slice(0, 240)}`);
      assert.match(otherPage.text, /Order capture is off/);

      const orders = await get(`/api/commerce/orders?tenantId=${QA_ID}`);
      assert.equal(orders.status, 200, orders.text.slice(0, 240));
      const ordersBody = JSON.parse(orders.text) as { orders: unknown[]; enabled: boolean };
      assert.deepEqual(ordersBody.orders, []);
      assert.equal(ordersBody.enabled, false);
      const stillMissing = await slice.$queryRaw<Array<{ name: string | null }>>`SELECT to_regclass('public."CommerceOrder"')::text AS name`;
      assert.equal(stillMissing[0]?.name, null);

      const catalog = await get(`/api/commerce/catalog/products?tenantId=${QA_ID}`);
      assert.equal(catalog.status, 200, catalog.text.slice(0, 240));
      const catalogBody = JSON.parse(catalog.text) as { enabled: boolean; discoveryEnabled: boolean; importEnabled: boolean; products: unknown[] };
      assert.equal(catalogBody.enabled, false);
      assert.equal(catalogBody.discoveryEnabled, false);
      assert.equal(catalogBody.importEnabled, false);
      assert.deepEqual(catalogBody.products, []);
      const imported = await fetch(`http://127.0.0.1:${PORT}/api/commerce/catalog/products`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ tenantId: QA_ID, retailerIds: ["ATLASNOW-QA-SHAPE-001"] }),
      });
      const importedText = await imported.text();
      assert.equal(imported.status, 503, importedText.slice(0, 240));

      const preview = await fetch(`http://127.0.0.1:${PORT}/api/commerce/catalog/preview`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ tenantId: QA_ID, productId: product.id }),
      });
      const previewText = await preview.text();
      assert.equal(preview.status, 200, previewText.slice(0, 240));
      const previewBody = JSON.parse(previewText) as { networkCalled: boolean; wouldSend: boolean };
      assert.equal(previewBody.networkCalled, false);
      assert.equal(previewBody.wouldSend, false);

      const whatsapp = await fetch(`http://127.0.0.1:${PORT}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=ping`);
      assert.equal(whatsapp.status, 403);
      const ingested = await fetch(`http://127.0.0.1:${PORT}/api/webhooks/whatsapp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const ingestedText = await ingested.text();
      assert.equal(ingested.status, 200, ingestedText.slice(0, 240));
      const conversations = await get(`/api/conversations?client=${QA_ID}`);
      assert.equal(conversations.status, 200, conversations.text.slice(0, 240));
      const inbox = await get(`/conversations?client=${QA_ID}`);
      assert.equal(inbox.status, 200, `${inbox.status} ${inbox.location || ""} ${inbox.text.slice(0, 240)}`);
      assert.equal(logs.text.includes("items_batch"), false);
      console.log(`slice25 applied=${applied.length} omitted=${OMITTED} commerceOrder=absent import=off`);
    } finally {
      stop(server);
      await slice.$disconnect().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 600));
      await admin.$queryRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid()`
      ).catch(() => undefined);
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DB_NAME}"`).catch(() => undefined);
      await admin.$disconnect().catch(() => undefined);
      rmSync(schemaDir, { recursive: true, force: true });
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
