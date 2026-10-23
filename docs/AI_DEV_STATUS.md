# AtlasNow development status

Updated 2026-10-23. Source of truth for what is in the tree. A feature is listed as working only when a test or a browser check showed it.

## Active slice

Commerce Slice 2 — Meta Catalog connection. **Partial.** Do not start Slice 3 until this is reviewed.

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
- A new authorization clears the old catalog. Discovery of a different Meta business rejects the old catalog id. The connection does not stay Connected.
- A token that loses `catalog_management` drops the catalog id and reports Permission error. A revoked token is not stored.
- An OAuth nonce works once for the session key that created it. A different session key does not consume it.
- Changing price, name, description, image, availability, variant price, or the public URL changes the payload hash. A processed product becomes `OUTDATED` and keeps its external id.
- Production mode refuses the development `AUTH_SECRET` fallback. Inbox `src/lib/meta/oauth.ts` still points at Graph v21.0 and does not request `catalog_management`.

## Implemented, not proven against Meta

- Facebook Login start, code exchange, encrypted token save, paginated business discovery, and `items_batch` plus `check_batch_request_status` on Graph v25.0.
- Local Connect Meta redirects back with “Meta App ID / Secret not set”. No Graph call was made.
- Every Graph failure and retry test used a fake `fetch`. None of them called `graph.facebook.com`.

## Not built

- WhatsApp checkout, cart webhook, payment gateway, revenue.
- Production catalog sync. `COMMERCE_CATALOG_SYNC_ENABLED` is unset.
- `catalog_management` on the live Meta app (App ID 1551959122621683). Do not add it until the founder publishes that scope.

## Tests

2026-10-23, after the final hardening: `npx tsx --test` on `connection.test.ts`, `validate.test.ts`, `nav-access.test.ts`, and `service.db.test.ts` — **46 passed, 0 failed**. `npx tsc --noEmit` passed. Full app suite was not re-run. An older unrelated failure remains in `src/lib/conversations/portfolio.test.ts` and was not run again.

`.github/workflows/commerce.yml` is written locally. It runs that typecheck, the unit files, and the database file against a Postgres 16 service. It is not on the branch yet: the GitHub token can push the repo but cannot add a workflow file without the `workflow` scope. `COMMERCE_CATALOG_SYNC_ENABLED` is not set in that file. GitHub Actions has not run.

Browser, demo brand, localhost: product list, detail, sync preview (“No request was sent”), checkout copy off, no token field. Network stayed on localhost except the Connect redirect back to Commerce.

## Migrations

Applied on localhost:5433 only:

- `20261023120000_commerce_products`
- `20261023180000_commerce_image_sku`
- `20261023210000_commerce_catalog_connection`
- `20261023233000_commerce_sync_hardening` — `processedPayloadHash`, `processedPublicUrl`, `batchHandle`, `itemResults`, `CommerceOAuthNonce`
- `20261024100000_commerce_batch_poll` — `mappingCurrent`, `catalogId`, `publicUrl`, `pollAttempts`, `nextPollAt`, `lockedAt`, `lockToken`

`migrate deploy` applied `20261024100000_commerce_batch_poll` on localhost:5433. The same five commerce migrations, with the rest of the migration history, applied on a disposable Postgres 16 at `127.0.0.1:5434`. That container was removed. There is no staging database. Server migrate has not been run.

`prisma migrate diff` from that disposable database to `schema.prisma` did not ask for commerce changes. It still wants to drop `LoyaltyBirthdayWaSend_tenantId_voucherCode_idx` and `LoyaltyRedemption_tenantId_voucherCode_idx`, set `BroadcastFeeConfig.id` default to `default`, and rename a `LoyaltyRedemption` unique index. Those statements were not applied and were not turned into a migration. `scripts/verify-commerce-migrations.sh` checks that the five commerce SQL files do not mention Loyalty or Broadcast.

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

Review the final hardening on the draft pull request. Do not merge. Do not start checkout. After approval: founder Meta setup, then a server migration with backup. Leave the loyalty and broadcast diff alone. See `docs/COMMERCE_ARCHITECTURE.md` and `docs/DECISION_LOG.md`.
