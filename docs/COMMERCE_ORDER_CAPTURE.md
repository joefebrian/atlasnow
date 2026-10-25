# Commerce order capture — deployment proposal

Milestone C stores a WhatsApp catalog order. It does not take payment. Do not deploy this until this proposal is accepted. Do not set `COMMERCE_ORDER_CAPTURE_ENABLED` in the same step as the first boot.

## What this build does

- `POST /api/webhooks/whatsapp` keeps the current signature check and the current inbox ingest.
- A request with a bad `X-Hub-Signature-256` still returns 401 and stores nothing.
- If the Meta app secret is empty, inbox behavior stays as it is today and no order is stored.
- When `COMMERCE_ORDER_CAPTURE_ENABLED=true` and the signature is valid, a message with `type` `order` is stored.
- The merchant is the `CommerceConnection` whose WABA id, phone number id, and catalog id all match, and whose `disconnectedAt` is empty. Anything else is ignored.
- One WhatsApp message id is one order. A later delivery of that id is a duplicate. A new message id is a new order, even when the sender and SKU are the same.
- Lines are checked against `CommerceProduct` and `CommerceVariant`. A missing SKU is `UNKNOWN_SKU`. A different price or currency is `PRICE_MISMATCH`. Archived or unavailable products are `REVIEW`. Only an all-matching order is `MATCHED`.
- Every stored order is `PENDING_PAYMENT` with payment status `NOT_INITIATED`.
- `estimatedTotal` is the WhatsApp figure. `masterTotalIdr` is filled only from the product master, and only when validation is `MATCHED`. Neither field is revenue.
- The Commerce page lists the order reference, received time, merchant, outlet when exactly one outlet is known, a masked customer reference, lines, the estimate, validation, and payment "Not started".
- The sender id is stored on the row. It is not returned by `GET /api/commerce/orders` and it is not written to the capture log.

## What this build does not do

- No payment link, Xendit call, Midtrans call, or Creem call.
- No ticket and no QR.
- No catalog batch and no change to `COMMERCE_CATALOG_SYNC_ENABLED` or `COMMERCE_CATALOG_POLL_ENABLED`.
- No new Meta webhook subscription and no outbound WhatsApp message.
- No change to the Page or Instagram webhook, and no change to WAHA.
- The test number ending 2839 is not special-cased in code. It is captured only if that brand's connection row matches the webhook.

## Migration

`prisma/migrations/20261024180000_commerce_orders/migration.sql` creates `CommerceOrder` and `CommerceOrderLine` only. It does not alter inbox, loyalty, or broadcast tables.

Production `/opt/atlasnow` is not a git checkout. `deploy/docker-entrypoint.sh` runs `prisma migrate deploy` before the app starts. A rebuilt image that contains this migration will apply it on boot. Do not rebuild the production image until the steps below are accepted.

## Proposed production sequence

1. Leave `COMMERCE_ORDER_CAPTURE_ENABLED` unset.
2. Take a new custom-format backup of the production database and record its sha256. Keep the existing pre-commerce dump.
3. Confirm the image contains this migration and does not contain a loyalty or broadcast drop.
4. Deploy the commerce overlay the same way as Slice 2: add these files onto the current production tree. Do not replace the tree with the branch. Keep the inbox migrations that are already on the server.
5. Start the app. Confirm migrate applied only `20261024180000_commerce_orders`.
6. Smoke the HQ inbox with a normal text webhook path, Commerce for AtlasNow Commerce QA, and one other brand. Orders for the other brand must stay empty. Sync and poll must stay off.
7. Stop. Orders are still not captured, because the flag is unset.

A later, separate approval can set `COMMERCE_ORDER_CAPTURE_ENABLED=true` and recreate the app process. Only AtlasNow Commerce QA should have the test WABA, phone, and catalog linked. Do not link the HQ inbox number.

## Rollback

Unset `COMMERCE_ORDER_CAPTURE_ENABLED` and recreate the process. Capture stops. Inbox continues. The new tables can stay. Rolling the app image back to `atlasnow-atlas:pre-commerce-20261023` is the older Slice 2 rollback and is not required for this flag. Do not drop the order tables if they already contain rows.

## Not approved by this document

Payment automation stays off until a separate approval. `COMMERCE_PAYMENTS_ENABLED` stays unset.
