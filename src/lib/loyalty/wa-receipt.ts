import { canonPhone } from "@/lib/conversations/identity";
import { extractPhones, extractRpAmounts, extractTrxCandidates } from "./receipt-ocr";
import { ocrReceiptImage } from "./receipt-ocr-run";
import { compressReceiptPhoto } from "./receipt-photo";

export type StorePhone = { id: string; phone: string | null; waOutletPhone: string | null };

export type WaReceiptActor =
  | { kind: "staff"; locationId: string; memberPhone: string | null }
  | { kind: "member"; phone: string; locationId: string }
  | { kind: "unknown" };

export function resolveWaReceiptActor(opts: {
  senderPhone: string;
  caption: string;
  stores: StorePhone[];
  member: { phone: string; signupLocationId: string | null } | null;
}): WaReceiptActor {
  const sender = canonPhone(opts.senderPhone);
  const staffStore = opts.stores.find((s) => {
    const a = s.phone ? canonPhone(s.phone) : "";
    const b = s.waOutletPhone ? canonPhone(s.waOutletPhone) : "";
    return (a && a === sender) || (b && b === sender);
  });
  if (staffStore) {
    const phones = extractPhones(opts.caption)
      .map((p) => canonPhone(p))
      .filter((p) => p.length >= 8 && p !== sender);
    return { kind: "staff", locationId: staffStore.id, memberPhone: phones[0] || null };
  }
  if (opts.member) {
    const signup = opts.member.signupLocationId;
    const locationId =
      (signup && opts.stores.some((s) => s.id === signup) ? signup : null) || opts.stores[0]?.id || "";
    if (!locationId) return { kind: "unknown" };
    return { kind: "member", phone: opts.member.phone, locationId };
  }
  return { kind: "unknown" };
}

export async function typedFieldsFromPhoto(opts: {
  caption: string;
  jpeg: Buffer;
}): Promise<{ trxId: string; amount: number | null; ocrText: string }> {
  const caption = opts.caption === "[image]" ? "" : opts.caption;
  const ocrText = await ocrReceiptImage(opts.jpeg);
  const blob = `${caption}\n${ocrText}`;
  const captionAmt = extractRpAmounts(caption)[0];
  const ocrAmt = extractRpAmounts(ocrText)[0];
  const amount = captionAmt ?? ocrAmt ?? null;
  const captionTrx = extractTrxCandidates(caption)[0];
  const ocrTrx = extractTrxCandidates(ocrText)[0];
  const trxId = captionTrx || ocrTrx || "";
  return { trxId, amount, ocrText: blob };
}

export async function jpegFromInboundPhoto(bytes: Buffer, mime: string) {
  return compressReceiptPhoto(bytes, mime);
}
