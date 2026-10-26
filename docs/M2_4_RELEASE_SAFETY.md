# M2.4 release safety

Status: **local remediation.** Built on the M2.3 procedure `9881e352c5536854bd6e5dbb4fe20f4403ffc505`. This change does not connect to production, does not deploy, and does not edit applied SQL.

Staging implementation: **NO-GO**. Production rollout: **NO-GO**. YOLA FUN stays NO-GO.

## Verified production state

A founder-authorized read-only check observed:

- 39 finished `_prisma_migrations` rows. Each has a start, a finish, an empty `rolled_back_at`, and `applied_steps_count` 1.
- The same 39 `migration.sql` files in the image that was running then, with the same SHA-256 values.
- The 35 git folders through `20261024100000_commerce_batch_poll` match those checksums.
- No duplicate, unfinished, rolled-back, or checksum-mismatched row was reported.

The 2026-10-23 document that says production has 37 migrations is **incorrect**. The count 39 in `docs/TRANSACTION_ORCHESTRATOR_ARCHITECTURE.md` was a disposable test count. The later read found 39 rows for a different reason: the 35 baseline folders, the two inbox folders, plus catalog import and catalog feed.

This file does not store the production CSV or server timestamps.

## Unknown historical authorization

These two rows were applied on 2026-10-25. Their checksums match git. This review does not treat that application as an approval that existed beforehand:

- `20261024200000_commerce_catalog_import`
- `20261024220000_commerce_catalog_feed`

`scripts/migration-manifest.json` marks both `applied_authorization_unknown`. They stay in the verified applied set because the database and the running image already contain them.

## Source control

The two inbox folders are restored from the local SQL copies whose SHA-256 values equal the observed production checksums:

| Folder | SHA-256 |
|---|---|
| `20261004120000_wa_message_image` | `4b976d08e35a360d8abcc7be696b2fa51fc7d7894efd230a1ea0b82dae5d8163` |
| `20261004143000_inbox_image_retention` | `d84e9881c254e2164e649caabedbec078640d968051cef578e1406edef2dae32` |

The SQL bytes are unchanged. `schema.prisma` is unchanged.

## Pending folders

These three stay in git and are not approved to apply:

- `20261024180000_commerce_orders`
- `20261026120000_cc_location_tenant_key`
- `20261026140000_cc_persistence`

The manifest lists them as `trackedPending`. `approvedPending` is empty. `approvedGitSha` is null, so the preflight fails closed on this tree.

## Boot

`deploy/docker-entrypoint.sh` starts `node server.js` and does not run Prisma. `NODE_ENV=production` and `ATLASNOW_MIGRATE_ON_BOOT` do not turn migration back on. There is no fallback. This entrypoint is not deployed.

A migration remains a separate operator command. It is allowed only after a written approval and a preflight exit 0.

## Preflight

`node scripts/migration-preflight.mjs --manifest <file> --migrations <dir> --history <json-or-csv> --git-sha <sha>`

The history file has `migration_name`, `checksum`, `started_at`, `finished_at`, `rolled_back_at`, and `applied_steps_count`. The program reads that file and the SQL bytes. It does not call `migrate deploy`, `migrate status`, `migrate resolve`, or `db push`, and a successful Prisma exit code is not an input.

It fails closed when the manifest SHA is empty or different, a folder or checksum disagrees, a history row is missing, duplicated, unfinished, or rolled back, or a folder is not in `applied` or `approvedPending`.

## Future migration artifact

1. Pin `approvedGitSha` to the exact commit being released.
2. Copy only the `applied` folders into the image.
3. Copy an `approvedPending` folder only after a separate approval adds that one name and its checksum to `approvedPending`.
4. Leave `trackedPending` out of the image until that approval.
5. Run the preflight against the image directory and a fresh six-column history file.
6. Start the app only when the preflight exits 0. Do not migrate during boot.

## Remaining blockers

- No release SHA is pinned.
- Import and feed were applied without a recorded approval in the older release notes.
- The three pending folders are still in this branch. A boot that migrates would apply them. This PR removes that boot behavior and does not deploy it.
- The running production process was not restarted and still has the previous entrypoint until a later deployment, which is not authorized.
- Staging does not exist.
