import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { privateKeyLocation, signApproval } from "./migration-preflight.mjs";

function arg(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0 || index + 1 >= argv.length) return "";
  return argv[index + 1];
}

export function signRelease(argv, repoRoot = process.cwd()) {
  const location = privateKeyLocation(arg(argv, "--private-key"), repoRoot);
  if (!location.ok) return { ok: false, code: location.code };
  let privateKey;
  try {
    privateKey = readFileSync(location.resolved);
  } catch {
    return { ok: false, code: "PRIVATE_KEY_UNREADABLE" };
  }
  let statement;
  try {
    statement = JSON.parse(readFileSync(arg(argv, "--statement"), "utf8"));
  } catch {
    return { ok: false, code: "STATEMENT_INVALID" };
  }
  let approval;
  try {
    approval = signApproval(privateKey, statement);
  } catch (error) {
    return { ok: false, code: error.code || "STATEMENT_INVALID" };
  }
  const out = arg(argv, "--out");
  if (!out) return { ok: false, code: "STATEMENT_INVALID" };
  writeFileSync(out, `${JSON.stringify(approval)}\n`);
  return { ok: true, code: "" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = signRelease(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify({ ok: report.ok, code: report.code })}\n`);
  process.exit(report.ok ? 0 : 1);
}
