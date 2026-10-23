# Commerce architecture

AtlasNow is the product source of truth. Meta Catalog is a later projection. Checkout and payment are not part of this module.

## Tenancy

Every commerce row is scoped by `tenantId`. Agency staff pass `tenantId` and must pass `canAccessTenant`. A brand user is locked to `session.tenantId`. Platform mode cannot open Commerce.

Writes: client admin and agency staff. Reads also include HQ marketing, HQ ops, and regional. Branch and viewer have no Commerce route.

## Data model

- `CommerceProduct` — SKU, name, description, category, optional https image URL, uploaded image bytes, whole IDR price, `ACTIVE` or `ARCHIVED`, internal availability, catalog eligibility `UNKNOWN` or `INELIGIBLE`.
- `CommerceVariant` — own SKU and optional price. Unique with the product SKU inside the merchant, case-insensitive.
- `CommerceProductOutlet` — outlet availability. This is not a Meta review.
- `CommerceCatalogLink` — one row per product. `retailerId` is the SKU. `metaProductId` and `reviewStatus` stay empty or `UNKNOWN` until Meta returns them.
- `CommerceVariantMap` — variant SKU to a Meta item. Unique retailer id and unique Meta product id per merchant.
- `CommerceConnection` — business, WABA, masked phone, catalog id, granted scope names. `tokenEnc` is AES-256-GCM. It is never selected into the browser view.
- `CommerceSyncJob` — one row per merchant plus payload hash. Status `BLOCKED`, `SUCCEEDED`, or `FAILED`.
- `CommerceSyncLog` — attempt history.
- `CommerceReadiness` — payment flags only. Checkout stays off. A saved flag is not shown as a live payment connection.

## APIs

Product: `GET/POST /api/commerce/products`, `PATCH /api/commerce/products/:id`, `POST .../archive`, `GET/POST/DELETE .../image`.

Connection: `GET /api/commerce/connection`, `GET .../start`, `GET /api/commerce/meta/callback`, `POST .../discover`, `POST .../link`, `POST .../disconnect`.

Catalog: `POST /api/commerce/catalog/preview`, `POST /api/commerce/catalog/sync`.

`GET /api/commerce/readiness` reports channels. Payment is always not connected.

## Meta

Graph base is `https://graph.facebook.com/v21.0`. Login scopes are `business_management`, `whatsapp_business_management`, and `catalog_management`. The Page login config is not reused. This path does not register the HQ phone or subscribe WABA webhooks.

Discovery reads businesses, owned catalogs, owned WABAs, and phone numbers. Link accepts only ids that Graph just returned for that token.

Sync builds a catalog batch (`CREATE` or `UPDATE`, price as `99000 IDR`, stock from internal availability). The call runs only when the catalog state is Connected, `COMMERCE_CATALOG_SYNC_ENABLED=true`, and the product has no blockers (archived, ineligible, ticket-like category, missing https image, missing public URL). Otherwise the job is `BLOCKED` and `networkCalled` is false.

## External dependencies

- Postgres via Prisma.
- Meta Graph and Facebook Login. Not connected in this environment.
- No Xendit, Midtrans, Creem, or WhatsApp send on these routes.
- This branch does not set `COMMERCE_CATALOG_SYNC_ENABLED`. Review happens on the draft pull request. Merging does not deploy and does not turn sync on.
