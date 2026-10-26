# Conversational commerce M2 — schema and QA plan (review)

Status: **QA adapter implemented. Not applied to production.** The review was conditionally accepted. The SQL that runs is `prisma/migrations/20261026120000_cc_location_tenant_key` and `prisma/migrations/20261026140000_cc_persistence`. Do not run those folders against production. Do not deploy. Do not merge PR #1, PR #2, or PR #3.

The sketch later in this file is the review draft. Money columns in that sketch say `INTEGER`. The migration uses `BIGINT`. Do not apply the sketch.

The table sketch remains `docs/CONVERSATIONAL_COMMERCE_PERSISTENCE.md`. The port contract remains `src/lib/conversational-commerce/ports.ts`. M2 implements that contract on PostgreSQL. It does not reopen M0–M1C.2 product rules.

YOLA FUN stays NO-GO. No merchant, tenant, connection, or product is created for it. Catalog discovery, import, sync, poll, order capture, and payments stay as they are. `CommerceOrder` is not a booking table and gains no foreign key.

## QA implementation corrections

1. A disposable database is `atlasnow_cc_qa_` plus random hex, created by this process, with one owner-marker row. Loopback is required and is not enough. Drop runs only when the name, marker, `application_name`, and pinned server port match. There is no `DROP DATABASE IF EXISTS` for a database this process did not create. A Docker port forward may publish 5433 while `inet_server_port()` is 5432. The guard pins the port from the admin connection.
2. `CcIdempotency.transactionRef` is a nullable composite foreign key to `CcTransaction` (`ON DELETE RESTRICT`, MATCH SIMPLE). A null `transactionRef` stays valid for explicit `NO_COMMIT`. The claim inserts the transaction before the idempotency row.
3. `cc_assert_same_location` rejects a booking, payment attempt, or inflight row whose `locationId` differs from the transaction. The port maps `cc_location_mismatch` to `SCOPE_MISMATCH`.
4. `expectedAmountIdr`, ledger `amountIdr` and `refundedIdr`, and event `amountIdr` are `BIGINT`. Writes reject non-integers, negatives, and values above the catalog ceiling of 1000000000. Reads reject values above `Number.MAX_SAFE_INTEGER` and do not coerce. Checks: `CcPaymentAttempt_amount_safe`, `CcPaymentLedger_amount_safe`, `CcPaymentEvent_amount_safe`, `CcPaymentAttempt_currency_idr`.
5. `CcBooking_live_slot` is unique on `("tenantId", "locationId", "providerId", "slotKey")` for `HELD` and `CONFIRMED`. Two providers may hold the same slot key. This does not protect capacity across booking systems.

## What this review accepts

The QA implementation added the two migration folders and the Prisma models. Production migration is still a separate approval.

PostgreSQL 16. Prisma 5.22. The adapter implements `CommercePersistence`. `runAtomic` becomes one `prisma.$transaction`. Provider calls stay outside that callback. `settleConcurrent` is not the concurrency proof.

## Migration history this branch actually has

`git ls-files prisma/migrations` on `18a965c` contains 38 folders. Production history is a different set.

| Set | Contents | Applied where |
|---|---|---|
| Git, through `20261024100000_commerce_batch_poll` | 35 folders. The two inbox folders are absent from git | Base of this branch |
| Production | 37 finished, through `20261024100000_commerce_batch_poll`, including `20261004120000_wa_message_image` and `20261004143000_inbox_image_retention` | Production only. Those two folders are not in this branch |
| Git, not production | `20261024180000_commerce_orders`, `20261024200000_commerce_catalog_import`, `20261024220000_commerce_catalog_feed` | Local and CI disposable databases when `migrate deploy` runs this branch |
| Slice 2.5 release test | Vendors the two inbox folders when git lacks them, applies import and feed, omits `20261024180000_commerce_orders`. Asserts 39 names and `CommerceOrder` absent | Disposable database `atlasnow_slice25` on localhost |

