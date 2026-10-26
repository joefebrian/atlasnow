import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, type KeyObject } from "node:crypto";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  evaluatePreflight,
  fingerprintPublicKey,
  inventoryDigest,
  readPackagedArtifact,
  signApproval,
  stageReleaseArtifact,
} from "../../../scripts/migration-preflight.mjs";

const repo = process.cwd();
const script = path.join(repo, "scripts/migration-preflight.mjs");
const signScript = path.join(repo, "scripts/release-sign.mjs");
const manifestPath = path.join(repo, "scripts/migration-manifest.json");
const trustFile = path.join(repo, "scripts/release-trust-fingerprint.txt");
const migrationRoot = path.join(repo, "prisma/migrations");
const entrypoint = path.join(repo, "deploy/docker-entrypoint.sh");
const PENDING = [
  "20261024180000_commerce_orders",
  "20261026120000_cc_location_tenant_key",
  "20261026140000_cc_persistence",
];
const SOURCE = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "fedcba9876543210fedcba9876543210fedcba98";
const IMAGE_A = `sha256:${"a".repeat(64)}`;
const IMAGE_B = `sha256:${"b".repeat(64)}`;

type Manifest = {
  approvedGitSha: string | null;
  applied: Array<{ name: string; sha256: string; authorization: string }>;
  approvedPending: Array<{ name: string; sha256: string }>;
  trackedPending: Array<{ name: string; sha256: string }>;
};

type Report = {
  ok: boolean;
  releaseDecision: string;
  productionApproval: boolean;
  packageGate: boolean;
  signatureVerified: boolean;
  trustedKey: boolean;
  pinMatches: boolean;
  imageBinding: string;
  appliedMatch: number;
  approvedPending: string[];
  unapprovedPending: string[];
  failures: Array<{ code: string; name: string; detail: string }>;
  sourceDigest: string;
  artifactDigest: string;
};

function manifest(): Manifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
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

function has(report: Report, code: string) {
  return report.failures.some((failure) => failure.code === code);
}

function assertClosed(report: Report) {
  assert.equal(report.ok, false);
  assert.equal(report.releaseDecision, "NO-GO");
  assert.equal(report.productionApproval, false);
}

function disposableKey() {
  return generateKeyPairSync("ed25519");
}

function namesOf(entries: Array<{ name: string }>) {
  return entries.map((entry) => entry.name).sort();
}

function statementFor(body: Manifest, packaged: { digest: string }, source = SOURCE, imageDigest: string | null = null) {
  return {
    schemaVersion: 1,
    purpose: "atlasnow-migration-package-approval",
    repository: "joefebrian/atlasnow",
    sourceSha: source,
    artifactDigest: packaged.digest,
    inventoryDigest: inventoryDigest(body) as string,
    applied: namesOf(body.applied),
    approvedPending: namesOf(body.approvedPending),
    imageDigest,
  };
}

function approvalFor(privateKey: KeyObject, body: Manifest, packaged: { digest: string }, source = SOURCE, imageDigest: string | null = null) {
  return signApproval(privateKey, statementFor(body, packaged, source, imageDigest)) as {
    statement: ReturnType<typeof statementFor>;
    signature: string;
  };
}

function check(input: {
  manifest: Manifest;
  packaged: ReturnType<typeof readPackagedArtifact>;
  history: unknown[];
  approval?: { statement: unknown; signature: string } | null;
  publicKey?: KeyObject | null;
  trustedFingerprint?: string;
  repoPin?: string;
  checkoutSha?: string;
  callerSha?: string;
  attestationProvided?: boolean;
  claimedImageDigest?: string;
  keyRejected?: string;
}) {
  return evaluatePreflight({
    manifest: input.manifest,
    packaged: input.packaged,
    history: input.history,
    approval: input.approval ?? null,
    publicKey: input.publicKey ?? null,
    keyRejected: input.keyRejected ?? "",
    trustedFingerprint: input.trustedFingerprint ?? "",
    repoPin: input.repoPin ?? "",
    checkoutSha: input.checkoutSha ?? SOURCE,
    callerSha: input.callerSha ?? "",
    attestationProvided: input.attestationProvided ?? false,
    claimedImageDigest: input.claimedImageDigest ?? "",
  }) as Report;
}

