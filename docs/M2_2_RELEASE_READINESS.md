# M2.2 release readiness review

Status: **review only.** Accepted QA foundation `df3e7f2997fcddad6bc7a499d62db40bff146ac9` on Draft PR #5. This document does not apply a migration, open staging, or change `prisma/schema.prisma`.

Recommendation: **NO-GO** for staging implementation until an operator supplies the production `_prisma_migrations` metadata and startup no longer runs `migrate deploy`. YOLA FUN stays NO-GO for transactional WhatsApp commerce. AtlasNow is not the merchant of record.

## 1. Scorecard

| Area | Result | Evidence in this review |
|---|---|---|
| Repository migration inventory at `df3e7f2` | PASS | `git ls-files prisma/migrations` lists 40 folders. Counted below. |
| Production `_prisma_migrations` contents | NOT VERIFIED | This session did not open the production host or a production dump. |
| Inbox folders absent from git and recorded as applied in production | BLOCKED | Names are in `docs/COMMERCE_SLICE_2_5_RELEASE.md`. The folders are not in this commit. Production checksums were not read. A missing applied folder does not stop `migrate deploy`. |
| Pending catalog migrations | BLOCKED for any shared boot | Orders, import, and feed are in git and are not in the documented production set. `migrate deploy` applies pending folders even when an already applied folder is missing from the image. |
| Conversational migrations | BLOCKED for production | `20261026120000_cc_location_tenant_key` and `20261026140000_cc_persistence` are in git. They are QA-only. |
| Docker startup | BLOCKED | Committed `deploy/docker-entrypoint.sh` runs `prisma migrate deploy` before `node server.js`. That command is not a fail-closed history check. |
| Checksum compatibility with production | NOT VERIFIED | No production checksum column was read. On Prisma 5.22.0, `migrate deploy` and `migrate status` also exited 0 after a local file no longer matched the stored SHA-256. |
| Tenant hard deletion | PASS as a refusal | Not implemented here. `Cc*` foreign keys use `ON DELETE RESTRICT`. |
| Staging environment | NOT VERIFIED | No staging database exists. `docs/AI_DEV_STATUS.md` already says so. |
| Multi-worker QA correctness | PASS for disposable QA | CI on `df3e7f2`: https://github.com/joefebrian/atlasnow/actions/runs/40262845004. That is not a production pool measurement. |
| Production pool, lock wait, and backlog monitors | NOT VERIFIED | Settings below are the code. No production runtime was inspected. |
| Booking-provider sandbox | BLOCKED | Requirements are listed. No provider is connected. |
| Overall staging implementation | NO-GO | Production history is unverified, and boot migrate can apply pending folders without rejecting a missing applied folder or a checksum mismatch. |

## 2. Migration reconciliation plan

### What git contains

`df3e7f2997fcddad6bc7a499d62db40bff146ac9` tracks 40 migration directories plus `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`).

Thirty-five folders end at `20261024100000_commerce_batch_poll`. That is the documented production tip, excluding two inbox folders that are not in git.

Five later folders are in git and are outside that documented production tip:

| Folder | Depends on | Effect |
|---|---|---|
| `20261024180000_commerce_orders` | Commerce product tables from `20261023120000_commerce_products` | Creates `CommerceOrder` and `CommerceOrderLine`. |
| `20261024200000_commerce_catalog_import` | `CommerceCatalogLink` | Adds nullable `lastImportedAt`. |
| `20261024220000_commerce_catalog_feed` | Product, catalog link, and commerce connection tables | Adds `publicUrl`, `sourceSnapshot`, and `catalogVertical` with empty defaults. |
| `20261026120000_cc_location_tenant_key` | `Location` from `20260824140000_multi_agency_tenancy` | `CREATE UNIQUE INDEX "Location_tenant_id_key" ON "Location"("tenantId", "id")`. `Location.id` is already the primary key, so existing rows satisfy it. |
| `20261026140000_cc_persistence` | That unique index, `Tenant`, and `Location` | Creates the `Cc*` tables, partial unique indexes, amount checks, and `cc_assert_same_location`. It does not read or write catalog, loyalty, broadcast, or inbox tables. |

