# WABA wallet + 1,000 service remaining — design for Joe review

Date: 2026-09-04  
Status: **W1 live 2026-09-06 (chip + monthly count, no debit).** Do not implement debit until Joe locks pack IDR.  
Master money: vault `AtlasNow-Monetization-PRD` v0.2.1. If this spec and that PRD conflict after Joe edits, **Monetization PRD wins**.  
Related: Meta service messages from **1 Oct 2026** (1,000 free / business phone / month). Inbox = a person, **not** Meta Business Agent.

## What Joe asked

- Show **how many of the 1,000 are left**.
- Mature monetization **on the WABA**, not a vague “HQ number.”
- Review together: **monthly Atlas invoice vs they buy credit** for WhatsApp.
- Original intent: **one credit scheme for all paid AtlasNow usage**.
- Unit: **per nomor WABA**, not “per nomor HQ.”

## Locked language

| We say | We do not say |
|---|---|
| **Nomor WABA** = the Cloud phone on Chat apps (`phoneNumberId` + `wabaId`) | “Nomor HQ” as a Meta invoice line |
| **HQ** = Atlas location kind (the desk), still valid in the product | One WABA = one free bucket if it has two Cloud phones |
| Wallet = prepaid **IDR** on the **brand** tenant | A second USD WhatsApp wallet |
| 1,000 free = **Meta’s gift**, not Atlas credits | “Unlimited care replies” after 1 Oct 2026 |

Meta’s 1,000 is **per business phone number**, not per WABA account. One brand, one Cloud phone → one bucket. Two Cloud phones on the same WABA → **two** buckets of 1,000.

## Recommendation (hybrid)

**Do both. Different jobs.**

```
Monthly invoice (software)
  = Brand desk: base + locations + optional ops
  Spreadsheet + transfer IDR until the third paying brand
  Already Monetization PRD §6–8. Unchanged.

Prepaid wallet (variable vendor cost)
  = one IDR wallet per brand
  = WhatsApp billed sends now
  = later OCR / extra Cloud phone / anything we pay per use
  Brand buys credit (invoice pack now, Xendit later). Not a monthly “unlimited WhatsApp” line.
```

Why **not** monthly invoice for WhatsApp per-message:

- Volume is uneven (quiet week vs ramadan blast).
- If Atlas invoices in arrears, **we front Meta** or we chase payment while messages already sent.
- PRD already: **hard block > overdraft** when P2P’s WABA would get the Meta bill.
- Credits match “beli dulu, pakai, habis = berhenti” — merchant-plain.

Why **not** credits for the whole desk:

- Location count is a **retainer**, not a tap. Monthly invoice stays for Control / Brand.
- Mixing “40 cabang × Rp250 rb” into the same pack as “satu blast 3.000 nomor” hides the product.

**WhatsApp specifically**

| Who Meta invoices | After the free 1,000 service msgs | Wallet |
|---|---|---|
| **Brand WABA** (their payment method on Meta) | Meta bills **them**. Atlas does not collect Meta’s Rp. | Optional: Atlas fee only on templates. Service replies: **warn**, do not block (Meta will bill). |
| **P2P WABA** (we pass through) | We would eat Meta. | **Must** debit wallet (Meta utility rate + Atlas add-on, add-on **0** until founder locks). **Block send** if wallet < cost. |

**Must-do by 30 Sep 2026 (ops, not code):** every live WABA has a **payment method on file**. Meta stops **delivering** service messages 1 Oct if not.

## What the merchant sees (copy)

On Chat apps / inbox, per nomor WABA:

> Service messages this month: **412 / 1,000 free**  
> After 1,000, WhatsApp (Meta) bills this number. Atlas is not inventing a visit or a sale.

If P2P WABA and remaining = 0:

> Next reply costs about **Rp …** (Meta utility for this market). Top up wallet or wait for next month’s 1,000.

Never: “24-hour window = always free” after 1 Oct 2026.

Inbound customer messages: still free. Click-to-WhatsApp **entry-point** window: still free (do not count toward the 1,000).

## Meters (one wallet, many lines)

| Meter | When Meta/Atlas charges | Debit wallet? |
|---|---|---|
| `whatsapp.service` | Person (or 3rd-party AI) non-template reply. From 1 Oct, after 1,000/phone/month | Only if `billingOwner = P2P`. Else count only. |
| `whatsapp.utility` | Utility template (from 1 Oct **also inside** 24h) | Yes if we would pay Meta; Atlas fee per PRD |
| `whatsapp.marketing` | Blast | Yes (existing credit design) |
| `whatsapp.authentication` | Auth template | Yes if billed |
| later `ocr`, `extra_waba_phone` | If we pay a vendor | Same wallet |

Failed Cloud send (Meta did not accept): **no debit**, no service count.