`Location.id` is the primary key, so it is unique. There is no `UNIQUE ("tenantId", "id")`. `Location.tenant` is `onDelete: Cascade`. `@@unique([tenantId, code])` stays. A composite foreign key cannot target `Location` until the tenant-and-id unique exists. Adding that unique does not change which location rows are legal, because `id` is already unique.

`Tenant` delete today cascades locations, memberships, commerce products, and the catalog connection. Conversational rows must not join that cascade.

## Dependency graph

```text
20260819120000_init_postgres
  -> 20260824140000_multi_agency_tenancy          Tenant, Location
  -> 20260825180000_location_kind_hq              Location.kind
  -> 20261023120000_commerce_products             catalog tables, not used by Cc
  -> 20261024100000_commerce_batch_poll           production tip
  -> 20261024180000_commerce_orders               pending, not production
  -> 20261024200000_commerce_catalog_import       pending, not production
  -> 20261024220000_commerce_catalog_feed         pending, not production

production-only, absent from this git tree:
  20261004120000_wa_message_image
  20261004143000_inbox_image_retention

proposed, not created in this review:
  20261026120000_cc_location_tenant_key           depends on Location
  20261026140000_cc_persistence                   depends on that unique key, Tenant, and Location
```

The conversational migration does not read or write `CommerceProduct`, `CommerceConnection`, `CommerceOrder`, loyalty, broadcast, or inbox tables. `orderRef` stays a string. Deleting or never creating a catalog order does not delete a booking.

`migrate deploy` applies every pending folder in the image, in filename order. An image built from this branch already contains the three pending catalog folders. Adding `20261026140000_cc_persistence` to that image would apply the catalog folders and the conversational tables on boot. That image is not approved. The review PR must not contain either new folder.

Do not add the inbox folders to this branch to “match production.” Slice 2.5 already vendors them for its own disposable database.

## Sketch columns the ports already require

The M1B sketch is the base. These columns are missing from that SQL and are required by `ports.ts` after M1C.2. They are not new product behavior.

| Table | Add | Why |
|---|---|---|
| `CcIdempotency` | `outcomeCode TEXT` | `finishDenied` remembers a definitive no-commit result. Null while the row is open or a booking completed |
| `CcInflight` | `merchantConfirmed BOOLEAN NOT NULL` | Original command. Recovery retries the same request |
| `CcInflight` | `experience TEXT NOT NULL` | Original commerce surface |
| `CcInflight` | `category TEXT NOT NULL` | Original offering category |
| `CcInflight` | `offeringId TEXT NOT NULL` | Recovery must not invent another offering |
| `CcInflight` | `startsAt TEXT NOT NULL` | Recovery queries this start, not a new slot |
| `CcInflight` | `adoptBookingRef TEXT` | Set only when lookup found the original provider booking |
| `CcInflight` | foreign key `("tenantId", "transactionRef")` to `CcTransaction` | The claim writes both rows in one transaction |
| `CcTransactionEvent` | foreign key `("tenantId", "transactionRef")` to `CcTransaction` | An event cannot point at another tenant's transaction |
| `CcPolicyEvidence` | `integrity TEXT` | Restart keeps `validatedBy` only when this seal matches. The key stays out of the row |

`CcIdempotency` has no foreign key to `CcTransaction`. A denial completes the key with `transactionRef` null. A required foreign key would reject that row.

`availabilityFreshUntil` is checked at reservation open and is not stored on the booking. Do not add a column for it.

`CcProviderCredential.ciphertext` stays nullable and unused. The adapter rejects `plaintext` and `ciphertext`, same as the memory port. QA stores `credentialRef` only. KMS versus `encryptSecret` stays open and blocks a real credential, not the QA tables.

Connection identity for recovery is the booking connection at `("tenantId", locationId, "providerId", kind = BOOKING)`. The unique scope index below makes that one row. The inflight row stores `providerId` and `locationId`, which is what `StoredInflight` stores. Do not add `connectionId` to the port in this slice.

