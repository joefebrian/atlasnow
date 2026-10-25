# Slice 2.5 release gates

Not approved. Do not merge. Do not deploy. Do not set a commerce switch while preparing this document.

The accepted phase is import, fail-closed catalog type detection, the commerce feed schema, and publish preview. Local catalog export is not fully supported.

`deploy/docker-entrypoint.sh` on this branch runs `prisma migrate deploy` and then `node server.js`. A new image applies every migration folder inside that image before the server starts. Leaving a folder out of the image is the only way to stop that boot from applying it.

This session did not open the production host. Confirm the live image id on the host before any later deploy.

## GitHub Actions

`.github/workflows/commerce.yml` includes the catalog tests. A release commit is covered only when its own Actions run is green and the job steps are these:

- Unit: `connection.test.ts`, `validate.test.ts`, `nav-access.test.ts`, `catalog-import.test.ts`, `catalog-feed.test.ts`, `catalog-publish.test.ts`, plus `tsc --noEmit`
- Database, as separate steps: `service.db.test.ts`, `catalog-import.db.test.ts`, `catalog-bidirectional.db.test.ts`

The run on `089bb76` does not count. It ran the older test list. `docs/COMMERCE_CI_WORKFLOW.patch` is the same workflow diff and is already applied.

## Production migration manifest

Production history recorded on 2026-10-23 is 37 applied migrations, ending at `20261024100000_commerce_batch_poll`. That count is the tracked folders through the batch-poll migration plus two inbox folders that are on the host and are not in git:

- `prisma/migrations/20261004120000_wa_message_image`
- `prisma/migrations/20261004143000_inbox_image_retention`

Those two folders must remain in the image. Deleting them makes `prisma migrate deploy` stop because the database history and the image history diverge. Do not replace `/opt/atlasnow` with this branch. Keep the existing WhatsApp and Inbox services. Do not apply the loyalty or broadcast schema drift.

### Already on production

Do not treat these as new work. They are the commerce migrations inside the 37:

- `20261023120000_commerce_products`
- `20261023180000_commerce_image_sku`
- `20261023210000_commerce_catalog_connection`
- `20261023233000_commerce_sync_hardening`
- `20261024100000_commerce_batch_poll`

### Withhold unless Milestone C is approved on its own

`20261024180000_commerce_orders` is order capture, not Slice 2.5.

It creates `CommerceOrder` and `CommerceOrderLine`. Unique keys are `waMessageId` and `tenantId + reference`. Foreign keys go to `Tenant` (cascade), `Location` (set null), `CommerceOrder` (cascade), `CommerceProduct` (set null), and `CommerceVariant` (set null). There is no `DROP`. It does not enable payment, tickets, or catalog sync.

The git branch contains this folder. An image built from the whole branch would apply it on boot. A Slice 2.5 image must omit this folder until `docs/COMMERCE_ORDER_CAPTURE.md` is accepted in a separate approval.

The Commerce page and `GET /api/commerce/orders` call `listCommerceOrders`. That function returns an empty list when `COMMERCE_ORDER_CAPTURE_ENABLED` is not `true`, and it does not query Prisma. The page says order capture is off. Do not add this migration to make the page render.

### Slice 2.5 folders, still not approved to apply

Both are additive. Neither enables a switch.

`20261024200000_commerce_catalog_import`

- `ALTER TABLE "CommerceCatalogLink" ADD COLUMN "lastImportedAt" TIMESTAMP(3);`
- Nullable. No backfill.

`20261024220000_commerce_catalog_feed`

- `CommerceProduct.publicUrl TEXT NOT NULL DEFAULT ''`
- `CommerceCatalogLink.sourceSnapshot TEXT NOT NULL DEFAULT ''`
- `CommerceConnection.catalogVertical TEXT NOT NULL DEFAULT ''`
- No radius column and no unit column.

Applied on localhost:5433 only. Not on production.

## Switches that stay unset

- `COMMERCE_CATALOG_SYNC_ENABLED`
- `COMMERCE_CATALOG_POLL_ENABLED`
- `COMMERCE_POLL_SECRET` stays as it is. Do not add a poll caller.
- `COMMERCE_ORDER_CAPTURE_ENABLED`
- `COMMERCE_PAYMENTS_ENABLED`
- `COMMERCE_CATALOG_IMPORT_ENABLED`
- `COMMERCE_CATALOG_IMPORT_TENANTS`
- `COMMERCE_CATALOG_DISCOVERY_ENABLED`
- `COMMERCE_CATALOG_DISCOVERY_TENANTS`

