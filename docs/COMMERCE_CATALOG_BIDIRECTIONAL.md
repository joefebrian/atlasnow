# Catalog file and publish preview

Not deployed. Do not turn on live catalog sync.

Slice 2.5 adds three merchant actions on top of the product master. AtlasNow stays the source of truth after an import. There is no automatic two-way sync.

## What is built

- Import stays the read path from commit `34f07c7`. It runs only when `COMMERCE_CATALOG_IMPORT_ENABLED=true`. That switch stays unset. An import stores the Meta product id, retailer id, review status, and a JSON copy of the imported fields (`sourceSnapshot`). A second import does not overwrite the product. A conflicting SKU is not changed.
- Publish preview builds CREATE or UPDATE from the stored mapping. UPDATE requires a current mapping, the same catalog, and the same retailer id. A SKU that does not match is blocked and no item is sent. The preview returns `networkCalled: false`. A finished batch is still not a Meta approval. `lastSyncedAt` stays empty until the existing confirmed-batch path says so.
- The catalog file is `POST /api/commerce/catalog/export`. It reads the product master for that merchant only. Commerce catalogs use `id, title, description, availability, condition, price, link, image_link, brand, item_group_id`. Local catalogs (`offline_commerce`, `local_service_businesses`, or a type whose name contains `local`) also require one outlet address, latitude, and longitude. Any missing required field returns the report and an empty file. The route does not call Graph.

## Gates that stay shut

- `COMMERCE_CATALOG_SYNC_ENABLED` stays unset.
- `POST /api/commerce/catalog/sync` still calls `recordCatalogSyncRefusal`. That call does not pass a product URL. A saved https link is used by the file and by the simulated batch only. It does not make the live route send.
- `COMMERCE_CATALOG_IMPORT_ENABLED`, `COMMERCE_CATALOG_POLL_ENABLED`, `COMMERCE_ORDER_CAPTURE_ENABLED`, and `COMMERCE_PAYMENTS_ENABLED` stay unset.
- The QA WhatsApp catalog stays a commerce `PRODUCT_ITEM` catalog. This slice does not change it to a local or activities catalog.

## Migration

`20261024220000_commerce_catalog_feed` adds `CommerceProduct.publicUrl`, `CommerceCatalogLink.sourceSnapshot`, and `CommerceConnection.catalogVertical`. It was applied on localhost:5433 only.

These earlier commerce migrations are also still local only:

- `20261024180000_commerce_orders`
- `20261024200000_commerce_catalog_import`

The production entrypoint runs `prisma migrate deploy` before start. Do not rebuild the production image until this proposal, the import proposal, and the order-capture proposal are accepted, a new backup is taken, and only those additive files are confirmed.

`catalogVertical` is filled when the merchant links a catalog, or when Find catalogs returns a vertical for the catalog that is already linked. An empty value means the file uses the commerce schema and says the type is not stored.

## Deploy sequence, after a separate approval

1. Leave every commerce switch unset.
2. Take a new backup. Do not reuse the 23 October dump as the only copy.
3. Overlay the reviewed tree. Do not replace `/opt/atlasnow`.
4. Confirm the new image applies only the accepted additive commerce migrations.
5. Smoke AtlasNow Commerce QA and one other brand. Do not import or export into the demo brand.
6. Stop. Do not set `COMMERCE_CATALOG_SYNC_ENABLED`.

## Rollback

Unset any switch that was turned on. Imported rows, `publicUrl`, `sourceSnapshot`, and `catalogVertical` stay. They do not push to Meta while the sync switch is unset.

## Not in this slice

Payments, checkout, tickets, QR redemption, live Graph writes, and edits to Inbox, orders, or WhatsApp configuration.
