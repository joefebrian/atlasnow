# Decision log

Short record of choices that later work should not undo. Money rules stay in the Monetization PRD. WhatsApp number rules stay in the HQ WhatsApp decision.

## 2026-10-26 — Conversational M2.2 release readiness is a review

`docs/M2_2_RELEASE_READINESS.md` records the git migration inventory at `df3e7f2`, the documented production inventory of 37 migrations, and the boot path that runs `migrate deploy`. Production history was not queried. Staging implementation is NO-GO until that inventory is verified from a backup and application boot stops applying every folder in the image. No schema change. No `migrate resolve`. YOLA FUN stays NO-GO.

## 2026-10-26 — Conversational M2.1B rolls back direct SQL when an atomic write returns failure

`registerConnection()` inserted a new `CcProviderConnection` on the open `runAtomic` transaction. Prisma commits a callback that returns, so a later `{ ok: false }` skipped the diff flush and still committed that insert. The adapter now throws that failure inside the transaction and returns the same `PortResult` after rollback. A thrown exception still rolls back. A successful atomic callback still commits the nested connection. Claim SQL stays in its own transaction and does not run while a row scope is already open. No schema change.

## 2026-10-26 — Conversational M2.1B removes the QA snapshot rewrite

Payment, webhook, attribution, policy, and credential writes use the same row diff as bookings. `writeSnapshot()` and `pg_advisory_xact_lock(hashtext('atlasnow-cc'), hashtext('qa'))` are gone from the adapter. A failed financial result does not flush. The in-memory transitions stay the source of the business rules. The adapter is still QA-only: disposable `atlasnow_cc_qa_*` databases, no HTTP webhook, no gateway, no production migration. Row locks do not make an external provider call exactly once. AtlasNow is not the merchant of record.

## 2026-10-26 — Conversational M2.1A booking writes are row-level and QA-only

Booking and idempotency writes lock the rows for that operation and apply the existing in-memory transitions. They do not take `pg_advisory_xact_lock(hashtext('atlasnow-cc'), hashtext('qa'))` and they do not delete and reinsert the `Cc*` tables. Claim stays `INSERT ... ON CONFLICT` plus `SELECT ... FOR UPDATE`. Payment, webhook, attribution, credential, and policy writes still use the QA snapshot rewrite. That path is not production ready and can overwrite a concurrent booking row. M2.1B has to replace it before the adapter is called production-grade. No production migration.

## 2026-10-26 — Conversational M2 persistence is QA-only

PostgreSQL stores conversational bookings and payments only in a disposable `atlasnow_cc_qa_*` database. Production `migrate deploy` is a separate approval. Amounts are `BIGINT`. Writes stop at the catalog ceiling of 1000000000 whole rupiah. Reads reject values above `Number.MAX_SAFE_INTEGER`. A live slot is unique per provider, not across booking systems. `CcIdempotency.transactionRef` may be null when the provider definitely did not commit. Payment trust stays in the in-process HMAC, not in the database adapter. AtlasNow is not the merchant of record.

## 2026-10-23 — Commerce is multi-tenant, not a single pilot

The first build is a merchant product master. Pilot names stay out of the code. AtlasNow SKUs are the source of truth.

## 2026-10-23 — IDR is a whole number

Prices are Prisma `Int` rupiah. Floats are rejected. There is no cents column.

## 2026-10-23 — Three different statuses

Internal availability (in stock or not), catalog eligibility (`UNKNOWN` or `INELIGIBLE`), and Meta review (`UNKNOWN`, `PENDING`, `APPROVED`, `REJECTED`) are separate. The product form cannot set Meta-approved. Users cannot mark a product eligible.

## 2026-10-23 — Archive is one-way

An archived product stays archived. A stale save returns 409. There is no restore button.

## 2026-10-23 — Catalog permission is not added from this repo

The live Meta app does not get `catalog_management` until the founder publishes that scope. The login may request the scope. If Meta does not grant it, the catalog state is Permission error and no batch is sent.

## 2026-10-23 — Live sync is a server switch

Code can build a batch. It sends only when `COMMERCE_CATALOG_SYNC_ENABLED=true` and the merchant catalog state is Connected and the product passes validation. The switch is off.

## 2026-10-23 — Tokens stay on the server

Connection tokens use the existing AES-256-GCM helper. APIs reject bodies that contain token, secret, or access token fields. Phone numbers are stored masked.

## 2026-10-24 — Shopper payment is the merchant's gateway

A commerce order is paid through the merchant's own Xendit or Midtrans account. The money settles to the merchant. AtlasNow's software and credit fees stay on Rail A (IDR invoice) or, later, Rail B (Creem). Creem is not the shopper checkout. No commission rate is set. A payment URL visit is not `PAID`. Midtrans notifications are appended, not used to replace the merchant's callback. Xendit account webhook URLs are not overwritten. The design is `docs/COMMERCE_PAYMENTS_PRD.md`. No gateway call is built and the live switch stays off.

