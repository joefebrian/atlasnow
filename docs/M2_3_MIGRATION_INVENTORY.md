# M2.3 production migration inventory verification

Status: **procedure only.** Accepted M2.2 review `6efaa659a14c2f3712d9b6f2dc0d9dfde235d48e`. This document does not open production, does not read a credential, and does not apply a migration.

Recommendation: **NO-GO** for staging and production. The production `_prisma_migrations` export has not been supplied. Wait for that export.

## 1. Scorecard

| Area | Result | Evidence |
|---|---|---|
| Clean git inventory at `6efaa659` | PASS | 40 `migration.sql` files plus `migration_lock.toml` (`provider = "postgresql"`). Counted from `git ls-tree` of that commit. |
| SHA-256 of those 40 files | PASS | Computed from the git blobs. The dirty working tree was not hashed. |
| Documented production environment | PASS as a document | `deploy/README.md` and `compose.yaml`: Biznet VPS, `/opt/atlasnow`, compose project `atlasnow`, service `postgres`, Postgres 16, app `https://atlasnow.co`. Port 5432 is documented as closed to the internet. |
| Live host still matches that document | NOT VERIFIED | This session did not log in to the VPS. |
| Authorized operator | PASS as identification | The founder who already administers that VPS. This document does not authorize a login or a query. |
| Production six-column export | NOT VERIFIED | No production client was opened. No dump was taken. |
| Two inbox folders applied in production | NOT VERIFIED | Older docs name them. That is not a census. |
| Approved checksum for the two inbox folders | BLOCKED | Neither folder is in commit `6efaa659`. |
| Five later folders pending on production | NOT VERIFIED | They are in git. Their production rows were not read. |
| Row-by-row comparison | NOT RUN | It starts only after the operator supplies the CSV. |
| Staging and production rollout | NO-GO | Unchanged from M2.2. |
| YOLA FUN | NO-GO | No onboarding. |

## 2. Operator

The authorized operator is the founder who administers the Biznet VPS documented in `deploy/README.md`. No second operator is named in the repo.

This file is not permission to connect. Production access still needs a separate explicit authorization. When that authorization exists, the founder runs the commands below on the production host. An agent does not receive the shell, `.env`, `DATABASE_URL`, a password, or a tunnel.

The laptop Postgres on port 5433 is not this target. Do not point these commands at it.

## 3. Operator execution

Run this only after a separate authorization, and only on the production host. Do not copy `.env`. Do not print a password, a database URL, or a container environment.

Do not rebuild, recreate, restart, or stop any service. The committed entrypoint at `6efaa659` runs `prisma migrate deploy` before `node server.js`. A recreate can apply every folder baked into that image.

Forbidden on this visit: `docker compose config`, `docker inspect`, `prisma migrate deploy`, `prisma migrate status`, `prisma migrate resolve`, `prisma db push`, `prisma migrate dev`, `pg_dump`, `pg_dumpall`, any write SQL, and any `SELECT` from a table other than `_prisma_migrations`.

### 3.1 Confirm the compose project

The documented deployment is compose project `atlasnow` at `/opt/atlasnow`. `compose.yaml` declares `postgres` image `postgres:16-alpine`, `waha` image `devlikeapro/waha:latest`, and `caddy` image `caddy:2-alpine`. `atlas` is the locally built application image: that service has `build` and no `image` key. `caddy` publishes host ports 80 and 443. `postgres`, `waha`, and `atlas` publish no host port. The public app is `https://atlasnow.co`.

