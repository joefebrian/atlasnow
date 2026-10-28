import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "prisma/migrations");
const folders = readdirSync(dir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const yola = [
  "20261027120000_yola_fun_commerce",
  "20261028120000_yola_order_origin",
  "20261028160000_workspace_automation",
  "20261028180000_workspace_automation_runtime",
  "20261028190000_wa_message_source",
  "20261028200000_conversation_handoff",
];
const blocked = "20261024180000_commerce_orders";
const destructive = /\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bALTER\s+TABLE\b[\s\S]{0,80}\bDROP\b/i;
for (const name of yola) {
  const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
  if (destructive.test(sql)) {
    console.error(`preflight: ${name} contains a destructive statement`);
    process.exit(2);
  }
}
const docker = readFileSync(join(root, "Dockerfile"), "utf8");
if (!docker.includes(`rm -rf prisma/migrations/${blocked}`)) {
  console.error("preflight: Dockerfile must omit the unapplied commerce_orders migration from the image");
  process.exit(2);
}
if (process.argv.includes("--strict-image") && folders.includes(blocked)) {
  console.error(`preflight: ${blocked} is present. Production did not apply it. Remove it from the image before migrate.`);
  process.exit(2);
}
const pendingNote = folders.filter((name) => name >= "20261027");
if (pendingNote.join(",") !== yola.join(",")) {
  console.error(`preflight: expected ${yola.join(",")} after the production set, found ${pendingNote.join(",")}`);
  process.exit(2);
}
console.log(`preflight: sql_ok folders=${folders.length} new=${yola.join(",")}`);
