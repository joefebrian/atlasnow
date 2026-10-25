# Transaction orchestrator architecture

Status: **M1A foundation, in memory only.** The orchestrator does not open a database connection and does not call Meta or a payment host.

## Separated concerns

| Concern | Owner in this milestone | Must not decide |
|---|---|---|
| Customer experience | `experience.ts` normalizes catalog, Flow, and chat into an intent | Booking state or payment status |
| Transaction orchestration | `orchestrator.ts` | Capacity at an external merchant system |
| Booking or order | Provider adapter | Whether money moved |
| Payment | `payment.ts` ledger | Whether a booking is confirmed |
| Revenue attribution | `attribution.ts` | Inventing a click id |

A transaction can be `COMMITTED` while payment is `NOT_STARTED`. A payment can be `PAID` while the booking is still `REQUESTED`.

## Identity

Internal references are immutable and derived from tenant plus caller material. They are not phone numbers.

| Reference | Prefix | Role |
|---|---|---|
| Intent | `CIN-` | Demand record |
| Transaction | `CTX-` | Orchestration record. Stable for one tenant and idempotency key |
| Booking | `CBK-` | Reservation inside the adapter |
| Provider reference | `PRV-` | Id issued by the provider. Stored separately from the internal booking ref |
| Payment attempt | `CPA-` | Defined on the type. Not created by a live gateway |
| Event | `CEV-` | Append-only note |

`phoneCorrelation` rejects a bare phone-shaped idempotency key or offering id. Customer phone is not a field on the transaction, the booking, or the provider reference.

Every operational function takes `tenantId`. Location-scoped booking commands take `locationId`. `authorize` returns `CROSS_TENANT` when the actor tenant and the record tenant differ, and `LOCATION_FORBIDDEN` when the actor's location list excludes that outlet. The denial payload does not include the other tenant's provider reference.

## Domain model and existing tables

These names are types in `src/lib/conversational-commerce/types.ts`. They are not Prisma models. No table was added.

| Concept | Persistence decision |
|---|---|
| `CommerceIntent` | Not stored. A catalog order can point at `CommerceOrder.reference` later. This code does not write that row |
| `CommerceTransaction` | Not stored. In-memory only inside `OrchestratorState` |
| `Booking` | Not stored. The mock keeps it in a `Map` |
| `OrderLink` | A pointer. `COMMERCE_ORDER` means the existing `CommerceOrder`. `PROVIDER_ORDER` is reserved. Neither is written |
| `ProviderConnection` | Not `CommerceConnection`. That row is the Meta catalog login: business, WABA, masked phone, catalog id, encrypted token. A booking connection needs its own future row |
| `ProviderReference` | Not `CommerceCatalogLink`. The catalog link stores Meta product ids and retailer SKUs. It is not a booking id and not a payment id |
| `PaymentAttempt` | Not stored. Distinct from `CommerceOrder.paymentStatus`, which stays `NOT_INITIATED` until Milestone C is approved and a later payment slice moves it |
| `TransactionEvent` | In-memory list. Not `CommerceSyncLog` |
| `AttributionTouchpoint` | Not stored. Review capture already keeps UTM on a different feature. It is not reused as revenue |

`CommerceProduct` stays the goods master: SKU, whole IDR, outlet availability, catalog eligibility `UNKNOWN` or `INELIGIBLE`. A booking offer is not forced into that row in this milestone. Reuse the product later for catalog goods. Do not overload it with appointment capacity.

`CommerceReadiness.paymentStatus` stays `NOT_CONNECTED`. A mock payment notice does not change it.

### Why these are not new tables yet

Production history is 39 finished migrations. `CommerceOrder` is not among them. The production entrypoint runs `prisma migrate deploy` on boot. A new migration folder in an image would apply on the next boot. This milestone adds no folder.

`CommerceOrder.status` is fixed at `PENDING_PAYMENT` and is not the booking state machine. Folding booking states into that column would mix a catalog cart with a reservation and would require the orders migration that is still excluded from production.

