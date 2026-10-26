# Conversational commerce persistence (M1B)

Status: **in-memory ports plus a QA PostgreSQL adapter.** M1C.2 behavior is unchanged. M2.1B writes for bookings, payments, webhooks, attribution, policy, and credentials are row-level in `postgres-booking.ts` and `postgres-finance.ts`. They do not rewrite every `Cc*` table and they do not take the global QA advisory lock. `exportSnapshot()` is read-only. The adapter uses disposable `atlasnow_cc_qa_*` databases only. Money columns are `BIGINT`. The sketch below is the old review draft and still says `INTEGER`. The migration folders are the SQL. No production migration. No HTTP route. No gateway client. Payment HMAC stays outside the adapter.

The runnable contract is `src/lib/conversational-commerce/ports.ts` and `memory-store.ts`. This document is the table sketch a reviewer can reject before any SQL is added.

## Names

Catalog commerce already owns `CommerceConnection`, `CommerceOrder`, and the payment-attempt shape in `docs/COMMERCE_PAYMENTS_PRD.md`. Conversational rows use a `Cc` prefix so a later migration cannot be mistaken for those tables.

`CommerceOrder` stays the catalog-order domain. A conversational row may store `commerce_order_ref` or `order_ref` as a string. There is no foreign key. Deleting or never creating a catalog order does not delete a booking. This module does not write `CommerceOrder`.

## Ports

| Port | Responsibility |
|---|---|
| Intents | Demand before a reservation. Phone numbers are rejected as keys. |
| Transactions and bookings | Lifecycle, slot occupancy, reschedule, external booking reference. |
| Connections | Provider capabilities, outlet override, health, credential references. Booking and payment modes cannot be mixed. |
| Payments | Immutable attempt, one ledger per attempt, provider-reference ownership. The attempt mode must match the payment connection. |
| Idempotency | Request hash, timeout inflight, absence claim. |
| Webhooks | Dedupe key `connection_id:event_id`. The provider id is copied from the trusted connection. |
| Events | Append-only transaction history. |
| Attribution | User-level touchpoints and separate aggregate counts. |
| Policy | One approval row per merchant, offering category, and commerce surface. A caller enum cannot become `VERIFIED`. |

Repository results are defensive copies. A caller cannot change a stored booking, ledger, or connection by mutating a read, list, replay, or write result. `runAtomic` is the in-memory stand-in for one database transaction. `exportSnapshot` plus JSON parse is the restart test. `settleConcurrent` copies the first snapshot, then inserts a later reservation or payment only as a whole unit. A rejected unit leaves no transaction, booking, idempotency row, event, or reference behind. It does not field-merge rows that already existed, and it does not prove that arbitrary SQL commits atomically.

Processing is **at-least-once with idempotent effects**. This design does not claim exactly-once delivery to a booking vendor, a gateway, or Meta.

## Orchestrator on the ports (M1C)

`CommercePersistence` is the source of truth. `OrchestratorState` exposes `bookings`, `transactions`, `ledgers`, and `paymentAttempts` as a read-only snapshot view for the existing tests. Those maps are not a second writer.

`reserve` uses five stages. Provider I/O stays outside `runAtomic`. A future SQL adapter must keep that rule: no network call inside the claim transaction.

