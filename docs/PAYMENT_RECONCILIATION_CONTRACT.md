# Payment and reconciliation contract

Status: **classification and an in-memory ledger.** No gateway client. No webhook route. No card data. `COMMERCE_PAYMENTS_ENABLED` is not read and is not set.

Shopper money still follows `docs/COMMERCE_PAYMENTS_PRD.md`: the merchant's own Xendit or Midtrans account, settlement to the merchant, no commission, no split, AtlasNow is not merchant of record. This contract does not start that build. Creem remains a later rail for AtlasNow's own fees only, and only after the Monetization PRD says so.

## Independence

Booking state and payment state move on different functions.

| Situation | Booking | Payment | Evidence level |
|---|---|---|---|
| Provider confirmed, no payment notice | `CONFIRMED` | `NOT_STARTED` | B, when the provider reference is authoritative. Not revenue |
| Verified paid notice, booking still requested | `REQUESTED` | `PAID` | A. The booking is not auto-confirmed |
| Cancel after paid | `CANCELLED` | stays `PAID` until a refund notice | Not revenue after a full refund |
| Full refund after cancel | stays `CANCELLED` | `REFUNDED` | Not level A |

`recordPayment` copies the ledger onto the transaction and does not change `booking.state`. `cancelReservation` does not change the ledger.

## Payment states

`NOT_STARTED` → `PENDING` | `PAID` | `FAILED` | `EXPIRED`

`PENDING` → `PAID` | `FAILED` | `EXPIRED`

`PAID` → `REFUNDED` | `PARTIALLY_REFUNDED` | `CHARGEBACK`

`PARTIALLY_REFUNDED` → `REFUNDED` | `PARTIALLY_REFUNDED` | `CHARGEBACK`

`FAILED`, `EXPIRED`, and `REFUNDED` do not move again in this ledger.

`CHARGEBACK` is the orchestrator word for the payments-PRD state `DISPUTED`. A new fulfillment decision is not implemented here.

A verified `payment.paid` can move `NOT_STARTED` directly to `PAID`, matching a provider event that never sent a pending notice. `FAILED` and `EXPIRED` do not become `PAID` from another webhook. The payments PRD allows a later provider read to recover `EXPIRED`. That recovery is unresolved and is not implemented. Fail closed.

## Evidence

Only these kinds can change the ledger:

- `VERIFIED_PROVIDER_EVENT`
- `TRUSTED_MERCHANT_EVENT`
- `RECONCILED_RECORD`

These cannot:

- `REDIRECT` (a payment URL visit or a browser return)
- `WHATSAPP_MESSAGE`
- `SCREENSHOT`
- `CUSTOMER_CONFIRMATION`

A rejected notice does not change status. The same event id is then a duplicate.

`verifiedPaid` becomes true only after a verified paid notice is applied. It stays true after a later refund so the ledger remembers that money moved. Current revenue uses the status: `PAID` is full level A, `PARTIALLY_REFUNDED` is partial level A, `REFUNDED` and `CHARGEBACK` are not revenue.

## Attempts and references

`PaymentAttempt` is a type: its own `attemptRef`, its own `externalId`, whole `amountIdr`, currency `IDR`. It is not the booking's `PRV-` reference. Nothing writes gateway credentials. There is no PAN, CVV, or raw card field.

One ledger in the mock is one attempt. A second capture is a new attempt, not a second paid notice on the same ledger. A repeated paid notice with the same amount is a duplicate.

## Amounts

Currency must be `IDR`. Amounts are whole rupiah safe integers.

- `payment.paid` requires `amountIdr >= 1`
- `payment.refunded` is a full refund. `amountIdr` must equal the captured amount
- `payment.partially_refunded` carries the cumulative refunded total, not a delta. A second notice with the same cumulative total does not add again. A higher cumulative total replaces it. A partial that equals the captured amount is rejected so a full refund uses `payment.refunded`

This matches the payments PRD rule that a second partial stores the new refunded total.

## Duplicates, delay, and order

`applyPaymentNotice` is pure. The input ledger is not mutated.

| Arrival | Result |
|---|---|
| Same `eventId` again | `duplicate`. Status unchanged |
| Second `payment.paid` for the same captured amount | `duplicate` |
| `payment.pending` after `PAID` | `ignored_out_of_order`. Status stays `PAID` |
| Refund, partial refund, or chargeback before `PAID` | `queued_out_of_order`. Status stays unpaid |
| Verified `payment.paid` while a refund is queued | Applies paid, then the queued refund in sequence and time order |
| `payment.failed` after `PAID` | `ignored_out_of_order` |

Webhook authentication is `assessWebhook` in the booking contract. A notice is applied only after that gate would pass. The ledger itself re-checks evidence. Both checks are in process. Neither is mounted on a URL.

## Reconciliation

A level A outcome needs one of the three verified evidence kinds and a payment status of `PAID` or `PARTIALLY_REFUNDED`, linked to a transaction ref. Outlet id is copied from the transaction when a touchpoint or a later rollup is built.

These are not reconciliation:

- Opening the payment URL
- A WhatsApp message that says paid
- A screenshot
- The customer confirming in chat
- A booking confirmation
- Catalog eligibility or Meta review status
- An estimated cart total

`OFFLINE_RECONCILIATION` is a mode name for a future matched settlement file. No file format is accepted in this milestone. A trusted merchant event still has to be that evidence kind on a notice. Staff confirmation of a manual booking does not create one.

## Map from the current commerce words

The orders table is not updated.

| Source | Map |
|---|---|
| `CommerceOrder.paymentStatus = NOT_INITIATED` | `NOT_STARTED` |
| Payments PRD `OPEN` and catalog `REVIEW` | `NOT_STARTED` |
| `LINK_CREATED` | `PENDING` |
| `DISPUTED` | `CHARGEBACK` |
| Unpaid attempt `CANCELLED` | `FAILED` |
| Unknown word | `NOT_STARTED` |

`CommerceReadiness.paymentStatus` stays `NOT_CONNECTED`.

## Explicitly not built

- Xendit or Midtrans HTTP
- Webhook URLs, path tokens, and encrypted gateway keys
- `X-Append-Notification` behavior
- Sandbox charges
- Refund execution
- Chargeback evidence files
- Any write to `CommerceOrder`

No live payment test is authorized. The unit tests call `applyPaymentNotice` and `recordPayment` with fixture notices only.
