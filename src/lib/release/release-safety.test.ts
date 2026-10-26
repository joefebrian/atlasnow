import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";

const repo = process.cwd();
const script = path.join(repo, "scripts/migration-preflight.mjs");
const manifestPath = path.join(repo, "scripts/migration-manifest.json");
const migrationRoot = path.join(repo, "prisma/migrations");
const entrypoint = path.join(repo, "deploy/docker-entrypoint.sh");
const PENDING = [
  "20261024180000_commerce_orders",
  "20261026120000_cc_location_tenant_key",
  "20261026140000_cc_persistence",
];

function manifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as {
    approvedGitSha: string | null;
    applied: Array<{ name: string; sha256: string; authorization: string }>;
    approvedPending: Array<{ name: string; sha256: string }>;
    trackedPending: Array<{ name: string; sha256: string }>;
  };
}

function sha256(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function historyFor(entries: Array<{ name: string; sha256: string }>, edit?: (row: Record<string, unknown>) => void) {
  return entries.map((entry) => {
    const row: Record<string, unknown> = {
      migration_name: entry.name,
      checksum: entry.sha256,
      started_at: "2026-01-01T00:00:00.000Z",
      finished_at: "2026-01-01T00:00:01.000Z",
      rolled_back_at: null,
      applied_steps_count: 1,
    };
    edit?.(row);
    return row;
  });
}

function writeJson(dir: string, name: string, value: unknown) {
  const file = path.join(dir, name);
  writeFileSync(file, JSON.stringify(value));
  return file;
}

function run(args: string[]) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  let report: { ok: boolean; appliedMatch: number; approvedPending: string[]; unapprovedPending: string[]; failures: Array<{ code: string; name: string }> } | null = null;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    report = null;
  }
  return { status: result.status, report, stderr: result.stderr };
}

function copyApplied(dir: string, names: string[]) {
  const root = path.join(dir, "migrations");
  mkdirSync(root);
  for (const name of names) cpSync(path.join(migrationRoot, name), path.join(root, name), { recursive: true });
  return root;
}

