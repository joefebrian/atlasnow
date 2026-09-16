/**
 * Per-invoice VAT. Default off. Always Indonesian PPN from PT Sorak Digital Media,
 * including when the client is a Singapore company.
 * Joe remits (or refunds) manually. Not a tax-filing API. Not Singapore GST.
 *
 * Indonesia 2026: statutory PPN 12% on an 11/12 base = effective 11% for ordinary services.
 * We invoice the effective 11% line.
 */

export const VAT_PPN_RATE = 0.11;

export type VatLine = {
  active: boolean;
  label: string;
  rate: number;
  amountIdr: number;
  note: string;
};

export function vatLine(active: boolean, subtotalIdr: number): VatLine {
  if (!active) {
    return {
      active: false,
      label: "VAT (PPN)",
      rate: 0,
      amountIdr: 0,
      note: "Tidak ditagih pada invoice ini. Centang VAT per klien kalau mau ditambah.",
    };
  }
  return {
    active: true,
    label: "VAT (PPN 11%)",
    rate: VAT_PPN_RATE,
    amountIdr: Math.round(Math.max(0, subtotalIdr) * VAT_PPN_RATE),
    note: "PPN Indonesia, diterbitkan PT Sorak Digital Media. Berlaku juga untuk klien perusahaan SG. Setoran ke DJP manual.",
  };
}
