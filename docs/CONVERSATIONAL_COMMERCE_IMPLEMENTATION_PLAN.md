# Conversational commerce implementation plan

Status: **M0 through M1C.1 in memory.** M1C wires the orchestrator through the ports. M1C.1 hardens claim replay, payment trust, and crash recovery. Do not start SQL, webhooks, Flows, payments, UI, or deploy from this document.

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
- In-memory reserve, cancel, timeout reconciliation, and verified payment events
- Webhook HMAC gate and booking event planner with no route
- Action-level read and write checks. This is not production RBAC

M1A.1 hardens the M1A contracts. A timeout stays `PENDING_RESOLUTION` until lookup, a terminal provider state, or a documented idempotency guarantee. A human release does not authorize a second booking. Payment requires a signed proof matched to a stored attempt. Experience and event pairs are validated. Webhook replay uses the delivery timestamp. Registry mode must match the adapter. A non-empty approval string is not Meta approval.

M1A.2 binds that lookup to the original provider, location, and request hash. Another provider cannot prove absence. Payment attempts keep separate ledgers, and the transaction status is derived from those ledgers. The internal payment HMAC is not a gateway webhook signature.

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
| 7 | External timeout stays pending. Human release does not create a second booking. Lookup adopts a committed-then-timeout reservation. A non-authoritative empty lookup does not retry |
| 8 | Missing external reference does not confirm |
| 9 | Duplicate paid notice |
| 10 | Pending after paid does not regress. Refund before paid waits, then applies |
| 11 | Cancel leaves payment paid. A later refund does not reopen the booking |
| 12 | Confirmed booking with `NOT_STARTED` payment is level B and not revenue |
| 13 | Verified payment leaves the booking at `REQUESTED` and is level A |
| 14 | Unknown eligibility, services, admission-on-Flow, and an unverified approval reference deny |
| 15 | Catalog order and Flow submission normalize with `confirmed: false` and do not verify payment. Illegal experience and event pairs are rejected |
| 16 | Missing ids and aggregated Search or Maps counts do not invent `ctwa_clid` |
| 17 | Existing order constants, catalog eligibility, and tenant helper still behave. Source scan forbids Prisma and Graph |
| 18 | Unverified, unsigned, wrong-amount, wrong-tenant, wrong-provider, wrong-attempt, wrong-currency, and wrong-reference payment notices do not mark `PAID` |
| 19 | Read permission cannot reserve. Write permission cannot read a booking |
| 20 | Native registered as external API, and the reverse, is `PROVIDER_MISMATCH` and is not resolved |
| 21 | A delayed business event with a fresh delivery is accepted. A stale delivery is `REPLAY`. A claimed tenant that disagrees with the connection is `TENANT_MISMATCH` |

Also run:

- `npx tsc --noEmit`
- Commerce unit files already in `.github/workflows/commerce.yml`
- Commerce database files in that workflow, on localhost only

No live Graph write, payment charge, or booking API call.

M1A.1 adds `src/lib/conversational-commerce/conversational-commerce.test.ts` to the unit job in `.github/workflows/commerce.yml`. A green run of that workflow is coverage only when the log includes this file. A green catalog-only run does not. If the push of the workflow file is refused, that remains a blocker and this sentence must stay honest.

## Rollout gates

All of these stay true after M1A:

- Production migration history is unchanged. New migration count is zero
- `COMMERCE_CATALOG_SYNC_ENABLED`, `COMMERCE_CATALOG_POLL_ENABLED`, `COMMERCE_ORDER_CAPTURE_ENABLED`, and `COMMERCE_PAYMENTS_ENABLED` are not set by this code
- QA discovery env already on the server is not edited
- No container rebuild, no Caddy change, no WAHA change
- PR #1 is not merged
- No pilot workspace is created

## M1B — persistence design

M1B is the in-memory ports and `docs/CONVERSATIONAL_COMMERCE_PERSISTENCE.md`. It does not add a migration. M1B.1 corrects copies, provider-mode checks, scoped policy evidence, connection-scoped webhook identity, composite location keys in the sketch, and the concurrency simulation. M1C moves the orchestrator onto those ports and removes the private maps as a second writer. M1C.1 stores the operation envelope with the claim, stops a losing claim from calling the provider, and rejects a forged payment event at the port. It still does not add SQL, a route, or a gateway.

The slice that was recommended, still without a production migration:

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

## Open before a SQL adapter

Still open after M1C.1:

- The claim envelope, the single-winner claim, and the absence retry must become one database transaction. That transaction must not call the provider
- `settleConcurrent` is still an in-memory merge, not a row lock
- Trusted payment evidence is an in-process marker after the test HMAC. A real adapter must verify the gateway signature or an authoritative read before it can mint that evidence
- Exactly-once external delivery is not claimed
- Offer-specific Meta exception rows are not stored. The test attestation is not Meta approval

Settled through M1C.1, and still not a migration:

- Payments-PRD words stay mapped as they were: `DISPUTED` → `CHARGEBACK`, `NOT_INITIATED` → `NOT_STARTED`. Unpaid `CANCELLED` stays `FAILED` on the catalog map. Conversational `EXPIRED` and `FAILED` change only after an authoritative provider read
- The first booking vendor stays unnamed. Mocks only
- No universal hold TTL. Provider expiry is stored when the provider sends it. Native expiry waits for a policy id
- No universal `ctwa_clid` retention period. Erasure is explicit
- Manual staff confirmation is not level B unless the booking is confirmed and the provider reference is authoritative

Still open:

- Choose KMS or the existing AES-256-GCM helper before any real credential row
- Choose a legal retention interval before storing one
- Decide whether a chargeback blocks a later capture. Today only `PAID` and `PARTIALLY_REFUNDED` block a second capture
- Split tender
- Whether `BRANCH` ever gains commerce read, using the location already on the membership
