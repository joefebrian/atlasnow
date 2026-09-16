import sharp from "sharp";
import { prisma } from "@/lib/db";

/** Incoming file cap (before compress). */
export const BRAND_LOGO_MAX_UPLOAD = 1_500_000;
export const BRAND_LOGO_OK_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Output square for join page / web. 512 is enough at 3× on a 72–96px mark. */
export const BRAND_LOGO_SIZE = 512;

export async function compressBrandLogo(input: Buffer): Promise<{ buf: Buffer; mime: string }> {
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  if (!meta.format || !["jpeg", "png", "webp", "gif"].includes(meta.format)) {
    throw Object.assign(new Error("image_type"), { code: "image_type" });
  }
  const hasAlpha = Boolean(meta.hasAlpha);
  const resized = img.resize(BRAND_LOGO_SIZE, BRAND_LOGO_SIZE, {
    fit: "contain",
    background: hasAlpha
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { r: 255, g: 255, b: 255, alpha: 1 },
  });
  const buf = await resized.webp({ quality: 80, alphaQuality: 80 }).toBuffer();
  return { buf, mime: "image/webp" };
}

export async function saveTenantLogo(tenantId: string, raw: Buffer) {
  const { buf, mime } = await compressBrandLogo(raw);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { logoImage: buf, logoMime: mime },
  });
  return { bytes: buf.length, mime };
}

export async function clearTenantLogo(tenantId: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { logoImage: null, logoMime: "" },
  });
}

export function withoutLogoBytes<T extends { logoImage?: unknown; logoMime?: string | null }>(
  row: T
): Omit<T, "logoImage"> & { hasLogo: boolean } {
  const { logoImage: _img, ...rest } = row;
  return { ...rest, hasLogo: Boolean(row.logoMime) };
}

export async function readLogoFile(file: File) {
  if (file.size < 40) return { error: "image_required" as const };
  if (file.size > BRAND_LOGO_MAX_UPLOAD) return { error: "image_too_large" as const };
  const mime = (file.type || "").toLowerCase();
  if (!BRAND_LOGO_OK_MIME.has(mime)) return { error: "image_type" as const };
  return { buf: Buffer.from(await file.arrayBuffer()) };
}