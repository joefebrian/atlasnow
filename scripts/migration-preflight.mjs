import { createHash, createPublicKey, sign, verify } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const TRUST = Object.freeze({
  repositoryNwo: "joefebrian/atlasnow",
  repositoryId: "1373362968",
});

export const APPROVAL_PURPOSE = "atlasnow-migration-package-approval";
export const TRUST_FINGERPRINT_FILE = "scripts/release-trust-fingerprint.txt";
export const STATEMENT_KEYS = Object.freeze([
  "schemaVersion",
  "purpose",
  "repository",
  "sourceSha",
  "artifactDigest",
  "inventoryDigest",
  "applied",
  "approvedPending",
  "imageDigest",
]);

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const IMAGE_DIGEST = /^sha256:[0-9a-f]{64}$/;
const NAME = /^[A-Za-z0-9_]+$/;
const PACKAGE_BLOCKERS = new Set([
  "UNPINNED_SHA",
  "SHA_MISMATCH",
  "MANIFEST_INVALID",
  "MISSING_FOLDER",
  "CHECKSUM_MISMATCH",
  "UNAPPROVED_FOLDER",
  "MISSING_PENDING_FOLDER",
  "PENDING_ALREADY_APPLIED",
  "MISSING_HISTORY",
  "UNEXPECTED_HISTORY",
  "DUPLICATE",
  "INCOMPLETE",
  "MISSING_APPROVAL",
  "UNKNOWN_KEY",
  "FORGED_SIGNATURE",
  "WRONG_SIGNER",
  "REPOSITORY_MISMATCH",
  "INVENTORY_MISMATCH",
  "STATEMENT_INVALID",
  "ARTIFACT_MISMATCH",
  "CALLER_SHA_REJECTED",
  "ENTRYPOINT_MIGRATES",
  "MISSING_ENTRYPOINT",
  "GITHUB_ATTESTATION_UNAVAILABLE",
  "KEY_FROM_ARTIFACT",
]);

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

function insideRoot(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function nameList(value) {
  if (!Array.isArray(value)) return null;
  if (!value.every((name) => typeof name === "string" && NAME.test(name))) return null;
  if (new Set(value).size !== value.length) return null;
  const sorted = [...value].sort((left, right) => left.localeCompare(right));
  if (value.some((name, index) => name !== sorted[index])) return null;
  return [...value];
}

function sameNames(left, right) {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}

export function fingerprintPublicKey(publicKey) {
  const key = publicKey && typeof publicKey.export === "function" ? publicKey : createPublicKey(publicKey);
  const der = key.export({ type: "spki", format: "der" });
  return sha256Bytes(der);
}

export function readTrustPin(file) {
  try {
    const text = readFileSync(file, "utf8").trim().toLowerCase();
    if (SHA256_HEX.test(text)) return { pinned: true, fingerprint: text };
  } catch {
    return { pinned: false, fingerprint: "" };
  }
  return { pinned: false, fingerprint: "" };
}

export function canonicalApproval(statement) {
  if (!statement || typeof statement !== "object" || Array.isArray(statement)) {
    return { ok: false, code: "STATEMENT_INVALID", detail: "object" };
  }
  const present = Object.keys(statement);
  for (const key of present) {
    if (!STATEMENT_KEYS.includes(key)) return { ok: false, code: "STATEMENT_INVALID", detail: key };
  }
  for (const key of STATEMENT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(statement, key)) {
      return { ok: false, code: "STATEMENT_INVALID", detail: key };
    }
  }
  if (statement.schemaVersion !== 1) return { ok: false, code: "STATEMENT_INVALID", detail: "schemaVersion" };
  if (statement.purpose !== APPROVAL_PURPOSE) return { ok: false, code: "STATEMENT_INVALID", detail: "purpose" };
  if (statement.repository !== TRUST.repositoryNwo) return { ok: false, code: "REPOSITORY_MISMATCH", detail: "repository" };
  if (!SHA40.test(statement.sourceSha)) return { ok: false, code: "STATEMENT_INVALID", detail: "sourceSha" };
  if (!SHA256_HEX.test(statement.artifactDigest)) return { ok: false, code: "STATEMENT_INVALID", detail: "artifactDigest" };
  if (!SHA256_HEX.test(statement.inventoryDigest)) return { ok: false, code: "STATEMENT_INVALID", detail: "inventoryDigest" };
  const applied = nameList(statement.applied);
  if (!applied) return { ok: false, code: "STATEMENT_INVALID", detail: "applied" };
  const approvedPending = nameList(statement.approvedPending);
  if (!approvedPending) return { ok: false, code: "STATEMENT_INVALID", detail: "approvedPending" };
  if (applied.some((name) => approvedPending.includes(name))) {
    return { ok: false, code: "STATEMENT_INVALID", detail: "overlap" };
  }
  if (statement.imageDigest !== null && !IMAGE_DIGEST.test(String(statement.imageDigest))) {
    return { ok: false, code: "STATEMENT_INVALID", detail: "imageDigest" };
  }
  const body = {
    schemaVersion: 1,
    purpose: APPROVAL_PURPOSE,
    repository: TRUST.repositoryNwo,
    sourceSha: statement.sourceSha,
    artifactDigest: statement.artifactDigest,
    inventoryDigest: statement.inventoryDigest,
    applied,
    approvedPending,
    imageDigest: statement.imageDigest,
  };
  return { ok: true, bytes: Buffer.from(JSON.stringify(body)), statement: body };
}

