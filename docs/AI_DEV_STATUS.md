# AtlasNow development status

Updated 2026-10-26. Source of truth for what is in the tree. A feature is listed as working only when a test or a browser check showed it.

## Conversational commerce M0 through M1C.2

In-memory orchestrator and persistence ports on `feature/conversational-commerce-m1a`. M1A.2 binds timeout reconciliation to the original provider and gives each payment attempt its own ledger. M1B adds repository ports, a deterministic in-memory store, and `docs/CONVERSATIONAL_COMMERCE_PERSISTENCE.md`. M1B.1 copies repository results, binds a reservation to the registered provider mode, scopes policy evidence and webhook identity, and specifies composite location foreign keys. M1C runs the orchestrator through those ports. The orchestrator no longer keeps a second copy of bookings, payments, or idempotency. M1C.1 stops a losing claim from calling the provider, requires trusted payment evidence before settlement, and stores the operation envelope with the claim so a crash can be reconciled. M1C.2 keeps that envelope unless the provider outcome is explicitly `NO_COMMIT`, and resolves booking, payment, and cancellation references by the authenticated tenant. The Prisma schema is unchanged. Not deployed. No migration. No route. No gateway. Catalog discovery, import, sync, poll, order capture, and payments are unchanged and stay off except for the QA discovery switch that was already set outside this branch. YOLA FUN stays NO-GO. No workspace was created for it.

Working in unit tests only:

- Booking and transaction transition checks, including a rejected hold when the provider cannot reserve
- Tenant and location denials that do not return the other merchant's booking
- Read and write are separate actions. This is not production RBAC
- Four mock providers: native hold, external API, external checkout handoff, manual inquiry
- Slot conflict, idempotent replay, and a missing external reference
- A timeout stays `PENDING_RESOLUTION`. Human release does not authorize a second booking. Lookup uses the original provider, location, and request hash. Another provider cannot prove absence. A recovered booking must match the original slot
- Each payment attempt has its own ledger. A repeated attempt id cannot change amount, provider, or transaction. An expired attempt does not block a later paid attempt. A refund cannot move to a different attempt. Duplicate events do not add revenue. A blank provider reference cannot verify payment. The internal HMAC is not a gateway webhook signature
- Payment duplicates, out-of-order notices, and partial and full refunds
- An evidence label, a bad signature, or a mismatched tenant, provider, attempt, amount, currency, or provider reference does not mark a transaction paid
- Confirmed booking with unpaid payment, and paid payment with an unconfirmed booking
- Unknown Meta eligibility fails closed. An unverified approval reference fails closed. A Flow submission does not confirm a booking. A catalog order does not verify payment. Illegal experience and event pairs are rejected
- Webhook replay uses the authenticated delivery time. An old business event with a fresh delivery is accepted. The tenant comes from the connection, not from JSON
- A native adapter cannot be registered as an external API, or the reverse
- Missing attribution ids are not invented. Aggregated Search or Maps counts are not a person
- Existing catalog order constants still map. This module does not import Prisma or call Graph

M1B, in unit tests only:

- Repository ports for intents, transactions, bookings, connections, payment attempts, idempotency, webhooks, events, attribution, and policy evidence
- Tenant and location isolation, optimistic version checks, and a first-writer win for two overlapping snapshots
- Restart rehydration of an unresolved timeout. A new booking waits for that provider's absence rule
- One attempt identity, one provider reference, and one live capture. `EXPIRED` requires an authoritative provider read
- Cancellation does not refund. A refund or chargeback does not change the booking
- Caller `VERIFIED` stays unverified. An attested process can pass the existing fail-closed policy
- Credential ports store a reference and reject secret bytes. Outlet health does not fall through to the tenant default
- Session mapping follows `canReadCommerce` and `canWriteCommerce`. `BRANCH` stays scoped to `Membership.locationId` and still has no commerce permission

M1B.1, in unit tests only:

- A read-only caller cannot mutate a stored booking, ledger, or connection through a repository result
- A reservation mode must match the booking connection. External checkout does not create a booking. Manual confirmation cannot invent an authoritative reference
- Policy evidence is one merchant, one offering category, and one commerce surface. An unmatched scope fails closed
- Webhook dedupe is the connection id plus the provider event id. Another tenant's connection does not suppress the event
- Two non-conflicting reservations both keep their transaction, booking, idempotency row, and event. A losing slot does not leave its transaction behind
- `settleConcurrent` does not claim to prove arbitrary atomic SQL. Composite location keys are documented and not migrated

M1C, in unit tests only:

- Reserve, replay, timeout, and recovery go through the in-memory ports. Provider calls stay outside the atomic write
- The same idempotency key cannot create a second booking. An unknown provider result stays `PENDING_RESOLUTION` and is resolved only with the original provider
- Payment attempts and ledger events go through the payment port. A forged notice never becomes a ledger event. Refunds and chargebacks do not change the booking
- Webhook apply requires the connection's location. A snapshot without the policy seal cannot grant commerce approval
- M1C seeded one attested goods-and-catalog fixture from the orchestrator constructor. M1C.1 removes that silent seed

M1C.1, in unit tests only:

- Two callers can both pass the initial read. Only the claim winner sends one create. The loser rereads and does not call the provider. A different payload is `IDEMPOTENCY_CONFLICT`
- A forged paid event passed straight to `applyEvent`, including by a Commerce writer, stays `NOT_STARTED` and writes no ledger event. A verified notice through the port still settles
- A crash after claim, after a provider create but before the local write, after timeout persistence, and during reconciliation does not create a second booking. A confirmed external booking is adopted on the original transaction
- `createOrchestratorState()` does not create merchant approval. The goods/catalog attestation is an explicit test fixture and is not Meta approval

M1C.2, in unit tests only:

- `ProviderFailure.outcomeCertainty` is `NO_COMMIT` or `MAY_COMMIT`. `providerError` defaults to `MAY_COMMIT`. A missing certainty is treated as uncertain. `RETRYABLE`, `UNAVAILABLE`, and `TIMEOUT` do not by themselves prove that no booking was created
- A committed booking that returns `RETRYABLE` or `UNAVAILABLE` stays `PENDING_RESOLUTION`. The idempotency key is not completed as `FAILED`. Restart keeps the envelope. Recovery adopts the original booking on the original provider, connection, location, and key. A repeated reserve does not create a second booking
- A remote success with a blank booking reference, or an external held or confirmed booking with a blank provider reference, keeps the envelope as `MISSING_REFERENCE`. It is not closed as a denial
- A definitive no-commit conflict calls `finishDenied`, completes the key, and leaves no inflight row. A replay does not call the provider again
- `readBooking`, `openPaymentAttempt`, `recordPayment`, and `cancelReservation` match the actor's tenant and the reference before location authorization. Two tenants can share one internal reference string. A foreign-only reference returns `CROSS_TENANT` and does not include the other tenant's record. A wrong outlet is still `LOCATION_FORBIDDEN`
- The read-only snapshot maps still key bookings and transactions by reference alone. Those maps are not the lookup used by the four operations above. A SQL adapter must not copy that keying

Not built: SQL tables, a Prisma adapter, webhook routes, Flows, gateway calls, native inventory, UI, feature flags, a live provider, production RBAC, split tender, offer-specific Meta exception rows. The in-process payment HMAC is not a gateway signature. The in-memory claim is not a Postgres lock. Outcome certainty is only as honest as the adapter that sets it.

Contracts: `docs/CONVERSATIONAL_COMMERCE_PRD.md`, `docs/CONVERSATIONAL_COMMERCE_PERSISTENCE.md`, and the companion docs named in `docs/CONVERSATIONAL_COMMERCE_IMPLEMENTATION_PLAN.md`.

Do not merge this into PR #1. Do not merge PR #2. Do not add a SQL adapter, a route, or a gateway until a separate review.

## Active slice

Commerce Slice 2 — Meta Catalog connection. **Internal complete.** Live catalog push is still off. Do not start Slice 3.

Slice 1 (product master) is implemented and was accepted locally (21 tests). Slice 2 adds the connection manager and a gated sync path. Live Meta push is not on.

## Working (tested)