## State machines

### Transaction

`OPEN` → `IN_PROGRESS` | `PENDING_RESOLUTION` | `COMMITTED` | `FAILED` | `CLOSED`

`IN_PROGRESS` → `PENDING_RESOLUTION` | `COMMITTED` | `FAILED` | `CLOSED`

`PENDING_RESOLUTION` → `IN_PROGRESS` | `COMMITTED` | `FAILED`

`COMMITTED` → `CLOSED`

`FAILED` and `CLOSED` are terminal.

`PENDING_RESOLUTION` means the provider timed out. The same idempotency key returns that result and does not call the provider again until `releaseTimedOut`. Release does not invent a booking.

A successful hold stores `IN_PROGRESS`. A provider confirmation stores `COMMITTED`. Cancel moves the transaction to `CLOSED` and does not change the payment ledger.

### Booking

`REQUESTED` → `HELD` | `CONFIRMED` | `REJECTED` | `EXPIRED` | `CANCELLED`

`HELD` → `CONFIRMED` | `REJECTED` | `EXPIRED` | `CANCELLED`

`CONFIRMED` → `COMPLETED` | `CANCELLED` | `NO_SHOW`

`COMPLETED`, `REJECTED`, `EXPIRED`, `CANCELLED`, and `NO_SHOW` are terminal.

`HELD` is legal only when `supportsHold` is true. A submitted Flow is not `CONFIRMED`. A displayed slot is not `HELD`.

Occupying states for the mock conflict check are `HELD` and `CONFIRMED`. `REQUESTED` does not occupy capacity. Manual inquiries can repeat. Native and external confirmed or held rows conflict on the same tenant, location, offering, and start time.

### Payment

See `docs/PAYMENT_RECONCILIATION_CONTRACT.md`. The booking transition function does not read payment status.

## API shape

There is no HTTP route.

| Function | Effect |
|---|---|
| `reserve` | Policy, tenant check, idempotency, then hold or create |
| `releaseTimedOut` | Clears one tenant's inflight key so a later reserve may call again |
| `cancelReservation` | Provider cancel. Payment ledger unchanged |
| `recordPayment` | Applies one payment notice. Booking state unchanged |
| `readBooking` | Tenant and location check. Cross-tenant returns no booking body |
| `normalizeCustomerExperience` | Intent only. `confirmed` is false |
| `assessWebhook` | HMAC, tenant, provider, skew, duplicate, ordering flag. No socket |
| `planBookingEvent` | Next booking state, or a refusal. Reschedule is not applied |

Idempotency key plus a hash of tenant, location, provider, offering, start, experience, category, and merchant-confirmed flag:

- Same key and same hash returns the stored result and does not call the provider again
- Same key and a different hash returns `IDEMPOTENCY_CONFLICT`
- A timeout is stored as inflight, not as a finished idempotent success

## UX architecture

No screen changes in this milestone. A later workspace UI should show three settings and a transaction list:

- Experience, booking provider, and payment provider are separate controls
- Booking state and payment state are separate columns
- Unknown eligibility is shown as blocked
- Estimates are labeled as estimates
- Cashiers stay out of Commerce, matching `canWriteCommerce`
- Brand admin and agency staff write. HQ ops and regional stay read-only when a screen exists

The current Commerce page, catalog import, and order-capture empty state are unchanged.

## Threat model