export function signApproval(privateKey, statement) {
  const canonical = canonicalApproval(statement);
  if (!canonical.ok) {
    const error = new Error(canonical.code);
    error.code = canonical.code;
    throw error;
  }
  return {
    statement: canonical.statement,
    signature: sign(null, canonical.bytes, privateKey).toString("base64"),
  };
}

function detachedSignature(bytes, signature, publicKey) {
  if (!publicKey) return { verified: false, code: "UNKNOWN_KEY", detail: "public-key" };
  const raw = Buffer.from(String(signature ?? ""), "base64");
  if (!signature || raw.length !== 64) return { verified: false, code: "FORGED_SIGNATURE", detail: "encoding" };
  try {
    if (!verify(null, bytes, publicKey, raw)) return { verified: false, code: "FORGED_SIGNATURE", detail: "verify" };
  } catch {
    return { verified: false, code: "FORGED_SIGNATURE", detail: "verify" };
  }
  return { verified: true, code: "", detail: "" };
}

export function privateKeyLocation(keyPath, repoRoot) {
  if (!keyPath) return { ok: false, code: "PRIVATE_KEY_INSIDE_REPO" };
  const resolved = path.resolve(repoRoot, keyPath);
  if (insideRoot(resolved, repoRoot)) return { ok: false, code: "PRIVATE_KEY_INSIDE_REPO" };
  try {
    if (insideRoot(realpathSync(resolved), repoRoot)) return { ok: false, code: "PRIVATE_KEY_INSIDE_REPO" };
  } catch {
    return { ok: true, resolved };
  }
  return { ok: true, resolved };
}

export function publicKeyLocation(keyPath, artifactRoot) {
  if (!keyPath) return { ok: false, code: "UNKNOWN_KEY" };
  const resolved = path.resolve(keyPath);
  if (artifactRoot && insideRoot(resolved, artifactRoot)) return { ok: false, code: "KEY_FROM_ARTIFACT" };
  try {
    const real = realpathSync(resolved);
    if (artifactRoot && insideRoot(real, artifactRoot)) return { ok: false, code: "KEY_FROM_ARTIFACT" };
    return { ok: true, resolved: real };
  } catch {
    return { ok: false, code: "UNKNOWN_KEY" };
  }
}