- Product create, edit, archive for one merchant. Variants, whole-IDR prices, outlet assignment. Archived products stay archived.
- SKU unique per merchant, including case. Cross-merchant update is rejected.
- Product photo upload (JPEG/PNG/WebP stored as WebP). Image URL is optional and https-only.
- Catalog eligibility cannot be set to approved from the product form. Offer status is not Meta review status.
- Connection states: Not connected, Setup required, Connected, Permission error, Disconnected. Payment stays Not connected.
- Sync preview and a blocked sync job. A second identical blocked sync reuses the same job and does not call Graph.
- A stored token is absent from the connection JSON. A request body that contains an access token is rejected. Graph error text is stored with `EAA…` removed. This was checked with a fake error string, not a live token.
- Commerce is on the default menu for brand admin, HQ marketing, HQ ops, and regional. Cashiers do not see it.
- Catalog batch states with a fake `fetch`: accepted (`SUBMITTED` plus a stored handle), pending (`PROCESSING`), partial item failure, complete failure, and success only after a finished status and product-id lookup. Meta review stayed `UNKNOWN` in each case. A second call did not post the batch again.
- Two overlapping sync calls produced one `items_batch` post. The losing claim uses `ON CONFLICT DO NOTHING` and the test log did not show a Prisma unique-constraint error.
- Three failed posts stop. The fourth call does not call the network.
- A price edit while a batch is still in flight leaves the product `OUTDATED`. The late Graph ids are not stored and the job is not `SUCCEEDED`.
- Reconnecting, then selecting another catalog, keeps the old Meta ids in the database, sets `mappingCurrent` false, and the product list shows a blank external id with `OUTDATED`. The next push to the new catalog uses `CREATE`.
- `POST /api/commerce/catalog/poll` resumes one due job under two overlapping calls. Eight polls, or a job older than two hours, ends `FAILED` without a Graph call. Validation errors, a status of `error`, a partial product lookup, and a stored validation error followed by a clean poll all stay off `SYNCED`. A confirmed worker poll writes the variant map. Review status stayed `UNKNOWN`.
- A worker poll reloads the product after the Meta calls and writes mappings only inside a transaction that still sees the same payload hash, retailer ids, and catalog. A price edit while that response is delayed leaves the old Meta ids in place and does not mark the product `SYNCED`.
- `POST /api/internal/commerce/poll` is the scheduler entry. It requires `COMMERCE_POLL_SECRET` and does not call Meta unless `COMMERCE_CATALOG_POLL_ENABLED=true`. That switch is unset. The app process does not start the tick. The sync switch does not turn polling on. A tick handles at most 5 jobs and logs counts only.
- A new authorization clears the old catalog. Discovery of a different Meta business rejects the old catalog id. The connection does not stay Connected.
- A token that loses `catalog_management` drops the catalog id and reports Permission error. A revoked token is not stored.
- An OAuth nonce works once for the session key that created it. A different session key does not consume it.
- Changing price, name, description, image, availability, variant price, or the public URL changes the payload hash. A processed product becomes `OUTDATED` and keeps its external id.
- Production mode refuses the development `AUTH_SECRET` fallback. Inbox `src/lib/meta/oauth.ts` still points at Graph v21.0 and does not request `catalog_management`.

## Implemented, not proven against Meta

- Facebook Login start, code exchange, encrypted token save, paginated business discovery, and `items_batch` plus `check_batch_request_status` on Graph v25.0.
- Local Connect Meta redirects back with “Meta App ID / Secret not set”. No Graph call was made.
- Every Graph failure and retry test used a fake `fetch`. None of them called `graph.facebook.com`.

## Catalog file and publish preview (not live)

The product master can preview a Meta CREATE or UPDATE and can build a catalog CSV. Neither path calls Graph. The live sync switch stays unset, and the live sync route still does not send. See `docs/COMMERCE_CATALOG_BIDIRECTIONAL.md` before any deploy.

## Meta catalog import (not live)

A connected catalog can be listed and selected items copied into the product master when `COMMERCE_CATALOG_IMPORT_ENABLED=true`. The switch is unset. Import does not push to Meta. See `docs/COMMERCE_CATALOG_IMPORT.md` before any deploy.

## Milestone C — order capture (not live)

