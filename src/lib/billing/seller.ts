/**
 * Who issues AtlasNow invoices. Not a payment gateway.
 * Public /about credits “P2P Labs (PT Sorak Digital Media)”.
 * Do not dump bank details on the public site.
 * Do not mix Sorak product API keys onto AtlasNow.
 */

export const BILLING_SELLER = {
  legalName: "PT Sorak Digital Media",
  tradeName: "P2P Labs",
  product: "AtlasNow",
  email: "hello@atlasnow.co",
  site: "https://atlasnow.co",
  /** Joe 2026-09-05: invoice tanpa PPN dulu. */
  chargePpn: false,
  ppnRate: 0.11,
} as const;

export type BillingBank = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

/** Joe 2026-09-05. Env can override. Not a Sorak product key. */
export const DEFAULT_BILLING_BANK: BillingBank = {
  bankName: "BCA",
  accountName: "PT Sorak Digital Media (P2P Labs) / (Atlas Now)",
  accountNumber: "2480707501",
};

export function billingBankFromEnv(): BillingBank {
  return {
    bankName: (process.env.BILLING_BANK_NAME || DEFAULT_BILLING_BANK.bankName).trim(),
    accountName: (process.env.BILLING_BANK_HOLDER || DEFAULT_BILLING_BANK.accountName).trim(),
    accountNumber: (process.env.BILLING_BANK_ACCOUNT || DEFAULT_BILLING_BANK.accountNumber).trim(),
  };
}

export function sellerLine(): string {
  return `${BILLING_SELLER.legalName} (${BILLING_SELLER.tradeName})`;
}