Filename order is Prisma's apply order. The conversational folders sort after orders, import, and feed. `cc_persistence` does not reference `CommerceOrder`. A directory that contains all five still applies the three catalog folders first, because `migrate deploy` applies every pending folder in the image.

### What the documents say about production

These repo documents agree on a 2026-10-23 production inventory of **37 finished migrations** ending at `20261024100000_commerce_batch_poll`:

- `docs/COMMERCE_SLICE_2_5_RELEASE.md`
- `docs/COMMERCE_CATALOG_BIDIRECTIONAL.md`
- `docs/AI_DEV_STATUS.md`
- `docs/CONVERSATIONAL_COMMERCE_M2_SCHEMA_REVIEW.md`

That 37 is the 35 git folders through batch poll plus:

- `20261004120000_wa_message_image`
- `20261004143000_inbox_image_retention`

`docs/TRANSACTION_ORCHESTRATOR_ARCHITECTURE.md` says "Production history is 39 finished migrations." That sentence conflicts with the four documents above. The number 39 is the count asserted by `src/lib/commerce/slice25-release.db.test.ts` on a disposable database: 35 git folders through batch poll, plus the two inbox SQL strings embedded in that test, plus import and feed, while omitting orders and both conversational folders. Do not treat 39 as a production census.

This review did not query production. The 37-row inventory stays **NOT VERIFIED**. It is an unresolved release blocker. Do not fabricate `_prisma_migrations` rows. Do not run `prisma migrate resolve`. Do not copy a guessed inbox script into a production image.

### Local inbox bytes, not a production record

The working tree on the review machine has untracked copies of the two inbox folders. They are not part of `df3e7f2` and must not be committed from the dirty tree as if they were a production export.

Those files match the SQL strings already embedded in `slice25-release.db.test.ts`, including the trailing newline. SHA-256 of the working-tree `migration.sql` bytes:

| Folder | Bytes | SHA-256 of the working-tree file |
|---|---|---|
| `20261004120000_wa_message_image` | 118 | `4b976d08e35a360d8abcc7be696b2fa51fc7d7894efd230a1ea0b82dae5d8163` |
| `20261004143000_inbox_image_retention` | 360 | `d84e9881c254e2164e649caabedbec078640d968051cef578e1406edef2dae32` |

These hashes are not `_prisma_migrations.checksum`. Prisma's checksum was not compared to a database in this review. The image migration adds `WaMessage.mediaImage` and `WaMessage.mediaMime`. The retention migration adds `Tenant.inboxImageRetentionDays`, `WaMessage.inboxImage`, and `WaMessage.mediaPurgedAt`, then backfills `inboxImage` from `mediaMime` and a body prefix. Retention therefore sorts after the image migration, which the filenames already do.

The committed `schema.prisma` at `df3e7f2` has no `inboxImageRetentionDays` column. A dirty working tree that adds it is not this branch.

### Drift already known on disposable databases

`docs/AI_DEV_STATUS.md` records a `prisma migrate diff` from a removed disposable Postgres 16 to `schema.prisma`. Commerce SQL was not the diff. The diff still wanted to drop two loyalty voucher indexes, set `BroadcastFeeConfig.id` default to `default`, and rename a loyalty unique index. Those statements were not turned into a migration. A later staging diff must treat that drift as pre-existing and must not apply it.

Partial conversational indexes live only in `20261026140000_cc_persistence/migration.sql`. `prisma migrate diff` from a migrated QA database back to `schema.prisma` asks to drop them. Do not apply that diff.

### Prisma 5.22 `migrate deploy` is not a history gate

Prisma's production-migration document says `migrate deploy` does not warn when an already applied migration is missing from the local history, and does not detect schema drift. It applies pending migrations. Prisma 5.22.0 in this repo was checked on a disposable `atlasnow_cc_qa_*` database created on loopback. Each probe database was dropped at the end. Production was not used.

Probe 1, missing applied folder, drift, and a pending migration:

1. `migrate deploy` applied `20260101000000_probe_applied` and created `ProbeApplied`. Exit 0.
2. That folder was removed from the local migration directory.
3. `ALTER TABLE "ProbeApplied" ADD COLUMN "hotfix" TEXT` added a column that no migration file contains.
4. `20260102000000_probe_pending`, which creates `ProbePending`, was the only local folder.
5. `migrate deploy` exited 0. The output said `1 migration found in prisma/migrations`, then `Applying migration 20260102000000_probe_pending`, then `All migrations have been successfully applied.` It did not contain the name `20260101000000_probe_applied` and it did not contain a warning.
6. `_prisma_migrations` then had both names, both with `finished_at` set, `rolled_back_at` null, and `applied_steps_count` 1.
7. `ProbePending` existed. The `hotfix` column still existed.

Probe 2, checksum:

1. A second disposable database applied one migration. Its stored `checksum` equalled the SHA-256 of that `migration.sql`: `85ab11f2e5426fdd9d1bafc23bef3c0c1f55367a03dd269d914eaf38db6bbee2`.
2. A comment was appended to the local file. The file's SHA-256 became `0ba4950bdbe169732c0691c855dc1e381e07001641aa693f884726249b4b5c80`.
3. `migrate deploy` exited 0 and printed `No pending migrations to apply.`
4. `migrate status` exited 0 and printed `Database schema is up to date!`
5. Neither command printed a modified-migration warning. The Prisma documentation describes that warning. This 5.22.0 binary did not emit it. The preflight below compares the SHA-256 itself.

An earlier attempt exited 1 with `P3005` because the database already contained a table and had no `_prisma_migrations` history. That error does not cover a database that already has migration history and is missing an old folder.

Earlier notes in `docs/COMMERCE_SLICE_2_5_RELEASE.md` and `docs/CONVERSATIONAL_COMMERCE_M2_SCHEMA_REVIEW.md` say a missing inbox folder makes `migrate deploy` stop. Those sentences are not the behavior observed above. A clean image can apply orders, import, feed, and both conversational folders while the two inbox names remain only in `_prisma_migrations`.

### Boot behavior

Committed entrypoint:

```sh
node /app/node_modules/prisma/build/index.js migrate deploy
exec node server.js
```

The Dockerfile health check requests `http://127.0.0.1:3000/`. It does not check migration history or the database. `.dockerignore` does not exclude `prisma/migrations`. A clean checkout of this branch omits the two inbox folders and still contains the five later folders. Boot can apply those five folders. A dirty working tree can also copy the untracked inbox SQL into the image. There is no flag that skips migrate on boot. This review does not change the entrypoint.

Application startup must default to not migrating. That change is a later implementation and is not authorized here. Until it exists, do not boot this image against a database that already has history.

### Read-only production inventory

The production inventory stays **NOT VERIFIED** until an operator supplies the metadata below. This review does not collect it. Do not give an AI agent a production credential, a production URL, or a dump.

The operator runs this with their own client, against production or a replica they already operate. The statement reads one catalog table and no customer or application table:

```sql
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count
FROM "_prisma_migrations"
ORDER BY started_at;
```

The operator keeps the result. A later review may receive that result. It must not receive the connection string. If the operator cannot produce the six columns, the release stays NO-GO.

### Release preflight

The preflight runs before application startup and before any migration command. It is not `migrate deploy`, `migrate status`, `migrate resolve`, or `db push`. None of those commands is authorized against production by this review. The preflight program itself is not authorized for implementation here.

Fail closed. Any one of these conditions is **NO-GO**:

1. The release approval does not name the git SHA and the exact folder inventory.
2. The six columns above cannot be read.
3. A finished `migration_name` is absent from the approved folder inventory.
4. An approved folder that this release treats as already applied has no finished row.
5. `checksum` is not the lowercase SHA-256 hex of that folder's exact `migration.sql` bytes.
6. `started_at` is null, `finished_at` is null, or `rolled_back_at` is not null.
7. `applied_steps_count` is not 1. The disposable probes recorded 1 for each finished one-file migration. A different count needs a separate explanation before it can pass.
8. The image contains a folder that the approval does not name. The five later folders are unnamed unless a future approval names them one by one.
9. A folder is pending and this boot was not approved to apply that folder.

A passing preflight still does not start the app with migrate enabled. Startup stays non-migrating by default. A later approval may run one named migration command after a fresh preflight. That command is not part of this review.

