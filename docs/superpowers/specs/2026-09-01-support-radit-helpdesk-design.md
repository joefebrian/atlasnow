# AtlasNow support — Radit help desk (approach A)

Date: 2026-09-01  
Repo: AtlasNow  
Status: building (Joe: gas 2026-09-01).

This is **P2P support for people who use AtlasNow or will use it**. It is not a merchant-customer chatbot. It is not WhatsApp HQ. It is not AI.

## Product lock (Joe 2026-09-01)

| Topic | Choice |
|---|---|
| Who talks | Prospect on atlasnow.co **or** logged-in client (any desk page, including errors). |
| Who answers | A **human** at P2P. Display name always **Radit**. Never a bot. |
| Where the box is | **Both:** public site + inside the logged-in app. One queue. |
| Desk | Super Admin **Help desk** menu. Stores the conversations. Platform only. |
| Queue | Finish **one** conversation before the next. FIFO. |
| 10 minutes | **Customer's** clock, after Radit has replied. Joe silent 10 min → close. |
| Close copy | Suggest email **hello@atlasnow.co** (already the support address). |
| Seen | Client message shows **Not seen yet** until Radit **opens** that conversation. Then **Seen**. |
| Timer start | Does **not** start before Radit's reply. Unopened threads stay Not seen yet; they are **not** auto-closed for silence. |
| After close | Client writes again → **new** conversation, back of the queue. |
| Hours | Chat **on** 09:00–17:00, **off** outside that. Clock **Asia/Jakarta**. Configurable in Super Admin. Off-hours: box visible but dead → **contact form** (same `/contact` pipeline to hello@). |

## What we do not do

- Mix these threads with `WaConversation` / brand HQ WhatsApp / WAHA / Cloud templates.
- Auto-reply on a brand number. FAQ “Ada bot auto-reply?” stays about **merchant inbox**, not this box.
- AI / Fin-style tools (health check, republish). Radit types.
- Charge, debit WA credits, or invent a support SKU. Monetization PRD: this is P2P ops, not a pack.
- Put this on `p2plabs.asia` or the 1 GB VPS. Lives on **atlasnow.co**.
- Dump `.env`, tokens, or the Super Admin error log into the widget.
- Let brand HQ / cashier see other tenants’ support chats.
- CSV, blast, or loyalty from this queue.

Contact **form** (`/contact` → `ContactMessage` + mail to hello@) **stays**. Chat is live queue **only while hours are open**. Off-hours the widget **is** that form — do not invent a second mailbox.

## Surfaces

### 1. Widget (client / prospect)

- Public: every atlasnow.co marketing page (home, pricing, login, FAQ, contact, legal).
- App: every logged-in route (Home, Inbox, Till, Settings, error UI). Same widget, same queue.
- Composer + thread. Agent name **Radit**. Presence:
  - **Closed** — outside desk hours. Chat composer **dead**. No new messages. No join queue. Widget shows the **support email form** instead (existing contact fields → `/api/contact` → hello@). Logged-in: prefill name, email, brand.
  - **Active** — inside hours and a Super Admin has Help desk open.
  - **Away** — inside hours, Help desk not open. Messages **still enqueue** (working day). Closed does not.
- Off-hours widget still **visible** (support exists) but the input is disabled. Not a disappearing button.
- Prospect must leave **name + email** before the first message (so close-copy / later email has a person). Logged-in: use account name, email, brand, role — do not ask again.
- Attach **screenshot / image** (max 5 MB). For “frontend or backend” bugs. No generic file dump.
- Sidebar context for Radit (not a chat bubble): current URL, locale, brand if logged in, role. Client can add a screenshot.

Away copy (honest): Radit is a person. If Away, “Leave a message — Radit sees it when he opens Help desk. Or email hello@atlasnow.co.”

Closed copy (hours): times come from settings. Then the **form**, not a mailto-only line.

