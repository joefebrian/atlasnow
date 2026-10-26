import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createHash, generateKeyPairSync } from "node:crypto";
import {
  TRUST,
  evaluatePreflight,
  openProvenance,
  readPackagedArtifact,
  sealProvenance,
  stageReleaseArtifact,
  verifyGitHubAttestation,
} from "../../../scripts/migration-preflight.mjs";

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

const SOURCE = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "fedcba9876543210fedcba9876543210fedcba98";

function copySql(source: string, name: string) {
  const dest = path.join(source, name);
  mkdirSync(dest, { recursive: true });
  copyFileSync(path.join(migrationRoot, name, "migration.sql"), path.join(dest, "migration.sql"));
}

function stageApplied(dir: string, manifestBody: ReturnType<typeof manifest>) {
  return stageReleaseArtifact({
    manifest: manifestBody,
    sourceRoot: migrationRoot,
    entrypointPath: entrypoint,
    outDir: path.join(dir, "artifact"),
  });
}

function identityFor(digest: string, source = SOURCE) {
  return {
    sourceRepositoryDigest: source,
    sourceRepositoryURI: TRUST.repository,
    sourceRepositoryIdentifier: TRUST.repositoryId,
    issuer: TRUST.issuer,
    buildSignerURI: `https://github.com/${TRUST.repositoryNwo}/${TRUST.workflowPath}@refs/heads/feature/conversational-commerce-m2-4`,
    buildSignerDigest: source,
    runnerEnvironment: TRUST.runnerEnvironment,
    artifactDigest: digest,
  };
}