1. Validate the actor, the phone-correlation rule, fail-closed policy, the registry, provider capabilities, and stored approval.
2. Atomically claim the operation. The same write stores the idempotency row as `IN_PROGRESS`, the inflight envelope, and a `PENDING_RESOLUTION` transaction. The envelope keeps tenant, location, provider connection, idempotency key, request hash, offering, requested start, slot, and the recovery fields. This happens before any provider call.
3. Call the mock provider only when `claim` returns `replay: false`. That is a new claim, or the single retry after authoritative absence has been consumed inside the claim. `replay: true` rereads the repository. `COMPLETED` returns the stored outcome. `PENDING_RESOLUTION` and `IN_PROGRESS` stay unresolved and do not call the provider. A different payload returns `IDEMPOTENCY_CONFLICT`. Two workers can both pass the precheck; only the worker that wins the claim may create or hold.
4. Atomically persist the booking, or keep the existing envelope `PENDING_RESOLUTION` when the provider outcome may already be committed. `providerError` defaults `outcomeCertainty` to `MAY_COMMIT`. A missing certainty is the same. `RETRYABLE`, `UNAVAILABLE`, and `TIMEOUT` do not prove that no reservation exists. A success with a blank booking reference, or an external held or confirmed booking with a blank provider reference, also stays unresolved (`MISSING_REFERENCE`). Only explicit `NO_COMMIT` calls `finishDenied`, completes the idempotency key, and drops the envelope. A provider success followed by a failed local write stays unresolved. It is not closed as a denial. `holdUnresolved` writes only through `runAtomic`. It does not call the provider.
5. After restart, recovery reads the envelope and queries the original provider. A confirmed external booking is adopted under the original transaction. A missing local row is not proof that the provider has no reservation. Authoritative absence allows one later create. A non-authoritative empty lookup does not. `guaranteesIdempotency` may retry the same operation during reconciliation. It does not let the losing `reserve` call the provider. A terminal provider state fails the transaction. Human release does not authorize another create.

A provider-issued booking reference is copied from the mock result. The command cannot supply one. External checkout never opens a reservation. A manual connection cannot store an authoritative reference.

`createOrchestratorState()` does not seed merchant approval. Tests that need the old harness call `seedOrchestratorPolicyFixture` for tenant `tenant-a`, category `GENERAL_GOODS`, surface `WHATSAPP_CATALOG`. That helper is not called by the constructor. The orchestrator does not copy `approvalEvidence` from the command. On load, `validatedBy` is kept only when `integrity` matches the in-process validator key. A forged snapshot cannot grant approval. The key is not part of the snapshot. This seal is not a Meta signature and it does not stand in for Meta approval.

Real offer-specific Meta exceptions need another row keyed by offering id. The current row is one merchant, one offering category, and one commerce surface. That column is not added here. YOLA FUN stays NO-GO.

`payments.applyEvent` accepts only trusted evidence. A Commerce write permission does not settle money. A caller cannot build a `VerifiedPaymentEvent`, cast it, and mark a transaction paid. `trustPaymentNotice` mints that evidence only after `verifyPaymentNotice` checks the in-process HMAC. Raw notices stay outside the ledger. A future gateway adapter must verify the gateway's official signature or an authoritative API response before it calls `trustPaymentNotice`. This HMAC is not that check. There is no gateway HTTP client. Amount, currency, tenant, provider, attempt, reference, refund, and chargeback checks still run after the trust check.

`markApplied` requires write permission on the webhook connection's own tenant and location. Tenant-wide write is not enough for an outlet connection. Webhook dedupe stays `connectionId:eventId`. No webhook route is mounted.

A crash after the claim leaves the envelope in place, so reconciliation can find the original provider. The next `reserve` does not treat a missing local booking as a new create. Restart reloads the snapshot. Reconciliation still uses the original provider, connection, location, and idempotency key. This is not exactly-once delivery.

`readBooking`, `openPaymentAttempt`, `recordPayment`, and `cancelReservation` select the row with the actor's `tenantId` and the reference, then apply the location check. A reference that exists only on another tenant returns `CROSS_TENANT` and does not include that row. A missing reference with no other tenant returns `NOT_FOUND`. Two tenants may store the same internal reference string. The sketch primary keys are already `("tenantId", "bookingRef")` and `("tenantId", "transactionRef")`. A SQL adapter must query both columns. Do not add a global unique on the reference string. The in-memory snapshot maps that key a booking or transaction by reference alone are a test view. They are not the lookup for those four operations, and a SQL adapter must not copy that keying.

## Candidate tables