EN: “Radit is at the desk {open}–{close} (Jakarta). Leave a note — it goes to hello@atlasnow.co.”  
ID: “Radit di meja {open}–{close} (Jakarta). Isi form — masuk ke hello@atlasnow.co.”

Do not open a new Help desk thread from that submit. It is `ContactMessage` only.

### 2. Super Admin → Help desk

New `platformOnly` nav item. Suggested: `/support`, label **Help desk**, description **AtlasNow support — Radit**.

Three panes:

1. **Now** — the single active conversation (composer). Only one.
2. **Waiting** — FIFO list (name, brand or “prospect”, preview, wait time). **Cannot open** #2 while #1 is active.
3. **Closed** — history. Read-only. Search by email / brand.

Radit closes manually (**Resolved**) or the 10-minute job closes. Next waiting thread becomes the only one he can open. Seen flips when he opens it.

Display name to the client is always Radit, even if Joe or another Super Admin is typing.

### 3. Hours settings (Super Admin)

Help desk has a **Hours** fold (or Settings → Help desk). Not per brand. One desk for AtlasNow.

| Field | Default | Notes |
|---|---|---|
| Chat on | on | Kill switch. Off = box always Closed. |
| Timezone | `Asia/Jakarta` | Locked. Same clock as birthday H-2. Not a visitor’s local TZ. |
| Open | `09:00` | Inclusive. |
| Close | `17:00` | Exclusive (17:00:00 = Closed). |
| Days | all 7 days | Uncheck e.g. Sunday if P2P wants. |

Changing hours is live. No deploy. Open 09:00–17:00 every day until Joe unchecks a day.

**At 17:00**

- Widget: Closed. Chat composer dead. **Support form** in the box (same as `/contact`).
- No new `QUEUED` threads. Form submit is email, not the queue.
- `QUEUED` already waiting: stay in line until next open day. They cannot add messages while Closed. Radit sees them at 09:00.
- `ACTIVE` at the bell: Radit may **finish that one** (both sides still type) until he closes it or the 10-minute silence hits. Then the box is Closed for everyone. Do not auto-open the next in queue after hours.

Need overtime? Widen Close in settings (e.g. 21:00). No separate “force open” toggle in v1.

## Queue + seen + close

```text
Prospect/client sends
  → thread QUEUED
  → their bubbles: "Not seen yet"
  → if Radit is in another ACTIVE thread: visitor sees queue position ("Radit is with someone else · #2")

Radit finishes ACTIVE (close)
  → oldest QUEUED is the only one he can open

Radit opens that thread
  → ACTIVE
  → those messages: "Seen"
  → visitor no longer in line

Radit replies
  → start 10:00 silence clock on the **visitor**
  → visitor replies → clock resets
  → visitor silent 10 min → CLOSED
  → widget: this chat closed; email hello@atlasnow.co
```

Rules:

- One `ACTIVE` thread in the whole product (one Radit persona).
- Silence job runs often enough that close is within ~30s of the 10th minute (existing `instrumentation.ts` style, Jakarta clock).
- If Radit never opens: no silence clock. Thread stays QUEUED. Not seen yet.
- If Radit is Away (inside hours): same. Do not fake a bot reply to keep the clock honest.
- If Closed (outside hours): server **rejects** new chat messages and new threads. Widget shows the contact form. Form POST hits `/api/contact` (or the same `send` helper), never `SupportThread`.
- Visitor can keep typing while queued; all of it stays Not seen until open.
- Manual close by Radit: same hello@ hint if he wants the person off-chat.

### Copy (close)

EN: “This chat closed — no reply for 10 minutes. Email hello@atlasnow.co. A person reads it.”  
ID: “Percakapan ditutup — tidak ada balasan 10 menit. Email hello@atlasnow.co. Orang yang baca.”

### Copy (not seen)

EN: “Not seen yet” · after open: “Seen”.  
ID: “Belum dibuka” · “Dilihat”.

Do not show “Seen by Joe”. The face is Radit.

## Data (new tables — do not reuse Wa*)

`SupportThread`

