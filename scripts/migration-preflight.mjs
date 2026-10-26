import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
};

function fail(failures, code, name, detail) {
  failures.push({ code, name: name ?? "", detail: detail ?? "" });
}

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function readFolders(root) {
  const folders = [];
  for (const name of readdirSync(root)) {
    const dir = path.join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const sql = path.join(dir, "migration.sql");
    let hash = "";
    try {
      if (statSync(sql).isFile()) hash = sha256File(sql);
    } catch {
      hash = "";
    }
    folders.push({ name, sha256: hash });
  }
  return folders.sort((a, b) => a.name.localeCompare(b.name));
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

function blank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

export function evaluatePreflight({ manifest, folders, history, gitSha }) {
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
  if (blank(manifest.approvedGitSha)) fail(failures, FAILURE.unpinned, "", "approvedGitSha");
  else if (gitSha !== manifest.approvedGitSha) fail(failures, FAILURE.sha, "", `manifest=${manifest.approvedGitSha}`);

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
  };
}

function arg(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0 || index + 1 >= argv.length) return "";
  return argv[index + 1];
}

export function runPreflight(argv) {
  const manifest = JSON.parse(readFileSync(arg(argv, "--manifest"), "utf8"));
  const history = parseHistory(readFileSync(arg(argv, "--history"), "utf8"));
  const folders = readFolders(arg(argv, "--migrations"));
  return evaluatePreflight({ manifest, folders, history, gitSha: arg(argv, "--git-sha") });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = runPreflight(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(report.ok ? 0 : 1);
}
