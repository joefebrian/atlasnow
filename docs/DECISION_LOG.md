# Decision log

Short record of choices that later work should not undo. Money rules stay in the Monetization PRD. WhatsApp number rules stay in the HQ WhatsApp decision.

## 2026-10-23 — Commerce is multi-tenant, not a single pilot

The first build is a merchant product master. Pilot names stay out of the code. AtlasNow SKUs are the source of truth.

## 2026-10-23 — IDR is a whole number

Prices are Prisma `Int` rupiah. Floats are rejected. There is no cents column.

## 2026-10-23 — Three different statuses

Internal availability (in stock or not), catalog eligibility (`UNKNOWN` or `INELIGIBLE`), and Meta review (`UNKNOWN`, `PENDING`, `APPROVED`, `REJECTED`) are separate. The product form cannot set Meta-approved. Users cannot mark a product eligible.

## 2026-10-23 — Archive is one-way

An archived product stays archived. A stale save returns 409. There is no restore button.

## 2026-10-23 — Catalog permission is not added from this repo

The live Meta app does not get `catalog_management` until the founder publishes that scope. The login may request the scope. If Meta does not grant it, the catalog state is Permission error and no batch is sent.

## 2026-10-23 — Live sync is a server switch

Code can build a batch. It sends only when `COMMERCE_CATALOG_SYNC_ENABLED=true` and the merchant catalog state is Connected and the product passes validation. The switch is off.

## 2026-10-23 — Tokens stay on the server

Connection tokens use the existing AES-256-GCM helper. APIs reject bodies that contain token, secret, or access token fields. Phone numbers are stored masked.

## 2026-10-24 — Shopper payment is the merchant's gateway

A commerce order is paid through the merchant's own Xendit or Midtrans account. The money settles to the merchant. AtlasNow's software and credit fees stay on Rail A (IDR invoice) or, later, Rail B (Creem). Creem is not the shopper checkout. No commission rate is set. A payment URL visit is not `PAID`. Midtrans notifications are appended, not used to replace the merchant's callback. Xendit account webhook URLs are not overwritten. The design is `docs/COMMERCE_PAYMENTS_PRD.md`. No gateway call is built and the live switch stays off.

## 2026-10-23 — Checkout and payment stay out

A saved product is not a sale. Commerce does not call a payment gateway and does not send WhatsApp. The HQ Cloud number is not registered or subscribed by this flow. The 2026-10-24 decision specifies the later payment design. It does not turn that design on.

## 2026-10-23 — Draft review before merge

Commerce work is pushed to `feature/commerce-meta-catalog` and opened as a draft pull request against `main`. The agent does not merge, deploy, or set the live-sync switch. Approval is required first.

## 2026-10-23 — A catalog batch is not synced when Graph accepts it

`SUCCEEDED` means `check_batch_request_status` finished with no item errors and the product ids were returned. `SUBMITTED` and `PROCESSING` are not success. Meta review `APPROVED` is not written by the sync path. Commerce calls Graph v25.0. Inbox OAuth stays on v21.0.

## 2026-10-23 — Reconnect clears selected Meta assets

A new commerce authorization drops the stored business, catalog, WABA, and phone. They are saved again only when the new token's discovery list contains them. A catalog from the previous business cannot stay Connected.

## 2026-10-23 — A late batch does not overwrite a changed product

A finished batch is applied only when its payload hash, catalog id, and retailer ids still match the merchant's current product and selected catalog. A price edit during processing leaves the product `OUTDATED`. Meta ids from that late batch are not stored.

## 2026-10-23 — A different catalog does not inherit the old item ids

Reconnect and catalog link keep the old `externalProductId` and `metaProductId` rows. `mappingCurrent` becomes false, so those ids are not shown as the current catalog and are not sent as `UPDATE`. The screen shows `OUTDATED` until the new catalog confirms its own items.

## 2026-10-23 — The production sync route has no public URL input

`POST /api/commerce/catalog/sync` cannot send. The server does not accept a product URL on that route. Live send stays behind the server switch plus a validated https product URL that the server already has. Do not bypass that gate.

## 2026-10-23 — Catalog polling does not depend on an open browser

`POST /api/commerce/catalog/poll` continues batches that were already submitted. It uses backoff, an 8-poll cap, a 2-hour age cap, and a row lock. It does not post a new batch.

## 2026-10-23 — Loyalty and broadcast drift stays out of this branch

After the commerce migrations, the schema diff still wants to drop two voucher indexes and set a default on `BroadcastFeeConfig.id`. That drift is not part of commerce. It was not generated into a migration and it was not applied.

## 2026-10-23 — A worker rechecks the product before it writes synced

The poll worker loads the product again after `check_batch_request_status` and the product lookup. It writes Meta ids only in a transaction that still sees the same payload hash, retailer ids, and selected catalog. A price edit during the Meta call does not become `SYNCED`.

## 2026-10-23 — Catalog polling has an entry and stays off

`POST /api/internal/commerce/poll` accepts a bearer `COMMERCE_POLL_SECRET` and polls only when `COMMERCE_CATALOG_POLL_ENABLED=true`. Both are unset. The server process does not start a timer. The row lock stays with the worker until that tick returns.

## 2026-10-23 — Handoff docs

`docs/AI_DEV_STATUS.md`, `docs/COMMERCE_ARCHITECTURE.md`, and this file are the status pack for a reviewer. Update them at the end of a slice or when a blocker changes. Do not paste secrets into them.
