# Commerce payments PRD

Status: **design accepted, not built.** No gateway client, webhook, order table, or live charge exists. `COMMERCE_PAYMENTS_ENABLED` stays unset. `CommerceReadiness.paymentStatus` stays `NOT_CONNECTED`.

Reviewed 2026-10-24. This revision adds the payment state machine, webhook coexistence, idempotency, amount checks, and sandbox acceptance tests. It still does not authorize implementation.

## Two different kinds of money

| Path | Who pays whom | Where it is decided |
|---|---|---|
| Rail A / Rail B | A brand pays AtlasNow for the workspace or WhatsApp credits | Monetization PRD. Rail A is IDR invoice. Rail B is Creem later, and only for that fee. |
| Commerce payments | A shopper pays the merchant for an order | This document. Xendit or Midtrans accounts the merchant already owns. |

Commerce funds settle to the merchant. They are not collected into an AtlasNow bank account. Creem, PayPal, Stripe, and iPaymu are not shopper-checkout adapters. iPaymu stays the open candidate for AtlasNow's own IDR credit checkout, not for carts.

No commission rate is set. Split settlement, sub-merchant onboarding, and merchant-of-record are out of scope until a separate commercial agreement and a Monetization PRD edit both exist. `commissionBps` stays null and is never sent to a provider.

## Customer path

WhatsApp native catalog → send cart → AtlasNow order → payment link → verified payment → fulfillment.

A visit to the payment URL, or a browser return from the gateway, does not change the order to paid. Fulfillment does not start from catalog eligibility or from a created link.

## Model A — merchant gateway

The merchant connects one gateway they already own. First providers: Xendit and Midtrans. One active connection per tenant. Credentials are encrypted for that tenant and are never copied to another tenant.

Sandbox and production are separate connections. Production HTTP stays refused while `COMMERCE_PAYMENTS_ENABLED` is off. Sandbox HTTP stays refused until a later slice enables a sandbox-only flag for one internal tenant.

Each provider has its own adapter. Order code does not call provider hosts itself. A payment link is created only from an order whose lines were checked against the AtlasNow product master.

## Model B — payment partner

Reserved fields only: partner account id, KYC status default `NOT_STARTED`, and a null commission. No onboarding API and no split instruction.

## Separate facts

| Fact | Owner | Moves when |
|---|---|---|
| Catalog eligibility | Product | Archive or eligibility rules. Never because money moved. |
| Order payment status | Order | Only the payment state machine below. |
| Fulfillment | Fulfillment record | A later slice, and only after payment is `PAID`. Refund and dispute do not by themselves mark goods handed or void. |

Catalog review (`UNKNOWN`, `PENDING`, `APPROVED`, `REJECTED`) is a fourth fact and is not in this table.

## Payment state machine

The payment attempt is the source of truth. The order payment status is a copy of the latest applied attempt, except `REVIEW` and `OPEN`, which exist only on the order.

Attempt states: `LINK_CREATED`, `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `DISPUTED`.

Order payment status adds `OPEN` (no attempt yet) and `REVIEW` (the cart did not match the product master, so no link exists).

Allowed moves:

| From | To | Who may write it |
|---|---|---|
| `LINK_CREATED` | `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED` | Verified webhook or a matching provider read |
| `PENDING` | `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `DISPUTED` | Same |
| `PAID` | `REFUNDED`, `PARTIALLY_REFUNDED`, `DISPUTED` | Verified refund or dispute event, then a provider read that agrees |
| `PARTIALLY_REFUNDED` | `REFUNDED`, `PARTIALLY_REFUNDED` | A further verified refund. A second partial stores the new refunded total. It does not add the amounts twice. |
| `DISPUTED` | `PAID`, `REFUNDED` | Provider read shows the dispute closed in that direction |

No other move is applied. In particular:

- `PAID` never goes back to `PENDING` or `LINK_CREATED`.
- `EXPIRED` and `FAILED` do not become `PAID` from a webhook alone. A provider read that shows a settled payment for the same reference and the same amount may recover `EXPIRED` to `PAID`. The event row records that recovery. A mismatched late webhook stays `REJECTED`.
- `CANCELLED` is an unpaid attempt closed by the merchant or the shopper. It is not a refund.
- `DISPUTED` is not `PAID`. New fulfillment stays blocked. An order already `HANDED` stays `HANDED` until a person voids it.
- `REFUNDED` does not change fulfillment and does not change catalog eligibility.