```sh
cd /opt/atlasnow
pwd
docker compose ls
docker compose ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

Expected `pwd`: `/opt/atlasnow`.

Expected `docker compose ls`: one row named `atlasnow`, status running, config file under `/opt/atlasnow/compose.yaml`.

Expected `docker compose ps`: four running services. Compare each reported Image value with the Compose image named in this table. A shorter tag is not a match.

| Service | Documented Compose image | Ports |
|---|---|---|
| `postgres` | `postgres:16-alpine` | empty |
| `waha` | `devlikeapro/waha:latest` | empty |
| `atlas` | locally built application image; project `atlasnow` reports `atlasnow-atlas` or `atlasnow-atlas:latest` | empty |
| `caddy` | `caddy:2-alpine` | `80` and `443` |

`atlas` has no `image` key in `compose.yaml`. Any other `atlas` repository, registry, or tag is a difference.

STOP when the directory, project name, config path, a service, a reported image, or a port does not match. Record the service, the reported image, and the documented image. Do not treat the difference as acceptable. Do not retag, pull, edit, restart, recreate, or otherwise change a running service. Do not run the later commands. Do not search for another directory.

### 3.2 Database metadata

`docker compose exec` does not restart the service. `-U "$POSTGRES_USER"` and `-d "$POSTGRES_DB"` select the role and database already set inside the `postgres` container. The host shell does not expand those variables. The command does not print them. If either name is empty, `psql` fails. STOP. Do not type a role, a database name, or a URL.

```sh
docker compose exec -T postgres \
  sh -c 'psql --csv -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count FROM \"_prisma_migrations\" ORDER BY started_at;"'
```

Expected output is CSV and nothing else. The first line is:

```text
migration_name,checksum,started_at,finished_at,rolled_back_at,applied_steps_count
```

Each later line is one migration. `checksum` is 64 hexadecimal characters when it is a SHA-256. `rolled_back_at` is empty when the migration was not rolled back. The row count is unknown until this file exists. A written count of 37 or 39 is not the expected row count. There is no application column and no customer column.

Save the CSV outside the git checkout. Do not commit it.

### 3.3 Current image filenames and checksums

`WORKDIR /app` in the committed Dockerfile places Prisma files at `/app/prisma`. These commands read the migration files inside the image that is running now. They do not describe the next deployment. A later deployment is built from a git commit chosen at that time, and its folder list can differ. The host checkout at `/opt/atlasnow` can differ from both.

```sh
docker compose exec -T atlas sh -c 'find prisma/migrations -name migration.sql | sort'
docker compose exec -T atlas sh -c 'find prisma/migrations -name migration.sql -print0 | sort -z | xargs -0 sha256sum'
```

Expected filename list: one relative path per line, sorted, each ending in `/migration.sql`. No SQL text.

Expected checksum list: one line per file. Each line is 64 hexadecimal characters, two spaces, then the same relative path. `sha256sum` prints the hash of the file. It does not print the file.

An empty filename list means the running image has no `migration.sql` at that path. Record that empty result and STOP. Do not create a file in the container.

### 3.4 What may be shared

A later review may receive only these three texts:

1. The CSV from section 3.2.
2. The filename list from section 3.3.
3. The `sha256sum` list from section 3.3.

Before sending, read them. They must not contain `postgres://`, `postgresql://`, `PASSWORD`, `SECRET`, `.env` lines, or SQL statements. If they do, do not send them.

Do not send `.env`, a database URL, `docker compose config`, `docker inspect`, container logs, a dump, `migration.sql` contents, or any application or customer row.

## 4. Expected inventory

### 4.1 What git contains

Commit `6efaa659a14c2f3712d9b6f2dc0d9dfde235d48e` contains these 40 folders. The checksum is the lowercase SHA-256 of the raw `migration.sql` blob. Byte size is the blob size.