### Procedure after the operator supplies the six columns

1. Record the approved git SHA. Build the folder list from that clean checkout. Do not add working-tree files.
2. Compare the operator's rows with that list using the preflight conditions above. Do not edit `_prisma_migrations`. Do not run `migrate resolve`.
3. Expected names, if the 2026-10-23 document is still true: the 35 git folders through `20261024100000_commerce_batch_poll`, plus the two inbox names, and none of the five later folders. Any other shape is NO-GO.
4. Decide later, folder by folder, which of the five later migrations a future release may contain. Leaving them in the image is not safe while boot calls `migrate deploy`.
5. If the six columns are not supplied, staging implementation stays NO-GO.

`20261026120000` can apply on a database that has `Location` and does not require the catalog folders. `20261026140000` requires the unique index from `20261026120000`. Shipping them by deleting the three catalog folders from an image is a later release design. This review does not delete those folders.

## 3. Staging architecture

No staging host is authorized by this document.

| Piece | Requirement |
|---|---|
| Database | A new Postgres 16 instance. Its own volume. Its own role. A database name that is not the production name. |
| Credentials | A new `DATABASE_URL` and a new `AUTH_SECRET`. Production passwords stay on the production host. |
| Network | The staging app cannot reach the production database host. The production app cannot use the staging URL. |
| Code | An approved SHA. A clean git checkout. The two inbox folders are present only when their SHA-256 values match the operator's `checksum` column. |
| Migrate | A separate approved command, run once, by an operator, against the staging URL. The app process must start with migrate already finished. |
| Boot | The current entrypoint always migrates, and that command does not reject a missing applied folder. A later change must default startup to not migrating. Suggested gate: `ATLASNOW_MIGRATE_ON_BOOT` unset or any value other than `true` skips `migrate deploy`. This review does not add that gate. |
| Backup | Before a later approved staging migrate command: custom-format dump of that staging database, sha256 recorded, restore onto a second empty staging instance, then run the preflight. A dump that does not restore stops the release. This review does not take a production dump. |
| Rollback | Conversational SQL creates tables, indexes, checks, and a trigger. It has no down migration. If the staging migrate fails or applies the wrong folder, restore the dump taken in the previous step. Do not hand-delete `Cc*` tables on a database that has been used as production. Do not `migrate resolve` a failed migration to hide it. |
| Flags | Every commerce switch below stays unset. There is no conversational-commerce flag. The adapter has no HTTP route, which keeps it off the request path, and does not keep `migrate deploy` from creating tables. |
| Secrets | Staging secrets live in the staging environment store. They are not committed. `PAY_SECRET` in tests is a fixture and is not a staging credential. |
| Access | Staging admin is the same human approval as a production change. No shared production SSH key. |
| Health | The image health check only fetches `/`. Staging acceptance needs a process check that fails when `migrate deploy` did not finish and when the database connection fails. Logging must keep connection URLs redacted. `redactDatabaseText` in the QA helper covers `postgres://` URLs in test errors. The app Prisma client logs `error` in production and can include query text. |
| Recovery watch | A staging query, not a production job: count `CcTransaction` rows in `PENDING_RESOLUTION` older than 15 minutes, and `CcInflight` rows older than 15 minutes. Alert when the count is above zero. No such monitor exists today. |

Commerce switches that stay unset, from `docs/COMMERCE_SLICE_2_5_RELEASE.md`:

- `COMMERCE_CATALOG_SYNC_ENABLED`
- `COMMERCE_CATALOG_POLL_ENABLED`
- `COMMERCE_ORDER_CAPTURE_ENABLED`
- `COMMERCE_PAYMENTS_ENABLED`
- `COMMERCE_CATALOG_IMPORT_ENABLED`
- `COMMERCE_CATALOG_IMPORT_TENANTS`
- `COMMERCE_CATALOG_DISCOVERY_ENABLED`
- `COMMERCE_CATALOG_DISCOVERY_TENANTS`

`COMMERCE_POLL_SECRET` stays as it is. An empty tenant list allows no merchant. Discovery does not enable import.

## 4. Tenant archival and retention proposal