Proposed only. Do not apply this SQL.

```sql
-- Not applied. Review sketch for a later migration.
-- Prerequisite, also not applied: Location.id is already unique, but a composite
-- foreign key needs UNIQUE ("tenantId", "id") on Location. Do not edit prisma/schema.prisma here.
-- PostgreSQL MATCH SIMPLE skips the check when locationId is null.
-- A non-null locationId must belong to the same tenant. A CHECK cannot subquery, so this FK is the enforced design.
-- ALTER TABLE "Location" ADD CONSTRAINT "Location_tenant_id_key" UNIQUE ("tenantId", "id");

CREATE TABLE "CcIntent" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "locationId" TEXT,
  "intentRef" TEXT NOT NULL,
  "experience" TEXT NOT NULL,
  "intentType" TEXT NOT NULL,
  "qualified" BOOLEAN NOT NULL,
  "customerRef" TEXT,
  "commerceOrderRef" TEXT,
  "version" INTEGER NOT NULL,
  UNIQUE ("tenantId", "intentRef"),
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT
);

CREATE TABLE "CcTransaction" (
  "transactionRef" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "locationId" TEXT,
  "intentRef" TEXT,
  "providerId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "bookingRef" TEXT,
  "orderRef" TEXT,
  "paymentStatus" TEXT NOT NULL,
  "verifiedPaid" BOOLEAN NOT NULL,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("tenantId", "transactionRef"),
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT
);

CREATE TABLE "CcBooking" (
  "bookingRef" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "locationId" TEXT NOT NULL,
  "transactionRef" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerMode" TEXT NOT NULL,
  "slotKey" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "providerReference" TEXT,
  "referenceAuthoritative" BOOLEAN NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "holdExpiresAt" TIMESTAMPTZ,
  "holdExpiryOwner" TEXT NOT NULL,
  "nativeExpiryPolicyId" TEXT,
  "pendingSlotKey" TEXT,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("tenantId", "bookingRef"),
  UNIQUE ("tenantId", "providerId", "idempotencyKey"),
  FOREIGN KEY ("tenantId", "transactionRef") REFERENCES "CcTransaction"("tenantId", "transactionRef") ON DELETE RESTRICT,
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "CcBooking_live_slot"
  ON "CcBooking" ("tenantId", "locationId", "providerId", "slotKey")
  WHERE "state" IN ('HELD', 'CONFIRMED');

CREATE UNIQUE INDEX "CcBooking_provider_ref"
  ON "CcBooking" ("tenantId", "providerId", "providerReference")
  WHERE "providerReference" IS NOT NULL AND btrim("providerReference") <> '';

CREATE TABLE "CcProviderConnection" (
  "connectionId" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "locationId" TEXT,
  "providerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "capabilities" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "health" TEXT NOT NULL,
  "lastCheckedAt" TIMESTAMPTZ,
  "credentialRef" TEXT,
  "webhookSecretRef" TEXT,
  "version" INTEGER NOT NULL,
  UNIQUE ("tenantId", "connectionId"),
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "CcProviderConnection_scope"
  ON "CcProviderConnection" ("tenantId", COALESCE("locationId", ''), "providerId", "kind");

CREATE TABLE "CcProviderCredential" (
  "credentialRef" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "connectionId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "ciphertext" TEXT,
  "rotatedFromRef" TEXT,
  "revokedAt" TIMESTAMPTZ,
  FOREIGN KEY ("tenantId", "connectionId") REFERENCES "CcProviderConnection"("tenantId", "connectionId") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "CcProviderCredential_one_active"
  ON "CcProviderCredential" ("connectionId", "purpose")
  WHERE "status" = 'ACTIVE';

CREATE TABLE "CcExternalRef" (
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "locationId" TEXT,
  "owner" TEXT NOT NULL,
  "ownerRef" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  PRIMARY KEY ("tenantId", "providerId", "owner", "externalId"),
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT
);

CREATE TABLE "CcPaymentAttempt" (
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "attemptRef" TEXT NOT NULL,
  "locationId" TEXT,
  "transactionRef" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerMode" TEXT NOT NULL,
  "expectedAmountIdr" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("tenantId", "attemptRef"),
  FOREIGN KEY ("tenantId", "transactionRef") REFERENCES "CcTransaction"("tenantId", "transactionRef") ON DELETE RESTRICT,
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT
);

CREATE TABLE "CcPaymentLedger" (
  "tenantId" TEXT NOT NULL,
  "attemptRef" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "transactionRef" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "amountIdr" INTEGER,
  "refundedIdr" INTEGER NOT NULL DEFAULT 0,
  "verifiedPaid" BOOLEAN NOT NULL,
  "providerReference" TEXT,
  "queued" JSONB NOT NULL,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("tenantId", "attemptRef"),
  FOREIGN KEY ("tenantId", "attemptRef") REFERENCES "CcPaymentAttempt"("tenantId", "attemptRef") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "CcPaymentLedger_provider_ref"
  ON "CcPaymentLedger" ("tenantId", "providerId", "providerReference")
  WHERE "providerReference" IS NOT NULL AND btrim("providerReference") <> '';

-- One live capture until split tender is specified. REFUNDED and CHARGEBACK leave the predicate.
CREATE UNIQUE INDEX "CcPaymentLedger_one_live_capture"
  ON "CcPaymentLedger" ("tenantId", "transactionRef")
  WHERE "status" IN ('PAID', 'PARTIALLY_REFUNDED');

CREATE TABLE "CcPaymentEvent" (
  "tenantId" TEXT NOT NULL,
  "attemptRef" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amountIdr" INTEGER NOT NULL,
  "providerReference" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ NOT NULL,
  "sequence" INTEGER,
  PRIMARY KEY ("tenantId", "attemptRef", "eventId"),
  FOREIGN KEY ("tenantId", "attemptRef") REFERENCES "CcPaymentAttempt"("tenantId", "attemptRef") ON DELETE RESTRICT
);

CREATE TABLE "CcIdempotency" (
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "scope" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "transactionRef" TEXT,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("tenantId", "scope", "idempotencyKey")
);

CREATE TABLE "CcInflight" (
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "locationId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "slotKey" TEXT NOT NULL,
  "transactionRef" TEXT NOT NULL,
  "absenceVerified" BOOLEAN NOT NULL,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("tenantId", "idempotencyKey"),
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT
);

CREATE TABLE "CcWebhookEvent" (
  "connectionId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "providerId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("connectionId", "eventId"),
  FOREIGN KEY ("tenantId", "connectionId") REFERENCES "CcProviderConnection"("tenantId", "connectionId") ON DELETE RESTRICT
);

CREATE TABLE "CcTransactionEvent" (
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "eventId" TEXT NOT NULL,
  "transactionRef" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "at" TIMESTAMPTZ NOT NULL,
  "payload" JSONB NOT NULL,
  PRIMARY KEY ("tenantId", "eventId")
);

CREATE TABLE "CcTouchpoint" (
  "touchpointId" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "locationId" TEXT,
  "transactionRef" TEXT,
  "intentRef" TEXT,
  "bookingRef" TEXT,
  "attemptRef" TEXT,
  "channel" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "userLevel" BOOLEAN NOT NULL,
  "ctwaClid" TEXT,
  "gclid" TEXT,
  "gbraid" TEXT,
  "wbraid" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "qrCampaignId" TEXT,
  "erasedAt" TIMESTAMPTZ,
  "erasureReason" TEXT,
  "version" INTEGER NOT NULL,
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT
);

CREATE INDEX "CcTouchpoint_transaction" ON "CcTouchpoint" ("tenantId", "transactionRef");

CREATE TABLE "CcAttributionAggregate" (
  "aggregateId" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "locationId" TEXT,
  "channel" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT
);

CREATE TABLE "CcPolicyEvidence" (
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "offeringCategory" TEXT NOT NULL,
  "experience" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "validatedBy" TEXT,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("tenantId", "offeringCategory", "experience")
);
```

