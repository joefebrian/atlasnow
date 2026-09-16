# TikTok Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brand staff connect 1..N TikTok Business accounts, map each to a location, see inbound DMs in Conversations, and reply from Atlas (Live Agent).

**Architecture:** Official TikTok API for Business (Business Messaging). OAuth stores a `TIKTOK` connector on the brand tenant. Webhook `POST /api/webhooks/tiktok` gates on `SourceMapping(TIKTOK)`, upserts existing `WaContact` / `WaConversation` / `WaMessage`. Send reuses `/api/conversations/[id]/send`. Never invent a phone from `open_id`.

**Tech Stack:** Next.js 16 App Router, Prisma 5, PostgreSQL, existing encryptSecret, `resolvedAppBaseUrl()`, Conversations inbox, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-08-28-tiktok-inbox-design.md`

## Global Constraints

- Official Business Messaging only. No scrape, no Sorak keys, no `.env` in git.
- `providerTreatsPeerAsPhone("TIKTOK")` stays false. Identity prefix `tt:`.
- Unmapped handle: webhook 200, no insert, `logAppError` unmapped.
- Merchant UI: “TikTok”, never internal API names. Group/Grup not Agency.
- Do not implement until Joe approves the spec **and** Meta App Review is submitted (or Joe says gas anyway).
- Do not Publish the Meta app as part of this work.
- No ads, posts, Login-with-TikTok, LIVE, shop GMV, fake visits.

## File map

| File | Responsibility |
|---|---|
| `src/lib/integrations/catalog.ts` | `tiktok` integration fields |
| `src/lib/legal/copy.ts` | TikTok platform data EN+ID |
| `src/lib/tiktok/oauth.ts` | Auth URL, token exchange, list accounts |
| `src/lib/tiktok/service.ts` | Connector upsert, map handle, public handles |
| `src/lib/conversations/tiktok-parse.ts` | Webhook JSON → events |
| `src/lib/conversations/tiktok-ingest.ts` | Mapping gate + upsert |
| `src/lib/conversations/tiktok-send.ts` | Send API |
| `src/app/api/tiktok/oauth/start/route.ts` | Start OAuth |
| `src/app/api/tiktok/oauth/callback/route.ts` | Callback using `resolvedAppBaseUrl()` |
| `src/app/api/tiktok/status/route.ts` | Chat apps status |
| `src/app/api/tiktok/map/route.ts` | Map handle → location |
| `src/app/api/webhooks/tiktok/route.ts` | Public webhook |
| `src/app/api/conversations/[id]/send/route.ts` | Branch TIKTOK |
| `src/lib/conversations/service.ts` | mappings `in` includes `TIKTOK` |
| `src/components/channels/TikTokPanel.tsx` | Connect + map card |
| `src/components/conversations/ConversationsInbox.tsx` | Filter + reply placeholder |
| `compose.yaml` | `TIKTOK_*` empty defaults (VPS `.env` later) |

---

### Task 1: Privacy + catalog

**Files:** `src/lib/legal/copy.ts`, `src/lib/integrations/catalog.ts`, `compose.yaml`, `src/lib/i18n/messages.ts`

- [ ] Add TikTok platform-data paragraphs (EN+ID): Business Messaging only; list/receive/reply; no ads/posts; open_id not a login; disconnect + deletion.
- [ ] Catalog provider `tiktok`: clientKey, clientSecret, webhookSecret; env `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_WEBHOOK_SECRET`.
- [ ] `compose.yaml` empty defaults; **do not** write VPS `.env` until Joe pastes TikTok app secrets.
- [ ] Chat apps i18n strings for the TikTok card (EN+ID).
- [ ] Tests: deletion-request still accepts `kind: "tiktok"`.
- [ ] Deploy privacy to atlasnow.co **with** first TikTok code drop, not before Meta submit if that would confuse reviewers — privacy can ship with T1.

### Task 2: OAuth + connector

**Files:** `src/lib/tiktok/oauth.ts`, `src/lib/tiktok/service.ts`, `src/app/api/tiktok/oauth/start/route.ts`, `src/app/api/tiktok/oauth/callback/route.ts`, `src/app/api/tiktok/status/route.ts`

- [ ] `buildTikTokAuthUrl(state)` + `tiktokRedirectUri()` via `resolvedAppBaseUrl()`.
- [ ] Exchange code → access + refresh; encrypt; `Connector.provider = "TIKTOK"`.
- [ ] List Business Accounts the token can message; store `metaJson.accounts[]` `{ id, handle }`.
- [ ] Start/callback routes; callback redirects to `/settings/chat-apps?tiktok=connected` (never request.url origin).
- [ ] Status API: configured, connected, accounts, mappings.
- [ ] Test: redirect URI uses app base, not `0.0.0.0`.

### Task 3: Map handle → location

**Files:** `src/app/api/tiktok/map/route.ts`, `src/components/channels/TikTokPanel.tsx`, Channels page

- [ ] POST map `{ locationId, externalId, label }` → `SourceMapping` `TIKTOK`. Clash if same handle mapped elsewhere (existing unique).
- [ ] UI: Connect TikTok, list `@handles`, per-row location select, unmapped warning.
- [ ] Disconnect: status DISCONNECTED, stop using tokens, mappings can stay inactive or staff unmaps.

### Task 4: Webhook ingest

**Files:** `src/lib/conversations/tiktok-parse.ts`, `tiktok-parse.test.ts`, `tiktok-ingest.ts`, `src/app/api/webhooks/tiktok/route.ts`, `src/lib/conversations/service.ts`

- [ ] Parser fixtures from TikTok sample `DIRECT_MESSAGE` payload (capture a real sandbox payload in test `fixtures/` the first time webhook hits).
- [ ] Identity: `resolveIdentity(open_id, null, "TIKTOK")` → phone null, identifier `tt:…`.
- [ ] Ingest: ACTIVE mapping only; dedupe `externalId`; conversation `provider: "TIKTOK"`, `sessionId: externalId`.
- [ ] HMAC/signature: fail 401. Unmapped 200 + log.
- [ ] `sourceMapping.count` `in: [WAHA, FACEBOOK, INSTAGRAM, TIKTOK, META_CLOUD]` so empty copy is not “map WAHA”.
- [ ] Log POST bytes like Meta webhook (debug, no body dump of PII in info logs).

### Task 5: Inbox + send

**Files:** `ConversationsInbox.tsx`, `send/route.ts`, `src/lib/conversations/tiktok-send.ts`

- [ ] Filter option TikTok (`value="TIKTOK"`).
- [ ] Source badge `an-badge-demo`, label `TikTok`.
- [ ] Composer when `provider === "TIKTOK"`: placeholder “Reply on TikTok…”.
- [ ] Send helper uses that brand’s TikTok token + recipient open_id from contact identifier.
- [ ] Error if token missing / TikTok 4xx: show in inbox, do not 5xx HTML.
- [ ] Test: send route TIKTOK vs WAHA watch-only still blocked.

### Task 6: Joe runbook (not code)

- [ ] Create TikTok developer app **AtlasNow** (Indonesia / P2P Labs entity).
- [ ] Enable Business Messaging. Redirect `https://atlasnow.co/api/tiktok/oauth/callback`. Webhook `https://atlasnow.co/api/webhooks/tiktok`.
- [ ] Paste client key/secret into VPS `.env` / Settings → API (Atlas only).
- [ ] Register webhook `DIRECT_MESSAGE`.
- [ ] Sandbox: Joe’s TikTok Business `@…` as tester. Connect → map HQ → send a DM from a second TikTok user → Inbox.
- [ ] Submit TikTok app review **after** sandbox ingest+reply works. Separate from Meta. Do not mix videos.

## Done when

- Mapped TikTok handle: inbound thread in Conversations, filter TikTok, reply visible on TikTok.
- Unmapped handle: no thread.
- No phone fabricated.
- Privacy live.
- Meta App Review video/process untouched.
