/** Same HSM name + body on every brand WABA. Atlas fills the three named vars. */
export const BIRTHDAY_TEMPLATE_NAME = "birthday_greeting";

export const BIRTHDAY_TEMPLATE_BODY_ID =
  "Selamat ulang tahun, {{customer_name}}! Kami dengan senang hati memberikan Anda voucher senilai {{voucher_number}} dengan kode {{code_voucher}}. Tunjukkan kode voucher ini saat melakukan pembayaran. Voucher dapat digunakan tanpa minimum transaksi.";

export const BIRTHDAY_NAMED_EXAMPLES: Record<string, string> = {
  customer_name: "Yusuf Febrian Hanjaya",
  voucher_number: "100.000",
  code_voucher: "BDY26-K7M2",
  first_name: "Yusuf",
  voucher_value: "100.000",
  voucher_code: "BDY26-K7M2",
};

export type BirthdayVoucherStyle = {
  prefix: string;
  includeYear: boolean;
  suffixLen: number;
};

export const DEFAULT_BIRTHDAY_VOUCHER_STYLE: BirthdayVoucherStyle = {
  prefix: "BDY",
  includeYear: true,
  suffixLen: 4,
};

export function normalizeBirthdayVoucherStyle(
  raw?: Partial<BirthdayVoucherStyle> | null
): BirthdayVoucherStyle {
  let prefix = String(raw?.prefix || DEFAULT_BIRTHDAY_VOUCHER_STYLE.prefix)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  if (prefix.length < 2) prefix = DEFAULT_BIRTHDAY_VOUCHER_STYLE.prefix;
  const suffixLen = Math.min(6, Math.max(3, Math.floor(Number(raw?.suffixLen) || 4)));
  return {
    prefix,
    includeYear: raw?.includeYear !== false,
    suffixLen,
  };
}

export function previewBirthdayVoucherCode(
  style?: Partial<BirthdayVoucherStyle> | null,
  periodKey = "2026"
): string {
  const s = normalizeBirthdayVoucherStyle(style);
  const yy = String(periodKey).slice(-2).padStart(2, "0");
  const sample = "K7M2XY".slice(0, s.suffixLen);
  return s.includeYear ? `${s.prefix}${yy}-${sample}` : `${s.prefix}-${sample}`;
}