Inbound WhatsApp `type=order` capture is implemented behind `COMMERCE_ORDER_CAPTURE_ENABLED`. The switch is unset, so production does not store orders. A verified signature is required. The order status is `PENDING_PAYMENT` and the payment status is `NOT_INITIATED`. See `docs/COMMERCE_ORDER_CAPTURE.md` before any deploy.

## Not built

- Payment links, gateway calls, tickets, and revenue. The payment design is `docs/COMMERCE_PAYMENTS_PRD.md` (2026-10-24). It is not implemented. `COMMERCE_PAYMENTS_ENABLED` is unset.
- Live order capture. `COMMERCE_ORDER_CAPTURE_ENABLED` is unset. Do not turn it on until the deployment proposal is accepted.
- Production catalog sync. `COMMERCE_CATALOG_SYNC_ENABLED` is unset.
- `catalog_management` on the live Meta app (App ID 1551959122621683). Do not add it until the founder publishes that scope.

## Tests

2026-10-23, after the worker-race follow-up: `npx tsx --test` on `connection.test.ts`, `validate.test.ts`, `nav-access.test.ts`, and `service.db.test.ts` — **49 passed, 0 failed**. Full app suite was not re-run. An older unrelated failure remains in `src/lib/conversations/portfolio.test.ts` and was not run again.

2026-10-24, catalog import: `npx tsx --test src/lib/commerce/catalog-import.test.ts` — **6 passed, 0 failed**. `npx tsx --test src/lib/commerce/catalog-import.db.test.ts` on localhost:5433 — **3 passed, 0 failed**. `npx tsc --noEmit` passed. No `items_batch` call was made. `COMMERCE_CATALOG_IMPORT_ENABLED` stays unset outside the database test.

2026-10-24, catalog file and publish preview: `catalog-feed.test.ts` 7 passed, `catalog-publish.test.ts` 6 passed, `catalog-bidirectional.db.test.ts` 1 passed, `catalog-import.db.test.ts` 3 passed, `service.db.test.ts` 16 passed, and `tsc --noEmit` passed. No `items_batch` call was made by the file or the preview. `.github/workflows/commerce.yml` does not list the new tests. The GitHub token cannot edit that workflow. `COMMERCE_CATALOG_SYNC_ENABLED` stays unset. The local demo brand page rendered the catalog file section. Its export returned no file because a required link was missing, and its preview returned `networkCalled: false`.

2026-10-25, feed schema review: `catalog-feed.test.ts` 11 passed, `catalog-publish.test.ts` 9 passed, `catalog-import.test.ts` 6 passed, `connection.test.ts` 13 passed, `validate.test.ts` 12 passed, `nav-access.test.ts` 8 passed, `catalog-import.db.test.ts` 3 passed, `catalog-bidirectional.db.test.ts` 1 passed, `service.db.test.ts` 17 passed, `order-capture.test.ts` 11 passed, `order-capture.db.test.ts` 4 passed, and `tsc --noEmit` passed. No live Graph call. GitHub Actions on `f64502b` runs those catalog tests and passed: https://github.com/joefebrian/atlasnow/actions/runs/40149503443. `COMMERCE_CATALOG_SYNC_ENABLED` stays unset.

2026-10-26, conversational commerce M1C.2: `conversational-commerce.test.ts` and `persistence.test.ts` together 92 passed. Commerce unit files 73 passed. Separate database processes: `service.db.test.ts` 17, `catalog-import.db.test.ts` 3, `catalog-bidirectional.db.test.ts` 1, `slice25-release.db.test.ts` 1 with `CommerceOrder` absent, `order-capture.db.test.ts` 4. `tsc --noEmit` passed. No Prisma schema change. No live provider or gateway call.

2026-10-24, order capture: `npx tsx --test src/lib/commerce/order-capture.test.ts` — **11 passed, 0 failed**. `npx tsx --test src/lib/commerce/order-capture.db.test.ts` on localhost:5433 — **4 passed, 0 failed**. `npx tsc --noEmit` passed. The Commerce page for the local demo brand rendered "Catalog orders", the empty state, and, with a fixture row that was deleted afterward, the reference, SKU, `IDR 28,780` estimate, review label, and "Not started". The orders API omitted the sender id. Anonymous `GET /api/commerce/orders` returned 401. No payment call was made.

