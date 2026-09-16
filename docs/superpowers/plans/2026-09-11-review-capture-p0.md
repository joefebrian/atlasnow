# Review Capture P0 Implementation Plan

> **For agentic workers:** Inline execution this session. Joe gassed P0. Do not commit unless asked.

**Goal:** One Atlas link per outlet that logs a review intent and 302s the guest to Google’s write-review page; staff copy URL / download QR; Reviews shows intents, new reviews, estimated rate.

**Architecture:** Extend `Location` + new `ReviewCaptureEvent`. Public `GET /r/{token}`. Reuse Maps `place_id` helpers. Do not rebuild `/reputation` inbox.

**Tech Stack:** Next.js App Router, Prisma/Postgres, `qrcode` (already in repo), node:test.

## Global Constraints

- No Atlas review form. 302 to `https://search.google.com/local/writereview?placeid=`
- One token per outlet; UTM on Atlas URL only
- Never say conversion/visits/sales
- Capture on every plan with outlets; GBP reply stays Gold
- Merchant-plain; workspace not meja
- `/r/` must be public in middleware
- Writable place id = Places `ChIJ…` (not Maps `0x:0x` feature id)
- No `.env` in git

### Task 1: Pure capture helpers + tests
### Task 2: Prisma Location.reviewCaptureToken + ReviewCaptureEvent
### Task 3: Service ensure token / openCapture / stats
### Task 4: Public GET /r/[token] + middleware
### Task 5: Staff API + QR PNG
### Task 6: UI Reviews + Location 360 Reputation + Outlets 360
### Task 7: Deploy live + verify /r/ 302
