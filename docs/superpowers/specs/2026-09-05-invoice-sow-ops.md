# Invoice + SOW ops (not a payment gateway)

Date: 2026-09-05  
Status: live for Super Admin at `/billing`.  
Master: Monetization PRD.

Joe: template in the backend. Legal seller **PT Sorak Digital Media (P2P Labs)**. **No PPN** for now. Bank account already exists — paste on the form (do not commit numbers).

## What this is

Printable **invoice** and **SOW** for Silver / Gold / Platinum / Diamond quote. Transfer IDR. Spreadsheet remains the ledger. Login on after money lands.

## What this is not

- Payment gateway, Xendit, Midtrans, Creem, Stripe, PayPal.
- Self-serve card on atlasnow.co/pricing.
- A `BillingAccount` table (still after the third paying brand).
- PPN 11% (until Joe turns it on in `BILLING_SELLER.chargePpn`).
- Mixing Sorak **API keys** onto AtlasNow. Only the **legal name** on the paper.

## Math

Same as public pricing: Silver **500 rb** (1 Cloud HQ + blast) / Gold 2 jt / Platinum 8 jt + extra `n × 150 rb`. Diamond = typed quote. WhatsApp credits **not** on this invoice.
