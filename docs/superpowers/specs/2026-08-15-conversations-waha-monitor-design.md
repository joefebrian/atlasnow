# Conversations WAHA monitor — slice 1

Date: 2026-08-15  
Repo: AtlasNow  
Status: design approved in chat (sections 1–3). Waiting on spec review before implementation plan.

## Problem

`/conversations` is a placeholder. HQ needs to see which branch WhatsApp numbers are talking to whom. This is observability, not a helpdesk.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Source | WAHA live webhooks |
| Reply | Monitor-only — no send, no draft |
| Content | List preview + full thread in slide-over |
| Numbers | Only sessions with an ACTIVE `SourceMapping` (`sourceType = WAHA`) |
| Audience | Agency staff. Client users see the existing agency-only placeholder |
| Dates | `formatDateTime` + `Asia/Jakarta` |
| Connector | `provider` stored as `WAHA` now; schema allows `META_CLOUD` later |

## Out of scope

Taxonomy, SLA clocks, reply/composer, Meta Cloud API, retention purge job, session health incidents, pull/sync button, client-tenant inbox.

## Architecture

```
WAHA session (one WhatsApp number)
  → event message | message.any
  → POST /api/webhooks/waha   (X-Api-Key)
  → kill switch? ignore
  → SourceMapping(WAHA, session) ACTIVE?
        no  → 200 + log, no insert
        yes → upsert WaContact, WaConversation, WaMessage
  → GET /conversations inbox (cookie session, agency staff)
```

Units:

1. **Ingest adapter** — parse WAHA payload, never invent a phone from `@lid`.
2. **Mapping gate** — session → Location via existing `SourceMapping`.
3. **Store** — contacts, conversations, messages (dedupe on message `externalId`).
4. **Inbox UI** — list + thread slide-over, audit on open.

HQ number: map it to an HQ `Location` in Location 360. Slice 1 does not add a separate HQ binding table. `WaConversation.locationId` is required.

## Data model

Prisma (SQLite), names as specified.

### `WaContact`

- `id`, `tenantId` (required; tenant of the mapped location)
- `identifier` — phone digits if verified, else raw lid / chat id
- `displayName` nullable
- `identityConfidence` — `PHONE_VERIFIED` | `LID_RESOLVED` | `OPAQUE_LID` | `UNKNOWN`
- `phone` nullable — set only when confidence is `PHONE_VERIFIED` or `LID_RESOLVED` with a real number
- `lid` nullable
- timestamps

Unique: `(tenantId, identifier)`.

Identity rules:

- **Phone is first-class.** If WAHA sends a real number, persist `WaContact.phone` (digits only) and show it in the list + thread. Never hide a known number behind a lid.
- `…@c.us` / `…@s.whatsapp.net` / payload `from` or `author` with a numeric user → `phone` stored, confidence `PHONE_VERIFIED`
- payload includes both lid and a phone field → store both, show phone, confidence `LID_RESOLVED`
- `@lid` only, no phone anywhere in the event → `phone = null`, store lid, `OPAQUE_LID`. Do not invent digits.
- anything else → `UNKNOWN`, do not fabricate `phone`

If a later event for the same contact carries a phone, update the row (`phone` + confidence). Inbox then shows the number.

### `WaConversation`

- `id`, `tenantId`, `locationId` (required, FK Location)
- `contactId` (FK)
- `provider` default `WAHA`
- `sessionId` — WAHA session name (same string as `SourceMapping.externalId`)
- `status` default `OPEN`
- `firstMessageAt`, `lastMessageAt`
- `lastInboundAt`, `lastOutboundAt` nullable
- `lastPreview` — truncated last body (max 160 chars)
- timestamps

Unreplied = `lastInboundAt` is not null AND (`lastOutboundAt` is null OR `lastInboundAt` > `lastOutboundAt`).

New conversation: if the contact+session+location already has an `OPEN` conversation and `now - lastMessageAt < 24h`, append. Else close is not required; create a new `OPEN` row. 24h is hardcoded.

### `WaMessage`

- `id`, `conversationId`
- `externalId` unique — WAHA message id (dedupe key)
- `direction` — `IN` | `OUT` (`fromMe=true` → `OUT`)
- `sentAt`
- `body` text (empty string if media-only; no media download in slice 1)
- `fromMe` boolean
- `rawJson` optional truncated payload for debug
- timestamps

### Audit

Reuse `AuditEvent`: `action = conversation.thread_opened`, `tenantId` set, `actorId` = user, payload includes `conversationId`. Write on `GET /api/conversations/:id`.

## Mapping