`.github/workflows/commerce.yml` runs that typecheck, the older unit files, and `service.db.test.ts` against a Postgres 16 service. `COMMERCE_CATALOG_SYNC_ENABLED` is not set in that file. The workflow was added in `6a7df29`. The order-capture test files are not listed there yet. A push that edits `.github/workflows/commerce.yml` was refused because the GitHub token has no `workflow` scope. Run `order-capture.test.ts` and `order-capture.db.test.ts` locally until that file can be updated.

Browser, demo brand, localhost: product list, detail, sync preview (“No request was sent”), checkout copy off, no token field. Network stayed on localhost except the Connect redirect back to Commerce.

## Migrations

Applied on localhost:5433 only:

- `20261023120000_commerce_products`
- `20261023180000_commerce_image_sku`
- `20261023210000_commerce_catalog_connection`
- `20261023233000_commerce_sync_hardening` — `processedPayloadHash`, `processedPublicUrl`, `batchHandle`, `itemResults`, `CommerceOAuthNonce`
- `20261024100000_commerce_batch_poll` — `mappingCurrent`, `catalogId`, `publicUrl`, `pollAttempts`, `nextPollAt`, `lockedAt`, `lockToken`
- `20261024180000_commerce_orders` — Milestone C order capture, not Slice 2.5. `CommerceOrder`, `CommerceOrderLine`. Local only until the order-capture deploy is approved.
- `20261024200000_commerce_catalog_import` — nullable `lastImportedAt`. Local only.
- `20261024220000_commerce_catalog_feed` — `publicUrl`, `sourceSnapshot`, `catalogVertical`. Local only. No radius column.

Production remains 37 applied migrations through `20261024100000_commerce_batch_poll`, including the two inbox migrations that are not in this branch. The entrypoint applies every pending file in the image. Do not rebuild.

`migrate deploy` applied `20261024100000_commerce_batch_poll` on localhost:5433. The same five commerce migrations, with the rest of the migration history, applied on a disposable Postgres 16 at `127.0.0.1:5434`. That container was removed. There is no staging database. Server migrate has not been run.

`prisma migrate diff` from that disposable database to `schema.prisma` did not ask for commerce changes. It still wants to drop `LoyaltyBirthdayWaSend_tenantId_voucherCode_idx` and `LoyaltyRedemption_tenantId_voucherCode_idx`, set `BroadcastFeeConfig.id` default to `default`, and rename a `LoyaltyRedemption` unique index. Those statements were not applied and were not turned into a migration. `scripts/verify-commerce-migrations.sh` checks that the commerce SQL files do not mention Loyalty or Broadcast.

Rollback for the poll migration, if those columns must come back out: drop `CommerceSyncJob_status_nextPollAt_idx`, then drop `CommerceSyncJob.catalogId`, `publicUrl`, `pollAttempts`, `nextPollAt`, `lockedAt`, and `lockToken`, then drop `CommerceCatalogLink.mappingCurrent` and `CommerceVariantMap.mappingCurrent`. Do not drop product rows or the stored external ids. Earlier rollback remains: drop `CommerceOAuthNonce`, then drop `batchHandle`, `itemResults`, `processedPayloadHash`, and `processedPublicUrl`.

## Blockers before live sync

1. Meta App ID and secret in Settings → API.
2. Register `{APP_BASE}/api/commerce/meta/callback` on the Meta app.
3. Founder adds and publishes `catalog_management`.
4. Products need an https image URL and a public product link that the server already trusts. The production sync route does not accept that URL from the client. Ticket-like categories stay blocked.
5. Leave the live-sync env switch off until a real permission check passes.

## Git

Branch `feature/commerce-meta-catalog`. Draft pull request https://github.com/joefebrian/atlasnow/pull/1 against `main`. Not merged. No server deploy. Unrelated local work (inbox photos, public site) stays unstaged.

## Next

Review the Slice 2.5 release fix on the draft pull request. Do not merge. Do not deploy. Do not set any commerce switch. The order-capture migration stays out of a Slice 2.5 image. The Commerce page does not query `CommerceOrder` while capture is off. Catalog discovery and import are separate gates. Local catalog export stays blocked.