function signedIdentity(digest: string, source = SOURCE) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const envelope = sealProvenance(privateKey, identityFor(digest, source));
  return { publicKey, privateKey, envelope, identity: openProvenance(publicKey, envelope) };
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

  it("accepts a signed provenance for the 39 applied folders and rejects the release hazards", () => {
    const body = manifest();
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-provenance-"));
    const packaged = stageApplied(dir, body);
    assert.equal(packaged.folders.length, 39);
    assert.deepEqual(packaged.folders.map((folder) => folder.name).filter((name) => PENDING.includes(name)), []);
    const pinned = { ...body, approvedGitSha: SOURCE };
    const history = historyFor(body.applied);
    const { identity } = signedIdentity(packaged.digest);
    const pass = evaluatePreflight({ manifest: pinned, packaged, history, identity, attestationProvided: true, callerSha: "" });
    assert.equal(pass.ok, true, JSON.stringify(pass.failures));
    assert.equal(pass.appliedMatch, 39);

    const wrong = signedIdentity(packaged.digest, OTHER).identity;
    const wrongCommit = evaluatePreflight({ manifest: pinned, packaged, history, identity: wrong, attestationProvided: true, callerSha: "" });
    assert.equal(wrongCommit.ok, false);
    assert.equal(wrongCommit.failures.some((failure) => failure.code === "SHA_MISMATCH"), true);

    const changed = readPackagedArtifact(path.join(dir, "artifact"));
    writeFileSync(path.join(dir, "artifact", "prisma", "migrations", body.applied[0].name, "migration.sql"), "-- changed\n");
    const modified = readPackagedArtifact(path.join(dir, "artifact"));
    const stale = signedIdentity(changed.digest).identity;
    const modifiedArtifact = evaluatePreflight({ manifest: pinned, packaged: modified, history, identity: stale, attestationProvided: true, callerSha: SOURCE });
    assert.equal(modifiedArtifact.ok, false);
    assert.equal(modifiedArtifact.failures.some((failure) => failure.code === "ARTIFACT_MISMATCH"), true);

    const missingProvenance = evaluatePreflight({ manifest: pinned, packaged, history, identity: null, attestationProvided: false, callerSha: SOURCE });
    assert.equal(missingProvenance.ok, false);
    assert.equal(missingProvenance.failures.some((failure) => failure.code === "MISSING_PROVENANCE"), true);

    const { publicKey, envelope } = signedIdentity(packaged.digest);
    const forged = { ...envelope, signature: Buffer.from(envelope.signature, "base64").fill(9).toString("base64") };
    assert.equal(openProvenance(publicKey, forged), null);
    const forgedReport = evaluatePreflight({ manifest: pinned, packaged, history, identity: null, attestationProvided: true, callerSha: SOURCE });
    assert.equal(forgedReport.ok, false);
    assert.equal(forgedReport.failures.some((failure) => failure.code === "UNTRUSTED_PROVENANCE"), true);

    const callerOnly = evaluatePreflight({
      manifest: pinned,
      packaged,
      history,
      identity: { proof: "github-attestation", actionsConclusion: "success", sourceRepositoryDigest: SOURCE },
      attestationProvided: true,
      callerSha: SOURCE,
    });
    assert.equal(callerOnly.ok, false);
    assert.equal(callerOnly.failures.some((failure) => failure.code === "UNTRUSTED_PROVENANCE"), true);

    const extraDir = path.join(dir, "artifact", "prisma", "migrations", "20990101000000_extra");
    mkdirSync(extraDir);
    writeFileSync(path.join(extraDir, "migration.sql"), "SELECT 1;\n");
    const extraPackaged = readPackagedArtifact(path.join(dir, "artifact"));
    const extraIdentity = signedIdentity(extraPackaged.digest).identity;
    const extra = evaluatePreflight({ manifest: pinned, packaged: extraPackaged, history, identity: extraIdentity, attestationProvided: true, callerSha: "" });
    assert.equal(extra.ok, false);
    assert.equal(extra.failures.some((failure) => failure.code === "UNAPPROVED_FOLDER" && failure.name === "20990101000000_extra"), true);
    rmSync(extraDir, { recursive: true, force: true });

    writeFileSync(path.join(dir, "artifact", "prisma", "migrations", body.applied[0].name, "migration.sql"), readFileSync(path.join(migrationRoot, body.applied[0].name, "migration.sql")));
    const restored = readPackagedArtifact(path.join(dir, "artifact"));
    const restoredIdentity = signedIdentity(restored.digest).identity;
    const badHistory = historyFor(body.applied);
    badHistory[0] = { ...badHistory[0], checksum: "0".repeat(64) };
    const checksum = evaluatePreflight({ manifest: pinned, packaged: restored, history: badHistory, identity: restoredIdentity, attestationProvided: true, callerSha: "" });
    assert.equal(checksum.failures.some((failure) => failure.code === "CHECKSUM_MISMATCH"), true);

    const gap = evaluatePreflight({ manifest: pinned, packaged: restored, history: historyFor(body.applied).slice(1), identity: restoredIdentity, attestationProvided: true, callerSha: "" });
    assert.equal(gap.failures.some((failure) => failure.code === "MISSING_HISTORY"), true);

    const rolled = historyFor(body.applied, (row) => {
      if (row.migration_name === body.applied[1]?.name) row.rolled_back_at = "2026-01-02T00:00:00.000Z";
    });
    const incomplete = evaluatePreflight({ manifest: pinned, packaged: restored, history: rolled, identity: restoredIdentity, attestationProvided: true, callerSha: "" });
    assert.equal(incomplete.failures.some((failure) => failure.code === "INCOMPLETE"), true);

    const checkout = path.join(dir, "checkout");
    mkdirSync(path.join(checkout, "prisma", "migrations"), { recursive: true });
    copyFileSync(entrypoint, path.join(checkout, "docker-entrypoint.sh"));
    for (const name of [...body.applied, ...body.trackedPending].map((entry) => entry.name)) copySql(path.join(checkout, "prisma", "migrations"), name);
    const checkoutPackaged = readPackagedArtifact(checkout);
    const checkoutIdentity = signedIdentity(checkoutPackaged.digest).identity;
    const current = evaluatePreflight({ manifest: body, packaged: checkoutPackaged, history, identity: checkoutIdentity, attestationProvided: true, callerSha: SOURCE });
    assert.equal(current.ok, false);
    assert.equal(current.appliedMatch, 39);
    assert.deepEqual(current.unapprovedPending, PENDING);
    assert.equal(current.failures.some((failure) => failure.code === "UNPINNED_SHA"), true);
    assert.equal(current.failures.filter((failure) => failure.code === "UNAPPROVED_FOLDER").length, 3);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a caller SHA and a forged bundle at the operator command", () => {
    const body = manifest();
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-cli-provenance-"));
    const packaged = stageApplied(dir, body);
    const pinned = { ...body, approvedGitSha: SOURCE };
    const manifestFile = writeJson(dir, "manifest.json", pinned);
    const historyFile = writeJson(dir, "history.json", historyFor(body.applied));
    const artifact = path.join(dir, "artifact");
    const caller = run(["--manifest", manifestFile, "--artifact", artifact, "--history", historyFile, "--git-sha", SOURCE]);
    assert.equal(caller.status, 1);
    assert.equal(caller.report?.ok, false);
    assert.equal(caller.report?.failures.some((failure) => failure.code === "MISSING_PROVENANCE"), true);

    const { envelope } = signedIdentity(packaged.digest);
    const bundle = writeJson(dir, "bundle.json", envelope);
    const forged = run(["--manifest", manifestFile, "--artifact", artifact, "--history", historyFile, "--attestation", bundle, "--git-sha", SOURCE]);
    assert.equal(forged.status, 1);
    assert.equal(forged.report?.failures.some((failure) => failure.code === "UNTRUSTED_PROVENANCE"), true);
    const garbage = writeJson(dir, "garbage.json", { mediaType: "forged" });
    assert.equal(verifyGitHubAttestation({ artifactFile: path.join(artifact, "atlasnow-migration-artifact.json"), bundlePath: garbage }), null);
    rmSync(dir, { recursive: true, force: true });
  });

  it("allows a pending folder only when the manifest names it and the provenance matches", () => {
    const body = manifest();
    const pending = body.trackedPending.find((entry) => entry.name === PENDING[0]);
    assert.ok(pending);
    const dir = mkdtempSync(path.join(tmpdir(), "atlasnow-preflight-pending-"));
    const source = path.join(dir, "source");
    for (const name of [...body.applied.map((entry) => entry.name), pending.name]) copySql(source, name);
    const named = { ...body, approvedGitSha: SOURCE, approvedPending: [pending] };
    const out = path.join(dir, "named");
    const packaged = stageReleaseArtifact({ manifest: named, sourceRoot: source, entrypointPath: entrypoint, outDir: out });
    const identity = signedIdentity(packaged.digest).identity;
    const result = evaluatePreflight({
      manifest: named,
      packaged,
      history: historyFor(body.applied),
      identity,
      attestationProvided: true,
      callerSha: "",
    });
    assert.equal(result.ok, true, JSON.stringify(result.failures));
    assert.deepEqual(result.approvedPending, [pending.name]);
    const omitted = stageReleaseArtifact({ manifest: body, sourceRoot: migrationRoot, entrypointPath: entrypoint, outDir: path.join(dir, "omitted") });
    assert.equal(omitted.folders.some((folder) => folder.name === pending.name), false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("packages the non-migrating entrypoint and keeps attestation generation out of deployment", () => {
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
  });

  it("does not call prisma from the preflight program", () => {
    const source = readFileSync(script, "utf8");
    assert.equal(source.includes("migrate deploy"), false);
    assert.equal(source.includes("migrate status"), false);
    assert.equal(statSync(script).isFile(), true);
  });
});