Existing `SourceMapping`:

- `sourceType = "WAHA"`
- `externalId = <WAHA session name>` (exact, case-sensitive)
- `status = ACTIVE`

Location 360 already has a WAHA source option. Ops maps one session per location. Global unique `(sourceType, externalId)` already prevents two locations claiming one session.

## API

### `POST /api/webhooks/waha` — public

Middleware must allow this path without a login cookie (add `/api/webhooks` to the public prefix).

- Header `X-Api-Key` must match the decrypted WAHA `apiKey` in `IntegrationConfig` (provider `waha`). Missing/wrong → `401`.
- `IntegrationConfig` mode `OFF` or integration disabled → `200` `{ ignored: true }`.
- Unknown event name → `200` ignore.
- Invalid JSON / missing session or message id → `400`.
- Unmapped or inactive mapping → `200` `{ ignored: "unmapped_session" }`, no 5xx.
- Duplicate `externalId` → `200` `{ duplicate: true }`.
- Success → `200` `{ ok: true, conversationId }`.

Adapter reads (WAHA shapes vary; accept both):

- `event` or `type`
- `session`
- `payload.id` / `payload.id.id` as `externalId`
- `payload.fromMe`, `payload.body`, `payload.timestamp`
- `payload.from` / `payload._data.id.remote` for peer id

Never return 5xx for “business” misses. Only 5xx on unexpected crash.

### `GET /api/conversations` — cookie, agency staff

Query: `q`, `filter=all|unreplied`, `locationId`.

Response: `{ conversations, stats: { total, unreplied, open } }`.

Each row: id, lastMessageAt, contact (display, phone or lid, confidence), preview, location (id, name), direction hint (`IN`/`OUT`/`UNREPLIED`), sessionId.

Client / non-agency → `403`. Unauthenticated → `401`.

### `GET /api/conversations/:id` — cookie, agency staff

Returns conversation header + messages oldest-first. Writes audit. `403`/`401`/`404` as usual. Tenant isolation: conversation must belong to a location the session may see (agency: all).

No `POST` send.

## UI

Replace `ModulePlaceholder` on `/conversations` for agency staff.

- `PageHeader`: eyebrow Demand, badge `WAHA live · monitor-only`, title Conversations, unreplied chip.
- Toolbar: search; chips All / Unreplied; location dropdown (locations that have WAHA mapping).
- `TableShell` columns: Last, Contact, Preview, Cabang, Arah, View.
- Contact cell: **always `phone` when the DB has it**; else truncated lid; confidence badge.
- Slide-over: contact + location + confidence; bubbles IN left / OUT right; `fromMe` footer label `Account responder` (never a staff name). No composer.
- Empty: no WAHA mappings → “Map session di Location 360 → Sources”. Mappings but zero messages → “Menunggu webhook”.
- Client users: keep placeholder, agency-only copy.
- i18n EN/ID for chrome strings.

## Error / ops

| Case | Behavior |
|---|---|
| WAHA process down | Inbox shows last stored data |
| Kill switch | Webhook 200 ignore |
| Opaque lid | Show lid + `OPAQUE_LID`, never a guessed number |
| Double mapping | Impossible via existing unique; ingest uses the one ACTIVE row |
| Webhook flood | Dedupe on `externalId`; no extra rate limit in slice 1 |

## Tests

`tsx --test` next to ingest helpers (same style as `src/lib/i18n/format.test.ts`):

1. Same `externalId` twice → one `WaMessage`.
2. Gap ≥ 24h on same contact+session → new `WaConversation`.
3. Peer `@lid` only → `phone` null, confidence `OPAQUE_LID`.
3b. Same contact later arrives as `628…@c.us` → row updated, `phone` stored, UI shows number.
4. Unknown session → no contact/conversation/message rows.
5. Mode OFF → no rows.

## Files (implementation, not now)

- `prisma/schema.prisma` + migration
- `src/lib/conversations/identity.ts` — phone/lid rules
- `src/lib/conversations/ingest.ts` — mapping + 24h + upsert
- `src/lib/conversations/service.ts` — list/get
- `src/app/api/webhooks/waha/route.ts`
- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/[id]/route.ts`
- `src/middleware.ts` — public webhook prefix
- `src/components/conversations/ConversationsInbox.tsx`
- `src/app/(app)/conversations/page.tsx`
- i18n strings in `messages.ts`

## Success

Agency admin on `/conversations` sees every inbound/outbound line from mapped branch sessions, can open a thread, sees the customer phone whenever WAHA provided it (stored on `WaContact.phone`), and never sees a fabricated number.