## Proposed migration 1 — location key

Folder, not created yet: `prisma/migrations/20261026120000_cc_location_tenant_key/migration.sql`

```sql
-- Not applied. Prerequisite for composite tenant/location foreign keys.
-- Location.id is already the primary key, so this unique cannot fail on existing rows.
CREATE UNIQUE INDEX "Location_tenant_id_key" ON "Location" ("tenantId", "id");
```

Prisma, not edited yet, on `model Location`:

```prisma
@@unique([tenantId, id], map: "Location_tenant_id_key")
```

Leave `onDelete: Cascade` on `Location.tenant` unchanged. Changing it would change loyalty, inbox, and catalog deletes.

## Proposed migration 2 — conversational tables

Folder, not created yet: `prisma/migrations/20261026140000_cc_persistence/migration.sql`

Depends on `Location_tenant_id_key`. Every tenant foreign key and every location foreign key is `ON DELETE RESTRICT`. PostgreSQL `MATCH SIMPLE` skips the location check when `locationId` is null. A non-null `locationId` must belong to the same tenant. Do not copy `Location`'s cascade.

```sql
-- Not applied. Review SQL for a later approval.

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
  CHECK ("currency" = 'IDR'),
  CHECK ("expectedAmountIdr" >= 0),
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
  CHECK ("refundedIdr" >= 0),
  CHECK ("amountIdr" IS NULL OR "amountIdr" >= 0),
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
  CHECK ("amountIdr" >= 0),
  FOREIGN KEY ("tenantId", "attemptRef") REFERENCES "CcPaymentAttempt"("tenantId", "attemptRef") ON DELETE RESTRICT
);

CREATE TABLE "CcIdempotency" (
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "scope" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "transactionRef" TEXT,
  "outcomeCode" TEXT,
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
  "merchantConfirmed" BOOLEAN NOT NULL,
  "experience" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "startsAt" TEXT NOT NULL,
  "absenceVerified" BOOLEAN NOT NULL,
  "adoptBookingRef" TEXT,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("tenantId", "idempotencyKey"),
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("tenantId", "transactionRef") REFERENCES "CcTransaction"("tenantId", "transactionRef") ON DELETE RESTRICT
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
  UNIQUE ("dedupeKey"),
  FOREIGN KEY ("tenantId", "connectionId") REFERENCES "CcProviderConnection"("tenantId", "connectionId") ON DELETE RESTRICT
);

CREATE TABLE "CcTransactionEvent" (
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "eventId" TEXT NOT NULL,
  "transactionRef" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "at" TIMESTAMPTZ NOT NULL,
  "payload" JSONB NOT NULL,
  PRIMARY KEY ("tenantId", "eventId"),
  FOREIGN KEY ("tenantId", "transactionRef") REFERENCES "CcTransaction"("tenantId", "transactionRef") ON DELETE RESTRICT
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
  CHECK ("count" >= 0),
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
  "integrity" TEXT,
  "version" INTEGER NOT NULL,
  PRIMARY KEY ("tenantId", "offeringCategory", "experience")
);
```

Primary keys are `("tenantId", "bookingRef")` and `("tenantId", "transactionRef")`. The same internal reference string is legal on two tenants. Do not add a global unique on `bookingRef`, `transactionRef`, `attemptRef`, or `providerReference`.

`CcBooking_provider_ref` and `CcPaymentLedger_provider_ref` are unique per tenant and provider. Two tenants may store the same provider reference. A blank reference is excluded.

`CcPaymentLedger_one_live_capture` allows one `PAID` or `PARTIALLY_REFUNDED` ledger per tenant and transaction. `REFUNDED` and `CHARGEBACK` leave the predicate. A chargeback still does not block a later capture. That product choice stays open. Split tender stays unimplemented. Dropping the index needs its own decision.

`CcPaymentEvent` primary key is `("tenantId", "attemptRef", "eventId")`. A repeated event id inserts once. Revenue is the ledger aggregate. Event amounts are not a second total. `paymentStatus` and `verifiedPaid` on `CcTransaction` are updated in the same transaction as the ledger.

