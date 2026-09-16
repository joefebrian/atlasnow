# TikTok Inbox (Business Messaging) — product + design

Date: 2026-08-28  
Repo: AtlasNow  
Status: draft for Joe review. Do not implement until this spec is approved.  
Sequencing: **after Meta App Review is submitted** (Messenger + IG). Spec and todos now; production code next.

## Problem

Merchants already take customer chat on TikTok. Atlas Conversations has a `TIKTOK` provider stub and a public footer link, but **no connect, no webhook, no threads**. Those DMs live in the TikTok app, not the desk.

Wave A is Inbox CRM: one desk for HQ WhatsApp, Messenger, Instagram, and now TikTok DMs. Not ads. Not posting. Not “Login with TikTok” for staff.

## Product lock (do not drift)

| Topic | Choice |
|---|---|
| What | TikTok **Business Account DMs** in Conversations |
| Who | Other businesses (clients). Group staff can sit with a brand. |
| How many | **1..N TikTok Business accounts per brand.** Each mapped to one location. Unmapped DMs do not appear. |
| Reply | **Live Agent** — staff reply from Atlas on that same handle. Not a bot. Not Human Agent / 7-day tags. |
| Identity | TikTok `open_id` is **not a phone**. Never invent digits. `providerTreatsPeerAsPhone("TIKTOK") === false` already. |
| Mix IDs | Never store a TikTok id as a WhatsApp number or Facebook PSID. |
| Official API only | TikTok API for Business — Business Messaging. No unofficial scrape, no “login as the app”. |
| Out | Organic post, Spark ads, LIVE comments as inbox, Login-with-TikTok for Atlas staff, CSV blast, fake visits/leads/revenue |
| Copy | Merchant-plain. Parent tenant UI = **Group / Grup**, not Agency. Do not say WAHA on merchant screens. |
| Secrets | TikTok app key/secret on **Atlas** `.env` / Settings only. Do not mix Sorak keys. No `.env` in git. |

## Success

A brand admin on `atlasnow.co`:

1. Chat apps → **Connect TikTok**.
2. TikTok OAuth: pick the Business Account(s) they admin.
3. Map each handle to a location (HQ or a branch).
4. A customer DMs that TikTok account (account set to accept messages).
5. Thread appears in Conversations, source **TikTok**.
6. Staff reply from Atlas; the customer sees it in TikTok.

Public customers need TikTok’s own app review / production access. Sandbox/testers only until then — same honesty as Meta unpublished.

## Approaches considered

| | How | Verdict |
|---|---|---|
| **A. Official Business Messaging (recommended)** | TikTok developer app + OAuth + `DIRECT_MESSAGE` webhook + send API | Only path that matches Inbox CRM + other businesses |
| B. Paste token (like HQ Cloud paste) | Phone-id style fields | Faster demo, clients cannot self-serve, tokens rot. Reject for Wave A |
| C. Unofficial inbound | Scrape / third-party grey API | Policy + ban risk. Never |

## TikTok platform facts (gate, not hope)

- Product: **TikTok API for Business → Business Messaging**. Webhook event `DIRECT_MESSAGE` via `POST /business/webhook/update/` (`callback_url`, `event_type: DIRECT_MESSAGE`).
- Business Account must **accept DMs from everyone** (or the audience TikTok requires) before authorize, or webhooks never fire.
- **App review on TikTok’s developer portal** is separate from Meta. Joe clicks; Atlas does not.
- Regional lock: EEA / UK / CH often **cannot** use Business Messaging. Indonesia is the target; if a brand’s TikTok entity is EU-registered, say so in Chat apps — do not fake a connection.
- Rate limit historically ~10 QPS messaging. Atlas send path already serializes per conversation; keep that.
- Auto-welcome / `im_auto_message_*` is **out**. Atlas is Live Agent, not TikTok’s canned welcome.