## 2026-10-25 — Order capture stays out of the Slice 2.5 read path

`listCommerceOrders` returns an empty list when `COMMERCE_ORDER_CAPTURE_ENABLED` is not `true` and does not query `CommerceOrder`. The Commerce page says order capture is off. A Slice 2.5 image omits `20261024180000_commerce_orders`. Meta catalog discovery and product import use separate switches and separate tenant lists. A discovery grant does not enable `POST /api/commerce/catalog/products`.

## 2026-10-25 — Local catalog files need a confirmed circle

The 2026-10-24 file used one outlet address plus latitude and longitude. The Meta upload report for `ATLASNOW-QA-SHAPE-001` rejected that shape: location information was missing or incomplete, and `availability_circle_radius_unit` must be a supported value. The successful commerce file uses `id`, `title`, `description`, `availability`, `condition`, `link`, `image_link`, `brand`, and `price`. The successful local file adds `address.city`, `address.country`, `address.region`, a circle origin, radius `12`, and unit `KM`. Street address was empty. An empty or unknown catalog type is unverified and does not use the commerce schema. `activities` stays unsupported. Preview separates product-data blockers from execution blockers. A saved https link is not reported as missing. `wouldSend` and `networkCalled` stay false. Radius is not stored, so the export route still cannot emit a local file. No migration was added. The three pending migrations stay off production. `20261024180000_commerce_orders` remains Milestone C, not Slice 2.5.

## 2026-10-24 — Catalog file and publish preview do not send

A merchant can download a Meta catalog file and preview CREATE or UPDATE. The file is withheld when a required field is missing. A local catalog needs one outlet address, latitude, and longitude. The preview does not call Graph. UPDATE is allowed only when the stored retailer id and Meta product id still match. A saved https product link is not read by the live sync route. `COMMERCE_CATALOG_SYNC_ENABLED` stays off. AtlasNow remains the source of truth after import. There is no automatic two-way sync. The proposal is `docs/COMMERCE_CATALOG_BIDIRECTIONAL.md`.

## 2026-10-24 — Meta catalog import copies items into the product master

A merchant can read the connected Meta catalog and import selected items into AtlasNow. The product master stays canonical. An existing SKU is not overwritten. The Meta product id and retailer id are stored on the catalog link, with sync status `IMPORTED` and `lastImportedAt` set. `lastSyncedAt` stays empty because import does not push. Internal catalog eligibility stays `UNKNOWN` even when Meta review is approved. The read and the import run only when `COMMERCE_CATALOG_IMPORT_ENABLED=true`. That switch stays off. `COMMERCE_CATALOG_SYNC_ENABLED` stays off. The proposal is `docs/COMMERCE_CATALOG_IMPORT.md`.

## 2026-10-24 — WhatsApp catalog orders are captured before any payment

A native WhatsApp `order` message can be stored as a commerce order with status `PENDING_PAYMENT` and payment status `NOT_INITIATED`. The merchant is the connected WABA, phone number, and catalog. The same WhatsApp message id is one order. A different message id is another order. SKU and price are checked against the product master. An unknown SKU is kept for review and is not payment-ready. The WhatsApp item sum is an estimate, not revenue and not the master total. Capture runs only after a verified Cloud signature and only when `COMMERCE_ORDER_CAPTURE_ENABLED=true`. That switch stays off. No payment link, gateway call, ticket, or catalog sync is added. The deployment proposal is `docs/COMMERCE_ORDER_CAPTURE.md`.

## 2026-10-23 — Checkout and payment stay out

A saved product is not a sale. Commerce does not call a payment gateway and does not send WhatsApp. The HQ Cloud number is not registered or subscribed by this flow. The 2026-10-24 decision specifies the later payment design. It does not turn that design on.

## 2026-10-23 — Draft review before merge

Commerce work is pushed to `feature/commerce-meta-catalog` and opened as a draft pull request against `main`. The agent does not merge, deploy, or set the live-sync switch. Approval is required first.

## 2026-10-23 — A catalog batch is not synced when Graph accepts it

`SUCCEEDED` means `check_batch_request_status` finished with no item errors and the product ids were returned. `SUBMITTED` and `PROCESSING` are not success. Meta review `APPROVED` is not written by the sync path. Commerce calls Graph v25.0. Inbox OAuth stays on v21.0.

## 2026-10-23 — Reconnect clears selected Meta assets

A new commerce authorization drops the stored business, catalog, WABA, and phone. They are saved again only when the new token's discovery list contains them. A catalog from the previous business cannot stay Connected.

## 2026-10-23 — A late batch does not overwrite a changed product