Attempts and ledgers are not deleted. Credential revoke is a status change. Touchpoint erasure nulls click and UTM columns and keeps the row. Webhook rows stay so a redelivery still dedupes. `CcAttributionAggregate` has no transaction column.

Tenant hard-delete fails while these rows exist, because both the tenant foreign keys and the location foreign keys are `RESTRICT`. That is the QA behavior. An archive path for a production tenant delete is still not designed. Do not weaken `RESTRICT` to make tenant delete succeed.

## Prisma 5.22 limits

Prisma 5.22 can model the tables, the ordinary uniques, the checks it understands, and `@@unique([tenantId, id])` on `Location`.

It cannot model these indexes: `CcBooking_live_slot`, `CcBooking_provider_ref`, `CcProviderConnection_scope`, `CcProviderCredential_one_active`, `CcPaymentLedger_provider_ref`, `CcPaymentLedger_one_live_capture`. They live in the hand-written migration. `prisma migrate diff` will want to drop them. Do not apply that diff. The QA test reads `pg_indexes` and fails if any of those names are missing.

During implementation, run `prisma validate` on the composite relations where `tenantId` is required and `locationId` is optional. If Prisma rejects that relation, keep the column and the raw SQL foreign key, and do not invent a second location column. `prisma validate` is the check. This review does not edit the schema to try it.

State values stay `TEXT`. The port validates them. A wrong `CHECK` list would reject a legal port state. The database enforces tenancy, location ownership, idempotency, slot occupancy, provider-reference ownership, and one live capture.

## Concurrency and atomic idempotency

`settleConcurrent` stays an in-memory unit merge. The PostgreSQL tests do not call it.

Isolation is `Read Committed`. The single-winner rule is the primary key plus `INSERT ... ON CONFLICT DO NOTHING`, and `SELECT ... FOR UPDATE` when the row already exists. QA snapshot rewrites also take `pg_advisory_xact_lock` so two full-table writes cannot pass each other. A database lock is not held across a provider call.

### Claim — one transaction, no provider call

1. `INSERT` the `PENDING_RESOLUTION` `CcTransaction` for `("tenantId", transactionRef)` `ON CONFLICT DO NOTHING`. The idempotency foreign key requires this row before a non-null `transactionRef`.
2. `INSERT` into `CcIdempotency` for `("tenantId", 'RESERVE', idempotencyKey)` `ON CONFLICT DO NOTHING`.
3. If the idempotency insert wins, `INSERT` the `CcInflight` envelope in the same transaction. Commit. Return `replay: false`. This worker may call the provider after commit.
4. If the insert loses, `SELECT ... FOR UPDATE` the idempotency row and the inflight row.
5. A different `requestHash` rolls back with `IDEMPOTENCY_CONFLICT`.
6. `absenceVerified` with the same hash, provider, and location updates `absenceVerified` to false and sets status `IN_PROGRESS`. Commit. Return `replay: false`. The `UPDATE ... WHERE "absenceVerified" = true` returns one row, so only one worker consumes the retry.
7. Every other existing row commits the read and returns `replay: true`. That worker does not call the provider. A loser that observes the claim before the booking commit returns unresolved `TIMEOUT` with `replay: true`. It does not call the provider.

Two workers can both pass the in-process precheck. Only the worker that commits step 3 or step 6 calls the provider.

### Persist booking — one transaction

After the provider returns a usable reference, one transaction inserts `CcBooking`, updates the transaction, completes the idempotency row, and removes the inflight row. `CcBooking_live_slot` rejects a second `HELD` or `CONFIRMED` row for the same tenant, location, provider, and slot. `CcBooking_provider_ref` rejects a repeated provider reference. Either violation rolls the whole transaction back. The winner's booking stays.

A different idempotency key is a different claim. It may call the provider, because holding a row lock during that call would put network I/O inside the database transaction. The local booking still inserts once. A remote duplicate from two different keys is the existing at-least-once provider behavior. This design does not claim exactly-once external delivery.