`CcPaymentEvent.amountIdr` for a partial refund is the cumulative refund target already used by the ledger, not a delta to be summed. Revenue is `aggregateAttemptLedgers` over `CcPaymentLedger` rows. Do not add event amounts into a second revenue total.

`paymentStatus` and `verifiedPaid` on `CcTransaction` are a cache of that aggregate. They are written in the same database transaction as the ledger update. They are not a second place that applies events.

## Deletion

Financial and booking rows use `ON DELETE RESTRICT` from tenant and location. Do not copy the existing `Location` cascade. An outlet archive must not erase payment history.

Attempts and ledgers are not deleted. Credential revoke is a status change. Touchpoint erasure nulls click and UTM columns and keeps the row. Webhook rows stay after cancellation so a redelivery still dedupes. `CcAttributionAggregate` has no transaction column and must not gain one.

Tenant hard-delete will fail while these rows exist. That is intentional. M1C has to decide an archive path before a migration, because today's tenant delete cascades other product tables.

## Transaction boundaries

Each boundary is one database transaction in a future adapter. The memory port rolls the whole batch back when any step returns an error.

| Boundary | Writes that commit together | Reject |
|---|---|---|
| Reserve | Idempotency row, occupying slot, booking, transaction, event | Second live slot, hash mismatch, policy denial |
| Timeout | Inflight row and `PENDING_RESOLUTION` on the same key | A different provider or location |
| Absence then create | Absence flag, then one booking if the provider rule passes | Empty lookup when the rule is unset or unmet |
| Payment notice | Ledger version, ledger cache on the transaction, one applied event | Foreign provider reference, second live capture, blank reference |
| Webhook | Insert `RECEIVED` on `connection_id, event_id`, apply effect, mark `APPLIED` | The same connection and event id returns the stored row. Another connection is a different event |
| Cancel or refund | Only the booking, or only the ledger | Neither write may update the other |
| Reschedule | Pending slot, then slot swap if the new slot is free | Occupied target leaves the old slot in place |

