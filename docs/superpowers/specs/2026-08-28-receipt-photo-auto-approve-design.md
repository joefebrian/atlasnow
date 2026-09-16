# Receipt photo → match → auto-Approve

Date: 2026-08-28  
Repo: AtlasNow  
Status: product design from founder chat (brainstorm). **Not built.**  
Amends: [[AtlasNow-Loyalty-Decision]] intake pipes (OCR was “always human Approve”).  
Obsidian: `02 Projects/atlasnow/AtlasNow-Loyalty-Decision.md` § amendment 2026-08-28

## Problem

Kasir already types HP + one receipt number + Rp, then HQ taps Approve. At a few dozen struk/day that is fine. At thousands, HQ is gempor. Founder wants Atlas to **foto struk**, **cocokkan data**, and **Approve sendiri** when the paper matches — with a brand switch to force HQ audit when they want to be preventive.

Today `LoyaltyIntake` has no photo. Unique `trxId` per brand already blocks double stamps. Amount is optional. Human Approve is the only path for the form pipe.

## Locked this chat

| Topic | Choice |
|---|---|
| Receipt number UI | **One field.** Label `No. transaksi / No. Struk / No. Invoice`. Machines print different names for the **same** number. (Shipped 2026-08-28.) |
| Who says sah (default) | **Atlas auto-Approve** if match. Not silent auto on typed numbers alone. |
| What must match | Member HP **in the book** (from kartu / ketik / unggah tamu). **Nomor struk** unique + same on photo. **Nominal** same on photo. Phone printed on the thermal slip is **bonus**, not required. |
| Photo | **Required** to submit. No photo → cannot send. |
| Unreadable photo | Kasir **ketik dari kertas** (fields stay). Photo still attached. **Not auto** — goes to HQ queue. |
| Mismatch (OCR ≠ typed) | Show both numbers. Kasir corrects or sends to HQ. **Not auto.** |
| Whose job is the photo | **Kasir is the easy/main door** (so the till is not slower than paper). **Tamu may also upload** (kartu stamp and/or chat HQ) as a second door. Same match rules. |
| HQ audit mode | Brand can turn **“Kantor cek semua”**. Then even a perfect match waits for human Approve. Preventive; they accept HQ load. |
| POS | **Later.** Atlas API so the merk’s POS can sync member + ticket (HP, trx, amount, outlet). Signed webhook may auto without a photo. Do not fake a Moka/Majoo sync. |
| JOIN vs stamp | Unchanged. Poster = daftar. Stamp only after a valid ticket (auto or HQ). Super Admin does not Approve another merk’s stamps. |

## Non-goals (this spec)

- Invented visits, OCR inventing a stamp count, points wallet.
- Table-sticker scan = stamp.
- Guest upload **replacing** the kasir (kasir stays the easy path).
- Live POS tokens before a signed partnership.
- Auto-Approve **without** a photo (typed-only). That is how people farm stamps.
- Silent auto when OCR failed (“kasir typed it so it must be real”).

## Two doors

```
Door 1 — Kasir (primary, make the till easy)
  Cek HP / Scan QR → member ketemu
  → 1 nomor struk + Rp wajib + foto kertas
  → OCR
      match → APPROVED + stamp (if min)
      mismatch / blur → HQ queue (photo kept)

Door 2 — Tamu (optional, same match)
  Kartu stamp PWA “Kirim struk” and/or foto ke nomor HQ
  → HP = kartu / nomor pengirim WA (must already be a member)
  → OCR nomor + Rp
      match + unique trx + min → auto
      else → HQ queue
```

Door 2 is weaker against old/stolen photos. Unique `trxId` + audit mode are the brakes. If a brand is scared, they turn audit on.

## Till (Door 1)

After member is in the book:

1. Outlet — locked to one cabang for Branch PIC.
2. One box: **No. transaksi / No. Struk / No. Invoice** (required).
3. **Nominal required** for this pipe (top spender uses the same number).
4. **Foto struk required** — rear camera, whole paper, JPEG/WebP, max ~5 MB (same ballpark as broadcast images). Not a WhatsApp screenshot of someone else’s slip if we can help it — still a photo file; uniqueness + match do the work.
5. Client runs OCR (or server). Do not block the till for more than a couple of seconds; if OCR is slow, show “sedang dibaca” then the three outcomes above.
6. Success auto: message **Stamp tercatat** (or “menunggu kantor” if audit on / sent to queue).
7. Guest does **not** have to stand there for HQ. Auto is the default so the queue is empty except failures and audit brands.

Nominal used to be optional. For photo-match auto it cannot stay optional: there is nothing to match Rp against.

## Match rules (all must pass for auto)

1. **HP** exists as a registered member of **this brand** (calon OK — first valid ticket still activates).
2. HP is not a staff number for that outlet (existing guard).
3. **trxId** non-empty, unique per brand (existing unique). Same value as OCR nomor (normalise spaces/dashes).
4. **Amount** integer Rp, equals OCR amount (tolerance: ignore thousands-separator, allow ±0).
5. Amount ≥ brand min (existing `stampMinAmount`; 0 = every valid ticket).
6. Photo stored and readable enough for (3)+(4). If OCR has no nomor or no Rp → **not auto**.
7. If OCR also reads a phone and it **disagrees** with the member HP → **not auto** (HQ). If OCR has no phone → ignore, HP from the book stands.

On auto: `status = APPROVED`, `reviewedAt = now`, `reviewedById = system:ocr-match` (or null + `source` flag). Then the same stamp / WA-after-Approve path as today. Stamp stays sah if WA fails (existing lock).

On queue: `status = PENDING`, photo + typed fields + OCR text + confidence stored so HQ sees them side by side.

