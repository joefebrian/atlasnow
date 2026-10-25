# Catalog file and publish preview

Not deployed. Do not turn on live catalog sync.

Slice 2.5 adds three merchant actions on top of the product master. AtlasNow stays the source of truth after an import. There is no automatic two-way sync.

## What is built

- Import stays the read path from commit `34f07c7`. It runs only when `COMMERCE_CATALOG_IMPORT_ENABLED=true`. That switch stays unset. An import stores the Meta product id, retailer id, review status, and a JSON copy of the imported fields (`sourceSnapshot`). A second import does not overwrite the product. A conflicting SKU is not changed.
- Publish preview builds CREATE or UPDATE from the stored mapping. UPDATE requires a current mapping, the same catalog, and the same retailer id. A SKU that does not match is an execution blocker and no item is sent. Product-data blockers are separate. A saved https product link is not reported as missing. The preview still returns `wouldSend: false` and `networkCalled: false`, including when the live switch is on, because the live route does not read that saved link. A finished batch is still not a Meta approval. `lastSyncedAt` stays empty until the existing confirmed-batch path says so.
- The catalog file is `POST /api/commerce/catalog/export`. It reads the product master for that merchant only. A confirmed commerce type (`commerce`, `ecommerce`, `products`, or `product`) uses `id, title, description, availability, condition, link, image_link, brand, price`. `item_group_id` is added only when a product has an active variant. A confirmed local type also needs `address.city`, `address.country`, `address.region`, `availability_circle_origin.latitude`, `availability_circle_origin.longitude`, `availability_circle_radius`, and `availability_circle_radius_unit` of `KM` or `MI`. Those values come from the uploaded Jakarta Barat file. An address, latitude, and longitude are not enough. Radius and unit are never invented, and they are not stored, so the export route cannot emit a local file yet. An empty or unknown catalog type is unverified and returns no file. `activities` stays unsupported. The route does not call Graph.

## Gates that stay shut

- `COMMERCE_CATALOG_SYNC_ENABLED` stays unset.
- `POST /api/commerce/catalog/sync` still calls `recordCatalogSyncRefusal`. That call does not pass a product URL. A saved https link is used by the file and by the simulated batch only. It does not make the live route send.
- `COMMERCE_CATALOG_IMPORT_ENABLED`, `COMMERCE_CATALOG_POLL_ENABLED`, `COMMERCE_ORDER_CAPTURE_ENABLED`, and `COMMERCE_PAYMENTS_ENABLED` stay unset.
- The QA WhatsApp catalog stays a commerce `PRODUCT_ITEM` catalog. This slice does not change it to a local or activities catalog.

## Migration assessment

Three migrations are in the branch and are not on production. Production history is 37 applied migrations through `20261024100000_commerce_batch_poll`. That count is the 35 tracked folders through the batch-poll migration plus the two production inbox migrations `20261004120000_wa_message_image` and `20261004143000_inbox_image_retention`. Those inbox folders are on the production host and are untracked in this working tree. They are not part of this branch. An image that drops them will make `prisma migrate deploy` stop because the database history and the image history diverge. A later overlay must keep both folders.

This review did not open a production database session and did not run a migration.

| Migration | Slice | SQL | Production |
| --- | --- | --- | --- |
| `20261024180000_commerce_orders` | Milestone C order capture. Not Slice 2.5. | Creates `CommerceOrder` and `CommerceOrderLine`, indexes, and foreign keys. No `DROP`. Does not enable payment or catalog sync. | Not applied |
| `20261024200000_commerce_catalog_import` | Catalog import. | Adds nullable `CommerceCatalogLink.lastImportedAt`. No backfill. | Not applied |
| `20261024220000_commerce_catalog_feed` | Slice 2.5 file and preview. | Adds `CommerceProduct.publicUrl`, `CommerceCatalogLink.sourceSnapshot`, and `CommerceConnection.catalogVertical`, each `TEXT NOT NULL DEFAULT ''`. No location columns. | Applied on localhost:5433 only |

All three are additive and ordered after `20261024100000_commerce_batch_poll`. They do not alter inbox, loyalty, or broadcast tables. They are compatible with the tables created by the 37 applied migrations. Compatibility is not approval to run them.

`deploy/docker-entrypoint.sh` runs `prisma migrate deploy` before the server starts. A rebuilt image applies every pending migration in that image. Do not rebuild production. Do not put the order-capture migration in a production image until `docs/COMMERCE_ORDER_CAPTURE.md` is accepted. Do not put the import or feed migrations in a production image until this proposal is accepted. A branch image contains all three, so building from this branch would apply all three.

`catalogVertical` is filled when the merchant links a catalog, or when Find catalogs returns a vertical for the catalog that is already linked. An empty value is unverified. The file is not created and a live batch is not sent until the type is a confirmed commerce or local schema. `activities` stays unsupported.

## CI

`.github/workflows/commerce.yml` still runs the older unit files and `service.db.test.ts` only. The GitHub token for this repo cannot edit workflow files. `docs/COMMERCE_CI_WORKFLOW.patch` adds `catalog-import.test.ts`, `catalog-feed.test.ts`, and `catalog-publish.test.ts` to the unit job, and runs `catalog-import.db.test.ts` and `catalog-bidirectional.db.test.ts` as separate database steps. Those database files disconnect Prisma in `after()`, so they cannot share one process. Do not treat that patch as a passing Actions run until an authorized maintainer applies it and the run is green.

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