A finished batch is applied only when its payload hash, catalog id, and retailer ids still match the merchant's current product and selected catalog. A price edit during processing leaves the product `OUTDATED`. Meta ids from that late batch are not stored.

## 2026-10-23 — A different catalog does not inherit the old item ids

Reconnect and catalog link keep the old `externalProductId` and `metaProductId` rows. `mappingCurrent` becomes false, so those ids are not shown as the current catalog and are not sent as `UPDATE`. The screen shows `OUTDATED` until the new catalog confirms its own items.

## 2026-10-23 — The production sync route has no public URL input

`POST /api/commerce/catalog/sync` cannot send. The server does not accept a product URL on that route. Live send stays behind the server switch plus a validated https product URL that the server already has. Do not bypass that gate.

## 2026-10-23 — Catalog polling does not depend on an open browser

`POST /api/commerce/catalog/poll` continues batches that were already submitted. It uses backoff, an 8-poll cap, a 2-hour age cap, and a row lock. It does not post a new batch.

## 2026-10-23 — Loyalty and broadcast drift stays out of this branch

After the commerce migrations, the schema diff still wants to drop two voucher indexes and set a default on `BroadcastFeeConfig.id`. That drift is not part of commerce. It was not generated into a migration and it was not applied.

## 2026-10-23 — A worker rechecks the product before it writes synced

The poll worker loads the product again after `check_batch_request_status` and the product lookup. It writes Meta ids only in a transaction that still sees the same payload hash, retailer ids, and selected catalog. A price edit during the Meta call does not become `SYNCED`.

## 2026-10-23 — Catalog polling has an entry and stays off

`POST /api/internal/commerce/poll` accepts a bearer `COMMERCE_POLL_SECRET` and polls only when `COMMERCE_CATALOG_POLL_ENABLED=true`. Both are unset. The server process does not start a timer. The row lock stays with the worker until that tick returns.

## 2026-10-26 — Conversational commerce M2 schema review is not a migration

The PostgreSQL proposal is `docs/CONVERSATIONAL_COMMERCE_M2_SCHEMA_REVIEW.md`. It keeps the M1C.2 ports, adds the location unique key the composite foreign keys need, and fills the inflight and idempotency columns the ports already store. Claim, booking persist, uncertain outcome, and payment settlement are each one database transaction. Provider calls stay outside those transactions. `settleConcurrent` is not the concurrency proof. QA uses a disposable localhost database named `atlasnow_cc_qa`. The two migration folders are not created. `prisma/schema.prisma` is unchanged. PR #1 and PR #2 stay open and unmerged. A SQL adapter waits for a separate approval.

## 2026-10-26 — Conversational commerce M1C.2 separates uncertain outcomes from tenant lookups

A provider error code does not prove that no reservation was created. `ProviderFailure.outcomeCertainty` is `NO_COMMIT` or `MAY_COMMIT`. `providerError` defaults to `MAY_COMMIT`, and a missing certainty stays unresolved. Only an explicit `NO_COMMIT` may call `finishDenied` and complete the idempotency key. `RETRYABLE`, `UNAVAILABLE`, `TIMEOUT`, and a success that omits a usable booking reference keep the claim envelope at `PENDING_RESOLUTION`. Recovery still uses the original provider, connection, location, and idempotency key. That is local exactly-once persistence, not exactly-once delivery to the provider. Booking, payment, and cancellation reads match the authenticated tenant and the reference before the location check. The same internal reference string may exist on two tenants. A foreign-only match returns `CROSS_TENANT` and does not return the other tenant's row. The schema sketch already keys those rows by tenant and reference. Do not add a global unique on the reference string. No Prisma schema change, migration, route, Graph write, gateway, or live booking vendor was added. A SQL adapter is still not authorized.

## 2026-10-26 — Conversational commerce M1C.1 closes orchestration boundaries

Only the worker that newly acquires a reservation claim may call the provider. A claim replay rereads the stored outcome: completed work is returned, an in-progress or unresolved operation is not sent again, and a different payload is an idempotency conflict. The claim writes the operation envelope and a `PENDING_RESOLUTION` transaction before any provider call, so a crash after the claim can be reconciled against the original provider. A missing local booking is not treated as provider absence. A provider success that fails to persist locally stays unresolved and is adopted under the original transaction. Payment settlement requires trusted evidence created by the in-process verifier. A Commerce write permission and a fabricated event object cannot mark a transaction paid. A future gateway adapter must verify that gateway's official signature or an authoritative API response before producing trusted evidence. The orchestrator constructor does not seed merchant approval. The test fixture is explicit and is not Meta approval. No Prisma schema change, migration, route, Graph write, gateway, or live booking vendor was added. A SQL adapter is still not authorized.

## 2026-10-26 — Conversational commerce M1C backs the orchestrator with ports

