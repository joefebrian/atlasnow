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
- A stored token is absent from the connection JSON. A request body that contains an access token is rejected.
- Commerce is on the default menu for brand admin, HQ marketing, HQ ops, and regional. Cashiers do not see it.

## Implemented, not proven against Meta

- Facebook Login start, code exchange, encrypted token save, catalog and WABA discovery, and catalog batch build.
- Local Connect Meta redirects back with “Meta App ID / Secret not set”. No Graph call was made.
- `pushCatalogItems` was tested with a fake `fetch`, not with `graph.facebook.com`.

## Not built

- WhatsApp checkout, cart webhook, payment gateway, revenue.
- Production catalog sync. `COMMERCE_CATALOG_SYNC_ENABLED` is unset.
- `catalog_management` on the live Meta app (App ID 1551959122621683). Do not add it until the founder publishes that scope.

## Tests

2026-10-23: `tsc --noEmit` clean. Commerce, connection, and nav tests **28 passed, 0 failed**. Full app suite was not re-run. An older unrelated failure remains in `src/lib/conversations/portfolio.test.ts`.

Browser, demo brand, localhost: product list, detail, sync preview (“No request was sent”), checkout copy off, no token field. Network stayed on localhost except the Connect redirect back to Commerce.

## Migrations

Applied on localhost:5433 only:

- `20261023120000_commerce_products`
- `20261023180000_commerce_image_sku`
- `20261023210000_commerce_catalog_connection`

No staging database is configured in this workspace. Server migrate has not been run.

## Blockers before live sync

1. Meta App ID and secret in Settings → API.
2. Register `{APP_BASE}/api/commerce/meta/callback` on the Meta app.
3. Founder adds and publishes `catalog_management`.
4. Products need an https image URL and a public product link. Ticket-like categories stay blocked.
5. Leave the live-sync env switch off until a real permission check passes.

## Next

Review this slice. Do not start checkout. After approval: founder Meta setup, then a server migration with backup. See `docs/COMMERCE_ARCHITECTURE.md` and `docs/DECISION_LOG.md`.
