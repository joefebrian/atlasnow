# TikTok Local Service (GO Dining) — product + design

Date: 2026-08-28  
Repo: AtlasNow  
Status: draft for Joe review. Do not implement until approved.  
Related: TikTok Inbox DMs are a **different** portal (`business-api.tiktok.com`). This PRD uses **TikTok for Developers → Local Service API** — the product on the Add products screen.

## Why this exists

The Add products list on developers.tiktok.com has **no Business Messaging**. It **does** have **Local Service API**: dining voucher management for local restaurants.

That product is **TikTok GO Dining** (Indonesia: TikTok GO / Tokopedia local). Customer buys a voucher **in TikTok**, walks into an outlet, shows a QR. Atlas is the till: query + redeem. Same kasir motion as stamp Redeem — **different ledger**.

Wave A stays Inbox CRM + honest stamps. This is **Wave A-adjacent / Wave B local**: voucher fulfilment at the outlet, not ads, not posting, not DM inbox.

## Product lock

| Topic | Choice |
|---|---|
| What | Kasir **cek + tebus voucher TikTok GO** (QR `TT-…` or numeric code) |
| Who | Multi-location dining brands (F&B). One brand, many outlets. |
| Map | Each TikTok shop (`third_shop_id`) → one Atlas `Location` |
| Stamp card | **Not a stamp.** Paid TikTok voucher ≠ receipt stamp. Do not auto-stamp. |
| Revenue | Do not invent visits, leads, or GMV. Show voucher status only (valid / used / refunded / wrong shop). |
| Official API | `open.tiktokapis.com/v2/localservice/saas/…` only |
| Locale | `id-ID` for Indonesian merchants |
| Copy | Merchant-plain. Kasir Redeem. Group/Grup not Agency. |
| Secrets | Same AtlasNow developer app (client key/secret already in Settings → API). Extra: merchant token + `merchant_id`. Not Sorak. |

## What TikTok actually sells here