Provider words map like this. A channel that cannot express a state does not invent one. The sandbox test for that case records `UNSUPPORTED`.

| Attempt | Xendit | Midtrans |
|---|---|---|
| `PENDING` | Invoice `PENDING`. Payments API `payment.authorization` is not `PAID`. | `transaction_status=pending`, or `capture`/`settlement` while `fraud_status` is still absent |
| `PAID` | Invoice `PAID` or `SETTLED`. Payments API `payment.capture` with the captured amount equal to the order. | `status_code=200`, `fraud_status=accept`, and `transaction_status` of `settlement` or `capture` |
| `FAILED` | Payment failed event. | `deny` or `failure` |
| `EXPIRED` | Invoice `EXPIRED`. Payments API `payment_request.expiry` or `payment.expiry`. | `expire` |
| `CANCELLED` | Cancelled unpaid invoice, when the provider sends it. | `cancel` while unpaid |
| `REFUNDED` | Refund completed for the full amount, when that product supports refunds. | `refund` |
| `PARTIALLY_REFUNDED` | Refund completed for less than the settled amount, when supported. | `partial_refund` |
| `DISPUTED` | A chargeback or fraud event for a card payment, when that event exists. QRIS and VA often have no dispute object. | `fraud_status=challenge`. Do not treat `challenge` as paid. |

`PAID` requires the provider word and the amount check below. Redirect URLs (`success_redirect_url`, Snap finish, unfinish, error) write `returnedAt` only.

Fulfillment values stay `NOT_STARTED`, `READY`, `HANDED`, and `VOID`. This module does not set them. A later slice may set `READY` only from `PAID`.

## Amount, reference, and expiry

The authoritative amount is `CommerceOrder.amountIdr`, the sum of line totals. Each line total is quantity times the AtlasNow unit price in whole rupiah, copied when the order is created. After a link exists, that amount does not change.

The browser cannot submit an amount. The WhatsApp cart price is not authoritative. A retailer id must match an active product or variant on that tenant, and the outlet must belong to the tenant. A missing SKU, an archived product, or a price that differs from the cart sets the order to `REVIEW`. No link is created.

The adapter sends:

- currency `IDR`
- amount equal to `amountIdr` with no fraction
- merchant reference equal to the payment attempt id (`external_id` on Xendit, `order_id` on Midtrans)

A notification or a provider read is applied only when all of these hold:

- currency is `IDR`
- the provider amount is the same whole rupiah. Midtrans `gross_amount` of `150000.00` is 150000. Any fractional rupiah is a mismatch.
- the merchant reference is the attempt id
- the provider payment id matches the attempt once that id is stored. The first verified response may store it.

A mismatch stores the event as `REJECTED` and does not move the attempt.

Expiry time is the provider's expiry, stored on the attempt. A local clock does not expire an attempt by itself. When the stored time has passed, a reconciler reads the provider. Expired there becomes `EXPIRED`. Settled there, with the same amount, becomes `PAID` through the recovery rule above.

## Idempotency

| Action | Key | Repeat behaviour |
|---|---|---|
| Inbound WhatsApp order | `(tenantId, source, cartRef)` | Returns the existing order. Does not create a second order or a second link. |
| Create payment link | `(tenantId, attempt idempotency key)` which is the order id plus attempt number | If the attempt already has a provider payment id and a URL, return them. Do not call the provider again. |
| Provider notification | `(tenantId, provider, providerEventId)` | Second delivery returns 200 and does not apply again. |
| Provider retry of the same status | Same event key, or the same `(providerPaymentId, mapped status, amount)` when the provider sends no event id | No-op if the attempt is already in that status. |
| Refund retry | Provider refund id inside the event key | The refunded total is set from the provider read, not added to itself. |

Xendit `webhook-id` is the event id. Midtrans can repeat a status with no separate event id, so the key is `order_id`, `transaction_status`, `fraud_status`, `gross_amount`, and `transaction_id`.