Discovery and import are separate. `GET /api/commerce/catalog/products` reads Meta only when discovery is `true` and the tenant id is listed in `COMMERCE_CATALOG_DISCOVERY_TENANTS`. `POST` writes a product only when import is `true` and the tenant id is listed in `COMMERCE_CATALOG_IMPORT_TENANTS`. An empty list allows no merchant. Discovery does not enable the import POST. The QA pilot below is the only listed tenant, and only after a separate approval. Demo brand `cmsz2tcnk0001coqz71pqqjul` stays off both lists.

## Local catalog export

Local export is blocked. Radius and unit are not stored. The Commerce page says so. Outlet address, latitude, and longitude do not become a coverage circle. A commerce file can still be downloaded when the catalog type is a confirmed commerce type and the product fields are complete. An empty or unknown type stays unverified. `activities` stays unsupported.

## Deployment checklist

Do not start this list until there is a separate approval that names the commit.

1. Record the approved commit SHA. Confirm its Actions run is green and the steps above are present.
2. On the host, record `docker image inspect atlasnow-atlas --format '{{.Id}}'` and tag that id as the rollback image for this release. The 23 October tag `atlasnow-atlas:pre-commerce-20261023` is older than the live Slice 2 image. It is not the rollback target for this release.
3. Take a new custom dump. Do not reuse `/root/atlasnow-backups/atlasnow-20261023-pre-commerce-b7ba45e.dump` as the only copy. Record the new sha256.
4. Build the image from the approved tree. Copy the two inbox migration folders in. Leave `20261024180000_commerce_orders` out unless Milestone C was approved in the same decision.
5. Diff the image migration directory against production `_prisma_migrations` before boot. Expected new names are only the approved Slice 2.5 folders. Expected missing names are none of the 37 already applied, including the two inbox folders.
6. Boot once. The entrypoint will migrate. Read the migrate log. Stop if it asks to drop an index or alter loyalty or broadcast tables.
7. Confirm the new columns exist and `CommerceOrder` does not, unless Milestone C was approved.
8. Confirm every switch in the list above is unset. `GET /api/commerce/catalog/products` for a non-QA brand returns import off and does not call Graph.
9. Smoke `https://atlasnow.co/commerce` for AtlasNow Commerce QA and one other brand. Do not import. Do not export into the demo brand. Sync preview must keep `networkCalled: false` and `wouldSend: false`.
10. Stop. Do not call `items_batch`. Do not set catalog sync, polling, order capture, or payments.

## Rollback checklist

1. Leave every commerce switch unset.
2. Point the service back at the image id recorded in deployment step 2. Do not use the 23 October pre-commerce tag unless the new backup restore requires that older tree.
3. If migrate did not run, no database restore is required.
4. If the approved additive columns were applied, leave them. They do not push to Meta while sync is unset.
5. If `20261024180000_commerce_orders` was applied without Milestone C approval, restore the dump from deployment step 3. Do not hand-delete tables on the live database.
6. Confirm Inbox and WhatsApp still answer, and the two inbox migration folders are still on disk.
7. Confirm no container log line contains `items_batch`.

## QA pilot for SKU ATLASNOW-QA-SHAPE-001

Tenant: AtlasNow Commerce QA, slug `atlasnow-commerce-qa`, id `commerceqa20261023tenant`. No other tenant. No demo brand. No live HQ WhatsApp number.

Do not run this pilot in this change. It starts only after the deployment above is approved and the read-only check is approved on its own.

1. Read-only. Switches stay unset. Open Commerce for that tenant. Confirm the catalog link, the masked test number, and that publish preview shows `wouldSend: false` and `networkCalled: false`. Confirm the page shows the local-export blocker. Do not download a local file. Do not import.
2. Read-only discovery. After a separate approval, set only:
   - `COMMERCE_CATALOG_DISCOVERY_ENABLED=true`
   - `COMMERCE_CATALOG_DISCOVERY_TENANTS=commerceqa20261023tenant`
   Leave both import variables unset. Restart. Load Meta Catalog Products for that tenant. Confirm `ATLASNOW-QA-SHAPE-001` is listed and the import button is absent. `POST /api/commerce/catalog/products` returns 503. Confirm another brand still sees discovery off and that its request does not call Graph.
3. One import. After a further approval, set `COMMERCE_CATALOG_IMPORT_ENABLED=true` and `COMMERCE_CATALOG_IMPORT_TENANTS=commerceqa20261023tenant`. Import that SKU once. Confirm one product row, Meta product id and retailer id stored, `lastImportedAt` set, `lastSyncedAt` empty, and a second import does not create a second row or overwrite the master. Confirm the container log has no `items_batch`.
4. Stop. Unset the discovery and import variables unless a later approval says the QA tenant may keep read and import. Do not add another tenant id. Do not enable sync, polling, order capture, or payments.
