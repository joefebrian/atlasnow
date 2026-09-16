# Multi-agency tenancy — Super Admin, Agency, standalone brand

Date: 2026-08-24  
Repo: AtlasNow  
Status: product design approved in chat (sections 1, 1b, 2, 4). Section 3 (change log + WhatsApp-disconnect notifications) **parked** for a later phase.  
Obsidian PRD: `02 Projects/atlasnow/AtlasNow-PRD.md` §4.3 (v1.2.0)

## Problem

Today `SUPER_ADMIN` and `ANALYST` are both `isAgencyStaff`. That flag dumps **every** `CLIENT` tenant into Brands, Follow-up, Inbox, Reviews, Outlets. There is one operator workspace (`p2p-labs`). Self-serve signup creates an orphan brand that the same operators all see.

That does not match the product:

- **atlasnow.co Super Admin** manages **many agencies** and can also run **P2P’s own brands**.
- **An agency** manages **only the brands it registered**.
- **A standalone brand** is one merk, not a fake agency. It can **apply** to become an agency (first merk stays itself). Super Admin does **not** attach a brand to someone else’s agency.
- Monetization (later): charge **per merk** + **WhatsApp number**, subscribe **by feature**. Not in this build.

## Locked decisions

| Topic | Choice |
|---|---|
| Data shape | Approach **1**: keep `Tenant.type` `AGENCY` \| `CLIENT`. Brand gets optional `agencyId` (null = standalone). |
| Super Admin hats | **One login**. Switcher: **Platform** / **P2P agency** / **any other agency** (enter that workspace). Not a second account. |
| Super Admin in an agency | Same screens as that agency’s admin. Edits are in context. (Actor attribution in audit is phase 3.) |
| Agency isolation | Agency 1 cannot list, open, or edit Agency 2, its brands, or someone else’s standalone brand. Platform-only. |
| Standalone brand | Independent `CLIENT`, `agencyId = null`. No Brands / Follow-up / Pitch menu. |
| Upgrade | Brand **applies**. Super Admin **approves**. New `AGENCY` tenant created; existing brand keeps id/locations/chats; `agencyId` set; user becomes agency admin. Later monetization may auto-approve. Rejection = stay standalone. |
| Super Admin does not | Move a standalone brand under another agency. |
| Signup doors | Public `/signup`: **One brand** or **Agency**. Terms required. Login **off** until follow-up. Pending page, not dashboard. |
| Who turns login on | Platform follow-up: new agency, standalone brand, upgrade request. Agency follow-up: brands **under that agency** only. Super Admin inside an agency can do that agency’s follow-up. |
| Existing VPS data | `p2p-labs` = **P2P agency**. Current clients = **P2P’s brands** (`agencyId = p2p-labs`), not standalone. New self-serve after this ships = standalone. |
| Monetization | Parked. PRD note only: per merk + WhatsApp number, feature subscription, upgrade auto-approve after pay. No prices, invoices, paywall in this build. |
| Change log + WA disconnect notif | **Phase 2** (section 3). Do not block tenancy. Existing `AuditEvent` stays as-is. |

## Out of scope (this build)

- Per-agency activity log UI, “who changed what” feed, WhatsApp-session-drop notifications (phase 2).
- Billing, meters, feature flags as paywall, auto-approve upgrade on payment.
- Super Admin attaching brand A to agency B.
- Changing GBP/Meta/WAHA connector policy (still one Google agency model for P2P-operated brands unless a later spec says otherwise).
- Splitting ANALYST into per-brand assignments beyond “staff of one agency” (Analyst on P2P sees P2P brands only, not all agencies — unless Super Admin).

## Architecture

```
User.role SUPER_ADMIN ── session.mode = platform | agency:<tenantId>
                         platform → all AGENCY tenants + CLIENT where agencyId is null
                         agency:X → CLIENT where agencyId = X  (plus X itself)

Tenant AGENCY  (p2p-labs, and each approved agency)
  └── Tenant CLIENT.agencyId = that agency

Tenant CLIENT.agencyId = null   ← standalone brand
  └── apply upgrade → new AGENCY + this CLIENT.agencyId = new agency
```

Units:

1. **Ownership** — `CLIENT.agencyId` nullable FK to `AGENCY` tenant. No tree walk.
2. **Session mode** — Super Admin cookie (or session payload) carries `actAsAgencyId` or `platform`. Non–Super Admin has no platform mode.
3. **Access helpers** — replace “if isAgencyStaff then all CLIENT”. Use: platform admin in platform mode; else brands where `agencyId = current agency`; else own CLIENT.
4. **Signup / follow-up** — two create paths; loginEnabled false; queues scoped as above.
5. **Upgrade request** — row Super Admin can approve/reject; approve is transactional (agency tenant + link + membership).

### Data model (Prisma direction)

`Tenant`

- Existing fields unchanged (`type`, `loginEnabled`, `activatedAt`, `notes`, …).
- **Add** `agencyId String?` — set only when `type = CLIENT`. Null = standalone. FK `Tenant.id` where parent `type = AGENCY`.
- Index `(type, agencyId)`, `(agencyId)`.

`AgencyUpgradeRequest` (new)

- `id`, `clientId` (the standalone brand), `applicantUserId`, `status` (`PENDING` \| `APPROVED` \| `REJECTED`), `note`, timestamps, `reviewedByUserId?`, `reviewedAt?`, `agencyId?` (filled on approve).

Signup notes: keep a clear `Self-serve signup (email|google|facebook)` / agency equivalent so follow-up can label “signed up on the site”. Do not rely on notes as the ownership key — `agencyId` is the key.