| migration_name | Bytes | SHA-256 |
|---|---:|---|
| `20260819120000_init_postgres` | 16265 | `2bd28bc573bcced69601e48a73fc9c4c253d422c09aec78e6a70a80877ee8cba` |
| `20260821120000_review_source_type` | 213 | `e749119521976f29d7adcde9cc09394cc785c240dda0bd8f8c7d28c070a890a5` |
| `20260821180000_site_pages_contact` | 1239 | `4be5b15df952968b72df952ea989be3cc6427ce1b8108d9382b488499ae08356` |
| `20260821190000_site_social_json` | 73 | `ba3f851ddced04e231f3b4c37209c09e65843f3102ed82a9c1542a5ed1b536d2` |
| `20260821193000_site_faq_json` | 70 | `0a5c1c8a21d9b76838e65710f5b2f5145ae8184ab15e221045408defb89bdb9a` |
| `20260824120000_user_signup_terms` | 231 | `d8c26240b2616d9e00ed6cbc1cab4308f5838c32eecc7f4174e3c6063607b9e7` |
| `20260824140000_multi_agency_tenancy` | 1608 | `9b5c6e508988ac882cdb8911400818e59c1156531ae0fab6d7724b0f576e97df` |
| `20260824160000_activity_notices` | 665 | `12e5b63c601e3e33015dd4fc53f1e7435601ed817f55636ca5ce67cfccb003a2` |
| `20260825180000_location_kind_hq` | 218 | `f03fd676aa5e54581b14b56cdb7f65ee611f8fed6bf8c282f9321b0fea26a10e` |
| `20260825190000_loyalty` | 4207 | `cc2271ae9536da4f7a294eac5a0fed78dc3404516bd2fa377b7331b8226217e2` |
| `20260825200000_loyalty_tiers` | 784 | `39f31d98b30c45964e545b4c68fbf77fb0f41c76339b3c97f23e4a7b0b10aae3` |
| `20260825210000_loyalty_members` | 1639 | `de8f43db64f442a014607c7995b723b0859d6696d1deb3bcae41b690fb2a5ec1` |
| `20260827120000_loyalty_wa_replies` | 98 | `7dcfc2867ff62dd091276addebeafd45cd83d37f7971e67ee1803ef23ba00865` |
| `20260827140000_loyalty_stamp_card_image` | 174 | `ee794fc35f4d7e4458996718d302c70a3d82ab0d15b0178c7654de80e208e004` |
| `20260827160000_tenant_brand_logo` | 148 | `92f65bdc590041c5ac6511b47164f1ac54e779274cc7fcbcf937864fd67e3e33` |
| `20260827180000_member_domicile` | 176 | `ff5f26d6ba81dbeb973dfae76b3f1a46ad54f74e592b20e1db20e35d7c276fb2` |
| `20260827210000_broadcast_fee_config` | 704 | `6fa05c2a6188c9289eb86dfef7f3ecbb61502bc24559024f094408a1466d3a69` |
| `20260827230000_role_menu_branch_location` | 980 | `adda0c6c22e2c203d23b3c70faf7cdcea2ecf2d4affcb94433981fdedda5121e` |
| `20260828120000_receipt_photo_ocr` | 333 | `51dc1f947cde29561ef193877ea48661042b8a44dbcf1922317cd71c534bc627` |
| `20260828140000_guest_receipt_upload` | 107 | `8a828948ea16b048803b72b3f8c64bee6d19e4b4e7978fc063e6468f564255f6` |
| `20260829120000_loyalty_point_exclusive` | 363 | `395d286cc782b010d44fcd36b97098f5845a4de0acceaeb8042c7bc0cd993659` |
| `20260901120000_birthday_wa_send` | 949 | `09d4f359f941bd51c27fa6db6bfd91fa59c63379a28b1ba5f1fa94440b0c7d38` |
| `20260901140000_birthday_voucher_code` | 292 | `a5aa97a9f97599f84bce425d3982b5703c1cfe6f2c01bad9e754ed7942991433` |
| `20260901160000_birthday_voucher_style` | 474 | `f4a5b6a260663539470a6e3fc8e8b8750e4a516e423da11fef97f40a027b0614` |
| `20260901200000_support_helpdesk` | 2650 | `7f2af55d0a6d24401db3649d320db758b5f6fa29c7413f2a501ed09f7b23bac6` |
| `20260902120000_broadcast_meta_history` | 1970 | `2d6eab3a546ffba646896b23b4f3349519e38e8e7bc9870888a32afb28a75c10` |
| `20260902180000_tiktok_go_events` | 1081 | `f0332b5bba2953c78f26bbc17d742fdbe12d692d29ed39c020be1a4b7dd51150` |
| `20260906120000_waba_service_quota` | 2708 | `045ffbbfffb556e32b92f4b819b066be5d6975d244c59d84650519d73c06d330` |
| `20260909120000_tenant_plan` | 380 | `17b506bf89631377c33ea3353c5b4c642e55f38b53b97e76ee9714bb9d27d25a` |
| `20260911180000_review_capture` | 1047 | `c4d58ea7727801992ccaf5a9a56b4e009672307929b467a6b5599df7ae4c143b` |
| `20261023120000_commerce_products` | 5906 | `f4d0beab120321370f74b9ae5de31958534d5c377f21e55ce2ac85a6621bab12` |
| `20261023180000_commerce_image_sku` | 426 | `d701a4747cd66988508199d5642ade9c5ae6f4332399f2edaad1039e94502b47` |
| `20261023210000_commerce_catalog_connection` | 4344 | `27aeb25ec5d5a2a9cccc824d8bde7a80883510ae26bcdbce47d2ede0ece4d03a` |
| `20261023233000_commerce_sync_hardening` | 1190 | `8e2dd93a16b2dbdf077c5b64d5b97a1ddf001dd599175cd26ba5c1a361b88c8f` |
| `20261024100000_commerce_batch_poll` | 738 | `e9a5df0cf50c7701dd2ffd11f18147cdd8fc6c08c2cd09c7d16c750cbf6ded71` |
| `20261024180000_commerce_orders` | 2627 | `36fb63f76b0101d8ce28eeecf7f9f6e0e8eaf6961e44e5ec41596cb40692b82e` |
| `20261024200000_commerce_catalog_import` | 204 | `a76b86a739c9621706cade51dc3dad2f3592a926ddb491b3a39df1de08c84326` |
| `20261024220000_commerce_catalog_feed` | 335 | `f0e5bf21b219a547107fc5997b177547f82e551a1c6caad08c06cb585b663fce` |
| `20261026120000_cc_location_tenant_key` | 93 | `cea4b5c877ead3830d4830cb1f8dd1f649eb7eb7662ca5aae193be5ef3da402a` |
| `20261026140000_cc_persistence` | 17627 | `b38e2d43b739f797f8c7dc957f44b9ea76f0b87501b328ba23d1a7db78b62f21` |