This is a policy proposal. It does not add a deletion API.

### What already exists

`Tenant.status` is documented as `ACTIVE`, `INACTIVE`, or `ARCHIVED`. Login in `src/lib/auth.ts` drops memberships whose tenant is `ARCHIVED`. `INACTIVE` does not, by itself, drop the membership. `loginEnabled` is a second gate. Location status can be `ARCHIVED`. Commerce product archive is one-way for that product.

Every `Cc*` foreign key to `Tenant`, `Location`, or a parent `Cc*` row is `ON DELETE RESTRICT`. The same constraints use `ON UPDATE CASCADE`. The adapter does not rewrite `Tenant.id` or `Location.id`. A `DELETE` of a tenant that owns a conversational row fails, and the surrounding cascade to loyalty, inbox, and catalog rows rolls back with it. A `DELETE` of a tenant that owns none of those conversational rows still cascades catalog, loyalty, inbox, and the other relations that already use `ON DELETE CASCADE`. That cascade is existing product behavior and is the reason hard delete stays forbidden.

`eraseIdentifiers` clears `ctwaClid`, `gclid`, `gbraid`, `wbraid`, `utmSource`, `utmMedium`, `utmCampaign`, and `qrCampaignId` on one touchpoint, then stores `erasedAt` and `erasureReason`. It leaves the touchpoint row, the booking, the ledger, and `customerRef`. The port already rejects a phone number used as an intent key. Inbox message bodies and loyalty phone numbers are outside this adapter.

Webhook identity is `connectionId` plus the provider event id, stored on `CcWebhookEvent`. Nothing deletes those rows. Idempotency rows and inflight envelopes have no expiry. `CcPolicyEvidence`, `CcTransactionEvent`, and payment events are the audit trail this adapter writes. It does not write the application `AuditEvent` table.

### Proposed states

| State | Behavior | Deletes rows |
|---|---|---|
| Suspended | Set `loginEnabled` false and `Tenant.status` to a value the login path already rejects. Today that value is `ARCHIVED`. A later implementation may add `SUSPENDED` only if login rejects it in the same change. | No |
| Archived | Tenant remains. Locations can be `ARCHIVED`. Conversational reads stay available to a platform operator. Customer-facing login stays off. | No |
| Identifier erasure | Call the existing touchpoint erasure for the named touchpoint, with a reason and a time. | No financial or booking row |
| Controlled deletion | A named approval, a tenant id check, a backup, and a report of remaining `Cc*` rows. | Not in this milestone |

Financial and booking history stays for the life of the merchant record: `CcBooking`, `CcTransaction`, `CcPaymentAttempt`, `CcPaymentLedger`, `CcPaymentEvent`, `CcIdempotency`, `CcInflight`, `CcExternalRef`, and `CcTransactionEvent`. AtlasNow does not hold shopper funds. Those rows are the merchant's reconciliation evidence, not a balance AtlasNow pays out.

Webhook dedupe rows stay while the connection exists. Deleting them would let the same provider event id be accepted again. A shorter window requires its own review.

Policy evidence stays. It is the record that a commerce approval was or was not sealed.

Hard deletion of a tenant, location, booking, ledger, or webhook row is out of scope. Do not call `prisma.tenant.delete` for a merchant that has had commerce or conversational activity.

## 5. Security and operational blockers

