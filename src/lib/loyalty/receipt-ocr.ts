import { canonPhone } from "@/lib/conversations/identity";

export type ReceiptMatchStatus = "MATCH" | "MISMATCH" | "UNREADABLE" | "SKIPPED";

export type ReceiptMatch = {
  status: "MATCH" | "MISMATCH" | "UNREADABLE";
  ocrNomor: string | null;
  ocrAmount: number | null;
  ocrPhone: string | null;
};

export const SYSTEM_OCR_ACTOR = "system:ocr-match";

export function normalizeTrxId(raw: string): string {
  return (raw || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Indonesian thermal slips: 28.000 = 28000, 28.000,50 = 28000. */
export function parseIdrInt(raw: string): number | null {
  let s = (raw || "").trim().replace(/\s/g, "");
  if (!s) return null;
  if (/[.,]\d{2}$/.test(s)) s = s.slice(0, -3);
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, "");
  } else if ((s.match(/,/g) || []).length > 1) {
    s = s.replace(/,/g, "");
  } else if (/^\d{1,3}[.,]\d{3}$/.test(s)) {
    s = s.replace(/[.,]/g, "");
  } else {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function extractRpAmounts(text: string): number[] {
  const found = new Set<number>();
  const src = text || "";
  for (const m of src.matchAll(/rp\.?\s*([\d.,]+)/gi)) {
    const n = parseIdrInt(m[1]);
    if (n != null && n >= 100) found.add(n);
  }
  for (const m of src.matchAll(/\b(\d{1,3}(?:\.\d{3}){1,3})(?:[.,]\d{2})?\b/g)) {
    const n = parseIdrInt(m[1]);
    if (n != null && n >= 1000) found.add(n);
  }
  return [...found];
}

export function trxFoundInOcr(typed: string, ocr: string): boolean {
  const n = normalizeTrxId(typed);
  if (n.length < 3) return false;
  return normalizeTrxId(ocr).includes(n);
}

export function extractTrxCandidates(text: string): string[] {
  const skipAmt = new Set(extractRpAmounts(text));
  const out: string[] = [];
  for (const m of (text || "").matchAll(/[A-Za-z]{1,10}[-/]?\d{2,}|\b\d{5,}\b/g)) {
    const tok = m[0];
    const asAmt = parseIdrInt(tok.replace(/[^\d.,]/g, ""));
    if (asAmt != null && skipAmt.has(asAmt) && !/[A-Za-z]/.test(tok)) continue;
    if (normalizeTrxId(tok).length >= 4) out.push(tok);
  }
  return out;
}

export function extractPhones(text: string): string[] {
  const phones: string[] = [];
  for (const m of (text || "").matchAll(/(?:\+?62|0)8\d{7,13}/g)) {
    phones.push(m[0]);
  }
  return phones;
}

export function matchReceiptPhoto(opts: {
  typedTrx: string;
  typedAmount: number;
  typedPhone: string;
  ocrText: string;
}): ReceiptMatch {
  const text = opts.ocrText || "";
  const amounts = extractRpAmounts(text);
  const trxOk = trxFoundInOcr(opts.typedTrx, text);
  const typedAmount = Math.round(opts.typedAmount);
  const amtOk = amounts.includes(typedAmount);
  const ocrNomor = trxOk ? opts.typedTrx.trim() : null;
  const ocrAmount = amtOk ? typedAmount : amounts[0] ?? null;
  const phones = extractPhones(text)
    .map((p) => canonPhone(p))
    .filter((p) => p.length >= 8);
  const typedPhone = canonPhone(opts.typedPhone);
  const ocrPhone = phones.find((p) => p === typedPhone) || phones[0] || null;
  const phoneDisagree = phones.some((p) => p !== typedPhone);

  if (!text.trim() || !trxOk || amounts.length === 0) {
    return { status: "UNREADABLE", ocrNomor, ocrAmount, ocrPhone };
  }
  if (!amtOk || phoneDisagree) {
    return { status: "MISMATCH", ocrNomor, ocrAmount, ocrPhone };
  }
  return { status: "MATCH", ocrNomor, ocrAmount, ocrPhone };
}

export function parseOcrJson(raw: string | null | undefined): {
  raw: string;
  status?: string;
  ocrNomor: string | null;
  ocrAmount: number | null;
  ocrPhone: string | null;
} {
  try {
    const j = JSON.parse(raw || "{}") as {
      raw?: string;
      status?: string;
      ocrNomor?: string | null;
      ocrAmount?: number | null;
      ocrPhone?: string | null;
    };
    return {
      raw: typeof j.raw === "string" ? j.raw : "",
      status: typeof j.status === "string" ? j.status : undefined,
      ocrNomor: j.ocrNomor ?? null,
      ocrAmount: typeof j.ocrAmount === "number" ? j.ocrAmount : null,
      ocrPhone: j.ocrPhone ?? null,
    };
  } catch {
    return { raw: "", ocrNomor: null, ocrAmount: null, ocrPhone: null };
  }
}