Optimistic updates use `UPDATE ... WHERE version = :expected`. Zero rows is `VERSION_CONFLICT` and the transaction rolls back.

### Uncertain provider outcome

`RETRYABLE`, `UNAVAILABLE`, `TIMEOUT`, a missing `outcomeCertainty`, and a success without a usable booking reference take one transaction:

- Set the idempotency status to `PENDING_RESOLUTION`.
- Keep `CcInflight`, including provider, location, idempotency key, hash, slot, offering, and start.
- Do not set the transaction to `FAILED`.
- Do not delete the inflight row.
- Do not call `finishDenied`.

`finishDenied` runs only for explicit `NO_COMMIT`. Its transaction updates the idempotency row only when status is distinct from `PENDING_RESOLUTION`, fails an orphan `PENDING_RESOLUTION` transaction that has no booking, and deletes the inflight row. If the status guard matches nothing, the transaction rolls back with `RECONCILIATION_REQUIRED`.

### Recovery after process restart

The rows are the restart record. A new process selects `CcInflight` by `tenantId` and `idempotencyKey`. A second `claim` hits the primary key and returns `replay: true`, so it does not call the provider and does not insert a second booking.

Reconciliation reads that envelope and calls the original provider outside a transaction. The provider is the booking connection for that tenant, location, and `providerId`. Another provider or location does not prove absence.

Adopt is one transaction: insert the original booking under the original `transactionRef`, complete the idempotency row, and clear the inflight row. The booking primary key and the provider-reference unique index stop a second adopt.

Authoritative absence is the stored rule on the connection (`absenceConsistencyRequirement`), the same provider and location, `satisfied`, and an empty lookup. A null requirement does not authorize a create. `mock-absence-v1` remains a fixture. No live vendor rule is invented here.

### Payment

`openAttempt` inserts `CcPaymentAttempt` on `("tenantId", "attemptRef")`. The same id with a different amount, provider, transaction, or mode is `ATTEMPT_CONFLICT`.

`applyEvent` is one transaction. It inserts `CcPaymentEvent` on `("tenantId", "attemptRef", "eventId")` with `ON CONFLICT DO NOTHING`. A conflict returns the stored ledger and does not add the amount again. A new event updates the ledger `WHERE version = :expected` and writes the transaction payment cache in that same transaction. `CcPaymentLedger_provider_ref` rejects a reference owned by another attempt. `CcPaymentLedger_one_live_capture` rejects a second open capture.

Cancel writes the booking only. Refund writes the ledger only.

Webhook accept inserts `CcWebhookEvent` on `("connectionId", "eventId")`. Another connection with the same vendor event id is a different row.

## Isolated QA database

The implementation test creates and drops its own database. It never uses a production connection string, a production password, or production row data.

| Rule | Value |
|---|---|
| Database name | `atlasnow_cc_qa_` plus 24 hex characters. The fixed name `atlasnow_cc_qa` is not used |
| Host guard | `localhost` or `127.0.0.1` only, plus the pinned `inet_server_port()`, `application_name=atlasnow-cc-qa`, and the owner marker. Loopback alone does not authorize a drop |
| Admin URL | Loopback coordinates from `DATABASE_URL`, connected to the `postgres` maintenance database. The named database in that URL is not migrated and is not dropped |
| Lifecycle | `CREATE DATABASE` of a new name only, `migrate deploy` of the branch folders, install `cc_qa_owner`, tests, then drop only if the marker matches |
| Process | Its own `tsx --test` process. It does not share a Prisma client with `service.db`, catalog DB tests, `slice25-release.db.test.ts`, or `order-capture.db.test.ts` |
| Secrets | Fixture HMAC key only. No `ciphertext`. No gateway secret. No Meta token |
| Provider | Existing in-memory mock. No outbound HTTP |
| Catalog path | The test does not call catalog sync, import, order capture, or Graph |

