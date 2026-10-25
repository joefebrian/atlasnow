# Meta catalog import — deployment proposal

This slice reads products that are already in the connected Meta catalog and copies the ones a merchant selects into the AtlasNow product master. It does not push catalog changes. Do not deploy it until this proposal is accepted. Do not set `COMMERCE_CATALOG_IMPORT_ENABLED` in the same step as the first boot.

## What this build does

- Commerce shows Meta Catalog Products for the selected brand.
- Load calls `GET /{catalog-id}/products` on Graph v25.0 with cursor pagination, up to 500 items.
- Each row shows the image, retailer id, name, price, Meta availability, Meta review, and AtlasNow mapping: Meta only, Imported, or Conflict.
- Import creates one product master row and one catalog link. The link stores the Meta product id, catalog id, and retailer id. Sync status is `IMPORTED`. `lastImportedAt` is set. `lastSyncedAt` stays empty.
- A second import of the same retailer id does not create another SKU.
- A retailer id that already exists on that merchant is a conflict. The existing name, price, and link are left as they are.
- Internal catalog eligibility stays `UNKNOWN`. Meta review is stored separately. Internal availability comes from Meta's in-stock flag and is not the review status.
- Items with variant attributes, or several items in one retailer group, are shown and are not imported.
- A missing retailer id, name, or whole-IDR price is shown and is not imported.
- A Graph permission error stops the read and writes nothing.
- If the connected catalog changed since the list was loaded, import is refused.
- The merchant is taken from the signed-in tenant. One tenant cannot read or write another tenant's catalog.

## What this build does not do

- No `items_batch` and no change to `COMMERCE_CATALOG_SYNC_ENABLED` or `COMMERCE_CATALOG_POLL_ENABLED`.
- No payment, checkout, ticket, or order-capture change.
- No call to Graph unless `COMMERCE_CATALOG_IMPORT_ENABLED=true`.

## Migration

`prisma/migrations/20261024200000_commerce_catalog_import/migration.sql` adds `CommerceCatalogLink.lastImportedAt`. It does not change inbox, loyalty, or broadcast tables.

Production runs `prisma migrate deploy` on boot. Do not rebuild the production image until the steps below are accepted.

## Proposed production sequence

1. Leave `COMMERCE_CATALOG_IMPORT_ENABLED` unset. Leave catalog sync and poll unset.
2. Take a new database backup and record its sha256.
3. Overlay this slice onto the current production tree. Do not replace the tree with the branch.
4. Start the app. Confirm migrate applied only `20261024200000_commerce_catalog_import`.
5. Open Commerce for AtlasNow Commerce QA and one other brand. The other brand's product list stays unchanged. Sync preview still sends no request.
6. Stop. Import still does not call Graph, because the switch is unset.

A later approval can set `COMMERCE_CATALOG_IMPORT_ENABLED=true` and restart the process. Only AtlasNow Commerce QA should have a catalog linked before that. Then load Meta products and confirm SKU `ATLASNOW-QA-SHAPE-001` and its price before importing it.

## Rollback

Unset `COMMERCE_CATALOG_IMPORT_ENABLED` and restart. The new column can stay. Imported product rows stay in the product master. Do not drop them as part of an app rollback.
