import { createHash, sign, verify } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const TRUST = Object.freeze({
  repository: "https://github.com/joefebrian/atlasnow",
  repositoryNwo: "joefebrian/atlasnow",
  repositoryId: "1373362968",
  issuer: "https://token.actions.githubusercontent.com",
  workflowPath: ".github/workflows/release-provenance.yml",
  runnerEnvironment: "github-hosted",
});

const STATEMENT_TYPE = "application/vnd.in-toto+json";
const FAILURE = {
  unpinned: "UNPINNED_SHA",
  sha: "SHA_MISMATCH",
  manifest: "MANIFEST_INVALID",
  missingFolder: "MISSING_FOLDER",
  checksum: "CHECKSUM_MISMATCH",
  unapproved: "UNAPPROVED_FOLDER",
  missingPending: "MISSING_PENDING_FOLDER",
  pendingApplied: "PENDING_ALREADY_APPLIED",
  missingHistory: "MISSING_HISTORY",
  unexpected: "UNEXPECTED_HISTORY",
  duplicate: "DUPLICATE",
  incomplete: "INCOMPLETE",
  missingProvenance: "MISSING_PROVENANCE",
  untrusted: "UNTRUSTED_PROVENANCE",
  artifact: "ARTIFACT_MISMATCH",
  caller: "CALLER_SHA_REJECTED",
  entrypoint: "ENTRYPOINT_MIGRATES",
  missingEntrypoint: "MISSING_ENTRYPOINT",
};

function fail(failures, code, name, detail) {
  failures.push({ code, name: name ?? "", detail: detail ?? "" });
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(file) {
  return sha256Bytes(readFileSync(file));
}

function blank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function pae(payloadType, payload) {
  const type = Buffer.from(payloadType);
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  return Buffer.concat([
    Buffer.from("DSSEv1 "),
    Buffer.from(String(type.length)),
    Buffer.from(" "),
    type,
    Buffer.from(" "),
    Buffer.from(String(body.length)),
    Buffer.from(" "),
    body,
  ]);
}

export function sealProvenance(privateKey, identity) {
  const payload = Buffer.from(JSON.stringify(identity));
  const signature = sign(null, pae(STATEMENT_TYPE, payload), privateKey);
  return {
    payloadType: STATEMENT_TYPE,
    payload: payload.toString("base64"),
    signature: signature.toString("base64"),
  };
}

export function openProvenance(publicKey, envelope) {
  try {
    const payload = Buffer.from(String(envelope?.payload ?? ""), "base64");
    const signature = Buffer.from(String(envelope?.signature ?? ""), "base64");
    const type = String(envelope?.payloadType ?? "");
    if (type !== STATEMENT_TYPE) return null;
    if (!verify(null, pae(type, payload), publicKey, signature)) return null;
    const identity = JSON.parse(payload.toString("utf8"));
    return { ...identity, proof: "signed" };
  } catch {
    return null;
  }
}

function signerPrefix() {
  return `https://github.com/${TRUST.repositoryNwo}/${TRUST.workflowPath}@`;
}

export function identityFieldsTrusted(identity) {
  if (!identity) return false;
  const source = String(identity.sourceRepositoryDigest ?? "").toLowerCase();
  const signerDigest = String(identity.buildSignerDigest ?? "").toLowerCase();
  return identity.sourceRepositoryURI === TRUST.repository
    && String(identity.sourceRepositoryIdentifier) === TRUST.repositoryId
    && identity.issuer === TRUST.issuer
    && identity.runnerEnvironment === TRUST.runnerEnvironment
    && String(identity.buildSignerURI ?? "").startsWith(signerPrefix())
    && signerDigest === source
    && /^[0-9a-f]{40}$/.test(source);
}

function canonicalBody(files) {
  const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path));
  return JSON.stringify({
    version: 1,
    files: sorted.map((file) => ({ path: file.path, sha256: file.sha256 })),
  });
}

export function readPackagedArtifact(root) {
  const entrypointPath = path.join(root, "docker-entrypoint.sh");
  const migrationRoot = path.join(root, "prisma", "migrations");
  let entrypointSource = "";
  const files = [];
  const folders = [];
  try {
    const bytes = readFileSync(entrypointPath);
    entrypointSource = bytes.toString("utf8");
    files.push({ path: "docker-entrypoint.sh", sha256: sha256Bytes(bytes) });
  } catch {
    entrypointSource = "";
  }
  let names = [];
  try {
    names = readdirSync(migrationRoot);
  } catch {
    names = [];
  }
  for (const name of names) {
    const dir = path.join(migrationRoot, name);
    if (!statSync(dir).isDirectory()) continue;
    const sqlPath = path.join(dir, "migration.sql");
    let hash = "";
    try {
      if (statSync(sqlPath).isFile()) hash = sha256File(sqlPath);
    } catch {
      hash = "";
    }
    folders.push({ name, sha256: hash });
    if (hash) files.push({ path: `prisma/migrations/${name}/migration.sql`, sha256: hash });
  }
  folders.sort((left, right) => left.name.localeCompare(right.name));
  const body = canonicalBody(files);
  return {
    body,
    digest: sha256Bytes(Buffer.from(body)),
    files,
    folders,
    entrypointSource,
    entrypointPresent: files.some((file) => file.path === "docker-entrypoint.sh"),
  };
}