CI, when the implementation is approved, adds one step to the existing `db` job in `.github/workflows/commerce.yml`, after the current tests:

```text
npx tsx --test src/lib/conversational-commerce/persistence.pg.test.ts
```

That job already starts `postgres:16-alpine` with user `atlasnow`, password `atlasnow`, database `atlasnow`, on localhost. The pg test still creates its own `atlasnow_cc_qa_*` database from those admin coordinates. It does not migrate the `atlasnow` database. The workflow step is in this branch. The local `gh` token may still reject `.github/workflows` on push.

`slice25-release.db.test.ts` copies every migration folder except `20261024180000_commerce_orders`. When the conversational folders exist, that test must also skip `20261026120000_cc_location_tenant_key` and `20261026140000_cc_persistence`, and it must assert that `CcBooking` is absent. Otherwise the release database stops matching the production-shaped migration set. That omit is part of the implementation, not this review.

## QA cases the implementation must run on PostgreSQL

Mock provider only. Two real sessions where the case says concurrent.

| Case | Proves |
|---|---|
| Two concurrent `claim` calls, same tenant, key, and hash | One successful `replay: false`, one `replay: true` that does not call the provider, one local booking. The loser may still be unresolved `TIMEOUT` if it reads before the booking commit |
| Same key, different hash | `IDEMPOTENCY_CONFLICT`, no second booking |
| Two keys, one live slot | One `HELD` or `CONFIRMED` booking. The partial unique index rolls the other insert back |
| Provider returns `RETRYABLE` after a remote commit | Idempotency stays `PENDING_RESOLUTION`, inflight remains, transaction is not `FAILED` |
| Provider returns `UNAVAILABLE` after a remote commit | Same envelope |
| Success with a blank usable reference | Envelope kept as `MISSING_REFERENCE` |
| Explicit `NO_COMMIT` conflict | `finishDenied` completes the key and leaves no inflight row |
| Kill the client after claim, open a new client | Inflight row is still there. The next claim does not call the provider |
| Reconcile on the original provider, location, and key | One adopted booking on the original `transactionRef` |
| Reconcile with another provider or location | No absence, no second create |
| Repeat the original request after adopt | Same booking, provider create count stays 1 |
| Two tenants, same `bookingRef`, `transactionRef`, and `attemptRef` | Both rows exist. Each actor reads, pays, and cancels only their own row |
| Actor tenant has no row, another tenant has the reference | `CROSS_TENANT`, and the payload has no foreign provider reference |
| `locationId` from another tenant | Foreign key violation mapped to the port error. No row written |
| Wrong outlet for the actor | `LOCATION_FORBIDDEN` |
| Duplicate payment event id | One ledger event, one amount |
| Second `PAID` capture on the same transaction | Unique index rejects it |
| Refund and chargeback | Ledger changes. Booking state does not |
| Same vendor event id on two connections | Two webhook rows |
| `plaintext` or `ciphertext` on credential register | `SECRET_REJECTED`, no secret stored |
| Catalog order and product tables | Row counts for those suites stay on their own tests. This test does not write `CommerceOrder` |

## Backward compatibility

| Surface | Risk | Guard |
|---|---|---|
| PR #1 `feature/commerce-meta-catalog` | Unaffected while this review stays on its own branch. Merging PR #2 or the implementation into that branch puts the migration in the catalog image | Do not merge |
| PR #2 | This review stacks on its head and adds documentation only. The in-memory tests stay the contract | Implementation is a later commit on the stacked branch |
| Production boot | `prisma migrate deploy` in the image applies every pending folder, including orders, import, feed, and any Cc folder present | Do not build or deploy an image from the implementation branch |
| Slice 2.5 CI | A new folder is copied unless the omit list grows | Implementation adds both Cc folders to the omit list and asserts `CcBooking` is absent |
| Existing `db` job | `migrate deploy` on the disposable CI database would create Cc tables once the folders exist | Acceptable on the disposable CI database. Not acceptable on production |
| Inbox migrations | Still absent from git and present in production. `migrate deploy` from this branch against production fails because applied migrations are missing locally | Do not point QA or CI at production to “see what happens” |
| Dirty workspace `schema.prisma` | Local uncommitted inbox columns are not part of `18a965c` | Do not stage them |
| Orchestrator snapshot maps | Still keyed by reference alone | The SQL adapter queries `tenantId` and the reference. It does not use those maps |
| Payment trust | Still the in-process HMAC | The database does not become a gateway verifier |