Optimistic locking is `UPDATE ... WHERE version = :expected`. A mismatch is `VERSION_CONFLICT` and writes nothing. Two overlapping reserves of the same slot: the first commit wins, the second hits the partial unique index.

Webhook delivery is at-least-once. If the process dies after the dedupe insert and before `APPLIED`, the retry loads `RECEIVED` and applies once. Applied payment event ids are ignored. That is not exactly-once external delivery.

## Recovery

An uncertain provider result stores the original tenant, location, provider, idempotency key, request hash, and slot before anyone treats the call as success or failure. A timeout is one such result. `RETRYABLE`, `UNAVAILABLE`, unknown certainty, and a committed booking whose response omits a usable reference use the same envelope. Restart reloads that inflight row. A new create stays blocked. An error code alone is not proof of no commit. The adapter must set `NO_COMMIT` only when it has proof.

An empty provider lookup authorizes a new create only when all of these are true:

- The lookup is from the same provider and location as the inflight row
- The connection has a non-null `absenceConsistencyRequirement`
- The claim names that requirement and says it is satisfied
- The lookup observed an empty result

If the requirement is null, absence is not authoritative for that provider. The mock id `mock-absence-v1` is a test fixture. No live booking vendor is selected, so no vendor rule is invented here. A future vendor must write its own requirement before a retry create is allowed.

`EXPIRED` and `FAILED` on a payment attempt use the same shape: an authoritative provider read, the payment connection's requirement, and a from-state of `NOT_STARTED` or `PENDING`. A paid, refunded, or chargeback attempt cannot be moved to `EXPIRED` or `FAILED`. A caller status string is not that read.