describe("release safety", () => {
  it("keeps the restored inbox bytes equal to the observed production checksums", () => {
    assert.equal(sha256(path.join(migrationRoot, "20261004120000_wa_message_image/migration.sql")), "4b976d08e35a360d8abcc7be696b2fa51fc7d7894efd230a1ea0b82dae5d8163");
    assert.equal(sha256(path.join(migrationRoot, "20261004143000_inbox_image_retention/migration.sql")), "d84e9881c254e2164e649caabedbec078640d968051cef578e1406edef2dae32");
  });

  it("pins the manifest to 39 verified applied rows and 3 unapproved pending folders", () => {
    const body = manifest();
    assert.equal(body.approvedGitSha, null);
    assert.equal(body.approvedPending.length, 0);
    assert.equal(body.applied.length, 39);
    assert.deepEqual(body.trackedPending.map((entry) => entry.name), PENDING);
    for (const entry of body.applied) {
      assert.equal(sha256(path.join(migrationRoot, entry.name, "migration.sql")), entry.sha256, entry.name);
    }
    for (const entry of body.trackedPending) {
      assert.equal(sha256(path.join(migrationRoot, entry.name, "migration.sql")), entry.sha256, entry.name);
    }
    const unknown = body.applied.filter((entry) => entry.authorization === "applied_authorization_unknown").map((entry) => entry.name);
    assert.deepEqual(unknown, ["20261024200000_commerce_catalog_import", "20261024220000_commerce_catalog_feed"]);
    assert.equal(body.applied.some((entry) => entry.authorization === "verified_applied" && entry.name === "20261004120000_wa_message_image"), true);
  });

  it("does not invoke prisma migrate when the container starts", () => {
    const source = readFileSync(entrypoint, "utf8");
    const commands = source.split("\n").map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#"));
    assert.equal(commands.some((line) => /migrate|prisma/i.test(line)), false);
    assert.equal(commands.some((line) => line.includes("server.js")), true);
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-boot-"));
    const bin = path.join(dir, "bin");
    const log = path.join(dir, "argv");
    mkdirSync(bin);
    writeFileSync(path.join(bin, "node"), "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$LOG\"\nexit 0\n");
    chmodSync(path.join(bin, "node"), 0o755);
    const result = spawnSync(entrypoint, {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        LOG: log,
        PORT: "3000",
        NODE_ENV: "production",
        ATLASNOW_MIGRATE_ON_BOOT: "true",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const argv = readFileSync(log, "utf8");
    assert.match(argv, /server\.js/);
    assert.equal(/migrate|prisma/i.test(argv), false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts 39 applied folders and rejects a checksum, a gap, a rollback, and an unapproved folder", () => {
    const body = manifest();
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-preflight-"));
    const root = copyApplied(dir, body.applied.map((entry) => entry.name));
    const pinned = { ...body, approvedGitSha: "fixture-sha" };
    const manifestFile = writeJson(dir, "manifest.json", pinned);
    const historyFile = writeJson(dir, "history.json", historyFor(body.applied));
    const pass = run(["--manifest", manifestFile, "--migrations", root, "--history", historyFile, "--git-sha", "fixture-sha"]);
    assert.equal(pass.status, 0, JSON.stringify(pass.report));
    assert.equal(pass.report?.ok, true);
    assert.equal(pass.report?.appliedMatch, 39);
    assert.deepEqual(pass.report?.unapprovedPending, []);

    const mismatch = historyFor(body.applied);
    mismatch[0] = { ...mismatch[0], checksum: "0".repeat(64) };
    const mismatchFile = writeJson(dir, "mismatch.json", mismatch);
    const badHash = run(["--manifest", manifestFile, "--migrations", root, "--history", mismatchFile, "--git-sha", "fixture-sha"]);
    assert.equal(badHash.status, 1);
    assert.equal(badHash.report?.failures.some((failure) => failure.code === "CHECKSUM_MISMATCH"), true);

    const gapFile = writeJson(dir, "gap.json", historyFor(body.applied).slice(1));
    const missing = run(["--manifest", manifestFile, "--migrations", root, "--history", gapFile, "--git-sha", "fixture-sha"]);
    assert.equal(missing.status, 1);
    assert.equal(missing.report?.failures.some((failure) => failure.code === "MISSING_HISTORY"), true);

    const rolled = historyFor(body.applied, (row) => {
      if (row.migration_name === body.applied[1]?.name) row.rolled_back_at = "2026-01-02T00:00:00.000Z";
    });
    const rolledFile = writeJson(dir, "rolled.json", rolled);
    const incomplete = run(["--manifest", manifestFile, "--migrations", root, "--history", rolledFile, "--git-sha", "fixture-sha"]);
    assert.equal(incomplete.status, 1);
    assert.equal(incomplete.report?.failures.some((failure) => failure.code === "INCOMPLETE"), true);

    mkdirSync(path.join(root, "20990101000000_extra"));
    writeFileSync(path.join(root, "20990101000000_extra/migration.sql"), "SELECT 1;\n");
    const extra = run(["--manifest", manifestFile, "--migrations", root, "--history", historyFile, "--git-sha", "fixture-sha"]);
    assert.equal(extra.status, 1);
    assert.equal(extra.report?.failures.some((failure) => failure.code === "UNAPPROVED_FOLDER" && failure.name === "20990101000000_extra"), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("recognizes the repo as 39 applied and 3 unapproved pending folders", () => {
    const body = manifest();
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-preflight-repo-"));
    const pinned = { ...body, approvedGitSha: "fixture-sha" };
    const manifestFile = writeJson(dir, "manifest.json", pinned);
    const historyFile = writeJson(dir, "history.json", historyFor(body.applied));
    const result = run(["--manifest", manifestFile, "--migrations", migrationRoot, "--history", historyFile, "--git-sha", "fixture-sha"]);
    assert.equal(result.status, 1);
    assert.equal(result.report?.appliedMatch, 39);
    assert.deepEqual(result.report?.unapprovedPending, PENDING);
    assert.equal(result.report?.failures.filter((failure) => failure.code === "UNAPPROVED_FOLDER").length, 3);
    const unpinned = run(["--manifest", manifestPath, "--migrations", migrationRoot, "--history", historyFile, "--git-sha", "fixture-sha"]);
    assert.equal(unpinned.status, 1);
    assert.equal(unpinned.report?.failures.some((failure) => failure.code === "UNPINNED_SHA"), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("allows a pending folder only when the manifest names it", () => {
    const body = manifest();
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-preflight-pending-"));
    const names = [...body.applied.map((entry) => entry.name), PENDING[0]];
    const root = copyApplied(dir, names);
    const pending = body.trackedPending.find((entry) => entry.name === PENDING[0]);
    assert.ok(pending);
    const pinned = { ...body, approvedGitSha: "fixture-sha", approvedPending: [pending], trackedPending: body.trackedPending.slice(1) };
    const manifestFile = writeJson(dir, "manifest.json", pinned);
    const historyFile = writeJson(dir, "history.json", historyFor(body.applied));
    const result = run(["--manifest", manifestFile, "--migrations", root, "--history", historyFile, "--git-sha", "fixture-sha"]);
    assert.equal(result.status, 0, JSON.stringify(result.report));
    assert.deepEqual(result.report?.approvedPending, [PENDING[0]]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not call prisma from the preflight program", () => {
    const source = readFileSync(script, "utf8");
    assert.equal(source.includes("migrate deploy"), false);
    assert.equal(source.includes("migrate status"), false);
    assert.equal(statSync(script).isFile(), true);
  });
});