The event row and the attempt update commit in one transaction. The HTTP 2xx is sent after that commit. A crash before the commit is safe because the provider retries. A crash after the commit is safe because the next delivery hits the unique key.

## Partial failures

Create link, and the provider times out:

1. Read the provider by the attempt id we would have sent.
2. If that payment exists, store its id and URL. Do not create another.
3. If it does not exist, create once.
4. Two overlapping creates take one attempt row with a unique key. The loser returns that row.

Webhook received, process crashes:

- No commit yet: the retry applies once.
- Commit done: the retry is a 200 no-op.

Provider says paid while the attempt is still `LINK_CREATED`:

- The reconciler uses the same amount and reference checks as a webhook. It does not mark paid from age or from a redirect.

A second link for an order that already has an open attempt is not created. A new attempt is allowed only when the previous one is `EXPIRED`, `FAILED`, or `CANCELLED`, and the order is not `PAID`, `REFUNDED`, or `DISPUTED`.

## Credentials and settlement

- Settlement account is the merchant's account at Xendit or Midtrans.
- `credentialsEnc` is AES-256-GCM, same helper as Meta tokens, with a key version. The blob holds the API key or server key and the webhook verification token.
- Production refuses the development `AUTH_SECRET` fallback.
- Settings accept secrets on write and never return them.
- Adapter hosts are fixed. Sandbox and production hosts are not taken from the merchant.
- Webhook path is an unguessable token for one connection. A tenant id inside the JSON is ignored. Another tenant's path cannot update this order.
- Agency staff who can already manage the tenant may save credentials. They cannot read them. Platform mode cannot open payment settings.
- No card numbers are stored.

## Webhook coexistence

AtlasNow must not replace a callback the merchant already uses in production.

### Midtrans

Dashboard payment-notification URLs stay as they are. The charge or Snap request sends `X-Append-Notification` with the single AtlasNow URL. It does not send `X-Override-Notification`. Override would drop the dashboard URL. If both headers are present, Midtrans uses only override, so the adapter must not send override.

Append accepts up to three URLs. AtlasNow adds one. The merchant's existing dashboard URL still receives the notification. Some methods, including some GoPay flows, follow the URL on the request instead of the dashboard. The adapter still uses append, not override, and the sandbox test asserts the header.

Finish, unfinish, and error redirect URLs are browser pages. They are not the notification URL.

Verify `signature_key` as SHA-512 of `order_id + status_code + gross_amount + server key`, compared in constant time. Then read the transaction status API. `PAID` requires the notification and that read to agree. A bad signature is 401 and writes nothing.

