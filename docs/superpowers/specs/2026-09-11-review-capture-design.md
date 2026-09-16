# AtlasNow Review Capture — design

Date: 2026-09-11  
Repo: AtlasNow  
Status: P0 approved 2026-09-11 (Joe: gas). P1/P2 still later.  
Source PRD: Joe, 2026-09-11 (Review Capture / Reputation). This spec is the build contract; the PRD is product intent.

Joe paused Meta App Review to define this. MBA stays later-roadmap, not this module.

## Problem

HQ already **pulls** Google reviews into `/reputation` (Maps + GBP). They cannot **ask** a guest at the outlet to leave one.

Guests will not open Google Maps and hunt the listing. Capture is: scan/tap → Google’s own write-review page → star + comment **on Google**.

## Product lock (do not drift)

| Topic | Choice |
|---|---|
| Guest UX | **No Atlas form.** `GET /r/{token}` logs intent, **302** to Google write-review. Stars + text happen on Google. |
| Destination | `https://search.google.com/local/writereview?placeid={PLACE_ID}` |
| Assets (P0) | **One token per outlet.** NFC / QR / struk / tent share that URL. Difference = **UTM on the Atlas URL**. |
| UTM | Logged on our GET (`utm_source`, `utm_medium`, `utm_campaign`, plus `utm_content` if present). Do not depend on UTM surviving on Google. |
| Attribution | We know **intent** (link opened). We do **not** know they pressed Post. Never say “conversion”. |
| Metrics | Review intents · New reviews (synced) · **Estimated** capture rate. Label **Estimated** visible. Not visits, not sales. |
| Who gets Capture | **Every plan that has outlets** (Free included). Hook. |
| Who can **reply** on Google | **Gold+** with GBP connected (existing Google pack). Maps-only = read-only. |
| Staff UI | Review link + QR download on **`/reputation` and Outlets**. Not a new `/reputation/capture` menu in P0. |
| Inbox | **Do not rebuild.** Keep `Review`, `syncReviewsFromMaps`, `syncReviewsFromGoogle`, GBP reply, Maps badge. |
| Architecture | **A — extend live.** No `review_sources` rewrite, no `/api/reputation/*` rename in P0. |
| AI | P1. Suggested reply needs **human approve**. No auto-publish. Use SpaceXAI when we add it (`build-with-ai`). |
| Actions | P2 **after** To-do is live. Do not fake an action system. |
| Copy | Merchant-plain. Product surface = **workspace**. Physical tent may say meja. Group/Grup not Agency. |
| Out | Fake visits/leads/revenue · exact conversion · Maps reply button · posting reviews via API · Meta Business Agent · new paid SKU for Capture |

## Success (P0)

1. Outlet has a Maps `place_id` (URL or Place ID on the location).
2. HQ/staff open Reviews or Outlets → copy `https://atlasnow.co/r/{token}` and download QR.
3. Guest scans QR or taps NFC (same URL, optional UTM).
4. Atlas stores `review_capture_opened` (no customer PII required).
5. Browser lands on Google write-review for **that** place.
6. Guest rates + comments on Google.
7. Later Maps/GBP sync may show a new review. Dashboard shows intents vs new reviews as **Estimated** rate.
8. Missing `place_id`: no QR. Copy: map this outlet on Google Maps first. Do not 302 to a generic Google search.

## Approaches considered

| | How | Verdict |
|---|---|---|
| **A. Extend live (chosen)** | Token + events on existing Location/Review | Fast, inbox stays |
| B. New Reputation module | `review_sources`, `/api/reputation/*`, migrate Review | 2–3× time, break risk |
| C. Capture microsite | Atlas landing / form first | Conflicts with “straight to Google” |

## P0 design

### Capture loop

```text
Guest scan/tap
  → GET atlasnow.co/r/{token}?utm_source=nfc&utm_medium=exit
  → insert ReviewCaptureEvent (intent)
  → 302 writereview?placeid=
  → guest posts on Google
  → (later) existing Maps/GBP sync
  → /reputation inbox
```

Resolve `place_id` from the location’s active `GOOGLE_MAPS` mapping or parsed Maps URL / notes (reuse `mapsUrlForLocation` / place_id helpers). If GBP is connected, **still** send guests to the public write-review URL (that is what customers use). Do not send them to Business Profile Manager.

### Data

**Location** (additive):

- `reviewCaptureToken` — unique, unguessable, generated once when staff first open the link UI **and** `place_id` exists. Never reuse across outlets. Rotate = new token, old 404.

**ReviewCaptureEvent** (new):

- `id`, `locationId`, `token`, `eventType` (`opened`), `createdAt`
- `utmSource`, `utmMedium`, `utmCampaign`, `utmContent` (nullable)
- `userAgent` (optional, coarse device)
- no name, phone, email

Do not invent a multi-asset table in P0. Schema comment: P2 may add `ReviewCaptureAsset` (NFC vs QR) without changing `/r/{token}`.

