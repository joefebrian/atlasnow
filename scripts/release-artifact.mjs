import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { stageReleaseArtifact } from "./migration-preflight.mjs";

function arg(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0 || index + 1 >= argv.length) return "";
  return argv[index + 1];
}

export function buildReleaseArtifact(argv) {
  const manifest = JSON.parse(readFileSync(arg(argv, "--manifest"), "utf8"));
  const outDir = arg(argv, "--out");
  mkdirSync(outDir, { recursive: true });
  return stageReleaseArtifact({
    manifest,
    sourceRoot: arg(argv, "--source"),
    entrypointPath: arg(argv, "--entrypoint"),
    outDir,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const packaged = buildReleaseArtifact(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify({ digest: packaged.digest, files: packaged.files.length })}\n`);
}