`guaranteesIdempotency` on a connection is a capability flag. It does not by itself create a second booking. The orchestrator still owns the provider retry. The port records the outcome.

## Provider credentials

Existing helper: `encryptSecret` / `decryptSecret` in `src/lib/google/crypto.ts`. AES-256-GCM, blob `v1:<iv>:<tag>:<ciphertext>`, key `sha256(AUTH_SECRET)`. Commerce catalog tokens already use it. Browser JSON does not return `tokenEnc`.

Future provider API keys and webhook secrets use that helper, a new `CcProviderCredential.ciphertext` column, `purpose` `API` or `WEBHOOK`, and `keyVersion`. The memory port does not accept `plaintext` or `ciphertext` and does not store a secret. It stores `credentialRef` matching `cred_[a-z0-9_-]{1,64}`.

Rotation inserts a new `ACTIVE` row, marks the previous row `ROTATING`, and points the connection at the new ref. Revoke sets `REVOKED` and `revokedAt`. A revoked ref makes the connection unusable for reserve and payment open. Health can still be recorded.

Lookup order is outlet row, then tenant default (`locationId` null). An outlet row that is `UNREACHABLE`, `DISABLED`, `REVOKED`, or pointed at a revoked credential does not fall through to the tenant default.

`UNKNOWN` health is usable only when `capabilities.mock` is true, which is this milestone's mock path. A non-mock connection must be `HEALTHY` before a write. No production flag turns that path on.

The current helper is one application key, not a per-tenant key and not a KMS. Whether M1C stays on `encryptSecret` is an open decision. Do not put a real key in this design.

`CcProviderConnection` is not `CommerceConnection`. Catalog login stays where it is.

## Payments

One attempt id is immutable for a tenant. The same id with a different amount, provider, transaction, or mode is `ATTEMPT_CONFLICT`. A repeat of the same fields is a replay and does not reset the ledger.

A non-blank provider reference is unique per tenant and payment provider across attempts. A refund or chargeback whose reference belongs to another attempt is rejected.

Net paid is the sum of `amountIdr - refundedIdr` on `PAID` and `PARTIALLY_REFUNDED` ledgers only. `REFUNDED` and `CHARGEBACK` contribute 0 to net. `chargebackIdr` is the captured amount of `CHARGEBACK` ledgers, counted once, and those ledgers are not also added to `refundedIdr`. Duplicate `payment.paid` events do not increase the amount. A second open capture on a transaction that already has `PAID` or `PARTIALLY_REFUNDED` is rejected.

Split tender is a future requirement. The partial unique index above is the current constraint, not the split-tender design. Dropping it needs its own decision. This milestone does not implement split tender.

The internal HMAC in `payment.ts` is still not Xendit or Midtrans verification. The port persists an event that already matched the stored attempt. It does not hold the gateway secret.

## Bookings and holds

There is no universal hold TTL. `holdExpiresAt` is set only when the provider or an explicit native policy supplies it.

| Owner | When a hold becomes `EXPIRED` |
|---|---|
| `PROVIDER` | `holdExpiresAt` is present and not after the caller clock |
| `NATIVE_POLICY` | A policy id and `holdExpiresAt` were both stored. No default duration exists. |
| `NONE` or a missing timestamp | The row stays. `expireDue` counts it as unset. |

External availability must include a provider `freshUntil` that is still after `now`. A missing or stale window blocks the create. Native mocks may omit it. The first live booking vendor remains undecided. M1B runs against mock capabilities only.

Concurrent holds of the same slot cannot both stay in `HELD` or `CONFIRMED`. Reschedule stores a pending slot and swaps only when the target is free. Cancellation changes the booking. Refund changes the ledger. Neither writes the other side.

After downtime, the inflight row is still `PENDING_RESOLUTION` until the absence rule above passes. A second booking is not created by rehydration.

## Attribution and privacy

