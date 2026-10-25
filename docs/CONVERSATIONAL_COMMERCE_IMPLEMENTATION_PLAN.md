# Conversational commerce implementation plan

Status: **stop after M0 and M1A.** Do not start persistence, webhooks, Flows, payments, UI, or deploy from this document.

## Stack

`feature/conversational-commerce-m1a` is based on `feature/commerce-meta-catalog` at `f68614367c40e7f921519f4700c00e0f7728cfd8`.

Draft PR #1 stays open and unmerged. This branch does not commit onto that branch. The new draft PR targets `feature/commerce-meta-catalog`, not `main`, because `main` does not contain the commerce models this contract refers to. Merging into `main` would skip that parent. Do not merge either PR without a separate approval. Do not deploy.

## M0 — contract

| Document | Contents |
|---|---|
| `docs/CONVERSATIONAL_COMMERCE_PRD.md` | Product rules, three merchant dimensions, evidence levels, tenancy, non-goals |
| `docs/TRANSACTION_ORCHESTRATOR_ARCHITECTURE.md` | Types, state machines, existing-table map, threats, migration, unresolved choices |
| `docs/BOOKING_PROVIDER_CONTRACT.md` | Capability matrix, errors, mocks, idempotency, webhook gate |
| `docs/PAYMENT_RECONCILIATION_CONTRACT.md` | Ledger, evidence, duplicates, ordering, payments-PRD map |
| `docs/WHATSAPP_EXPERIENCE_POLICY_CONTRACT.md` | Catalog, Flow, chat, fail-closed eligibility |
| This file | Milestone split, tests, rollout gates, M1B |

Repository findings that shaped the contract:

- Catalog commerce already has a product master, Meta connection, catalog link, and a gated import path. That path is the one in production through commit `f686143`
- `CommerceOrder` and `CommerceOrderLine` exist in the branch schema and are not in the production migration history. Order capture is behind `COMMERCE_ORDER_CAPTURE_ENABLED` and that switch stays unset
- `CommerceConnection` is a Meta catalog credential, not a booking adapter
- Payment design already lives in `docs/COMMERCE_PAYMENTS_PRD.md` and is not built. This ledger uses a smaller state set and maps the older words. It does not replace that PRD
- Inbox, WAHA, loyalty, and broadcast are outside this change. Both inbox migration folders stay in the tree for production images and are not edited here
- The worktree also had unrelated uncommitted inbox and marketing edits. They are not part of this branch's commit

## M1A — foundation

Namespace: `src/lib/conversational-commerce/`.

Included:

- Domain types and id rules
- Booking, transaction, and payment transition checks
- Provider interface, registry, and four mocks
- Experience normalization
- Policy checks
- Attribution classification
- Tenant and location authorization
- In-memory reserve, cancel, timeout release, and payment notices
- Webhook HMAC gate and booking event planner with no route

Excluded:

- Prisma schema and migration folders
- Route handlers and feature flags
- Meta Graph, WhatsApp send, Flows, and payment HTTP
- Native capacity
- UI

The module does not import Prisma, does not call `fetch`, and does not read `process.env`.

## Tests and gates

Unit file: `src/lib/conversational-commerce/conversational-commerce.test.ts`.

| # | Case |
|---|---|
| 1 | Legal booking transitions, including hold when supported |
| 2 | Illegal and terminal booking transitions |
| 3 | Cross-tenant actor, foreign provider resolve, and a read that returns no payload |
| 4 | Checkout provider cannot hold or create |
| 5 | Second hold on the same slot conflicts and does not add a row |
| 6 | Idempotent replay, hash conflict, phone-shaped key rejected |
| 7 | External timeout, no second call until release, still no booking |
| 8 | Missing external reference does not confirm |
| 9 | Duplicate paid notice |
| 10 | Pending after paid does not regress. Refund before paid waits, then applies |
| 11 | Cancel leaves payment paid. A later refund does not reopen the booking |
| 12 | Confirmed booking with `NOT_STARTED` payment is level B and not revenue |
| 13 | Verified payment leaves the booking at `REQUESTED` and is level A |
| 14 | Unknown eligibility, services, and admission-on-Flow deny |
| 15 | Catalog order and Flow submission normalize with `confirmed: false` |
| 16 | Missing ids and aggregated Search or Maps counts do not invent `ctwa_clid` |
| 17 | Existing order constants, catalog eligibility, and tenant helper still behave. Source scan forbids Prisma and Graph |

Also run:

- `npx tsc --noEmit`
- Commerce unit files already in `.github/workflows/commerce.yml`
- Commerce database files in that workflow, on localhost only

No live Graph write, payment charge, or booking API call.

The new test file is not added to `commerce.yml` in this milestone. Earlier pushes that edit that workflow were refused for token scope. Run the file locally until a workflow edit is possible. Do not treat a green catalog workflow as coverage of this module.

## Rollout gates

All of these stay true after M1A:

- Production migration history is unchanged. New migration count is zero
- `COMMERCE_CATALOG_SYNC_ENABLED`, `COMMERCE_CATALOG_POLL_ENABLED`, `COMMERCE_ORDER_CAPTURE_ENABLED`, and `COMMERCE_PAYMENTS_ENABLED` are not set by this code
- QA discovery env already on the server is not edited
- No container rebuild, no Caddy change, no WAHA change
- PR #1 is not merged
- No pilot workspace is created

## M1B — recommended next slice

Do not start M1B from this plan. A separate review has to approve it.

Recommended M1B, still without a production migration:

1. Repository ports for transaction, booking, payment ledger, and idempotency, with an in-memory adapter and the same tests
2. A reviewed table sketch that a human can reject. No SQL folder
3. Keep `CommerceOrder` as a future pointer for catalog orders. Do not move booking state into it
4. Specify secret storage for provider HMAC keys using the existing encryption helper, without saving a key
5. Add the unit file to CI when the workflow file can be updated

Still not in M1B unless a later approval says so:

- `prisma/migrations/*`
- An HTTP webhook
- Xendit, Midtrans, or any other charge
- WhatsApp Flow runtime or outbound catalog messages
- Native slot inventory
- A Commerce page redesign
- A production feature flag
- Any pilot onboarding

Rejected as the next step: a localhost migration. The production image applies migrations on boot, and a folder that lands in an image is no longer local.

## Unresolved items to settle before M1B code

- Confirm the payments-PRD state map (`DISPUTED` → `CHARGEBACK`, `NOT_INITIATED` → `NOT_STARTED`, unpaid `CANCELLED` → `FAILED`)
- Decide whether manual staff confirmation can ever be level B
- Name the first external booking vendor, or explicitly keep mocks only
- Decide hold TTL
- Decide `ctwa_clid` retention
- Decide whether `EXPIRED` payment recovery from a provider read is in scope