[Dining Overview](https://developers.tiktok.com/docs/en/tiktok-go-dining-overview). Two halves:

1. **Merchant Portal** — merchant lists outlets and voucher SKUs (can stay on TikTok UI at first).
2. **Dining SaaS APIs** — Atlas integrates. Redemption is **API-only** (Merchant Portal cannot redeem).

Three API suites:

| Suite | Atlas use |
|---|---|
| Shop / outlet | Claim POI, NIB cert, decorate, query shops. `third_shop_id` = Atlas location id (or atlas_location_id). |
| Product / voucher | Create/update group-buying coupons (`product_type = 2`). Later. |
| Fulfilment | **Query** then **Redeem**. Wave 1. |

Indonesia-specific: NIB (Nomor Induk Berusaha) on shop cert. Locale `id-ID`. Docs: [Shop management ID](https://developers.tiktok.com/docs/en/shop-management), [Voucher management ID](https://developers.tiktok.com/docs/en/voucher-management).

### Till flow (Wave 1)

```
Customer bought voucher on TikTok GO
  → shows QR (string starts with TT-) or types code
  → Kasir Atlas: Loyalty-style scan (reuse StampQrScan camera + jsQR)
  → POST …/fulfill/get_code_item_list/  { merchant_id, third_shop_id, qr_info | code_list, locale: "id-ID" }
  → Screen: voucher name, valid window, this shop allowed?
  → Kasir confirms
  → POST …/fulfill/redeem_code/  { merchant_id, third_shop_id, code_list, shop_order_id, locale: "id-ID" }
  → Done. Optional: log as activity. Not a stamp.
```

QPS: query/redeem 50. Atlas already serializes till actions.

Error honesty (from [local-service-error-codes](https://developers.tiktok.com/docs/en/local-service-error-codes)):

- Wrong shop → “This voucher is not for this outlet.”
- Already redeemed / refunded → say so.
- Outside valid time → say so.
- QR parse fail (`TT-` decrypt) → “Cannot read this TikTok code.”

### Auth

[Obtain access token](https://developers.tiktok.com/docs/en/obtain-access-token-for-apis):

`POST https://open.tiktokapis.com/merchant/oauth/token/`  
`client_key` + `client_secret` (Atlas app) + `merchant_id` (the dining merchant) + `grant_type=access_token`.

This is **merchant SaaS**, not Login Kit for staff. Staff still log into Atlas with email/Google/Facebook.

Scopes on the developer app (Add products → Local Service API): `local.shop.manage`, `local.product.manage`, `local.voucher.manage`.

## Fit to Atlas (do not smash into stamps)

| Atlas today | TikTok GO |
|---|---|
| Join QR → member | TikTok user bought on TikTok. No Atlas member required. |
| Stamp = approved receipt | Voucher = paid SKU on TikTok |
| Redeem gift at till | Redeem voucher at till |
| HQ WhatsApp | Irrelevant to this API |

Later optional (not Wave 1): if the same phone is an Atlas member, show their stamp card **next to** the voucher result. Never convert a TikTok voucher into a stamp.

## Approaches

| | How | Verdict |
|---|---|---|
| **A. Atlas as till only (recommended Wave 1)** | Map shops. Kasir query + redeem. Products stay in TikTok Merchant Portal. | Smallest honest slice. Uses Local Service API Joe can Add today. |
| B. Atlas creates vouchers too | Product save API + till | Needed if ops refuse Merchant Portal. Second PR. |
| C. Mix with Inbox DMs | Same Connect TikTok button | **No.** Different portal, token, and product. |

## Architecture (Wave 1)

```
Location (STORE)
  → SourceMapping(TIKTOK_GO_SHOP, third_shop_id)   // or location.metaJson
  → brand Connector / Integration: merchant_id + merchant access token

Kasir /settings or Loyalty scan mode “TikTok voucher”
  → get_code_item_list
  → confirm
  → redeem_code
  → AuditEvent + optional InboxNotice
```

Reuse `StampQrScan` live camera. Detect `TT-` prefix → voucher path, not member card URL.

Webhook: subscribe voucher redemption events later so HQ sees “redeemed at Cabang X”. Not required for till.

## Joe clicks (this week)

On the **same** AtlasNow app (developers.tiktok.com):

1. Add products → **Local Service API** (the dining voucher card). Not Content Posting, not Share Kit, not Data Portability.
2. Add scopes `local.shop.manage`, `local.product.manage`, `local.voucher.manage` if shown.
3. Merchant Portal account for the dining brand (P2P / first F&B client).
4. `merchant_id` from Merchant Portal → we store in Settings later.
5. Sandbox first; Production needs app review + demo video of kasir scan.

Login Kit can stay Added. Unused for this PRD.

## Out of scope

- TikTok Inbox DMs (separate apply on business-api).
- Content Posting / Spark ads.
- Treating GO redemptions as visits or revenue KPIs.
- Auto-stamp.
- Creating vouchers in Atlas (Wave 2).
- EU/UK Data Portability.

## Key decisions

1. **Separate PRD from Inbox DM** — Joe’s Add products screen is the GO Dining door, not messaging.
2. **Till-first** — Query + Redeem. Products can stay on TikTok until ops demand Atlas SKU editor.
3. **Map shop ↔ Location** — one TikTok shop per Atlas outlet.
4. **Voucher ≠ stamp.**
5. **Reuse existing scan UI.**

## 360 desk (TikTok GO + HQ WhatsApp)

Joe: when a GO voucher is live, send it on HQ WhatsApp via a Meta-approved template so Atlas is one desk.

**Honest join of the two pipes**

```
TikTok GO          Atlas till           HQ WhatsApp
customer pays   →  scan TT- QR      →  not automatic
TikTok user        Location mapped      member = phone + opt-in
open_id ≠ phone    redeem this shop     template ≠ voucher code
```

TikTok Local Service **does not give a phone number**. That is fine. WhatsApp blast **does not use TikTok as a phone book**.

**Audience = Atlas customers on the HQ Cloud number** who already joined (Join QR) or already chatted HQ, and who opted in to WA deals (or birthday WA until a deals tick exists). Never a CSV. Never TikTok open_id. Never a GO buyer who never gave Atlas a phone.

Do not paste the voucher secret / `TT-` payload onto WhatsApp (the QR lives in the TikTok app). The template points them to **buy on TikTok GO**, then **show the TikTok QR at the till**.

**What we send on WA**

| Template | Meta category | Who | Body (EN for review) |
|---|---|---|---|
| `go_deal_optin` | **MARKETING** | Members who ticked deals/birthday WA on Join, or already opted in. Never a CSV. | `{{1}} has a TikTok GO voucher: {{2}}. Buy in TikTok, then show the TikTok QR at {{3}}. This chat is not the voucher. Reply STOP to leave.` |
| Session reply | Not a template | People who **wrote HQ first** (24h window) | Short: till instruction + outlet name. Live Agent / keyword, not blast. |

Utility is the wrong bucket for “new deal” — Meta will class it Marketing. Submit **MARKETING** from Broadcast (existing `createWabaTemplate`). Send only after APPROVED, to opt-in only.

**When it fires (later, after till works)**

1. Ops publishes a GO voucher (Merchant Portal or Atlas product save).
2. Broadcast desk: pick template `go_deal_optin`, pick opted-in members, send.
3. Customer buys **on TikTok**, walks in, kasir scans.
4. Optional later: Join QR extra tick “WhatsApp me TikTok GO deals” — privacy must name it. Until then, reuse birthday/deals opt-in; do not invent a silent list.

**Not 360 (reject)**

- CSV of phones “everyone who follows us on TikTok”
- Sending the `TT-` payload on WhatsApp
- Auto-stamp when voucher redeems
- Calling a GO redeem a visit or revenue

## Open questions

1. First merchant: P2P Labs HQ as dining, or wait for an F&B client with NIB?
2. Should redeem require BRANCH role at that location only? (Recommended: yes, same as stamp Redeem.)

## PR Plan

| PR | Title | Notes |
|---|---|---|
| G1 | Catalog `tiktok_go` + legal (TikTok GO voucher data) | Distinct from `tiktok` messaging keys if merchant token differs; may share client key |
| G2 | Shop map Location ↔ `third_shop_id` + merchant token | |
| G3 | Kasir scan: detect `TT-`, query voucher, confirm UI | Reuse StampQrScan |
| G4 | Redeem + audit log | |
| G5 | Joe runbook: Add Local Service, Merchant Portal, sandbox QR | |

## Docs

- https://developers.tiktok.com/docs/en/tiktok-go-dining-overview
- https://developers.tiktok.com/docs/en/voucher-management
- https://developers.tiktok.com/docs/en/shop-management
- https://developers.tiktok.com/docs/en/integrate-with-dining-saas
