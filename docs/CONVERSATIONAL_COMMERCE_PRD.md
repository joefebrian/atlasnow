# Conversational commerce PRD

Status: **M0 contract and M1A foundation.** Not deployed. No production migration. No live booking, payment, WhatsApp Flow, or Meta write.

Date: 2026-10-25. Parent branch: `feature/commerce-meta-catalog` (draft PR #1, unmerged). This work is a separate branch. It does not activate Milestone C order capture.

## Position

AtlasNow connects demand from Google Search, Google Maps, Meta ads, websites, and WhatsApp to a verified business outcome.

The merchant keeps the booking system they already use. AtlasNow connects WhatsApp demand to a booking or an order only when a provider adapter can support that step, and it records revenue only when payment evidence is verified.

AtlasNow is not the merchant of record. Shopper funds are not a new payment rail. Software fees and WhatsApp credits stay on the Monetization PRD. Shopper checkout, when it is built later, stays on the merchant gateway described in `docs/COMMERCE_PAYMENTS_PRD.md`.

## What a merchant configures

Three choices are independent. A later settings screen can change one without rewriting the others. This milestone has no settings screen.

### Customer experience

| Experience | What the customer can produce | What it is not |
|---|---|---|
| `WHATSAPP_CATALOG` | A product view, a cart, or a catalog order message | A booking engine and a payment |
| `WHATSAPP_FLOW` | A structured form or a booking selection | A confirmed reservation |
| `WHATSAPP_CHAT` | A conversation that may become a qualified inquiry | A transaction |

A catalog order is not a booking. A Flow submission is not a booking. A chat message is not a payment.

### Booking or order provider

| Mode | Who owns the outcome | This milestone |
|---|---|---|
| `NATIVE` | AtlasNow would own availability, holds, and the booking lifecycle | Mock only. No inventory engine |
| `EXTERNAL_API` | The merchant booking system owns capacity. AtlasNow calls an authorized API and accepts signed status events | Contract and mock. No vendor client |
| `EXTERNAL_CHECKOUT` | The merchant website owns booking and payment. AtlasNow records a tracked handoff | Mock returns a handoff and no slot |
| `MANUAL` | Staff follow up and may confirm an inquiry | Confirmation is not a verified payment |

No vendor API is assumed. If a provider cannot guarantee a slot, the result is pending or a handoff. The mock never invents a slot.

### Payment provider

| Mode | Meaning |
|---|---|
| `MERCHANT_PAYMENT_GATEWAY` | The merchant's own gateway. Payments PRD names Xendit and Midtrans. Not built |
| `EXTERNAL_BOOKING_PROVIDER` | The booking system also collects payment. AtlasNow trusts it only after a signed event or a reconciliation record |
| `OFFLINE_RECONCILIATION` | A matched settlement record. A screenshot is not a settlement |

Creem, PayPal, Stripe, and iPaymu are not shopper adapters. No commission rate is set.

## Outcome evidence

| Level | Name | Counts as revenue |
|---|---|---|
| A | Verified revenue. Payment status `PAID` or `PARTIALLY_REFUNDED` from verified evidence | Yes, full or partial. A refund or chargeback does not |
| B | Verified booking. `CONFIRMED` or `COMPLETED` with a provider-issued reference, payment not verified | No |
| C | Qualified lead | No |
| D | Engagement: traffic, clicks, chat, or a Flow interaction | No |

A WhatsApp cart total, a quote, and a booking estimate are not revenue. `estimateCountsAsRevenue()` is false.

Manual staff confirmation without a provider-issued reference does not reach level B. A customer saying they paid does not reach level A.

## Attribution

Record a touchpoint when an identifier exists:

- Meta click-to-WhatsApp: keep `ctwa_clid` when the source provides it
- Google Ads: `gclid`, `gbraid`, or `wbraid`
- Website: UTM parameters, session-level, not a person id
- QR: a campaign id
- Direct WhatsApp: no click id, low confidence

Google Search Console and Business Profile totals are outlet-level context. They are not copied onto a person. A missing identifier stays missing.

## Tenancy

Every record carries `tenantId`. Location-scoped records also carry `locationId`. An actor from another tenant receives a denial and no payload. A provider registered for one tenant is not resolved for another, even when the provider id string matches.

A phone number is not a correlation key for a payment, a booking, or an idempotency key.

## Policy

Unknown merchant eligibility fails closed for catalog and Flow transactions. Lead capture can still be recorded. Details are in `docs/WHATSAPP_EXPERIENCE_POLICY_CONTRACT.md`.

No merchant is hardcoded. This PRD does not create a workspace, a product, or a connection for any pilot. Admission and service offers stay off transactional WhatsApp until eligibility and approval evidence both exist. The existing QA catalog and the imported Montessori product are not modified.

## Existing catalog commerce

The shipped catalog path stays as it is:

Meta Catalog → product discovery → product import → AtlasNow product master.

`CommerceProduct` remains the goods master. `CommerceCatalogLink` remains the Meta item map. `CommerceConnection` remains the Meta catalog login. It is not a booking connection. `CommerceOrder` remains an unreleased catalog-order capture. Production does not have that table. This milestone does not write it and does not turn `COMMERCE_ORDER_CAPTURE_ENABLED` on.

Catalog eligibility stays `UNKNOWN` or `INELIGIBLE`. This module cannot mark a product eligible.

## Out of scope

- Database migrations and production writes
- Inbound webhook routes
- Outbound Meta or WhatsApp messages
- Live Flows
- A payment gateway client
- Native capacity, holds that expire, or a real reservation
- Production UI and feature flags
- Deploy, merge of PR #1, container rebuilds, and changes to Inbox, WAHA, Caddy, loyalty, or broadcast

## Acceptance for this milestone

- The six contract documents in `docs/`
- Pure TypeScript under `src/lib/conversational-commerce/`
- Unit tests for transitions, isolation, provider gaps, conflicts, idempotency, timeouts, missing references, payment duplicates and ordering, cancellation versus refund, unpaid confirmed bookings, paid unconfirmed bookings, unknown eligibility, catalog versus Flow normalization, missing attribution, and the existing commerce constants
- `tsc --noEmit` passes
- Existing commerce unit tests pass
- Zero new migration folders
