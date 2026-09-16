import sharp from "sharp";

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function brandIconFill(slug: string): { r: number; g: number; b: number } {
  const palette: [number, number, number][] = [
    [31, 27, 29],
    [15, 118, 110],
    [154, 52, 18],
    [30, 58, 95],
    [54, 83, 20],
    [107, 33, 168],
    [159, 18, 57],
    [14, 116, 144],
  ];
  let h = 0;
  for (const ch of slug || "") h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const [r, g, b] = palette[h % palette.length];
  return { r, g, b };
}

export async function renderCardPwaIcon(opts: {
  logo: Buffer | null;
  letter: string;
  size: number;
  maskable?: boolean;
  fill?: { r: number; g: number; b: number };
}): Promise<Buffer> {
  const size = opts.size;
  const pad = opts.maskable ? Math.round(size * 0.2) : Math.round(size * 0.1);
  const inner = Math.max(32, size - pad * 2);
  const bg = { r: 250, g: 248, b: 252, alpha: 1 };

  if (opts.logo && opts.logo.length > 40) {
    const innerImg = await sharp(opts.logo, { failOn: "none" })
      .rotate()
      .resize(inner, inner, { fit: "contain", background: bg })
      .png()
      .toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
      .composite([{ input: innerImg, left: pad, top: pad }])
      .png()
      .toBuffer();
  }

  const letter = escapeXml((opts.letter || "A").slice(0, 2));
  const fontSize = Math.round(inner * (letter.length > 1 ? 0.42 : 0.52));
  const fill = opts.fill || { r: 31, g: 27, b: 29 };
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="rgb(${fill.r},${fill.g},${fill.b})"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
      font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif"
      font-size="${fontSize}" font-weight="700" fill="#ffffff">${letter}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