The first 35 names, through `20261024100000_commerce_batch_poll`, are the git portion of the 2026-10-23 document. The last five are in git and are outside that document.

### 4.2 Two inbox names, no approved file

These names are in `docs/COMMERCE_SLICE_2_5_RELEASE.md` and are absent from `6efaa659`:

- `20261004120000_wa_message_image`
- `20261004143000_inbox_image_retention`

There is no approved SHA-256 for either file. Working-tree copies and the hashes printed in `docs/M2_2_RELEASE_READINESS.md` are not the approved inventory. Do not use them as the expected checksum.

### 4.3 Five later folders

These five are in the table above. A production row for any of them is outside the 2026-10-23 document. Absence from a future export would show they are not applied. Presence would show they were applied without this review's approval. Neither fact is known today.

| migration_name | In clean git | Approved for production boot |
|---|---|---|
| `20261024180000_commerce_orders` | Yes | No |
| `20261024200000_commerce_catalog_import` | Yes | No |
| `20261024220000_commerce_catalog_feed` | Yes | No |
| `20261026120000_cc_location_tenant_key` | Yes | No |
| `20261026140000_cc_persistence` | Yes | No |

### 4.4 Documented production shape, not evidence

`docs/COMMERCE_SLICE_2_5_RELEASE.md`, `docs/COMMERCE_CATALOG_BIDIRECTIONAL.md`, `docs/AI_DEV_STATUS.md`, and `docs/CONVERSATIONAL_COMMERCE_M2_SCHEMA_REVIEW.md` say production has 37 finished migrations: the 35 git folders through batch poll, plus the two inbox names, and none of the five later folders.