export function releaseNames(manifest) {
  const pending = new Set((manifest.approvedPending ?? []).map((entry) => entry.name));
  const names = new Set((manifest.applied ?? []).map((entry) => entry.name));
  for (const name of pending) names.add(name);
  return names;
}

export function stageReleaseArtifact({ manifest, sourceRoot, entrypointPath, outDir }) {
  const allowed = releaseNames(manifest);
  mkdirSync(path.join(outDir, "prisma", "migrations"), { recursive: true });
  copyFileSync(entrypointPath, path.join(outDir, "docker-entrypoint.sh"));
  for (const name of readdirSync(sourceRoot)) {
    if (!allowed.has(name)) continue;
    const sql = path.join(sourceRoot, name, "migration.sql");
    const destDir = path.join(outDir, "prisma", "migrations", name);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(sql, path.join(destDir, "migration.sql"));
  }
  const packaged = readPackagedArtifact(outDir);
  writeFileSync(path.join(outDir, "atlasnow-migration-artifact.json"), packaged.body);
  return packaged;
}

function parseHistory(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  const lines = trimmed.split(/\r?\n/).filter((line) => line.length > 0);
  const header = lines[0].split(",").map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    header.forEach((key, index) => {
      row[key] = cells[index] ?? "";
    });
    return row;
  });
}

function asRows(history) {
  return history.map((row) => ({
    migration_name: String(row.migration_name ?? ""),
    checksum: String(row.checksum ?? "").toLowerCase(),
    started_at: row.started_at ?? "",
    finished_at: row.finished_at ?? "",
    rolled_back_at: row.rolled_back_at ?? "",
    applied_steps_count: row.applied_steps_count,
  }));
}

function entrypointMigrates(source) {
  const commands = String(source).split("\n").map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#"));
  return commands.some((line) => /migrate|prisma/i.test(line)) || !commands.some((line) => line.includes("server.js"));
}

export function evaluatePreflight({ manifest, packaged, history, identity, attestationProvided, callerSha }) {
  const failures = [];
  const applied = Array.isArray(manifest.applied) ? manifest.applied : [];
  const approvedPending = Array.isArray(manifest.approvedPending) ? manifest.approvedPending : [];
  const names = new Set();
  for (const entry of applied) {
    if (!entry?.name || !entry?.sha256 || names.has(entry.name)) fail(failures, FAILURE.manifest, entry?.name ?? "", "applied");
    names.add(entry.name);
  }
  for (const entry of approvedPending) {
    if (!entry?.name || !entry?.sha256 || names.has(entry.name)) fail(failures, FAILURE.manifest, entry?.name ?? "", "approvedPending");
    names.add(entry.name);
  }

  const proof = identity?.proof;
  const signed = proof === "signed" || proof === "github-attestation";
  if (!attestationProvided) fail(failures, FAILURE.missingProvenance, "", "");
  else if (!identity || !signed) fail(failures, FAILURE.untrusted, "", "proof");
  else if (!identityFieldsTrusted(identity)) fail(failures, FAILURE.untrusted, "", "identity");
  else if (String(identity.artifactDigest ?? "").toLowerCase() !== packaged.digest) fail(failures, FAILURE.artifact, "", "digest");

  const source = String(identity?.sourceRepositoryDigest ?? "").toLowerCase();
  if (blank(manifest.approvedGitSha)) fail(failures, FAILURE.unpinned, "", "approvedGitSha");
  else if (!signed || source !== String(manifest.approvedGitSha).toLowerCase()) fail(failures, FAILURE.sha, "", "certificate");
  if (!blank(callerSha) && (!signed || String(callerSha).toLowerCase() !== source)) {
    fail(failures, FAILURE.caller, "", "caller");
  }

  if (!packaged.entrypointPresent) fail(failures, FAILURE.missingEntrypoint, "docker-entrypoint.sh", "");
  else if (entrypointMigrates(packaged.entrypointSource)) fail(failures, FAILURE.entrypoint, "docker-entrypoint.sh", "");

  const folders = packaged.folders ?? [];
  const onDisk = new Map(folders.map((folder) => [folder.name, folder]));
  const appliedNames = new Set(applied.map((entry) => entry.name));
  const pendingNames = new Set(approvedPending.map((entry) => entry.name));
  let appliedMatch = 0;
  const approvedPendingFound = [];
  for (const entry of applied) {
    const folder = onDisk.get(entry.name);
    if (!folder || !folder.sha256) {
      fail(failures, FAILURE.missingFolder, entry.name, "");
      continue;
    }
    if (folder.sha256 !== entry.sha256.toLowerCase()) fail(failures, FAILURE.checksum, entry.name, "folder");
    else appliedMatch += 1;
  }
  for (const entry of approvedPending) {
    const folder = onDisk.get(entry.name);
    if (!folder || !folder.sha256) {
      fail(failures, FAILURE.missingPending, entry.name, "");
      continue;
    }
    if (folder.sha256 !== entry.sha256.toLowerCase()) fail(failures, FAILURE.checksum, entry.name, "pending-folder");
    else approvedPendingFound.push(entry.name);
  }
  const unapprovedPending = [];
  for (const folder of folders) {
    if (appliedNames.has(folder.name) || pendingNames.has(folder.name)) continue;
    unapprovedPending.push(folder.name);
    fail(failures, FAILURE.unapproved, folder.name, folder.sha256 ? "pending" : "no migration.sql");
  }

  const rows = asRows(history);
  const seen = new Set();
  const historyNames = new Set();
  for (const row of rows) {
    if (seen.has(row.migration_name)) fail(failures, FAILURE.duplicate, row.migration_name, "");
    seen.add(row.migration_name);
    historyNames.add(row.migration_name);
    const steps = Number(row.applied_steps_count);
    if (blank(row.started_at) || blank(row.finished_at) || !blank(row.rolled_back_at) || steps !== 1) {
      fail(failures, FAILURE.incomplete, row.migration_name, "");
    }
    if (pendingNames.has(row.migration_name)) fail(failures, FAILURE.pendingApplied, row.migration_name, "");
    else if (!appliedNames.has(row.migration_name)) fail(failures, FAILURE.unexpected, row.migration_name, "");
    else {
      const expected = applied.find((entry) => entry.name === row.migration_name);
      if (expected && row.checksum !== expected.sha256.toLowerCase()) fail(failures, FAILURE.checksum, row.migration_name, "history");
    }
  }
  for (const entry of applied) {
    if (!historyNames.has(entry.name)) fail(failures, FAILURE.missingHistory, entry.name, "");
  }

  return {
    ok: failures.length === 0,
    appliedMatch,
    approvedPending: approvedPendingFound,
    unapprovedPending,
    failures,
    sourceDigest: signed ? source : "",
    artifactDigest: packaged.digest,
  };
}

