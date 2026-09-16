# Broadcast report — Meta statuses only (wave 1)

Date: 2026-09-01  
Repo: AtlasNow  
Status: building (Joe: gas 2026-09-02).

This is **what Meta WhatsApp Cloud API actually tells us** about HQ outbound. It is not loyalty, not outlet visits, not revenue.

## Product lock (Joe 2026-09-01)

| Topic | Choice |
|---|---|
| Where | **Broadcast** page (same desk as send). Not Reports (stamp / outlets). |
| Source | Cloud API **status webhooks** + our send `wamid`. HQ number only. |
| Wave 1 | Sent / delivered / read / failed / **Action**. |
| Action | Meta inbound after that send: free-text **or** template quick-reply / button. **Not** URL clicks, not visits, not stamps. |
| Not wave 1 | Store visits, stamps, omzet, URL-button clicks, Ads insights, branch WAHA. |

Today: send returns “N sent, F failed” and vanishes. `parseCloudWhatsAppWebhook` **skips** `statuses[]`. `wamid` is stored on inbox `WaMessage.externalId` (`wacloud:…`) when there is a conversation row — **not** as a blast batch report.

## What Meta provides (honest)

Status webhooks on field `messages`, array `statuses[]`. Each outbound `wamid` can get up to **sent**, **delivered**, **read**, and/or **failed**.

| Status | Meaning (Meta) | WhatsApp ticks | Caveat |
|---|---|---|---|
| `sent` | Left Meta’s servers | 1 grey tick | We already know this from the send HTTP 200 + `wamid`. |
| `delivered` | Reached the handset | 2 grey ticks | If the person **reads in the open chat immediately**, Meta **may skip** `delivered` and only send `read`. Count delivered as `delivered OR read`. |
| `read` | Shown in an open chat | 2 blue ticks | **Only if the customer has read receipts on.** Off = we never get `read`. Never claim “X% read of everyone.” Copy: “Read (receipts on).” |
| `failed` | Not sent or not delivered | red triangle | Includes Meta error `code` + title (e.g. 131049 ecosystem / quality). |

Also on some status payloads (usually `sent` and one of delivered/read):

- `pricing.category`: `marketing` / `utility` / `authentication` / `service` / …
- `pricing.type`: `regular` / `free_customer_service` / `free_entry_point`
- `pricing.billable` (deprecated; prefer type + category)

That is **Meta’s rate label**, not an AtlasNow invoice and not IDR. Monetization PRD still master for money. Wave 1 may **show** category as a chip. Do **not** debit credits from it.

`played` = voice note played. We do not blast voice. Ignore.

### “Action” that Meta actually sends

| Event | Meta? | Use in wave 1? |
|---|---|---|
| Quick-reply / template **button** tap | Yes — inbound `type: button` or `interactive.button_reply` | **Yes.** Count as **Replied (button)**. |
| Free-text reply after the blast | Yes — inbound `messages[]` | **Yes.** Count as **Replied**. |
| List reply | Yes — `interactive.list_reply` | Same as button. |
| URL / call **CTA** on a template | **No click webhook** on Cloud API | **No.** Do not invent “clicked the link.” |
| Came to outlet / stamped / spent | Not Meta | **No.** That is loyalty, later, different PRD. |

A phone counts as **Action** if HQ receives inbound from that `wa_id` **after** that send’s `sentAt`, and the inbound is a real customer message (not a status): text, `button`, `interactive.button_reply`, or `list_reply`. Window: **7 days**. One Action per send row (first inbound wins).

## UI (Broadcast)

New tab **History** (EN) / **Riwayat** (ID), next to Session note / Templates / Pay as you go.

Each **batch** (one Send click) is a card:

- When, who sent (staff), brand
- Kind: Session 24h **or** Template `{name}`
- Totals: **Attempted · Sent · Delivered · Read · Failed · Action**
- Footnote: “Read only counts people with read receipts on. Action = they wrote back or tapped a template button.”
- Expand: per-number latest status + Meta error title if failed

Empty: “No HQ sends yet. Statuses appear after Meta calls us back — not at the Send click.”

H-2 `birthday_greeting` auto is a batch too (source **Birthday H-2**), same columns. It used Cloud templates; Meta statuses still apply.

Do not put this on `/reports` (loyalty month).

## Data

Do **not** reuse `WaConversation` as the report. Inbox stays inbox.

`BroadcastBatch`

- tenantId, createdByUserId
- kind: `SESSION` | `TEMPLATE` | `BIRTHDAY_H2`
- templateName nullable
- createdAt
- attemptedCount

`BroadcastSend`

- batchId, tenantId
- phone (canon)
- wamid (unique when present)
- status: `PENDING` | `SENT` | `DELIVERED` | `READ` | `FAILED`
- sentAt, deliveredAt, readAt, failedAt
- errorCode, errorTitle
- pricingCategory, pricingType nullable
- repliedAt nullable (first inbound after sentAt)

Status may only **move forward**: PENDING → SENT → DELIVERED → READ. FAILED is terminal. If `read` arrives without `delivered`, set deliveredAt = readAt (Meta implied delivery).

Webhook: parse `statuses[]` (today skipped). Match `statuses[].id` to `wamid`. Unknown wamid (HQ reply from inbox, not a batch) — **ignore for this report** (do not pollute History with every till Status Stamp).

Send path: when Broadcast or H-2 gets `{ ok, messageId }`, write `BroadcastSend` with that wamid **before** waiting for webhooks.

## Copy (merchant-plain)

EN: Sent / Delivered / Read (receipts on) / Failed / Action  
ID: Terkirim / Sampai HP / Dibaca (jika centang baca nyala) / Gagal / Action  

Action tooltip EN: “They wrote HQ or tapped a button on the template.”  
Action tooltip ID: “Mereka balas HQ atau tap tombol di template.”

Never: “open rate like email,” “clicked the Google Maps link,” “this blast made Rp.”

## Tests

- Status webhook with `delivered` updates the matching wamid; does not create a `WaConversation`.
- `read` without `delivered` still marks delivered.
- Unknown wamid (inbox-only outbound) does not create a History row.
- Failed status stores Meta code/title.
- Inbound button after send sets `repliedAt` once (Action = 1).
- URL-button templates do not increment Action unless the person actually messages HQ.

## Out of scope

- Insights Graph “template analytics” pull (account-level, not this Send).
- AtlasNow credit debit from `pricing`.
- Branch WAHA ticks.
- Screenshot / media in History.
- Building until Joe says gas.

## Success

HQ sends a 10-number template. History shows 10 attempted, then Meta fills sent/delivered/read/failed. If three people reply in HQ inbox or tap a quick-reply, **Action = 3**. Nobody is told how many walked into Villo.