Confirm live endpoint names in TikTok docs the week we implement (`open.tiktokapis.com` vs `business-api.tiktok.com`). Do not hardcode a guessed path in production without a fixture from their current Messaging send/receive reference.

## Architecture

```
TikTok Business Account (handle)
  → customer DM
  → TikTok DIRECT_MESSAGE webhook
  → POST https://atlasnow.co/api/webhooks/tiktok   (HMAC / TikTok signature)
  → SourceMapping(TIKTOK, business_id or open_id) ACTIVE?
        no  → 200 + logAppError unmapped_session, no insert
        yes → upsert WaContact (PLATFORM_ID, prefix tt:), WaConversation provider=TIKTOK, WaMessage
  → Conversations inbox (filter TikTok)
  → staff reply → TikTok send API with that account’s token
```

Reuse existing inbox tables (`WaContact`, `WaConversation`, `WaMessage`). Do **not** create a parallel TikTok thread schema.

### Units

1. **Catalog + secrets** — Settings integration `tiktok`: client key, client secret, webhook verify. Env fallbacks `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_WEBHOOK_SECRET`. Same Meta app discipline (platform webhook), **new** TikTok app.
2. **OAuth** — `GET /api/tiktok/oauth/start` + `callback`. `resolvedAppBaseUrl()` for redirects (never `0.0.0.0`). Store connector `provider: "TIKTOK"` on the **brand tenant**, tokens encrypted like Meta.
3. **Map** — `SourceMapping.sourceType = "TIKTOK"`, `externalId` = TikTok business / user open id used in webhooks, `externalLabel` = `@handle`. Unique `(sourceType, externalId)` already global — one handle cannot map to two locations.
4. **Ingest** — parse webhook, HMAC fail → 401, business miss → 200. Identity: `resolveIdentity(open_id, null, "TIKTOK")` → `PLATFORM_ID`, `phone = null`.
5. **Send** — existing `/api/conversations/[id]/send` branch `provider === "TIKTOK"` (today: META_CLOUD / FACEBOOK / INSTAGRAM). Composer placeholder “Reply on TikTok…”.
6. **Inbox UI** — restore TikTok in source filter (removed in the 2026-08-28 inbox polish). Badge `an-badge-demo`. Never show TikTok id as a phone.

### Webhook contract (target)

- URL: `https://atlasnow.co/api/webhooks/tiktok`
- Public (middleware already excludes `/api/*`).
- Verify signature before JSON parse when TikTok documents a header; otherwise verify as they specify (challenge GET if they use one).
- Idempotent on TikTok message id → `WaMessage.externalId`.
- Unmapped / unknown event: HTTP 200, structured log, no row.

### Data

| Field | Value |
|---|---|
| `Connector.provider` | `TIKTOK` |
| `SourceMapping.sourceType` | `TIKTOK` |
| `WaConversation.provider` | `TIKTOK` |
| `WaConversation.sessionId` | same string as `SourceMapping.externalId` |
| `WaContact.identifier` | `tt:{open_id}` (existing `PLATFORM_PREFIX.TIKTOK`) |
| `WaContact.phone` | always null for TikTok |
| `WaContact.displayName` | TikTok nickname if webhook sends one |

`listConversations` mappings count must include `TIKTOK` (today FACEBOOK\|INSTAGRAM\|WAHA only — same bug class as Meta). Empty state stays “map this channel”, never “map a WAHA session”.

## Chat apps UI

New card under Channels, English default:

**TikTok**  
Connect TikTok Business accounts this brand admins. Map each handle to a location. Unmapped DMs do not appear in Inbox.

Steps:

1. Connect TikTok with a Business Account that can receive DMs.
2. Map each `@handle` to a branch (or HQ).
3. TikTok webhook `https://atlasnow.co/api/webhooks/tiktok`.

Footer: The TikTok developer app must be approved for Business Messaging for public customers. Testers/sandbox only until then. This is not a deploy button.

No demo credentials on login. Reviewer test account (if TikTok review needs it) lives in TikTok’s form, not the public login page.