function pickCertificate(certificate, key) {
  return certificate?.[key] ?? certificate?.extensions?.[key] ?? "";
}

export function identityFromGitHubVerification(parsed, artifactDigest) {
  const row = Array.isArray(parsed) ? parsed[0] : null;
  const verification = row?.verificationResult ?? null;
  const certificate = verification?.signature?.certificate;
  const subject = verification?.statement?.subject?.find((item) => item?.digest?.sha256);
  const stated = String(subject?.digest?.sha256 ?? "").toLowerCase();
  if (!certificate || !stated || stated !== artifactDigest) return null;
  return {
    proof: "github-attestation",
    sourceRepositoryDigest: String(pickCertificate(certificate, "sourceRepositoryDigest")).toLowerCase(),
    sourceRepositoryURI: pickCertificate(certificate, "sourceRepositoryURI"),
    sourceRepositoryIdentifier: String(pickCertificate(certificate, "sourceRepositoryIdentifier")),
    issuer: pickCertificate(certificate, "issuer"),
    buildSignerURI: pickCertificate(certificate, "buildSignerURI"),
    buildSignerDigest: String(pickCertificate(certificate, "buildSignerDigest")).toLowerCase(),
    runnerEnvironment: pickCertificate(certificate, "runnerEnvironment"),
    artifactDigest: stated,
  };
}

export function verifyGitHubAttestation({ artifactFile, bundlePath }) {
  const artifactDigest = sha256File(artifactFile);
  const result = spawnSync("gh", [
    "attestation", "verify", artifactFile,
    "--bundle", bundlePath,
    "--repo", TRUST.repositoryNwo,
    "--signer-workflow", `${TRUST.repositoryNwo}/${TRUST.workflowPath}`,
    "--cert-oidc-issuer", TRUST.issuer,
    "--deny-self-hosted-runners",
    "--format", "json",
  ], { encoding: "utf8", timeout: 20000 });
  if (result.status !== 0) return null;
  try {
    const text = result.stdout.trim();
    const start = text.indexOf("[");
    if (start < 0) return null;
    return identityFromGitHubVerification(JSON.parse(text.slice(start)), artifactDigest);
  } catch {
    return null;
  }
}

function arg(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0 || index + 1 >= argv.length) return "";
  return argv[index + 1];
}

export function runPreflight(argv) {
  const manifest = JSON.parse(readFileSync(arg(argv, "--manifest"), "utf8"));
  const history = parseHistory(readFileSync(arg(argv, "--history"), "utf8"));
  const packaged = readPackagedArtifact(arg(argv, "--artifact"));
  const bundle = arg(argv, "--attestation");
  const attestationProvided = bundle.length > 0;
  let identity = null;
  if (attestationProvided) {
    const file = path.join(tmpdir(), `atlasnow-artifact-${packaged.digest}.json`);
    writeFileSync(file, packaged.body);
    identity = verifyGitHubAttestation({ artifactFile: file, bundlePath: bundle });
  }
  return evaluatePreflight({
    manifest,
    packaged,
    history,
    identity,
    attestationProvided,
    callerSha: arg(argv, "--git-sha"),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = runPreflight(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(report.ok ? 0 : 1);
}