| Blocker | Why it blocks staging implementation |
|---|---|
| Production migration inventory is NOT VERIFIED | An image can apply pending folders while an already applied folder is missing from that image. |
| Entrypoint always runs `migrate deploy` | Starting the process can apply pending folders. Prisma 5.22.0 does not stop when an already applied folder is missing, and it did not stop when a checksum changed. |
| No conversational feature flag | Tables appear whenever the folders are in the image. Routes are absent, so traffic does not call the adapter. |
| `authorize()` is not production RBAC | The actor carries `tenantId`, optional `locationIds`, and optional `read` or `write`. A caller that can set `locationIds` to null can read every location of that tenant. Cross-tenant access returns `CROSS_TENANT` and does not return the other tenant's row. Session wiring for this adapter does not exist. |
| Prisma logs errors in production | Query text can contain a customer reference. Staging logs need a redaction check before a real payload is stored. |
| Credentials | The adapter rejects plaintext and ciphertext. `CcProviderCredential.ciphertext` stays null. A real secret store is still absent. |
| Payment trust | The in-process HMAC is not a gateway signature. |
| Deadlock retry | A deadlock or serialization failure becomes `VERSION_CONFLICT` and rolls back. `commitOnce` retries once, and only for a unique violation. Reserve maps `VERSION_CONFLICT` to `RECONCILIATION_REQUIRED`. `paymentFailure` maps an unknown code, including `VERSION_CONFLICT`, to `MISMATCH`. Neither path retries the transaction. |
| Pool | `src/lib/db.ts` constructs `PrismaClient` with no `connection_limit`. The conversational QA client is a separate `PrismaClient` in tests. Production pool size was not measured. |
| Lock wait | Interactive transactions use Read Committed, `maxWait` 15 seconds, and `timeout` 20 seconds. The adapter does not set `lock_timeout` or `idle_in_transaction_session_timeout`. A blocked `FOR UPDATE` waits inside that 20 second budget. |
| Crash recovery | The inflight envelope and `PENDING_RESOLUTION` are covered by unit tests and the disposable QA suite. Nothing pages an operator when a row stays pending. |
| Claim conflict side effect | M2.1B was accepted with atomic rollback closed for `runAtomic`. Claim SQL still runs in its own transaction. A staging test must show that `IDEMPOTENCY_CONFLICT` leaves no extra `CcTransaction`. This review did not re-run that case. |
| Enumeration | List and resolve paths are tenant-scoped in the port. There is no public directory of tenants in this module. A future route must keep using the actor's tenant and must not accept a tenant id from the query string as authority. |
| YOLA FUN | NO-GO. Do not create a tenant, product, connection, or flag for it. |

QA evidence that does pass, and does not remove the blockers above: unit tests 154, service 17, catalog-import 3, catalog-bidirectional 1, slice 2.5 `applied=39` with `CcBooking` absent, persistence 11, workers 11, cross-module 11, on CI run 40262845004.

## 6. Rollback and recovery

| Situation | Action |
|---|---|
| Migrate did not start | Keep the previous image. No database restore. |
| Staging migrate applied an approved additive catalog column and every switch is unset | Leave the column. Point the app back at the previous image if the app must return to the old code. The column is unused while the switch is unset. |
| Staging migrate applied `Cc*` tables or `CommerceOrder` without a written approval for that folder | Restore the dump taken immediately before the command. Do not drop the tables by hand. |
| Checksum or history mismatch | The preflight is NO-GO before any migration command. Do not treat exit 0 from `migrate deploy` or `migrate status` as a match. Do not `migrate resolve`. |
| A conversational write returns a failure or throws | The QA adapter rolls the transaction back, including a connection insert performed inside `runAtomic`. The caller receives the same `PortResult` for a returned failure. |
| Process crash after the provider may have committed | The transaction stays `PENDING_RESOLUTION` with the inflight envelope. Recovery uses the original provider, location, and request hash. A second create is not authorized by the crash. |
| Deadlock | The transaction rolls back. The caller gets `VERSION_CONFLICT`, then `RECONCILIATION_REQUIRED` on reserve or `MISMATCH` on the payment failure mapper. An operator retries the business operation. The code does not loop. |
| Production | No production rollback is authorized. The 23 October pre-commerce image tag is not the rollback target for a later staging drill. |

## 7. Staging acceptance matrix

Run these only after a staging implementation is separately approved. This matrix has 20 checks. Every check is **NOT RUN**.

