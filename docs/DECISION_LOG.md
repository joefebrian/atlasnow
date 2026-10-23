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

## 2026-10-23 — Checkout and payment stay out

A saved product is not a sale. Commerce does not call a payment gateway and does not send WhatsApp. The HQ Cloud number is not registered or subscribed by this flow.

## 2026-10-23 — Draft review before merge

Commerce work is pushed to `feature/commerce-meta-catalog` and opened as a draft pull request against `main`. The agent does not merge, deploy, or set the live-sync switch. Approval is required first.

## 2026-10-23 — Handoff docs

`docs/AI_DEV_STATUS.md`, `docs/COMMERCE_ARCHITECTURE.md`, and this file are the status pack for a reviewer. Update them at the end of a slice or when a blocker changes. Do not paste secrets into them.