function stageApplied(dir: string, body: Manifest) {
  return stageReleaseArtifact({
    manifest: body,
    sourceRoot: migrationRoot,
    entrypointPath: entrypoint,
    outDir: path.join(dir, "artifact"),
  });
}

function copySql(source: string, name: string) {
  const dest = path.join(source, name);
  mkdirSync(dest, { recursive: true });
  copyFileSync(path.join(migrationRoot, name, "migration.sql"), path.join(dest, "migration.sql"));
}

function run(args: string[]) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  let report: Report | null = null;
  try {
    report = JSON.parse(result.stdout) as Report;
  } catch {
    report = null;
  }
  return { status: result.status, report, stderr: result.stderr };
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
    assert.equal(readFileSync(trustFile, "utf8").trim(), "UNPINNED");
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

  it("accepts a disposable test signature and still refuses production approval", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-valid-"));
    const packaged = stageApplied(dir, body);
    assert.equal(packaged.folders.length, 39);
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, packaged);
    const report = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
      repoPin: "",
    });
    assertClosed(report);
    assert.equal(report.packageGate, true, JSON.stringify(report.failures));
    assert.equal(report.signatureVerified, true);
    assert.equal(report.trustedKey, true);
    assert.equal(report.pinMatches, false);
    assert.equal(report.imageBinding, "NOT_VERIFIED");
    assert.equal(report.appliedMatch, 39);
    assert.equal(report.sourceDigest, SOURCE);
    assert.equal(has(report, "PRODUCTION_UNAPPROVED"), true);
    assert.equal(has(report, "IMAGE_UNVERIFIED"), true);
    const matchedPin = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
      repoPin: fingerprint,
    });
    assert.equal(matchedPin.pinMatches, true);
    assert.equal(matchedPin.productionApproval, false);
    assert.equal(matchedPin.imageBinding, "NOT_VERIFIED");
    assertClosed(matchedPin);
    const missing = { ...approval.statement };
    delete (missing as { inventoryDigest?: string }).inventoryDigest;
    const missingField = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval: { statement: missing, signature: approval.signature },
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assert.equal(has(missingField, "STATEMENT_INVALID"), true);
    assert.equal(missingField.signatureVerified, false);
    const extra = { ...approval.statement, publicKey: "supplied-by-artifact" };
    const extraField = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval: { statement: extra, signature: approval.signature },
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assert.equal(has(extraField, "STATEMENT_INVALID"), true);
    const otherRepo = { ...approval.statement, repository: "other/atlasnow" };
    const repository = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval: { statement: otherRepo, signature: approval.signature },
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assert.equal(has(repository, "REPOSITORY_MISMATCH"), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a signature from the wrong signer", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-signer-"));
    const packaged = stageApplied(dir, body);
    const trusted = disposableKey();
    const other = disposableKey();
    const approval = approvalFor(other.privateKey, pinned, packaged);
    const report = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval,
      publicKey: other.publicKey,
      trustedFingerprint: fingerprintPublicKey(trusted.publicKey) as string,
    });
    assertClosed(report);
    assert.equal(report.signatureVerified, true);
    assert.equal(report.trustedKey, false);
    assert.equal(report.packageGate, false);
    assert.equal(has(report, "WRONG_SIGNER"), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects the wrong source SHA", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-sha-"));
    const packaged = stageApplied(dir, body);
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, packaged, OTHER);
    const report = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assertClosed(report);
    assert.equal(report.signatureVerified, true);
    assert.equal(has(report, "SHA_MISMATCH"), true);
    assert.equal(report.packageGate, false);
    const caller = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval: approvalFor(privateKey, pinned, packaged),
      publicKey,
      trustedFingerprint: fingerprint,
      callerSha: OTHER,
    });
    assert.equal(has(caller, "CALLER_SHA_REJECTED"), true);
    assert.equal(caller.packageGate, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a modified artifact", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-artifact-"));
    const packaged = stageApplied(dir, body);
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, packaged);
    const file = path.join(dir, "artifact", "docker-entrypoint.sh");
    writeFileSync(file, `${readFileSync(file, "utf8")}\necho marker\n`);
    const modified = readPackagedArtifact(path.join(dir, "artifact"));
    const report = check({
      manifest: pinned,
      packaged: modified,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assertClosed(report);
    assert.equal(has(report, "ARTIFACT_MISMATCH"), true);
    assert.equal(has(report, "ENTRYPOINT_MIGRATES"), false);
    assert.equal(report.packageGate, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a modified migration.sql", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-sql-"));
    const packaged = stageApplied(dir, body);
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, packaged);
    writeFileSync(path.join(dir, "artifact", "prisma", "migrations", body.applied[0].name, "migration.sql"), "-- changed\n");
    const modified = readPackagedArtifact(path.join(dir, "artifact"));
    const report = check({
      manifest: pinned,
      packaged: modified,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assertClosed(report);
    assert.equal(has(report, "CHECKSUM_MISMATCH"), true);
    assert.equal(has(report, "ARTIFACT_MISMATCH"), true);
    assert.equal(report.packageGate, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a Docker entrypoint that migrates", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-entry-"));
    stageApplied(dir, body);
    writeFileSync(path.join(dir, "artifact", "docker-entrypoint.sh"), "#!/bin/sh\nset -eu\nprisma migrate deploy\nexec node server.js\n");
    const modified = readPackagedArtifact(path.join(dir, "artifact"));
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, modified);
    const report = check({
      manifest: pinned,
      packaged: modified,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assertClosed(report);
    assert.equal(report.signatureVerified, true);
    assert.equal(has(report, "ENTRYPOINT_MIGRATES"), true);
    assert.equal(has(report, "ARTIFACT_MISMATCH"), false);
    assert.equal(report.packageGate, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a missing approval", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-missing-"));
    const packaged = stageApplied(dir, body);
    const report = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval: null,
      trustedFingerprint: "ab".repeat(32),
    });
    assertClosed(report);
    assert.equal(report.signatureVerified, false);
    assert.equal(has(report, "MISSING_APPROVAL"), true);
    assert.equal(report.packageGate, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a forged signature", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-forged-"));
    const packaged = stageApplied(dir, body);
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, packaged);
    const flipped = Buffer.from(approval.signature, "base64");
    flipped[0] ^= 0xff;
    const report = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval: { statement: approval.statement, signature: flipped.toString("base64") },
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assertClosed(report);
    assert.equal(report.signatureVerified, false);
    assert.equal(has(report, "FORGED_SIGNATURE"), true);
    const truncated = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval: { statement: approval.statement, signature: "forged" },
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assert.equal(truncated.signatureVerified, false);
    assert.equal(has(truncated, "FORGED_SIGNATURE"), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects an unknown public key", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-unknown-"));
    const packaged = stageApplied(dir, body);
    const { publicKey, privateKey } = disposableKey();
    const approval = approvalFor(privateKey, pinned, packaged);
    const unpinned = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: "",
    });
    assertClosed(unpinned);
    assert.equal(unpinned.signatureVerified, true);
    assert.equal(unpinned.trustedKey, false);
    assert.equal(has(unpinned, "UNKNOWN_KEY"), true);
    const absent = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval,
      publicKey: null,
      trustedFingerprint: fingerprintPublicKey(publicKey) as string,
    });
    assert.equal(absent.signatureVerified, false);
    assert.equal(has(absent, "UNKNOWN_KEY"), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects the wrong image digest and does not treat a matching digest as image proof", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-image-"));
    const packaged = stageApplied(dir, body);
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, packaged, SOURCE, IMAGE_A);
    const mismatch = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
      claimedImageDigest: IMAGE_B,
    });
    assertClosed(mismatch);
    assert.equal(mismatch.imageBinding, "IMAGE_MISMATCH");
    assert.equal(has(mismatch, "IMAGE_MISMATCH"), true);
    assert.equal(mismatch.packageGate, true, JSON.stringify(mismatch.failures));
    const same = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
      claimedImageDigest: IMAGE_A,
    });
    assert.equal(same.imageBinding, "NOT_VERIFIED");
    assert.equal(has(same, "IMAGE_UNVERIFIED"), true);
    assert.equal(same.failures.find((failure) => failure.code === "IMAGE_UNVERIFIED")?.detail, "match-is-not-extract");
    assertClosed(same);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects an unapproved pending migration", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-pending-"));
    stageApplied(dir, body);
    const extra = path.join(dir, "artifact", "prisma", "migrations", PENDING[0]);
    mkdirSync(extra, { recursive: true });
    copyFileSync(path.join(migrationRoot, PENDING[0], "migration.sql"), path.join(extra, "migration.sql"));
    const packaged = readPackagedArtifact(path.join(dir, "artifact"));
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, packaged);
    const report = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assertClosed(report);
    assert.equal(report.signatureVerified, true);
    assert.equal(has(report, "UNAPPROVED_FOLDER"), true);
    assert.equal(report.unapprovedPending.includes(PENDING[0]), true);
    assert.equal(report.packageGate, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects missing migration history", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-history-"));
    const packaged = stageApplied(dir, body);
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, packaged);
    const report = check({
      manifest: pinned,
      packaged,
      history: historyFor(body.applied).slice(1),
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assertClosed(report);
    assert.equal(has(report, "MISSING_HISTORY"), true);
    assert.equal(report.failures.some((failure) => failure.code === "MISSING_HISTORY" && failure.name === body.applied[0].name), true);
    assert.equal(report.packageGate, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a rolled-back or incomplete migration", () => {
    const body = manifest();
    const pinned = { ...body, approvedGitSha: SOURCE };
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-rolled-"));
    const packaged = stageApplied(dir, body);
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    const approval = approvalFor(privateKey, pinned, packaged);
    const rolled = historyFor(body.applied, (row) => {
      if (row.migration_name === body.applied[1]?.name) row.rolled_back_at = "2026-01-02T00:00:00.000Z";
    });
    const rolledReport = check({
      manifest: pinned,
      packaged,
      history: rolled,
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assertClosed(rolledReport);
    assert.equal(rolledReport.failures.some((failure) => failure.code === "INCOMPLETE" && failure.name === body.applied[1].name), true);
    const unfinished = historyFor(body.applied, (row) => {
      if (row.migration_name === body.applied[2]?.name) {
        row.finished_at = null;
        row.applied_steps_count = 0;
      }
    });
    const unfinishedReport = check({
      manifest: pinned,
      packaged,
      history: unfinished,
      approval,
      publicKey,
      trustedFingerprint: fingerprint,
    });
    assert.equal(unfinishedReport.failures.some((failure) => failure.code === "INCOMPLETE" && failure.name === body.applied[2].name), true);
    assert.equal(unfinishedReport.packageGate, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails closed on the current unapproved checkout", () => {
    const body = manifest();
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-checkout-"));
    const checkout = path.join(dir, "checkout");
    mkdirSync(path.join(checkout, "prisma", "migrations"), { recursive: true });
    copyFileSync(entrypoint, path.join(checkout, "docker-entrypoint.sh"));
    for (const name of [...body.applied, ...body.trackedPending].map((entry) => entry.name)) {
      copySql(path.join(checkout, "prisma", "migrations"), name);
    }
    const packaged = readPackagedArtifact(checkout);
    const report = check({
      manifest: body,
      packaged,
      history: historyFor(body.applied),
      approval: null,
      checkoutSha: SOURCE,
    });
    assertClosed(report);
    assert.equal(report.appliedMatch, 39);
    assert.deepEqual(report.unapprovedPending, PENDING);
    assert.equal(has(report, "UNPINNED_SHA"), true);
    assert.equal(has(report, "MISSING_APPROVAL"), true);
    assert.equal(report.failures.filter((failure) => failure.code === "UNAPPROVED_FOLDER").length, 3);
    assert.equal(report.packageGate, false);
    const historyFile = path.join(dir, "history.json");
    writeFileSync(historyFile, JSON.stringify(historyFor(body.applied)));
    const cli = run(["--manifest", manifestPath, "--artifact", checkout, "--history", historyFile, "--git-sha", SOURCE]);
    assert.equal(cli.status, 1);
    assert.equal(cli.report?.ok, false);
    assert.equal(cli.report?.releaseDecision, "NO-GO");
    assert.equal(cli.report?.productionApproval, false);
    assert.equal(cli.report?.failures.some((failure) => failure.code === "UNAPPROVED_FOLDER"), true);
    assert.equal(cli.report?.failures.some((failure) => failure.code === "UNPINNED_SHA"), true);
    assert.equal(cli.report?.failures.some((failure) => failure.code === "MISSING_APPROVAL"), true);
    assert.equal(cli.report?.failures.some((failure) => failure.code === "CALLER_SHA_REJECTED"), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("allows a pending folder in the package gate only when the manifest names it", () => {
    const body = manifest();
    const pending = body.trackedPending.find((entry) => entry.name === PENDING[0]);
    assert.ok(pending);
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-named-"));
    const source = path.join(dir, "source");
    for (const name of [...body.applied.map((entry) => entry.name), pending.name]) copySql(source, name);
    const named = { ...body, approvedGitSha: SOURCE, approvedPending: [pending] };
    const packaged = stageReleaseArtifact({
      manifest: named,
      sourceRoot: source,
      entrypointPath: entrypoint,
      outDir: path.join(dir, "named"),
    });
    const { publicKey, privateKey } = disposableKey();
    const report = check({
      manifest: named,
      packaged,
      history: historyFor(body.applied),
      approval: approvalFor(privateKey, named, packaged),
      publicKey,
      trustedFingerprint: fingerprintPublicKey(publicKey) as string,
    });
    assertClosed(report);
    assert.equal(report.packageGate, true, JSON.stringify(report.failures));
    assert.deepEqual(report.approvedPending, [pending.name]);
    const omitted = stageReleaseArtifact({
      manifest: body,
      sourceRoot: migrationRoot,
      entrypointPath: entrypoint,
      outDir: path.join(dir, "omitted"),
    });
    assert.equal(omitted.folders.some((folder: { name: string }) => folder.name === pending.name), false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps the failed GitHub attestation workflow out of the operator command", () => {
    const docker = readFileSync(path.join(repo, "Dockerfile"), "utf8");
    assert.match(docker, /COPY deploy\/docker-entrypoint\.sh \/docker-entrypoint\.sh/);
    assert.match(docker, /ENTRYPOINT \["\/docker-entrypoint\.sh"\]/);
    const ignore = readFileSync(path.join(repo, ".dockerignore"), "utf8");
    for (const name of PENDING) assert.match(ignore, new RegExp(name));
    const workflow = readFileSync(path.join(repo, "scripts/release-provenance.workflow.yml"), "utf8");
    assert.equal(workflow.includes("migrate deploy"), false);
    assert.equal(workflow.includes("db push"), false);
    assert.equal(workflow.includes("pull_request"), false);
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /confirm_sha/);
    assert.match(workflow, /actions\/attest-build-provenance@v2/);
    assert.match(workflow, /This job is not a deployment/);
    assert.match(workflow, /not a Docker image digest/);
    const source = readFileSync(script, "utf8");
    assert.equal(source.includes("migrate deploy"), false);
    assert.equal(source.includes("migrate status"), false);
    assert.equal(source.includes("attestation verify"), false);
    assert.equal(source.includes('spawnSync("gh"'), false);
    const doc = readFileSync(path.join(repo, "docs/M2_4_RELEASE_SAFETY.md"), "utf8");
    assert.match(doc, /40359014239/);
    assert.match(doc, /UNPINNED/);
    assert.match(doc, /NOT VERIFIED/);
    assert.match(doc, /user-owned private repositories/);
    const blocked = run(["--manifest", manifestPath, "--artifact", repo, "--history", manifestPath, "--attestation", path.join(repo, "package.json")]);
    assert.equal(blocked.status, 1);
    assert.equal(blocked.report?.failures.some((failure) => failure.code === "GITHUB_ATTESTATION_UNAVAILABLE"), true);
    assert.equal(blocked.report?.ok, false);
  });

  it("refuses an in-repo private key and does not treat a disposable signature as production approval", () => {
    const refused = spawnSync(process.execPath, [signScript, "--private-key", trustFile, "--statement", manifestPath, "--out", path.join(tmpdir(), "atlasnow-should-not-write.json")], { encoding: "utf8" });
    assert.equal(refused.status, 1);
    assert.match(refused.stdout, /PRIVATE_KEY_INSIDE_REPO/);
    const body = manifest();
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-operator-cli-"));
    const packaged = stageApplied(dir, body);
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).stdout.trim();
    const pinned = { ...body, approvedGitSha: head };
    const { publicKey, privateKey } = disposableKey();
    const fingerprint = fingerprintPublicKey(publicKey) as string;
    writeFileSync(path.join(dir, "key.pem"), privateKey.export({ type: "pkcs8", format: "pem" }));
    writeFileSync(path.join(dir, "key.pub.pem"), publicKey.export({ type: "spki", format: "pem" }));
    writeFileSync(path.join(dir, "statement.json"), JSON.stringify(statementFor(pinned, packaged, head)));
    writeFileSync(path.join(dir, "trust.txt"), `${fingerprint}\n`);
    const signed = spawnSync(process.execPath, [signScript, "--private-key", path.join(dir, "key.pem"), "--statement", path.join(dir, "statement.json"), "--out", path.join(dir, "approval.json")], { encoding: "utf8" });
    assert.equal(signed.status, 0, signed.stderr);
    const manifestFile = path.join(dir, "manifest.json");
    const historyFile = path.join(dir, "history.json");
    writeFileSync(manifestFile, JSON.stringify(pinned));
    writeFileSync(historyFile, JSON.stringify(historyFor(body.applied)));
    const verified = run([
      "--manifest", manifestFile,
      "--artifact", path.join(dir, "artifact"),
      "--history", historyFile,
      "--approval", path.join(dir, "approval.json"),
      "--public-key", path.join(dir, "key.pub.pem"),
      "--trust-fingerprint", path.join(dir, "trust.txt"),
    ]);
    assert.equal(verified.status, 1);
    assert.equal(verified.report?.packageGate, true, JSON.stringify(verified.report?.failures));
    assert.equal(verified.report?.signatureVerified, true);
    assert.equal(verified.report?.trustedKey, true);
    assert.equal(verified.report?.pinMatches, false);
    assert.equal(verified.report?.productionApproval, false);
    assert.equal(verified.report?.releaseDecision, "NO-GO");
    assert.equal(verified.report?.imageBinding, "NOT_VERIFIED");
    assert.equal(verified.report?.ok, false);
    const planted = path.join(dir, "artifact", "planted.pub.pem");
    copyFileSync(path.join(dir, "key.pub.pem"), planted);
    const plantedRun = run([
      "--manifest", manifestFile,
      "--artifact", path.join(dir, "artifact"),
      "--history", historyFile,
      "--approval", path.join(dir, "approval.json"),
      "--public-key", planted,
      "--trust-fingerprint", path.join(dir, "trust.txt"),
    ]);
    assert.equal(plantedRun.status, 1);
    assert.equal(plantedRun.report?.failures.some((failure) => failure.code === "KEY_FROM_ARTIFACT"), true);
    assert.equal(plantedRun.report?.productionApproval, false);
    rmSync(dir, { recursive: true, force: true });
  });
});