- `status`: `QUEUED` | `ACTIVE` | `CLOSED`
- `visitorKind`: `PROSPECT` | `USER`
- `userId`, `tenantId` nullable (prospect)
- `name`, `email` required
- `locale`
- `firstPath`, `lastPath` (URL/path they were on)
- `queuedAt`, `openedAt` (Radit opened = Seen), `closedAt`
- `closeReason`: `VISITOR_SILENCE` | `AGENT` | `VISITOR_ENDED`
- `lastVisitorAt`, `lastAgentAt`, `silenceDeadlineAt`
- `queuePosition` computed, not stored as source of truth

`SupportMessage`

- `threadId`, `from`: `VISITOR` | `AGENT`
- `body`, optional image URL/key
- `sentAt`
- Visitor messages are seen when `thread.openedAt >= sentAt` **or** Radit has the thread open after `sentAt` (refresh `openedAt` on each Help desk focus / poll while ACTIVE).

Do not store other tenants’ WhatsApp bodies here. Do not attach loyalty IDs.

Rate-limit public creates by IP hash (same idea as `ContactMessage`).

`SupportDeskSettings` (single row)

- `enabled` boolean
- `openMinute` / `closeMinute` (0–1440, Jakarta) or store `openHm` / `closeHm` as `"09:00"` / `"17:00"`
- `daysOfWeek` e.g. `1,2,3,4,5,6,7` (Mon–Sun). Empty = never open.
- `timezone` stored as `Asia/Jakarta` for honesty; do not offer a picker in v1.

Server `isSupportDeskOpen(now)` is the only gate. Client clock does not decide.

## Staff

- Reply + presence: `SUPER_ADMIN` in **platform** mode only.
- Brand Client Admin / cashier: widget as **visitor** only. They never see Help desk.
- Analyst: not in v1 Help desk (keep the queue to one Radit). Revisit later if P2P wants a second human — still one ACTIVE thread, still named Radit.

## Transport

Single AtlasNow app + Postgres. **No new Redis.** Poll or SSE on the existing box. DB is the source of truth so two browser tabs for Radit stay consistent.

Silence closer: small interval in production `instrumentation.ts` (with birthday H-2). Idempotent: close only if `status=ACTIVE`, `silenceDeadlineAt <= now`, last speaker was agent.

## Tests (must exist before calling it done)

- Prospect without email cannot send.
- Logged-in thread carries tenant + path.
- Second visitor stays QUEUED while one ACTIVE exists; they cannot jump the line.
- Not seen until `openedAt`; Seen after open.
- Silence 10 min after agent message → CLOSED + hello@ copy. Visitor message resets the clock.
- No close if never opened / never agent-replied.
- Closed then new visitor message → new thread, QUEUED.
- Support queries never touch `WaConversation`.
- Non–Super-Admin cannot list threads.
- Outside 09:00–17:00 Jakarta, new chat thread/message is rejected; widget shows contact form; submit creates `ContactMessage` + mail, **not** a SupportThread.
- Changing Close to 21:00 in settings opens the box the same day without deploy.
- At 17:00, next QUEUED is not auto-opened; ACTIVE may finish.

## Success

Joe (prospect) on atlasnow.co can write Radit **between 09:00 and 17:00 Jakarta**. At 17:01 the box is Closed and shows the **support form** (hello@ via existing contact). Super Admin can change those hours. Joe (logged in, till error) can write from that page while open. Super Admin sees **one** Help desk queue, not Inbox. Unopened bubbles say Not seen yet. After Radit answers, 10 minutes of Joe silence closes and points at hello@atlasnow.co. Brand WhatsApp inbox is unchanged.

## Out of scope (later, not this PRD)

- AI drafts for Radit.
- Email/SMS ping when a chat arrives and Radit is Away (v1 = badge/sound in Help desk only).
- Transcript auto-mailed to the visitor.
- Canned replies.
- Multiple concurrent Radits.
- Widget on merchant **store** websites.
- Changing the public FAQ about merchant auto-reply.