| Check | Pass when |
|---|---|
| History match | The operator's six `_prisma_migrations` columns match the approved folder inventory. Every checksum equals the SHA-256 of that `migration.sql`. No unfinished, rolled-back, or unexpected row. `migrate status` is not the proof. |
| Boot does not migrate | App start with the gate unset leaves `_prisma_migrations` unchanged. |
| Approved migrate | The approved command adds only the folders named in that approval. |
| Restore drill | A second empty instance restored from the pre-migrate dump returns the same migration names. |
| Switches | All eight commerce switches above are unset. A catalog read does not call Graph. |
| Conversational route | No new HTTP route serves reserve, payment, or webhook. |
| Flags | No conversational flag is `true`. |
| Pool | `connection_limit` is set. Worker count times that limit is below the staging `max_connections` with at least 5 connections spare. |
| Lock budget | A blocked row lock ends inside 20 seconds with a rollback and no committed partial write. |
| Atomic failure | Registering a new connection inside `runAtomic`, then returning `{ ok: false }`, leaves zero new rows. A thrown error does the same. A successful callback commits the connection. |
| Two workers | One idempotency key, one booking, one provider call. One payment attempt, one capture amount. One webhook id, one row. |
| Idempotency conflict | A different request hash returns `IDEMPOTENCY_CONFLICT` and does not add a `CcTransaction`. |
| Pending backlog | The 15 minute `PENDING_RESOLUTION` query is defined and returns a number. |
| Crash | Kill the process after a provider timeout. A new process adopts one booking on the original transaction. |
| Tenant isolation | Tenant B cannot read tenant A's booking, payment, or connection. |
| Archive | An archived tenant cannot log in. `Cc*` row counts for that tenant stay the same. |
| Erasure | Touchpoint click identifiers become null. The ledger amount stays. |
| Logs | A forced error line does not contain `postgres://` credentials or a raw phone number. |
| Health | The process check fails when the database is unreachable. |
| YOLA FUN | No tenant, product, connection, or flag exists for that pilot. |

## 8. Release sequence

1. Accept or reject this review. No deploy follows from acceptance.
2. The operator exports the six `_prisma_migrations` columns with their own credentials. Do not send those credentials to an agent. If the export is not supplied, stop.
3. In a later PR, put the two inbox folders into git only when their SHA-256 values match the operator's `checksum` column. Do not edit applied history.
4. In that same or a following PR, make application boot skip `migrate deploy` unless an explicit gate is `true`. Default is off.
5. Decide the catalog folders and the conversational folders as separate approvals. An image must contain only the approved folders.
6. Create the staging instance from section 3. Run the backup and restore drill. Then run the approved migrate command. Then run section 7.
7. Leave the result on staging. Production rollout is a further approval and is not implied by a green staging matrix.
8. A booking-provider sandbox waits until staging acceptance passes and a provider contract is signed. It is not part of step 6.

## 9. Commercial pilot dependencies

A first booking sandbox needs all of the following before any merchant is connected. This review does not connect a provider.

| Requirement | What the contract already requires |
|---|---|
| Official booking and availability API | A documented hold or create. `getAvailability` is not a reservation. The mock returns only slots the caller supplied. |
| Authoritative booking reference | External `CONFIRMED` or `HELD` needs a provider reference. A blank reference stays `PENDING_RESOLUTION`. |
| Lookup and cancellation | `findByIdempotencyKey` on the original provider. Cancellation does not refund. |
| Provider idempotency | Same key and hash replays. Same key and a different hash conflicts. `guaranteesIdempotency` is a documented provider promise, not an assumption. |
| Absence rule | An empty lookup authorizes one later create only when that same provider's documented absence rule is satisfied. Another provider cannot prove absence. |
| Webhook verification | No HTTP route exists. A later route must verify the provider signature. The in-process payment HMAC is not that signature. Tenant comes from the connection. |
| Merchant ownership | The merchant system owns capacity and shopper funds. AtlasNow stores the orchestration record. AtlasNow is not the merchant of record. |
| Meta policy | `merchantEligibility` must be `ELIGIBLE`. The offering category must be allowed for the surface. Approval evidence is `META_COMMERCE_POLICY`, `VERIFIED`, with a non-blank reference and a matching attestation. Chat is not a transaction surface. A Flow submission does not confirm a booking. Unknown eligibility fails closed. |

YOLA FUN remains NO-GO. Do not onboard that merchant for transactional WhatsApp commerce from this work.

## 10. GO / NO-GO

**NO-GO** for the later staging implementation.

The QA adapter at `df3e7f2` can stay the foundation. Staging work starts only after the operator's migration metadata passes the preflight and application startup no longer runs `migrate deploy`. Production rollout is not authorized.