| Threat | Mitigation in M1A | Still open |
|---|---|---|
| Cross-tenant read or write | Actor tenant must match. Registry is tenant-scoped. Denial omits the other payload | Persist the check next to every future query |
| Location leak inside a tenant | Actor location list is enforced | HQ-wide null list is intentional for brand admin |
| Unsigned or mismatched webhook | HMAC over `timestamp.body`. Empty secret fails closed | No route is mounted. Secret storage is not built |
| Replay | Event time must be within five minutes of the supplied clock. Seen event ids are duplicates | Clock source and nonce store are not durable |
| Out-of-order events | Payment regress is ignored. Early refunds queue. Sequence numbers are flagged | Booking reschedule is recognized and not applied |
| Idempotency swap | Hash covers the business payload. A second payload with the same key conflicts | Key storage is in memory |
| Phone as a join key | Rejected before the provider is called. Phone is not a column on these types | A future schema review must keep it that way |
| Fake paid | Redirect, WhatsApp text, screenshot, and customer confirmation cannot verify payment | A live gateway verifier is not built |
| Policy bypass through Flows | Restricted categories are denied on Flow even with an evidence string | Evidence is a non-empty reference, not a checked Meta document |
| Double book | Mock conflict on held or confirmed slot. Second call does not create a row | External capacity stays at the merchant. The mock is not that system |
| Timeout duplicate | Second reserve does not call the provider until release. Timeout does not insert a booking | A real adapter must look up the original request before creating another |
| Invented availability or price | Empty slot list when none were supplied. Quote fails closed without a whole-IDR amount | Native inventory does not exist |
| Card data | No card field exists | Do not add one |
| Public generic webhook | No route | Future receiver must be provider-scoped and signed |
| Catalog batch or token leak | This module does not import the Graph client and does not read `process.env` | Keep it that way |

## Migration strategy

This change adds zero migration folders. Do not add one in a follow-up image until a reviewed release plan says so.

When persistence is approved later:

- Add new tables. Do not recycle `CommerceOrder.status` as the booking state machine
- Keep `20261024180000_commerce_orders` out of production until Milestone C is approved on its own
- Keep both inbox folders, `20261004120000_wa_message_image` and `20261004143000_inbox_image_retention`, in any production image that already has them
- Do not drop loyalty or broadcast indexes to make a diff clean
- A future booking `ProviderConnection` is a different row from `CommerceConnection`
- Backfill is empty. There is no production transaction to move

## Compatibility map

`mapCommercePaymentStatus` is a read-only vocabulary map:

| Existing word | Orchestrator |
|---|---|
| `NOT_INITIATED`, `OPEN`, `REVIEW` | `NOT_STARTED`. `REVIEW` stays a catalog validation result |
| `LINK_CREATED` | `PENDING` |
| `DISPUTED` | `CHARGEBACK` |
| Unpaid `CANCELLED` | `FAILED`, not a refund |
| `PAID`, `FAILED`, `EXPIRED`, `REFUNDED`, `PARTIALLY_REFUNDED` | Same word |
| Anything else | `NOT_STARTED`, never `PAID` |

`catalogOrderConfirmsBooking()` is false. `ORDER_STATUS_PENDING_PAYMENT` remains `PENDING_PAYMENT`.

## Decisions

Accepted:

- One orchestrator for catalog, Flow, chat, and later providers
- Capability flags instead of a different code path per vendor
- Payment evidence is separate from booking state
- Unknown policy fails closed
- Stack this branch on `feature/commerce-meta-catalog` because `main` does not contain the commerce models

Rejected:

- Reusing `CommerceOrder` as the transaction aggregate now
- Treating `CommerceConnection` as a booking connection
- Correlating on phone number
- A single public webhook URL
- AtlasNow as merchant of record
- A native inventory engine inside this milestone
- A hardcoded pilot merchant or a new QA catalog write
- Optional TypeScript methods for unsupported operations. Every adapter implements every method and returns `UNSUPPORTED` so callers cannot skip the check

## Unresolved

- Whether level B can ever come from a signed in-product merchant confirmation, or only from an external reference. M1A requires a provider-issued reference
- Hold expiry owner: AtlasNow clock or the provider. The mock does not expire holds
- Which booking vendors exist. None are integrated
- Where `ctwa_clid` is stored and for how long
- Durable idempotency and webhook dedupe
- Recovery of an `EXPIRED` payment attempt by a later provider read. The payments PRD allows that. This ledger does not
- Outlet-level rollups of level A and level B outcomes. Not a read model yet
- The future SQL shape. Listed above as a proposal, not a migration