### HTTP

`GET /r/[token]`

- Unknown/disabled token → 404, merchant-plain.
- No `place_id` → 200 short Atlas page: this outlet is not mapped; not a Google URL.
- Else log event + **302** (not 301 — token rotation / UTM).
- Cache-Control: `no-store`.
- Public. No login. No cookie required for the guest.

Staff:

- `GET /api/reviews/capture?locationId=` → `{ url, token, placeId, qrPngUrl, intents, newReviews, estimatedRate }`
- QR: PNG of the **Atlas** URL (no UTM in the printed default; staff can add UTM when they copy). Branch prints the same QR.

### Workspace UI

`/reputation` (existing inbox):

- Per-outlet (or toolbar when one location filtered): Review link, Copy, Download QR.
- Tiles: **Review intents** · **New reviews** (same window, default 30 days) · **Estimated capture rate** with **Estimated** label.
- Keep Maps / GBP pull, badges, GBP reply. Maps = Read only + Open in Maps.

Outlets: same link + QR on the location row/detail. If no `place_id`, CTA to paste Maps URL / Place ID (existing mapping), not a dead QR.

### Plan gating

| | Capture QR | Pull Maps snapshot | GBP sync + reply |
|---|---|---|---|
| Free / Silver | Yes (outlets they have) | Yes if mapped | No (Gold Google) |
| Gold+ | Yes | Yes | Yes when GBP connected |

No new SKU. Extra outlet still **+Rp 150 rb**. Draft pack (lock 2026-09-06): Free 2 · Silver Rp 500 rb / 2 + 1 Cloud HQ + blast · Gold Rp 2 jt / 5 + Google + GO + watch · Platinum Rp 8 jt / 15 · Diamond Talk to us.

### Metrics (honest)

Window = last 30 days unless the UI says otherwise.

- Intents = `ReviewCaptureEvent` opened in window.
- New reviews = `Review` rows with `createTime` in window for that location (Maps + GBP).
- Estimated rate = new reviews / intents if intents > 0, else em dash. **Not** a KPI we invoice on.

Do not join an intent to a specific Google review. Dedup of Maps vs GBP on upgrade stays as today’s inbox reconciliation (`externalId` / existing upsert). Do not promise COMPLETE_30_DAY_HISTORY on Places-only; existing Maps pull already uses listugcposts + Places fallback — **P0 does not change that adapter**. Coverage honesty stays on the inbox (Maps snapshot vs GBP owned).

### Errors

| Case | Behavior |
|---|---|
| Bad token | 404 |
| Token exists, no place_id | Atlas page, no redirect |
| Google writereview down | Guest problem; we still counted intent |
| Gold reply without GBP | Hide Reply (already) |
| Rate limit on Maps sync | Existing circuit; Capture still 302s |

### Tests (P0)

- Token unique; 302 location + `placeid=` query.
- UTM persisted on event; printed QR URL has **no** UTM unless staff added it.
- Missing place_id: no 302.
- Estimated rate labeled; 0 intents → no fake %.
- Free tenant can fetch capture URL; reply API still Gold/GBP.
- No PII fields required on event.

## Waves (Full PRD, not one release)

**P0 — this spec’s implementation plan**

Token, `/r/{token}`, QR, UTM, intents, estimated tiles, Reviews + Outlets entry, plan gating as above.

**P1**

- AI sentiment + topics on synced reviews (SpaceXAI).
- Suggested GBP reply, **approve before send**.
- Extra inbox filters (source already; sentiment when AI exists).
- Optional: GBP Pub/Sub if polling misses (not required for Capture).

**P2**

- Multiple assets per outlet (NFC kasir vs QR meja) — own tokens.
- Reputation Score.
- Create Action from review **after** To-do exists.
- Competitor / network benchmarks — only with a licensed source; no scrape expansion without legal review (PRD §37).

## Out of P0 (explicit)

Nav rewrite (Overview / Demand / Campaigns). `/reputation/capture` menu. NFC-specific tokens. Pub/Sub. Auto reply. Native Atlas review form. Posting reviews through any API. Treating listugcposts as a new product. Meta Business Agent.

## Key decisions

1. **302 to Google writereview** — guest already lives in Google; Atlas is the pointer + intent log.
2. **One token / outlet + UTM** — fastest print; placement via `utm_source=nfc|qr|receipt|tent`.
3. **Extend Location/Review** — Capture is a door in front of the inbox we have.
4. **Capture on Free** — time-to-value; reply remains Gold Google.
5. **Estimated, not conversion** — Google does not confirm Post.
6. **AI and Actions later** — no fake To-do, no auto-publish.

## Open questions (none blocking P0)

- Printed QR default UTM or clean URL? **Clean.** Staff add UTM when they copy.
- Token rotation UI? **P1.** P0 generate-once.
- Window 30 days vs billing month? **30 days** on the tiles; do not call it visits.
