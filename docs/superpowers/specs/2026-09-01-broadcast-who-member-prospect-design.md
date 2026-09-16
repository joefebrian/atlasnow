# Broadcast Who: Members vs Prospects

Date: 2026-09-01  
Repo: AtlasNow  
Status: draft for Joe review. Do not implement until this spec is approved.

## Problem

Templates tab **Who** is one mixed list of everyone who ticked birthday WhatsApp on the join form. Dennies and Yusuf sit together. HQ cannot send “come to Villo, 10% if you show this chat” to **members** without also grabbing **calon**.

## Product lock (Joe 2026-09-01)

| Topic | Choice |
|---|---|
| Template audience | Join QR **plus** the WA tick. Not branch chat. Not CSV. |
| Split | **Two blocks** in Who: **Members** and **Prospects**. |
| Members | Tick + **aktif** (first qualifying approved receipt). |
| Prospects | Tick + **calon** (join form filled, no qualifying Approve yet). |
| Chat-only (never scanned) | **Not** on this list. If they wrote **HQ** in the last 24 hours → **Session note** tab only. |
| Branch chats | Never become an HQ blast list. |
| H-2 birthday auto | Unchanged: tick + **aktif** only. Once a year. |
| STOP | Drops the tick; they leave both blocks. |
| Centang form | Now means “ok to WhatsApp from the HQ number” (ultah auto **and** HQ templates). Not a purchased list. |

## What we do not change

- Session note tab (24h HQ inbound).
- Birthday H-2 cron / `birthday_greeting` mapping / kasir code redeem.
- `BROADCAST_MAX` = 50 across **both** blocks combined.
- Send still goes only to phones still opted in (server re-checks `birthdayWaOptIn`).

## UI (Templates → step 2 Who)

One card, two stacks:

1. **Members** — count, Select all (this block only), checkboxes.
2. **Prospects** — same.

Footer: `{n} selected · max 50` (shared pool). Checking a 51st person does nothing (same as today).

Default check state: **Members selected, Prospects unchecked.** Safer than today’s “select everyone who ticked.”

Empty copy: “No members with the join-form tick yet.” / “No prospects with the join-form tick yet.”

Labels: EN **Members** / **Prospects**. ID **Member** / **Calon**.

Rename the old “Birthday opt-in” heading on this step so it does not sound like ultah-only. Eyebrow can stay honest: “Join-form WhatsApp tick.”

## Data

`loadBroadcastAudience` today returns a flat `optedIn[]`.

Split:

- Load `loyaltyMember` where `birthdayWaOptIn: true` (cap 200).
- For those phones, count qualifying **APPROVED** intakes (`stampMeetsMin` + brand min).
- `aktif` → members list. Else registered join → prospects list.
- Same phone never in both.

API JSON: `optedMembers` and `optedProspects` (phone + name). Keep `optedInCount` = sum. Drop relying on a mixed `optedIn` in the desk.

## Send

No new endpoint. POST template still `{ phones, templateName, … }`. Server still allows only opted-in phones. Calon **may** receive a **manual** template if HQ ticked them. Auto H-2 still skips calon.

`go_deal_optin` body `{{1}}…{{4}}` fill is **out of scope**. This spec is Who only.

## Tests

- Aktif + tick → members.
- Join + tick + no qualifying Approve → prospects.
- Chat-only, no join row → neither list.
- STOP (`birthdayWaOptIn: false`) → neither.
- Select-all members does not check prospects.

## Success

On Broadcast → Templates, Who shows two blocks. HQ can tick only members for a Villo 10% template. Yusuf-as-calon sits under Prospects, unchecked by default. Session tab still shows whoever wrote HQ in 24h.
