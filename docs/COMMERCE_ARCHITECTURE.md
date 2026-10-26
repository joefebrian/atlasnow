# Commerce architecture

AtlasNow is the product source of truth. Meta Catalog is a later projection. Checkout and payment are specified in `docs/COMMERCE_PAYMENTS_PRD.md` and are not built. Payment readiness stays not connected.

## Tenancy

Every commerce row is scoped by `tenantId`. Agency staff pass `tenantId` and must pass `canAccessTenant`. A brand user is locked to `session.tenantId`. Platform mode cannot open Commerce.

Writes: client admin and agency staff. Reads also include HQ marketing, HQ ops, and regional. Branch and viewer have no Commerce route.

## Data model

- `CommerceProduct` — SKU, name, description, category, optional https image URL, optional https product link, uploaded image bytes, whole IDR price, `ACTIVE` or `ARCHIVED`, internal availability, catalog eligibility `UNKNOWN` or `INELIGIBLE`. The saved product link is for the catalog file and the publish preview. The live sync route does not read it.
- `CommerceVariant` — own SKU and optional price. Unique with the product SKU inside the merchant, case-insensitive.
- `CommerceProductOutlet` — outlet availability. This is not a Meta review.
- `CommerceCatalogLink` — one row per product. `retailerId` is the SKU. `metaProductId` is written only after Graph confirms the item. `reviewStatus` stays `UNKNOWN` until Meta review says otherwise. `processedPayloadHash` is the last batch Meta finished with no item errors.
- `CommerceVariantMap` — variant SKU to a Meta item. Unique retailer id and unique Meta product id per merchant. Review status is not copied from the batch result.
- `CommerceConnection` — business, WABA, masked phone, catalog id, catalog vertical, granted scope names. `tokenEnc` is AES-256-GCM. It is never selected into the browser view. A new authorization clears those asset ids until they are checked against the new token. An empty or unknown vertical is unverified. The catalog file is withheld until a commerce or local schema is confirmed.
- `CommerceOAuthNonce` — one-time login nonce bound to the session that started it. It is not a Meta token.
- `CommerceSyncJob` — one row per merchant plus payload hash. Status `BLOCKED`, `SUBMITTED`, `PROCESSING`, `SUCCEEDED`, or `FAILED`. `batchHandle` is the Meta handle. A Graph 200 is `SUBMITTED`, not `SUCCEEDED`.
- `CommerceSyncLog` — attempt history.
- `CommerceReadiness` — payment flags only. Checkout stays off. A saved flag is not shown as a live payment connection.
- `CommerceOrder` — one inbound WhatsApp catalog order. Status stays `PENDING_PAYMENT`. Payment status stays `NOT_INITIATED`. `waMessageId` is unique, so a webhook retry does not create a second order. `estimatedTotal` is the WhatsApp sum. `masterTotalIdr` is set only when every line matches the product master.
- `CommerceOrderLine` — SKU, quantity, catalog estimate, and master price. Validation is `MATCHED`, `UNKNOWN_SKU`, `PRICE_MISMATCH`, or `REVIEW`.

## Order capture

`POST /api/webhooks/whatsapp` still verifies `X-Hub-Signature-256` and still runs inbox ingest. Order capture is a second step. It runs only when the app secret is set, the signature matches, and `COMMERCE_ORDER_CAPTURE_ENABLED=true`. An empty app secret still follows the existing inbox path and does not store an order. The merchant row must match `wabaId`, `phoneNumberId`, and `catalogId` on a connection that is not disconnected. Any other combination is ignored. The sender id is stored on the order and is not written to logs or the orders list. The list shows a masked customer reference.

`GET /api/commerce/orders` and the Commerce page use the same tenant guard as the product list. While `COMMERCE_ORDER_CAPTURE_ENABLED` is not `true`, the list returns no rows and does not query `CommerceOrder`. The page says order capture is off. When the switch is on, the page shows reference, time, merchant, outlet when one outlet is known, masked customer, lines, the WhatsApp estimate, validation, and payment "Not started".

