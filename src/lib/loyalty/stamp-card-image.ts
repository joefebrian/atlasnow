import sharp from "sharp";
import { appBaseUrl } from "./card-token";

const W = 1080;
const H = 1350;

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function overlaySvg(opts: {
  brandName: string;
  count: number;
  goal: number;
  nextLine: string;
}) {
  const brand = esc(opts.brandName.slice(0, 42));
  const next = esc(opts.nextLine.slice(0, 64));
  const count = String(opts.count);
  const goal = String(Math.max(1, opts.goal));
  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${H - 340}" width="${W}" height="340" fill="#1f1b1d" fill-opacity="0.82"/>
      <text x="72" y="${H - 250}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="700" fill="#7ee5d6" letter-spacing="4">${brand}</text>
      <text x="72" y="${H - 150}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="92" font-weight="700" fill="#faf8fc">${count} / ${goal}</text>
      <text x="72" y="${H - 70}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="32" fill="#faf8fc" fill-opacity="0.75">${next}</text>
    </svg>`
  );
}

function defaultCardSvg(opts: { brandName: string; count: number; goal: number; nextLine: string }) {
  const goal = Math.max(1, Math.min(opts.goal, 24));
  const count = Math.max(0, opts.count);
  const cols = goal <= 8 ? goal : goal <= 12 ? 6 : 8;
  const rows = Math.ceil(goal / cols);
  const gap = 22;
  const size = 72;
  const gridW = cols * size + (cols - 1) * gap;
  const startX = Math.round((W - gridW) / 2);
  const startY = 420;
  const dots: string[] = [];
  for (let i = 0; i < goal; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = startX + c * (size + gap);
    const y = startY + r * (size + gap);
    const on = i < count;
    dots.push(
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="36" fill="${on ? "#1f1b1d" : "#eef8ff"}"/>` +
        `<text x="${x + size / 2}" y="${y + size / 2 + 10}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="26" font-weight="700" fill="${on ? "#ffffff" : "#c5c5c8"}">${i + 1}</text>`
    );
  }
  const brand = esc(opts.brandName.slice(0, 42));
  const next = esc(opts.nextLine.slice(0, 64));
  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="#faf8fc"/>
      <text x="72" y="120" font-family="ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="700" fill="#2a9bb8" letter-spacing="4">${brand}</text>
      <text x="72" y="220" font-family="ui-sans-serif, system-ui, sans-serif" font-size="56" font-weight="600" fill="#1f1b1d">Kartu stamp</text>
      <text x="72" y="310" font-family="ui-sans-serif, system-ui, sans-serif" font-size="120" font-weight="700" fill="#1f1b1d">${count} / ${goal}</text>
      ${dots.join("")}
      <text x="72" y="${H - 80}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="32" fill="#1f1b1d" fill-opacity="0.55">${next}</text>
    </svg>`
  );
}

export function stampImagePublicUrl(token: string, count: number): string {
  return `${appBaseUrl()}/api/card/${encodeURIComponent(token)}/image?n=${Math.max(0, count)}`;
}

export async function renderStampCardJpeg(opts: {
  brandName: string;
  count: number;
  goal: number;
  nextLine?: string;
  customImage?: Buffer | null;
}): Promise<Buffer> {
  const nextLine = (opts.nextLine || "Tunjukkan ke kasir").slice(0, 80);
  const overlay = overlaySvg({
    brandName: opts.brandName,
    count: opts.count,
    goal: opts.goal,
    nextLine,
  });

  if (opts.customImage && opts.customImage.length > 40) {
    const logo = await sharp(opts.customImage)
      .rotate()
      .resize(820, 720, { fit: "contain", background: { r: 31, g: 27, b: 29, alpha: 1 } })
      .png()
      .toBuffer();
    return sharp({
      create: { width: W, height: H, channels: 3, background: "#1f1b1d" },
    })
      .composite([
        { input: logo, top: 90, left: Math.round((W - 820) / 2) },
        { input: overlay, top: 0, left: 0 },
      ])
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
  }

  return sharp(defaultCardSvg({ ...opts, nextLine }))
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

export const STAMP_CARD_MAX_BYTES = 1_800_000;
export const STAMP_CARD_OK_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
