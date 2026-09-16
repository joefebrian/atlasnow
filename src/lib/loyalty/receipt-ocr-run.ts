import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preprocessForOcr } from "./receipt-photo";

const TIMEOUT_MS = 12_000;

export async function ocrReceiptImage(jpeg: Buffer): Promise<string> {
  const png = await preprocessForOcr(jpeg);
  const file = join(tmpdir(), `an-struk-${randomBytes(8).toString("hex")}.png`);
  await fs.writeFile(file, png);
  try {
    return await runTesseract(file);
  } catch {
    return "";
  } finally {
    await fs.unlink(file).catch(() => {});
  }
}

function runTesseract(imagePath: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("tesseract", [imagePath, "stdout", "--psm", "6", "-l", "eng"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(out.trim());
    }, TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (c) => {
      out += c;
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve("");
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(out.trim());
    });
  });
}