Do **not** introduce `Tenant.type = PLATFORM`. Super Admin is a **user role** + session mode. `p2p-labs` stays `AGENCY`.

### Session

Extend session (JWT) with something like:

- `isPlatformAdmin` — `role === SUPER_ADMIN`
- `mode`: `platform` \| `agency`
- `tenantId` — when `mode = agency`, the agency being operated (P2P or another)
- Brand users: unchanged (`tenantType = CLIENT`, that brand)

Switcher (Super Admin only): Platform | P2P | list of other agencies. Switching sets cookie and reloads. Entering an agency uses that agency’s Brands/Follow-up/Inbox scoped to `agencyId`.

`ANALYST` on `p2p-labs`: agency staff of P2P only, **not** platform. Cannot open other agencies.

### Access (replace isAgencyStaff dump)

| Actor | List brands | List agencies | Turn on login |
|---|---|---|---|
| Super Admin, platform | Standalone only (plus agency directory, not mixed as “my brands”) | All | Standalone, new agency, upgrade |
| Super Admin, in agency X | `agencyId = X` | — | Those brands |
| Agency admin/analyst of X | `agencyId = X` | — | Those brands |
| Standalone brand user | Self | — | — |
| Brand user under an agency | Self | — | — |

Queries for locations, reviews, conversations, customers, clients API: filter through this table. **No** `if (isAgencyStaff) findMany CLIENT`.

### Signup

**One brand**

- Create `CLIENT`, `agencyId = null`, `loginEnabled = false`.
- `CLIENT_ADMIN` membership. No session. `/signup/pending`.
- Platform follow-up.

**Agency**

- Create `AGENCY`, `loginEnabled = false`. No brands yet (or none required).
- User membership on the agency as agency admin (new role **or** reuse `CLIENT_ADMIN` on AGENCY tenant — prefer a dedicated `AGENCY_ADMIN` so platform `SUPER_ADMIN` stays distinct).
- No session. `/signup/pending`.
- Platform follow-up. After login on: they add brands (`CLIENT` with `agencyId = them`). Those brands start `loginEnabled = false` until **that agency** (or Super Admin inside it) turns login on.

Google/Facebook: same pending rules as email. Existing activated user still signs in.

### Upgrade

1. Standalone brand admin, login already on, submits request.
2. Platform follow-up shows “upgrade request”.
3. Approve: create `AGENCY` (name from brand or applicant), set `CLIENT.agencyId`, add user membership on the agency, keep brand membership. Next login: agency workspace with one brand.
4. Reject: request closed, brand unchanged.

### UI (minimum)

**Platform (Super Admin)**

- Directory: agencies (waiting / active), standalone brands.
- Follow-up: new agencies, standalone signups, upgrade requests.
- Open agency → switcher to that agency.

**Agency (including Super Admin hat)**

- Existing Brands + Follow-up, scoped.
- Add brand.

**Standalone brand**

- No Brands / Follow-up / Pitch.
- Settings: **Apply to become an agency**.

**Public signup**

- Choice: one brand / agency, then today’s credentials + Terms.

### Migration

1. Add `agencyId`, backfill all existing `CLIENT` rows to `agencyId = p2p-labs` (except we have no pre-ship standalone — if a test self-serve row exists, decide: keep as P2P or null; default **P2P** so live work does not split).
2. `isAgencyStaff` callers: agency-scoped; Super Admin platform path separate.
3. Follow-up page: platform vs agency queues.

### Roles

| Role | Meaning after this |
|---|---|
| `SUPER_ADMIN` | Platform + may switch into any agency |
| `AGENCY_ADMIN` | (new) Admin of one agency |
| `ANALYST` | Staff of one agency (P2P or other), assigned that agency’s brands |
| `CLIENT_ADMIN` … `VIEWER` | Unchanged, on a brand |

Until `AGENCY_ADMIN` exists, do not treat `SUPER_ADMIN` as “agency staff who sees all clients”.

## Error / pending behaviour (already partly live)

- Signup does not set session.
- Login when `loginEnabled = false` → pending message, not dashboard.
- OAuth new user → pending page.

Keep that. Point queues at the right actor (platform vs agency).

## Testing (this build)

- Agency 1 cannot `GET /api/clients` rows of Agency 2 or standalone.
- Super Admin platform lists agencies + standalone, not “all clients in one table as mine”.
- Super Admin switch into Agency 1 sees only Agency 1 brands.
- Standalone signup → `agencyId` null, login off, platform follow-up.
- Agency signup → AGENCY tenant, login off.
- Approve upgrade → same location ids still on the brand; user opens agency home.
- Backfill: old VPS brands have `agencyId = p2p-labs`.
- Brand user still cannot open `/clients`.

No billing tests. No activity-log UI tests beyond existing audit writes if we still `writeAudit` on activate/signup.

## Phases

| Phase | Scope |
|---|---|
| **1 (this spec)** | Ownership, session mode, isolation, signup doors, follow-up split, upgrade request, Super Admin switcher, nav by workspace kind, VPS backfill |
| **2 (parked)** | Per-agency change log UI, who-changed-what, WhatsApp disconnect (and other system events) in that log and/or notification |
| **Later** | Monetization: per merk + WA number, feature subscription, auto-approve upgrade after payment |

## Open implementation notes (not product forks)

- Cookie vs extra JWT field for `mode` / `actAsAgencyId` — implementer choice; must survive refresh and not leak platform scope into agency API calls.
- Exact platform nav labels (English source: Agencies, Standalone brands, Follow-up).
- Agency signup form fields: name + contact email minimum; brands added after approval.
