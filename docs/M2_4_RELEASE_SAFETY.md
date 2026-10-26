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

## Provenance trust model

The operator command does not accept `--git-sha` as proof. A manifest value and a caller argument that repeat the same SHA fail closed.

The source commit is the `sourceRepositoryDigest` field on the Sigstore certificate returned by `gh attestation verify`. That field is copied from GitHub's OIDC token. The SLSA predicate is not the source of the commit. The artifact digest is the SHA-256 of the canonical file list inside the packaged directory, and `gh` checks that digest against the attestation subject.

Pinned build identity:

- Repository `https://github.com/joefebrian/atlasnow`, numeric id `1373362968`
- OIDC issuer `https://token.actions.githubusercontent.com`
- Signer workflow `.github/workflows/release-provenance.yml`
- Runner environment `github-hosted`

Missing, unverifiable, or mismatched provenance fails closed. A successful GitHub Actions conclusion is not an input and is not a deployment approval.

`scripts/release-provenance.workflow.yml` is the workflow text. It runs only by `workflow_dispatch`, and only when the typed SHA equals the selected run commit. It does not run on pull requests. It is not installed under `.github/workflows/`. The session token has scopes `gist`, `read:org`, and `repo`, and no `workflow` scope. Until that file is installed and GitHub signs an attestation, the operator command has no bundle it can accept. Local Ed25519 fixtures exercise the same binding rules and are rejected by the operator command.

## Package and image

The attestation subject is `atlasnow-migration-artifact.json`. That file lists the packaged entrypoint and the migration SQL bytes. A signature over that file is migration-package provenance. It is not proof of a Docker image digest, image config, or the rest of the filesystem.

The minimum later check, after an image exists and before any registry push, is to copy `/docker-entrypoint.sh` and `/app/prisma/migrations` out of that image, recompute the canonical digest, and require it to equal the attested package digest. A second attestation would have to name the image manifest digest as its own subject. Neither check has a signed GitHub bundle yet. `.dockerignore` excludes the three tracked pending folders from the build context. An image that still contains one of them fails preflight.

## Preflight

`node scripts/migration-preflight.mjs --manifest <file> --artifact <packaged-dir> --history <json-or-csv> --attestation <bundle>`

`--artifact` is the packaged root. It contains `docker-entrypoint.sh` and `prisma/migrations/<name>/migration.sql`. The program hashes those bytes. It does not read the developer checkout unless that checkout is passed as the artifact. `--git-sha`, when present, is rejected unless it equals the certificate commit, and that equality still does not pass by itself.

The history file has `migration_name`, `checksum`, `started_at`, `finished_at`, `rolled_back_at`, and `applied_steps_count`. The program does not call Prisma. A Prisma exit code is not an input.

It fails closed when provenance is missing or untrusted, the certificate repository, id, issuer, workflow, or runner disagrees, the artifact digest disagrees, `approvedGitSha` is empty or differs from the certificate commit, the packaged entrypoint would migrate, a folder or checksum disagrees, a history row is missing, duplicated, unfinished, or rolled back, or a folder is not in `applied` or `approvedPending`.

## Future migration artifact

1. Install `scripts/release-provenance.workflow.yml` at `.github/workflows/release-provenance.yml` from the GitHub website. Do not merge this pull request to do it. The Actions button lists the workflow only after the file also exists on the default branch.
2. Build the artifact with `node scripts/release-artifact.mjs --manifest <file> --source prisma/migrations --entrypoint deploy/docker-entrypoint.sh --out <dir>`. The command copies `applied` and `approvedPending` only.
3. Let that workflow attest `atlasnow-migration-artifact.json`. The attested digest is the immutable artifact digest.
4. Record `approvedGitSha` in a later approval manifest as the certificate commit of that artifact. The attested commit does not need to contain its own SHA.
5. Run the preflight against the packaged directory, the approval manifest, a fresh six-column history file, and the attestation bundle.
6. Start the app only when the preflight exits 0. Do not migrate during boot.

`.dockerignore` excludes the three tracked pending folders from the image build context. An image that still contains one of them fails preflight. The committed Dockerfile copies `deploy/docker-entrypoint.sh` to `/docker-entrypoint.sh` and sets that path as `ENTRYPOINT`. This entrypoint is not deployed.

## Remaining blockers

- No release SHA is pinned. `approvedGitSha` remains null.
- The signer workflow is not installed, so no GitHub attestation exists for an AtlasNow migration artifact.
- Import and feed were applied without a recorded approval in the older release notes.
- The three pending folders remain in git and are not approved to apply.
- The running production process was not restarted and still has the previous entrypoint.
- Staging does not exist.
- A local test and a green Actions run are not production release approvals.