## Data (Prisma — review this)

```prisma
/// Prepaid IDR for all PAYG on this brand. Not the monthly desk invoice.
model BrandWallet {
  id        String   @id @default(cuid())
  tenantId  String   @unique
  balanceIdr Int     @default(0) // whole rupiah
  updatedAt DateTime @updatedAt
  tenant    Tenant   @relation(...)
  ledger    WalletLedger[]
}

model WalletLedger {
  id             String   @id @default(cuid())
  tenantId       String
  /// TOPUP | DEBIT | REFUND
  kind           String
  amountIdr      Int      // + topup, − debit
  /// whatsapp.service | whatsapp.marketing | whatsapp.utility | whatsapp.authentication | topup
  meter          String
  wabaId         String   @default("")
  phoneNumberId  String   @default("")
  wamid          String?
  metaIdr        Int      @default(0)
  atlasIdr       Int      @default(0)
  note           String   @default("")
  createdAt      DateTime @default(now())
  @@index([tenantId, createdAt])
  @@unique([wamid]) // one debit per accepted Cloud message
}

/// One row per Cloud phone we send on. Unit Joe asked: nomor WABA.
model WabaPhone {
  id              String   @id @default(cuid())
  tenantId        String
  wabaId          String
  phoneNumberId   String   @unique
  displayPhone    String   @default("")
  /// BRAND = Meta invoices the merchant. P2P = we pass through.
  billingOwner    String   @default("BRAND")
  /// WABA timezone for the monthly 1,000 reset (Meta: 00:00 that TZ on the 1st).
  timezone        String   @default("Asia/Jakarta")
  paymentMethodOk Boolean  @default(false) // ops tick; warn if false before 1 Oct
  status          String   @default("ACTIVE")
  @@index([tenantId])
}

model WabaServiceMonth {
  id              String   @id @default(cuid())
  phoneNumberId   String
  /// YYYY-MM in that phone’s timezone
  periodKey       String
  /// Delivered service messages we attributed (not inbound, not entry-point-free)
  serviceCount    Int      @default(0)
  freeCap         Int      @default(1000)
  @@unique([phoneNumberId, periodKey])
}
```

`WabaPhone` can be **upserted from** the existing `Connector(provider=WHATSAPP_CLOUD)` so Chat apps stays the place they paste Phone number ID + WABA ID. Do not invent a second connect screen.

## How we count the 1,000

1. Outbound Cloud send from Atlas (inbox reply, Status Stamp, etc.) that is **not** a template.
2. Status webhook: delivered + `pricing.category = service` (or our send was non-template).
3. Do **not** increment if Meta marks it free entry-point / not billable for that reason.
4. Until 1 Oct 2026 the count still runs so the desk can show **412 / 1,000** as a preview. Debit stays off.

Do not trust only “we sent” — count **delivered**. Retry is not a second gift.

## Build order (after Joe locks this file)

| Slice | What | Debit? |
|---|---|---|
| **W1** | `WabaPhone` + `WabaServiceMonth` + chip on Chat apps / inbox: **sisa 1,000**. Ops field `billingOwner` + `paymentMethodOk`. | No |
| **W2** | `BrandWallet` + ledger + invoice pack top-up (ops records a TOPUP). Blast already designed to debit marketing. | Templates only, still behind pack-IDR lock |
| **W3** | From 1 Oct: increment service; if `P2P` and count ≥ 1,000, debit/block. If `BRAND`, warn only. | Service after free cap |

W1 can ship **before** pack prices lock. W2/W3 cannot debit production until Monetization §7 / §16 packs are ticked.

## What we refuse

- Meta Business Agent as Atlas inbox (~4–5 US cents/msg).
- Selling the 1,000 free as an Atlas “pack.”
- CSV blast, inventing visits/leads/revenue.
- One wallet for **location retainer** + WhatsApp (keeps invoice vs credit mixed).
- Inventing rates. `rates.ts` is the official **1 Oct 2026** IDR card (CSVs in `docs/meta/`). Indonesia unchanged vs July. Estimates use that card now; Meta still invoices July until 1 Oct.

## Founder ticks (review together)

- [ ] Hybrid: monthly invoice = desk; prepaid wallet = WhatsApp + later PAYG.
- [ ] Unit = **nomor WABA** = Cloud `phoneNumberId` (1,000 each).
- [ ] Default `billingOwner`: **BRAND** (merchant’s Meta bill) unless SOW says P2P WABA.
- [ ] Atlas add-on on **service** stays **0** until a later lock.
- [x] W1 (show remaining 1,000) may build now; no debit. **Shipped 2026-09-06.** Cycle = calendar month per Cloud phone, not daily.
- [ ] Pack IDR still DRAFT — no public price, no Creem.

When these are ticked, write the implementation plan and start W1.