## HQ queue

HQ (brand admin / group for that brand) sees pending rows:

- Photo
- Typed nomor + Rp + HP + outlet
- OCR nomor + Rp (+ phone if any) and **cocok / beda / tidak kebaca**
- Approve / Tolak (reason to cabang, not spam to guest)

Audit mode: **every** intake PENDING even on match. Same screen.

Kasir does not Approve their own tickets (existing: brand admin). Branch PIC submits only.

## Guest upload (Door 2) — later PRs, in this PRD

**PWA:** on `/c/{slug}/{memberId}`, a control “Kirim struk” — camera, same fields minus HP (HP = this card). Same match. If they never allowed camera, they cannot use this door; kasir still can.

**WA HQ:** member (or unknown) sends an image to the Cloud API HQ number. If the sender HP is a member, treat as Door 2 intake. If not a member: do **not** stamp; tell them to JOIN first (existing honesty). Do **not** treat branch-monitor chats as stamps.

Not in Door 2: join QR, table stickers, random people texting photos to a branch WAHA number.

## POS API (later, own PRs)

Atlas publishes a **signed** intake endpoint (per-brand token):

`HP, trxId, amount, outletId, closedAt`

No photo required when the body is signed by that merk’s POS. Auto allowed (already in the 2026-08-25 POS lock). Settings show Moka / Majoo / Other as **Coming, connect when ready** until a real token exists.

This does not replace Door 1. Brands without POS keep the camera.

## Data (direction)

`LoyaltyIntake` add:

- `photoBytes` / object store key + `photoMime` (do not git; same privacy class as member data)
- `ocrJson` (nomor, amount, phone?, confidence)
- `matchStatus` `MATCH` | `MISMATCH` | `UNREADABLE` | `SKIPPED`
- `source` already exists (`FORM`). Add `GUEST_PWA` | `GUEST_WA` | `POS` | `OCR` as needed.

`LoyaltyProgram` add:

- `receiptAuditMode` bool, default false (auto on match)
- `receiptPhotoRequired` bool, default true for the form pipe

Retention: photos are evidence. Keep at least until reviewed + a brand-set window (default 90 days) then delete bytes, keep trxId/amount/status. Exact days can be a later settings row; do not invent a legal hold.

OCR vendor: pick at implementation (on-device vs server). Must run on VPS, no sending struk to a random third party without a DPA. If OCR is weak on thermal Indonesian slips, **fail to HQ**, do not guess a stamp.

## Fraud (updated)

| Guard | Rule |
|---|---|
| Unique trxId | Same paper cannot stamp twice |
| Photo required on form/guest | Typed-only auto is off |
| Auto only on MATCH | Blur and mismatch never auto |
| Audit mode | Brand can force humans |
| Staff HP | Existing block |
| Guest Door 2 | Weaker; unique trx + optional audit |
| Super Admin | Still does not stamp someone else’s merk |

## Key decisions

1. **Auto is match-gated, not “kasir typed it.”** Keeps the honesty lock as close as POS-signed auto.
2. **Kasir door first** so the till is faster than HQ-every-row. Guest upload is extra, not the design centre.
3. **Nominal wajib** on this pipe so Rp can match.
4. **OCR failure ≠ auto.** Manual retype still needs HQ unless they retake and then MATCH.
5. **POS stays the clean auto path** when a real connector exists; camera is the path for everyone else.
6. **Amends 2026-08-25** “OCR always human” and “OCR as auto-approve = not in lock”. Dated in Loyalty-Decision. Form-without-photo human-Approve remains history; form-with-photo is this spec.

## Open questions (park, do not block the spec)

- OCR engine / on-device vs server — implementation plan, not product.
- Exact photo retention days — default 90 until a lawyer/brand asks.
- Guest Door 2 on by default vs brand toggle — recommend **off until Door 1 is live**, then a brand switch “Tamu boleh kirim struk”.

## PR Plan

1. **PR: photo on intake, HQ sees it, still human Approve**  
   Files: Prisma `LoyaltyIntake` photo, submit API multipart, LoyaltyDesk camera on Isi struk, queue thumbnail. Photo required. Amount required on this form. No OCR yet.  
   Unlocks evidence. HQ still gempor but can see the paper.

2. **PR: OCR + match badge, till mismatch UI**  
   Server OCR, store `ocrJson` + `matchStatus`. Kasir sees cocok/beda/buram. Still no auto.

3. **PR: auto-Approve on MATCH + brand audit switch**  
   If MATCH and not audit → same `reviewIntake` approve path as system. HQ queue only PENDING. Settings → Loyalty: “Kantor cek semua”.

4. **PR: guest PWA “Kirim struk”** (brand toggle, default off)  
   Member card only. Same match. Not JOIN.

5. **PR: guest WA HQ image** (needs Cloud API ingest)  
   Only if sender is a member. Ignore branch WAHA.

6. **PR: POS signed intake API** (when a merk actually has a partner token)  
   Independent of camera. Settings stub already conceptually exists.

Do not start PR 3 before PR 2 is honest on thermal photos (measure fail rate on real Vilo/P2P slips). If OCR cannot read Indonesian thermal, stay on PR 1+HQ and do not ship auto.

## Testing (when we build)

- Unique trx still 409.
- No photo → 400.
- MATCH auto → stamp +1, intake APPROVED, no HQ row.
- MISMATCH → PENDING, HQ can Approve/Tolak.
- UNREADABLE → PENDING.
- Audit on + MATCH → PENDING.
- Staff HP rejected before OCR.
- Below min → no stamp even on MATCH (existing).
- Guest non-member → no stamp.
- POS signed without photo → auto (PR 6 only).