`docs/TRANSACTION_ORCHESTRATOR_ARCHITECTURE.md` says 39. That number is the disposable Slice 2.5 test count, not a live census.

Neither number is verified production evidence. The comparison below uses the 37-name document only as the hypothesis to test. It does not assume the hypothesis is true.

## 5. Offline comparison

Use commit `6efaa659` through git, not a dirty working tree. For each `migration.sql`:

```sh
blob=$(git rev-parse 6efaa659a14c2f3712d9b6f2dc0d9dfde235d48e:prisma/migrations/NAME/migration.sql)
git cat-file blob "$blob" | shasum -a 256
```

Section 4 is that result for all 40 names. Repeat it for any later commit before comparing. `prisma migrate status` is not the comparison.

When the operator's CSV arrives, join on `migration_name`. Classify every CSV row and every name in the union of the 40 git folders plus the two inbox names.

| Condition | Class |
|---|---|
| `started_at` is null, `finished_at` is null, `rolled_back_at` is not null, or `applied_steps_count` is not 1 | INCOMPLETE. BLOCKED. |
| Duplicate `migration_name` | DUPLICATE. BLOCKED. |
| Name is one of the first 35, and `checksum` equals section 4 | MATCH. |
| Name is one of the 40, and `checksum` differs from section 4 | CHECKSUM_MISMATCH. BLOCKED. |
| Name is one of the first 35 and is absent from the CSV | MISSING_HISTORY. BLOCKED. |
| Name is an inbox name and the CSV checksum equals the current-image SHA-256 from section 3.3 | FILE_MATCH. The bytes are still not in git. BLOCKED for a release until a later approval adds those exact bytes. |
| Name is an inbox name and the CSV checksum differs from the image file, or the image file is absent | INBOX_CHECKSUM_UNRESOLVED. BLOCKED. |
| Name is an inbox name and is absent from the CSV | INBOX_ABSENT. The 2026-10-23 claim is contradicted. BLOCKED. |
| Name is one of the five later folders and is absent from the CSV | ABSENT_PENDING. Confirmed not applied. Still BLOCKED for any boot image that contains the folder. |
| Name is one of the five later folders and is present | UNAPPROVED_APPLIED. BLOCKED, even when the checksum matches section 4. |
| Any other CSV name | UNEXPECTED. BLOCKED. |
| Empty CSV | BLOCKED. |

One BLOCKED class fails the inventory. MATCH on the 35 folders does not pass the release by itself.

The section 3.3 `sha256sum` list describes the image that is running now. It is not the folder list of the next deployment. A folder in that current image and absent from the approved set is a boot hazard for a recreate of this image, because `migrate deploy` applies pending folders. The M2.2 disposable probe showed that a missing applied folder does not stop that command.

## 6. Unresolved discrepancies

These are open now. They are not production results.

1. The six-column production export does not exist. Every production row is NOT VERIFIED.
2. The two inbox folders have no file in `6efaa659`, so no approved checksum exists. BLOCKED.
3. Older documents say those two folders are already applied. That statement was not re-read from `_prisma_migrations`. NOT VERIFIED.
4. The five later folders are in git. Whether production has a row for them is NOT VERIFIED. They stay unapproved for boot.
5. The written counts 37 and 39 disagree. Neither count was taken from production in this session.
6. `docs/COMMERCE_SLICE_2_5_RELEASE.md` still says a missing inbox folder makes `migrate deploy` stop. The M2.2 probe showed the opposite. That sentence is not a control.
7. The committed entrypoint still migrates on boot. This procedure does not change it.
8. The live VPS path, compose project, and current image's `/app/prisma/migrations` contents were not inspected. The operator stops when they do not match section 3.1.

## 7. Stop

Do not connect to production from an agent session. Do not dump the database. Do not migrate. Do not edit `schema.prisma`. Do not edit Docker. Do not deploy staging. Do not merge. Do not onboard YOLA FUN.

The next review starts when the founder supplies the three texts from section 3.4. Staging and production stay NO-GO.