Sources: [Override Notification URL](https://docs.midtrans.com/reference/override-notification-url), [HTTP notification](https://docs.midtrans.com/docs/https-notification-webhooks), [Receiving notifications](https://docs.midtrans.com/reference/receiving-notifications).

### Xendit

Do not call the set-webhook-url API and do not save an AtlasNow URL over the dashboard webhook. For an invoice, that API replaces the account URL for that product type. The merchant's current URL keeps receiving `invoice` and Payments API events.

Coexistence, in order:

1. If the merchant has no webhook URL for that product, they may set the AtlasNow path themselves in their dashboard. AtlasNow does not set it for them.
2. If they already have a URL, leave it. Their server may forward a copy. AtlasNow also reconciles by reading the invoice or payment with that tenant's secret key.
3. A per-payment return URL is a browser redirect. It is not a substitute for the webhook and it does not mark paid.

Verify `x-callback-token` in constant time against the stored token. Use `webhook-id` as the event id. Then read the invoice or payment and compare reference, currency, and amount. A bad token is 401 and writes nothing.

Xendit retries until it receives 2xx, so the handler must be idempotent.

Sources: [Handling webhooks](https://docs.xendit.co/docs/handling-webhooks), [Set webhook URL](https://docs.xendit.co/apidocs/set-webhook-url), [Webhook behavior](https://docs.xendit.co/apidocs/webhook-behavior).

## Sandbox acceptance tests

These tests are the contract for the first implementation slice. They are not in the tree yet. They use sandbox keys and sandbox hosts only. They do not set `COMMERCE_PAYMENTS_ENABLED`. They do not call production.

Both providers:

- A second tenant cannot apply the first tenant's event.
- A browser return does not set `PAID`.
- A mismatched amount or currency does not set `PAID`.
- A duplicate notification does not create a second order change.
- A timed-out create is recovered by reading the merchant reference, not by creating a second payment.
- Catalog eligibility and fulfillment stay where they started when payment becomes `PAID`.
- The secret is absent from the API response and from stored logs.

Xendit sandbox:

- Create a sandbox invoice whose `external_id` is the attempt id and whose amount equals the order.
- A notification with the correct `x-callback-token`, a new `webhook-id`, and a matching read becomes `PAID`.
- A wrong token returns 401 and leaves the attempt unchanged.
- The same `webhook-id` returns 200 once.
- An expired invoice becomes `EXPIRED`.
- The test doubles as a guard that the set-webhook-url endpoint was not called.
- A full refund, if that sandbox product can refund, becomes `REFUNDED`. If it cannot, the test records `UNSUPPORTED` and does not invent a refund.
- A card dispute event, if the sandbox emits one, becomes `DISPUTED` and not `PAID`. Otherwise the test records `UNSUPPORTED`.

Midtrans sandbox:

- The create request includes `X-Append-Notification` and does not include `X-Override-Notification`.
- `order_id` is the attempt id and `gross_amount` matches the order.
- `settlement` or `capture`, with `fraud_status=accept`, a valid signature, and an agreeing status read, becomes `PAID`.
- `pending` becomes `PENDING`.
- `expire` becomes `EXPIRED`.
- `deny` or `failure` becomes `FAILED`. Unpaid `cancel` becomes `CANCELLED`.
- `refund` and `partial_refund` map to those states on a method that supports them. A method that cannot refund records `UNSUPPORTED`.
- `fraud_status=challenge` becomes `DISPUTED` and not `PAID`.
- A bad signature returns 401.
- The finish redirect does not set `PAID`.

## Build order

| Phase | What | Still refused |
|---|---|---|
| 0 | This document | All provider calls, schema migration, WhatsApp cart |
| 1 | Connection row, encrypted keys, settings screen. Readiness stays not connected until the sandbox tests pass. | Production calls, shopper links |
| 2 | Internal order, sandbox link, the acceptance tests above | Live switch, customer WhatsApp, fulfillment changes |
| 3 | WhatsApp cart creates the order after the SKU and price check | Replacing a merchant webhook, HQ number sends |
| 4 | Model B, only after a provider contract and a Monetization PRD edit | Any commission or split before that edit |

Phase 1 does not start until this revision is accepted. Accepting it does not turn payments on.

## Data model

Proposed only. Do not migrate until a payments slice is approved.

`CommercePaymentConnection` — one active row per tenant. `provider` is `XENDIT` or `MIDTRANS`. `environment` is `SANDBOX` or `PRODUCTION`. `credentialsEnc`, `keyVersion`, `status` (`NOT_CONNECTED`, `SANDBOX_READY`, `DISABLED`), `webhookPathToken`, `lastError`, `disconnectedAt`.

`CommercePaymentPartnerAccount` — Model B placeholder. `kycStatus` default `NOT_STARTED`. `commissionBps` null. No payout destination.

`CommerceOrder` — `tenantId`, `locationId`, `source` (`WHATSAPP_CART` or `INTERNAL`), payment status, `currency` `IDR`, `amountIdr`, `cartRef`. Unique `(tenantId, source, cartRef)` when `cartRef` is present.

`CommerceOrderLine` — SKU, name snapshot, quantity, unit price, line total.

`CommercePaymentAttempt` — order, provider, environment, idempotency key unique per tenant, `providerPaymentId`, attempt id used as the merchant reference, `amountIdr`, status, `checkoutUrl`, `expiresAt`, `paidAt`, `returnedAt`, `refundedAmountIdr` default 0. Unique `(tenantId, provider, providerPaymentId)` when the provider id is present.

`CommercePaymentEvent` — `providerEventId`, payload hash, signature result, `IGNORED` or `APPLIED` or `REJECTED`. Unique `(tenantId, provider, providerEventId)`. The body is stored only after the signature check. Card data is not expected and is not logged.

`CommerceReadiness.paymentStatus` changes only after the sandbox tests for that connection have passed. The provider name may be shown then. That flag is still not a live charge.
