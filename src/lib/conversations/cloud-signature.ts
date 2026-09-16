import { createHmac, timingSafeEqual } from "node:crypto";

export function cloudSignatureValid(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string
): boolean {
  const sig = (header || "").trim();
  const secret = (appSecret || "").trim();
  if (!sig || !secret) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