Touchpoints can point at an intent, a booking, a payment attempt, and a transaction for one outlet. Evidence class is computed by `classifyOutcome` when the transaction is read. It is not copied from a caller and not copied from an aggregate.

| Class | Meaning |
|---|---|
| A | Verified `PAID` (full) or `PARTIALLY_REFUNDED` (partial). Revenue. |
| B | Confirmed booking with an authoritative provider reference. Not revenue. |
| C | Qualified lead. Not revenue. |
| D | Engagement, or no stronger evidence. Not revenue. |

`CcAttributionAggregate` stores Search Console or Business Profile counts. It has no transaction reference. A save that mixes those counts into a touchpoint is rejected. Aggregates must not be turned into transactions.

`ctwa_clid`, `gclid`, `gbraid`, `wbraid`, UTM fields, and QR campaign ids are erased by an explicit command that records `erasedAt` and a reason. The booking and payment rows stay. No retention interval is set. A day count would be an invented legal period. Meta click-id terms, Google click-id terms, and the merchant's privacy notice have to be chosen before a number is stored. The column for a future tenant policy stays absent until that choice.

## Policy and authorization

Transactional reserve reads `CcPolicyEvidence` for the merchant, the offering category, and the commerce surface. Approval for general goods on WhatsApp Catalog does not authorize an admission ticket or a WhatsApp Flow. A missing or unmatched row fails closed. `VERIFIED` counts only when `validatedBy` is set and `approvalIsVerified` passes. A caller-supplied `{ status: VERIFIED }` is stored as `UNVERIFIED` and does not overwrite a validated row of that same scope.

The in-memory validator is an HMAC over tenant, offering category, experience, process id, reference, and outcome, using a key passed into the store factory. The key is not in the snapshot. A signature for one scope does not validate another. No Meta call is made. M1C replaces that HMAC with the real evidence-validation job. Until then, a missing key cannot write `VERIFIED`.

A reservation must use the mode stored on the booking connection. `EXTERNAL_CHECKOUT` does not create or hold a booking. `MANUAL` cannot store a provider reference or an authoritative flag. `referenceAuthoritative` and `providerReference` are accepted only when that connection's capabilities say it issues an authoritative reference. A caller cannot set those fields to skip the check.

Webhook identity is the trusted connection id plus the provider event id. Two merchants can use the same vendor and the same event id without suppressing each other. Duplicate delivery to one connection is a replay. No webhook route is authorized.

`actorFromCommerceSession` maps the current session onto `authorize`:

- `canReadCommerce` / `canWriteCommerce` in `src/lib/commerce/access.ts`
- `Membership.locationId` for `BRANCH` only (`sessionFromMembership` in `src/lib/auth.ts`)
- Platform mode has no commerce permissions
- `BRANCH` still has an empty permission list. This milestone does not grant branch staff commerce access

YOLA FUN stays NO-GO. This milestone creates no tenant, connection, or product for it.

## What M1C must not assume

- The orchestrator maps are still the live M1A.2 state. Moving them onto these ports is a later change and has to keep the existing tests.
- The snapshot is not an integrity-protected database. A hostile snapshot can set `validatedBy`. Production evidence is written only by the validator job. Result copies protect callers of this process. They are not a security boundary against a forged snapshot.
- `settleConcurrent` merges new reservation and payment units. It is not evidence that Postgres transactions are atomic.
- Composite location foreign keys are specified and not enforced. They wait for a migration that is not authorized.
- `ciphertext` in the sketch is nullable because this milestone stores no secret. A real column must be written only by server code that calls `encryptSecret`.
- Order-capture database tests stay out of `.github/workflows/commerce.yml`. They need `CommerceOrder`, and they also call inbox ingest. The working tree has uncommitted inbox migrations and a dirty ingest file. The Slice 2.5 job builds a separate database that must not contain `CommerceOrder`. Putting both in one migrate step would either apply the orders migration to that release check or run ingest against a schema this branch has not proven in CI. They were not added.