function canonicalBody(files) {
  const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path));
  return JSON.stringify({
    version: 1,
    files: sorted.map((file) => ({ path: file.path, sha256: file.sha256 })),
  });
}

export function inventoryCanonical(manifest) {
  const entries = (value) => [...(value ?? [])]
    .map((entry) => ({ name: String(entry.name), sha256: String(entry.sha256).toLowerCase() }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return JSON.stringify({
    applied: entries(manifest.applied),
    approvedPending: entries(manifest.approvedPending),
  });
}

export function inventoryDigest(manifest) {
  return sha256Bytes(Buffer.from(inventoryCanonical(manifest)));
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

function sortedNames(entries) {
  return [...entries].map((entry) => entry.name).sort((left, right) => left.localeCompare(right));
}

function blankReport(artifactDigest) {
  return {
    ok: false,
    releaseDecision: "NO-GO",
    productionApproval: false,
    packageGate: false,
    signatureVerified: false,
    trustedKey: false,
    pinMatches: false,
    imageBinding: "NOT_VERIFIED",
    appliedMatch: 0,
    approvedPending: [],
    unapprovedPending: [],
    failures: [],
    sourceDigest: "",
    artifactDigest,
    inventoryDigest: "",
    keyFingerprint: "",
  };
}

export function evaluatePreflight({
  manifest,
  packaged,
  history,
  approval,
  publicKey,
  keyRejected,
  trustedFingerprint,
  repoPin,
  checkoutSha,
  callerSha,
  attestationProvided,
  claimedImageDigest,
}) {
  const failures = [];
  const applied = Array.isArray(manifest?.applied) ? manifest.applied : [];
  const approvedPending = Array.isArray(manifest?.approvedPending) ? manifest.approvedPending : [];
  const names = new Set();
  for (const entry of applied) {
    if (!entry?.name || !entry?.sha256 || names.has(entry.name)) fail(failures, "MANIFEST_INVALID", entry?.name ?? "", "applied");
    names.add(entry.name);
  }
  for (const entry of approvedPending) {
    if (!entry?.name || !entry?.sha256 || names.has(entry.name)) fail(failures, "MANIFEST_INVALID", entry?.name ?? "", "approvedPending");
    names.add(entry.name);
  }

  if (attestationProvided) fail(failures, "GITHUB_ATTESTATION_UNAVAILABLE", "", "user-owned private repository");
  if (keyRejected) fail(failures, keyRejected, "", "public-key");

  let statement = null;
  let signatureVerified = false;
  let keyFingerprint = "";
  if (!approval) {
    fail(failures, "MISSING_APPROVAL", "", "");
  } else if (approval.publicKey || approval.statement?.publicKey) {
    fail(failures, "STATEMENT_INVALID", "", "publicKey");
  } else {
    const canonical = canonicalApproval(approval.statement);
    if (!canonical.ok) fail(failures, canonical.code, "", canonical.detail);
    else {
      statement = canonical.statement;
      const verdict = detachedSignature(canonical.bytes, approval.signature, keyRejected ? null : publicKey);
      signatureVerified = verdict.verified;
      if (!verdict.verified) fail(failures, verdict.code, "", verdict.detail);
      if (publicKey && !keyRejected) {
        try {
          keyFingerprint = fingerprintPublicKey(publicKey);
        } catch {
          keyFingerprint = "";
          fail(failures, "UNKNOWN_KEY", "", "public-key");
        }
      }
    }
  }

  const trusted = String(trustedFingerprint ?? "").toLowerCase();
  const trustedKey = signatureVerified && SHA256_HEX.test(trusted) && trusted === keyFingerprint;
  if (signatureVerified && !trustedKey) {
    fail(failures, SHA256_HEX.test(trusted) ? "WRONG_SIGNER" : "UNKNOWN_KEY", "", "fingerprint");
  }
  const pin = String(repoPin ?? "").toLowerCase();
  const pinMatches = trustedKey && SHA256_HEX.test(pin) && pin === keyFingerprint;
  if (!pinMatches) fail(failures, "PRODUCTION_UNAPPROVED", "", "trust-pin");

  const checkout = String(checkoutSha ?? "").toLowerCase();
  if (blank(manifest?.approvedGitSha)) fail(failures, "UNPINNED_SHA", "", "approvedGitSha");
  else if (String(manifest.approvedGitSha).toLowerCase() !== checkout) fail(failures, "SHA_MISMATCH", "", "manifest");
  if (!SHA40.test(checkout)) fail(failures, "SHA_MISMATCH", "", "checkout");
  else if (statement && statement.sourceSha !== checkout) fail(failures, "SHA_MISMATCH", "", "statement");
  if (!blank(callerSha) && String(callerSha).toLowerCase() !== checkout) fail(failures, "CALLER_SHA_REJECTED", "", "caller");

  const computedInventory = manifest ? inventoryDigest(manifest) : "";
  if (statement) {
    const appliedNames = sortedNames(applied);
    const pendingNames = sortedNames(approvedPending);
    if (statement.inventoryDigest !== computedInventory || !sameNames(statement.applied, appliedNames) || !sameNames(statement.approvedPending, pendingNames)) {
      fail(failures, "INVENTORY_MISMATCH", "", "inventory");
    }
    if (statement.artifactDigest !== packaged.digest) fail(failures, "ARTIFACT_MISMATCH", "", "digest");
  }

  const claimed = String(claimedImageDigest ?? "");
  let imageBinding = "NOT_VERIFIED";
  if (statement && statement.imageDigest && claimed && statement.imageDigest !== claimed) {
    imageBinding = "IMAGE_MISMATCH";
    fail(failures, "IMAGE_MISMATCH", "", "image");
  } else {
    const detail = statement?.imageDigest && claimed && statement.imageDigest === claimed ? "match-is-not-extract" : "";
    fail(failures, "IMAGE_UNVERIFIED", "", detail);
  }

  if (!packaged.entrypointPresent) fail(failures, "MISSING_ENTRYPOINT", "docker-entrypoint.sh", "");
  else if (entrypointMigrates(packaged.entrypointSource)) fail(failures, "ENTRYPOINT_MIGRATES", "docker-entrypoint.sh", "");

  const folders = packaged.folders ?? [];
  const onDisk = new Map(folders.map((folder) => [folder.name, folder]));
  const appliedNames = new Set(applied.map((entry) => entry.name));
  const pendingNames = new Set(approvedPending.map((entry) => entry.name));
  let appliedMatch = 0;
  const approvedPendingFound = [];
  for (const entry of applied) {
    const folder = onDisk.get(entry.name);
    if (!folder || !folder.sha256) {
      fail(failures, "MISSING_FOLDER", entry.name, "");
      continue;
    }
    if (folder.sha256 !== entry.sha256.toLowerCase()) fail(failures, "CHECKSUM_MISMATCH", entry.name, "folder");
    else appliedMatch += 1;
  }
  for (const entry of approvedPending) {
    const folder = onDisk.get(entry.name);
    if (!folder || !folder.sha256) {
      fail(failures, "MISSING_PENDING_FOLDER", entry.name, "");
      continue;
    }
    if (folder.sha256 !== entry.sha256.toLowerCase()) fail(failures, "CHECKSUM_MISMATCH", entry.name, "pending-folder");
    else approvedPendingFound.push(entry.name);
  }
  const unapprovedPending = [];
  for (const folder of folders) {
    if (appliedNames.has(folder.name) || pendingNames.has(folder.name)) continue;
    unapprovedPending.push(folder.name);
    fail(failures, "UNAPPROVED_FOLDER", folder.name, folder.sha256 ? "pending" : "no migration.sql");
  }

  const rows = asRows(history ?? []);
  const seen = new Set();
  const historyNames = new Set();
  for (const row of rows) {
    if (seen.has(row.migration_name)) fail(failures, "DUPLICATE", row.migration_name, "");
    seen.add(row.migration_name);
    historyNames.add(row.migration_name);
    const steps = Number(row.applied_steps_count);
    if (blank(row.started_at) || blank(row.finished_at) || !blank(row.rolled_back_at) || steps !== 1) {
      fail(failures, "INCOMPLETE", row.migration_name, "");
    }
    if (pendingNames.has(row.migration_name)) fail(failures, "PENDING_ALREADY_APPLIED", row.migration_name, "");
    else if (!appliedNames.has(row.migration_name)) fail(failures, "UNEXPECTED_HISTORY", row.migration_name, "");
    else {
      const expected = applied.find((entry) => entry.name === row.migration_name);
      if (expected && row.checksum !== expected.sha256.toLowerCase()) fail(failures, "CHECKSUM_MISMATCH", row.migration_name, "history");
    }
  }
  for (const entry of applied) {
    if (!historyNames.has(entry.name)) fail(failures, "MISSING_HISTORY", entry.name, "");
  }

  const packageGate = !failures.some((failure) => PACKAGE_BLOCKERS.has(failure.code));
  const productionApproval = pinMatches && packageGate && imageBinding === "VERIFIED";
  const releaseDecision = productionApproval ? "GO" : "NO-GO";
  return {
    ok: releaseDecision === "GO",
    releaseDecision,
    productionApproval,
    packageGate,
    signatureVerified,
    trustedKey,
    pinMatches,
    imageBinding,
    appliedMatch,
    approvedPending: approvedPendingFound,
    unapprovedPending,
    failures,
    sourceDigest: trustedKey && statement ? statement.sourceSha : "",
    artifactDigest: packaged.digest,
    inventoryDigest: computedInventory,
    keyFingerprint,
  };
}

function arg(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0 || index + 1 >= argv.length) return "";
  return argv[index + 1];
}

function gitHead(repoRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return "";
  return result.stdout.trim().toLowerCase();
}

export function runPreflight(argv, repoRoot = process.cwd()) {
  if (arg(argv, "--attestation")) {
    const report = blankReport("");
    report.failures = [{ code: "GITHUB_ATTESTATION_UNAVAILABLE", name: "", detail: "user-owned private repository" }];
    return report;
  }
  const manifest = JSON.parse(readFileSync(arg(argv, "--manifest"), "utf8"));
  const history = parseHistory(readFileSync(arg(argv, "--history"), "utf8"));
  const artifactDir = arg(argv, "--artifact");
  const packaged = readPackagedArtifact(artifactDir);
  const approvalPath = arg(argv, "--approval");
  let approval = null;
  if (approvalPath) approval = JSON.parse(readFileSync(approvalPath, "utf8"));
  const keyPath = arg(argv, "--public-key");
  let publicKey = null;
  let keyRejected = "";
  if (keyPath) {
    const location = publicKeyLocation(keyPath, artifactDir);
    if (!location.ok) keyRejected = location.code;
    else {
      try {
        publicKey = createPublicKey(readFileSync(location.resolved));
      } catch {
        keyRejected = "UNKNOWN_KEY";
      }
    }
  }
  const trustArg = arg(argv, "--trust-fingerprint");
  const trustFile = trustArg || path.join(repoRoot, TRUST_FINGERPRINT_FILE);
  const trusted = readTrustPin(trustFile);
  const pinned = readTrustPin(path.join(repoRoot, TRUST_FINGERPRINT_FILE));
  return evaluatePreflight({
    manifest,
    packaged,
    history,
    approval,
    publicKey,
    keyRejected,
    trustedFingerprint: trusted.fingerprint,
    repoPin: pinned.fingerprint,
    checkoutSha: gitHead(repoRoot),
    callerSha: arg(argv, "--git-sha"),
    attestationProvided: false,
    claimedImageDigest: arg(argv, "--image-digest"),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = runPreflight(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(report.ok ? 0 : 1);
}