## Proposed files

### This review PR

- `docs/CONVERSATIONAL_COMMERCE_M2_SCHEMA_REVIEW.md` (this file)
- One status line each in `docs/AI_DEV_STATUS.md`, `docs/DECISION_LOG.md`, `docs/COMMERCE_ARCHITECTURE.md`, `docs/CONVERSATIONAL_COMMERCE_PERSISTENCE.md`, and `docs/CONVERSATIONAL_COMMERCE_IMPLEMENTATION_PLAN.md`

### QA implementation on this branch

- `prisma/schema.prisma` — `Location` `@@unique([tenantId, id])` and the `Cc*` models. No edits to catalog models
- `prisma/migrations/20261026120000_cc_location_tenant_key/migration.sql`
- `prisma/migrations/20261026140000_cc_persistence/migration.sql`
- `src/lib/conversational-commerce/postgres-store.ts` — `CommercePersistence` on Prisma, `runAtomic` as `$transaction`, no provider call inside it. Reads for `exportSnapshot()` stay here. Writes do not
- `src/lib/conversational-commerce/postgres-booking.ts` — targeted row locks, claim `INSERT ... ON CONFLICT`, and booking diff writes. No global advisory lock
- `src/lib/conversational-commerce/postgres-finance.ts` — payment, webhook, attribution, policy, and credential diffs. No snapshot rewrite
- `src/lib/conversational-commerce/persistence.pg.test.ts` — the QA cases above
- `src/lib/conversational-commerce/persistence.pg.workers.test.ts` — two Prisma clients for booking races. `settleConcurrent()` is not the evidence
- `src/lib/conversational-commerce/persistence.pg.cross.test.ts` — two Prisma clients for booking, payment, webhook, and attribution together
- `src/lib/commerce/slice25-release.db.test.ts` — omit the two new folders and assert `CcBooking` is absent
- `.github/workflows/commerce.yml` — separate-process steps for `persistence.pg.test.ts`, `persistence.pg.workers.test.ts`, and `persistence.pg.cross.test.ts`, via the GitHub connection that can edit workflows

No route, webhook, gateway client, Meta call, Flow runtime, feature flag, or pilot workspace.

## Blockers before implementation

1. The conditional review approval is used for this QA implementation. Production migration still needs a separate approval.
2. `prisma validate` accepts the optional composite location relation.
3. Hand-written partial indexes, location triggers, amount checks, and `cc_qa_owner` are the allowed drift. The QA test reads `pg_indexes` and fails on any other drift. Do not apply a diff that drops the partial indexes.
4. The workflow edit needs a token that can push `.github/workflows`. Local `gh` cannot. QA can run locally against localhost before that CI line exists.
5. Production tenant delete still has no archive path. `RESTRICT` is correct for QA. It is a production-use blocker, not a reason to cascade these rows.
6. Real credentials stay blocked until KMS or `encryptSecret` is chosen. QA must not store ciphertext.
7. A chargeback still does not block a later capture. Do not change that index while implementing the adapter.
8. No live booking vendor, so absence stays `mock-absence-v1` or null. Null means no retry create.

## Blockers that stay after a later QA implementation

- Do not deploy. Do not run `migrate deploy` against production.
- Do not merge PR #1, PR #2, or the implementation PR.
- Do not onboard YOLA FUN.
- Exactly-once external delivery is not claimed.
- Trusted payment evidence is still the in-process HMAC.
- Offer-specific Meta exception rows are not in this schema.