`GET /api/commerce/catalog/products` reads the connected catalog with `GET /{catalog}/products` and a cursor only when `COMMERCE_CATALOG_DISCOVERY_ENABLED=true` and the tenant is listed. `POST` imports the selected retailer ids only when `COMMERCE_CATALOG_IMPORT_ENABLED=true` and the tenant is listed. Discovery does not enable that POST. Neither call posts `items_batch`. Import writes the Meta product id onto `CommerceCatalogLink`, sets `lastImportedAt`, stores `sourceSnapshot`, and leaves `lastSyncedAt` empty. A SKU that already exists is returned as a conflict and is not changed. Both switches stay off.

`POST /api/commerce/catalog/preview` compares the product master with `sourceSnapshot` and returns CREATE or UPDATE, field differences, mapping status, product-data blockers, and execution blockers. A saved https link is checked and is not reported as missing. `wouldSend` and `networkCalled` stay false. `POST /api/commerce/catalog/export` builds a commerce or local CSV only after the catalog type matches a confirmed schema. A missing required field, an unverified type, or an incomplete local circle returns the report and no file. The live sync route still refuses to send. `COMMERCE_CATALOG_SYNC_ENABLED` stays off. See `docs/COMMERCE_CATALOG_BIDIRECTIONAL.md`.

## APIs

Product: `GET/POST /api/commerce/products`, `PATCH /api/commerce/products/:id`, `POST .../archive`, `GET/POST/DELETE .../image`.

Connection: `GET /api/commerce/connection`, `GET .../start`, `GET /api/commerce/meta/callback`, `POST .../discover`, `POST .../link`, `POST .../disconnect`.

Catalog: `POST /api/commerce/catalog/preview`, `POST /api/commerce/catalog/sync`.

`GET /api/commerce/readiness` reports channels. Payment is always not connected.

Orders: `GET /api/commerce/orders`. There is no payment route.

## Meta

Inbox Graph stays `https://graph.facebook.com/v21.0` in `src/lib/meta/oauth.ts`. Commerce uses `https://graph.facebook.com/v25.0` only in the commerce client. That split was not checked against a live Meta app. Login scopes are `business_management`, `whatsapp_business_management`, and `catalog_management`. The Page login config is not reused. This path does not register the HQ phone or subscribe WABA webhooks.

`POST /{catalog}/batch` is deprecated and removed in Graph v27. Commerce posts to `/{catalog}/items_batch` and then reads `/{catalog}/check_batch_request_status`. Product ids are stored only when that status is finished with no item errors and a product lookup returns ids. Meta review approval is a separate field.

Discovery lists businesses with Graph cursors, capped at 10 pages. Catalogs, WABAs, and phone numbers load only after an explicit business id, and only for that business. Link rejects an id that was not in that response. A new token clears the previous business, catalog, WABA, and phone until this check passes.

The OAuth state nonce is stored once, tied to the session cookie hash, and rejected on reuse. Production refuses to sign that state with the development `AUTH_SECRET` fallback. Token debug checks validity, app id, scopes, and expiry. Error text strips `EAA…` values before they are stored or redirected.

Sync builds a catalog batch (`CREATE` or `UPDATE`, price as `99000 IDR`, stock from internal availability). The payload hash includes the public URL and the attributes sent to Meta. The call runs only when the catalog state is Connected, `COMMERCE_CATALOG_SYNC_ENABLED=true`, and the product has no blockers (archived, ineligible, ticket-like category, missing https image, missing public URL). Otherwise the job is `BLOCKED` and `networkCalled` is false. Two overlapping calls insert one job row with `ON CONFLICT DO NOTHING`, so the losing call does not post a second batch.

`POST /api/commerce/catalog/sync` does not read a public product URL from the browser. `recordCatalogSyncRefusal` calls the sync function without one, so that route cannot send a batch. Do not add a client URL field to bypass this. A validated https product URL has to exist on the server before a batch can be posted.

Before a finished batch is stored as synced, the worker reloads the product after the Meta calls and compares the job's payload hash, retailer ids, and catalog id with that current row. The mapping write locks the product row and checks those values again inside the same transaction. A mismatch is not applied. The product stays `OUTDATED` when it was not already synced by a newer payload, and the late Graph ids are not written. Validation errors, a status of `error`, and a product lookup that is missing a retailer id cannot become `SYNCED`.

