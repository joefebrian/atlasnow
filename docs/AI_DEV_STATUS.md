# AtlasNow development status

Updated 2026-10-23. Source of truth for what is in the tree. A feature is listed as working only when a test or a browser check showed it.

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
- `20261024180000_commerce_orders` — `CommerceOrder`, `CommerceOrderLine`. Local only until the order-capture deploy is approved. Production entrypoint applies pending migrations on boot, so this file must not ship in a production image before that approval.

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

Review Milestone C on the draft pull request. Do not merge. Do not deploy. Do not set `COMMERCE_ORDER_CAPTURE_ENABLED`. Do not start payment automation. The deploy steps are in `docs/COMMERCE_ORDER_CAPTURE.md`.