## Legal

Add a **TikTok Platform data** block on `/privacy` (EN+ID), parallel to Facebook/Instagram:

- Login / authorize so the brand can connect Business Accounts they admin.
- Scopes: only what Business Messaging needs to list accounts, receive DMs, send agent replies.
- No posting, no ads, no Spark, no lookalikes.
- Customer `open_id` + message visible to that brand’s Atlas users (and Group operators on that brand).
- Disconnect stops ingest; delete tokens/threads on request.
- Deletion request kinds already include `"tiktok"`.

## Error handling

| Case | Behaviour |
|---|---|
| TikTok app not configured | Chat apps: “TikTok is not configured (Settings → API)” |
| OAuth callback origin 0.0.0.0 | Use `resolvedAppBaseUrl()` |
| Unmapped handle | 200, `logAppError` `unmapped_session` |
| Send on unmapped / expired token | Inbox error string, no throw to Next overlay |
| EU/UK handle | Clear Chat apps error after OAuth, do not store as CONNECTED |
| HMAC mismatch | 401 |

## Testing

- Parse fixtures: inbound text, inbound image (store caption or `[image]`), echo/outbound, duplicate id, unsigned webhook.
- Identity: TikTok open_id never becomes `PHONE_VERIFIED`.
- Mapping gate: unknown `externalId` inserts nothing.
- Send route: TIKTOK uses TikTok send helper; WAHA still watch-only.
- Inbox filter `TIKTOK` lists only those rows.

Do not invent TikTok engagement, live viewers, or shop GMV in tests or UI.

## Key decisions

1. **Official Business Messaging only** — other businesses + App Review require it.
2. **N handles per brand, each mapped** — Joe: a brand may have several TikTok accounts; all inbound must land if mapped.
3. **Reuse Conversations tables** — same desk, same send modal.
4. **No phone from TikTok** — PLATFORM_ID / `tt:` prefix.
5. **Spec now, code after Meta submit** — do not block Messenger/IG review.

## Open questions (Joe can answer later)

1. TikTok developer app: new **AtlasNow** app on developers.tiktok.com (recommended) vs reuse some other P2P app. **Recommendation: new AtlasNow app, Indonesia entity.**
2. If TikTok only allows one Business Account per OAuth grant, Connect loops (“add another handle”) until N are stored.

## Out of scope (explicit)

Posting, ads, LIVE, comments-as-inbox, Shop CS API, auto-welcome, blast, branch-watch-only TikTok, mixing Sorak TikTok keys, publishing the Meta app to “make TikTok work”.

## PR Plan

| PR | Title | Files / area | Depends |
|---|---|---|---|
| T1 | Privacy + catalog + env shape | `src/lib/legal/copy.ts`, `src/lib/integrations/catalog.ts`, `compose.yaml` keys (empty defaults), i18n | — |
| T2 | OAuth start/callback + Chat apps Connect TikTok + list handles | `src/lib/tiktok/*`, `src/app/api/tiktok/oauth/*`, `ChannelsPanel` or `TikTokPanel`, `Connector` TIKTOK | T1 |
| T3 | Map handle → location (`SourceMapping` TIKTOK) | `src/app/api/tiktok/map`, mapping UI | T2 |
| T4 | Webhook ingest + identity + list mappings include TIKTOK | `src/app/api/webhooks/tiktok`, `src/lib/conversations/tiktok-*.ts`, `service.ts` mappings `in` | T3 |
| T5 | Inbox filter + Live Agent send | `ConversationsInbox.tsx`, `send/route.ts`, send helper | T4 |
| T6 | Runbook for Joe: TikTok developer app, webhook, scopes, sandbox testers | `docs/superpowers/plans/2026-08-28-tiktok-inbox.md` ops appendix | T1 |

Each PR is independently reviewable. No production TikTok DMs until T4 is live **and** the TikTok app can receive sandbox events.
