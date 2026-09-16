/** One till box. Machines print different names for the same number. */
export function pickReceiptNo(raw: string): { ok: true; trxId: string } | { ok: false; error: string } {
  const trxId = (raw || "").trim();
  if (!trxId) {
    return { ok: false, error: "Isi No. transaksi / No. Struk / No. Invoice." };
  }
  return { ok: true, trxId };
}