The orchestrator reads and writes through `CommercePersistence`. Its old maps are a read-only snapshot view, not a second owner of bookings, payments, or idempotency. Provider calls stay outside `runAtomic`. A duplicate reserve cannot create a second booking. An unknown provider result stays `PENDING_RESOLUTION` and is resolved only with the original provider. Payment attempts and ledger updates go through the payment port after proof verification. `applyEvent` stays privileged and is not a gateway client. `markApplied` requires the connection's location. Loaded policy evidence keeps `validatedBy` only when the in-process seal matches. A forged snapshot cannot approve commerce. Offer-specific Meta exceptions still need a per-offering row, which is not added. The default state seeds one goods-and-catalog fixture so the existing harness keeps its observable results. That fixture is not Meta approval and it does not approve YOLA FUN. No Prisma schema change, migration, route, Graph write, or gateway was added.

## 2026-10-26 — Conversational commerce M1B.1 closes the persistence contract holes

Repository results are copies, so a read-only caller cannot edit a stored booking, ledger, or connection. A reservation must match the registered connection mode. External checkout does not create a booking, and a manual connection cannot invent an authoritative reference. Policy evidence is scoped to one merchant, one offering category, and one commerce surface. Unknown scope fails closed. Webhook identity is the trusted connection id plus the provider event id. The schema sketch uses composite tenant and location foreign keys, and composite tenant and connection keys for credentials and webhooks. That SQL is not applied. `settleConcurrent` merges whole new reservation and payment units and does not prove database transactions. YOLA FUN stays NO-GO. M1C is not started.

## 2026-10-26 — Conversational commerce M1B is ports and a schema sketch

Persistence boundaries for the orchestrator are repository interfaces and a deterministic in-memory store. The schema sketch is `docs/CONVERSATIONAL_COMMERCE_PERSISTENCE.md`. It is not applied. `prisma/schema.prisma` is unchanged. `CommerceOrder` stays the catalog-order domain and is not a foreign key. Provider secrets stay references. The existing AES-256-GCM helper is the future ciphertext writer, and this milestone does not store a secret. `VERIFIED` policy evidence requires an attested process. There is no universal hold TTL and no universal click-id retention period. External delivery is at-least-once with idempotent effects. Split tender is not implemented. The M1A.2 orchestrator is not moved onto the ports. YOLA FUN stays NO-GO. M1C is not started.

## 2026-10-26 — Conversational commerce M1A.2 binds reconciliation and payment attempts

Timeout reconciliation uses the stored tenant, location, provider, idempotency key, and request hash. A later command that names another provider or location does not call that provider and does not prove the original booking is absent. A recovered booking must match the original slot. Payment attempts no longer share one transaction ledger. The same attempt id cannot be overwritten with a different amount, provider, or transaction. Refunds and chargebacks stay on the attempt that owns the provider reference. The transaction status is derived from the attempt ledgers, and a second open capture does not add revenue. An empty provider reference cannot verify payment. The internal HMAC is not a substitute for a payment gateway's own webhook verification. `occurredAt` and sequence count only when they are inside that HMAC. No migration, route, gateway, or Flow was added. M1B is not started.

## 2026-10-25 — Conversational commerce M1A.1 hardens ambiguous outcomes

A provider timeout is not proof that no booking exists. The operation stays `PENDING_RESOLUTION` until an authoritative lookup, a verified terminal provider state, or a documented provider idempotency guarantee. A human release does not authorize a second create. A payment evidence label is not proof. A raw notice becomes an internal event only when an HMAC matches the stored attempt on tenant, provider, attempt, transaction, provider reference, currency, and amount. Webhook replay uses the authenticated delivery time, and the tenant comes from the connection configuration. Registry mode must match the adapter. Read and write are distinct actions, and this is not production RBAC. A non-empty approval string is not verified Meta approval. YOLA FUN stays NO-GO. No migration, route, gateway, or Flow was added. M1B is not started.

## 2026-10-25 — Conversational commerce starts as a separate orchestrator

Catalog commerce stays the product master and the Meta catalog projection. Booking, payment, and attribution are a new module, `src/lib/conversational-commerce/`, with no table and no route. `CommerceConnection` is not a booking connection. `CommerceOrder` is not the booking state machine and is still absent in production. A phone number is not a correlation key. Unknown WhatsApp eligibility fails closed. A Flow submission is not a confirmed booking. Verified payment and booking confirmation move separately. AtlasNow is not the merchant of record. No gateway is called. The work is stacked on `feature/commerce-meta-catalog` in its own branch and draft PR. PR #1 stays unmerged. The contracts are the six conversational-commerce documents under `docs/`.

## 2026-10-23 — Handoff docs

`docs/AI_DEV_STATUS.md`, `docs/COMMERCE_ARCHITECTURE.md`, and this file are the status pack for a reviewer. Update them at the end of a slice or when a blocker changes. Do not paste secrets into them.