`POST /api/commerce/catalog/poll` resumes `SUBMITTED` and `PROCESSING` jobs that already have a handle. It does not start a push and it rejects a public URL. Backoff is 15s, 30s, 1m, 2m, 5m, 10m, then 15m. Polling stops after 8 attempts or 2 hours. The worker holds `lockToken` until the tick finishes, and refreshes `lockedAt` across the Meta calls. Another worker can take the row only when the lock is empty or older than 60 seconds.

`POST /api/internal/commerce/poll` is the scheduler entry. The caller sends `Authorization: Bearer` matching `COMMERCE_POLL_SECRET`. Without that secret the route returns 503. With the secret, it still does not call Meta unless `COMMERCE_CATALOG_POLL_ENABLED=true`. The process does not schedule this route. One tick polls at most 5 jobs and logs the count and statuses only.

Changing or reconnecting to a different Meta catalog sets `mappingCurrent` false on stored links. The external ids stay in the database. The product screen shows no external id and `OUTDATED` until a batch for the selected catalog is confirmed. A later push to the new catalog uses `CREATE` for those historical ids. A price change on the same catalog keeps the mapping current and marks the offer `OUTDATED`.

## External dependencies

- Postgres via Prisma.
- Meta Graph and Facebook Login. Not connected in this environment.
- No Xendit, Midtrans, Creem, or WhatsApp send on these routes. The payments PRD does not add those calls.
- This branch does not set `COMMERCE_CATALOG_SYNC_ENABLED`. Review happens on the draft pull request. Merging does not deploy and does not turn sync on.

## Conversational commerce

A second layer plans bookings and payments without using these tables. It lives in `src/lib/conversational-commerce/` and is documented in `docs/CONVERSATIONAL_COMMERCE_PRD.md`. `CommerceProduct` stays the goods master. `CommerceCatalogLink` stays the Meta item map. `CommerceConnection` stays the catalog login. `CommerceOrder` stays the unreleased catalog-order capture. None of those models gained a column in this layer. The orchestrator keeps booking state and payment state apart, rejects unknown transactional eligibility, and does not call Graph, a gateway, or Prisma. M1A.1 keeps an unknown provider timeout in `PENDING_RESOLUTION`, requires a signed payment proof bound to the stored attempt, and takes the webhook tenant from the connection. M1A.2 reconciles that timeout only against the original provider and keeps each payment attempt on its own ledger. M1B adds in-memory repository ports and a schema sketch in `docs/CONVERSATIONAL_COMMERCE_PERSISTENCE.md`. M1B.1 copies repository results, checks provider mode against the registered connection, and scopes policy evidence and webhook dedupe to one merchant surface or one connection. M1C runs the orchestrator on those in-memory ports. M1C.1 lets only a newly acquired claim call the provider, stores the operation envelope with that claim, and settles a payment only from trusted verifier evidence. M1C.2 closes that envelope only when the provider outcome is explicit `NO_COMMIT`. `RETRYABLE`, `UNAVAILABLE`, `TIMEOUT`, and a success without a usable booking reference stay `PENDING_RESOLUTION` for reconciliation on the original provider. Booking, payment, and cancellation resolve by the authenticated tenant and the reference. Provider calls stay outside the atomic write. A snapshot cannot grant Meta approval without the validator seal. The orchestrator constructor does not seed approval. M2 adds `Cc*` tables and a PostgreSQL adapter for a disposable QA database. M2.1B keeps booking, payment, webhook, attribution, policy, and credential writes on the rows for that operation, with `SELECT ... FOR UPDATE` and `INSERT ... ON CONFLICT` for the claim. The snapshot rewrite and the global QA advisory lock are gone. A returned failure inside `runAtomic` rolls back direct SQL, including a connection insert, and the caller still receives that failure. The adapter remains QA-only. Live-slot uniqueness is per provider. Financial amounts are `BIGINT` with a safe-integer guard. Provider calls and payment trust stay outside the database transaction. Those migrations are not applied to production. M2.2 reviews release readiness in `docs/M2_2_RELEASE_READINESS.md` and does not open staging. Do not turn on sync, poll, order capture, or payments from that work. Do not add a route from this layer.
