# Commerce architecture

AtlasNow is the product source of truth. Meta Catalog is a later projection. Checkout and payment are not part of this module.

## Tenancy

Every commerce row is scoped by `tenantId`. Agency staff pass `tenantId` and must pass `canAccessTenant`. A brand user is locked to `session.tenantId`. Platform mode cannot open Commerce.

Writes: client admin and agency staff. Reads also include HQ marketing, HQ ops, and regional. Branch and viewer have no Commerce route.

## Data model

- `CommerceProduct` — SKU, name, description, category, optional https image URL, uploaded image bytes, whole IDR price, `ACTIVE` or `ARCHIVED`, internal availability, catalog eligibility `UNKNOWN` or `INELIGIBLE`.
- `CommerceVariant` — own SKU and optional price. Unique with the product SKU inside the merchant, case-insensitive.
- `CommerceProductOutlet` — outlet availability. This is not a Meta review.
- `CommerceCatalogLink` — one row per product. `retailerId` is the SKU. `metaProductId` is written only after Graph confirms the item. `reviewStatus` stays `UNKNOWN` until Meta review says otherwise. `processedPayloadHash` is the last batch Meta finished with no item errors.
- `CommerceVariantMap` — variant SKU to a Meta item. Unique retailer id and unique Meta product id per merchant. Review status is not copied from the batch result.
- `CommerceConnection` — business, WABA, masked phone, catalog id, granted scope names. `tokenEnc` is AES-256-GCM. It is never selected into the browser view. A new authorization clears those asset ids until they are checked against the new token.
- `CommerceOAuthNonce` — one-time login nonce bound to the session that started it. It is not a Meta token.
- `CommerceSyncJob` — one row per merchant plus payload hash. Status `BLOCKED`, `SUBMITTED`, `PROCESSING`, `SUCCEEDED`, or `FAILED`. `batchHandle` is the Meta handle. A Graph 200 is `SUBMITTED`, not `SUCCEEDED`.
- `CommerceSyncLog` — attempt history.
- `CommerceReadiness` — payment flags only. Checkout stays off. A saved flag is not shown as a live payment connection.

## APIs

Product: `GET/POST /api/commerce/products`, `PATCH /api/commerce/products/:id`, `POST .../archive`, `GET/POST/DELETE .../image`.

Connection: `GET /api/commerce/connection`, `GET .../start`, `GET /api/commerce/meta/callback`, `POST .../discover`, `POST .../link`, `POST .../disconnect`.

Catalog: `POST /api/commerce/catalog/preview`, `POST /api/commerce/catalog/sync`.

`GET /api/commerce/readiness` reports channels. Payment is always not connected.

## Meta

Inbox Graph stays `https://graph.facebook.com/v21.0` in `src/lib/meta/oauth.ts`. Commerce uses `https://graph.facebook.com/v25.0` only in the commerce client. That split was not checked against a live Meta app. Login scopes are `business_management`, `whatsapp_business_management`, and `catalog_management`. The Page login config is not reused. This path does not register the HQ phone or subscribe WABA webhooks.

`POST /{catalog}/batch` is deprecated and removed in Graph v27. Commerce posts to `/{catalog}/items_batch` and then reads `/{catalog}/check_batch_request_status`. Product ids are stored only when that status is finished with no item errors and a product lookup returns ids. Meta review approval is a separate field.

Discovery lists businesses with Graph cursors, capped at 10 pages. Catalogs, WABAs, and phone numbers load only after an explicit business id, and only for that business. Link rejects an id that was not in that response. A new token clears the previous business, catalog, WABA, and phone until this check passes.

The OAuth state nonce is stored once, tied to the session cookie hash, and rejected on reuse. Production refuses to sign that state with the development `AUTH_SECRET` fallback. Token debug checks validity, app id, scopes, and expiry. Error text strips `EAA…` values before they are stored or redirected.

Sync builds a catalog batch (`CREATE` or `UPDATE`, price as `99000 IDR`, stock from internal availability). The payload hash includes the public URL and the attributes sent to Meta. The call runs only when the catalog state is Connected, `COMMERCE_CATALOG_SYNC_ENABLED=true`, and the product has no blockers (archived, ineligible, ticket-like category, missing https image, missing public URL). Otherwise the job is `BLOCKED` and `networkCalled` is false. Two overlapping calls claim one job row. A price, name, description, image, availability, variant, or public URL change marks a previously processed product `OUTDATED` and keeps the external id.

## External dependencies

- Postgres via Prisma.
- Meta Graph and Facebook Login. Not connected in this environment.
- No Xendit, Midtrans, Creem, or WhatsApp send on these routes.
- This branch does not set `COMMERCE_CATALOG_SYNC_ENABLED`. Review happens on the draft pull request. Merging does not deploy and does not turn sync on.
