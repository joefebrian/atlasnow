# TikTok Local Service (GO Dining) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans.

**Goal:** Kasir scans a TikTok GO voucher QR (`TT-…`) at the mapped outlet, sees valid/invalid, and redeems via official Local Service API.

**Architecture:** Same AtlasNow developer app. Merchant token + `merchant_id`. `third_shop_id` = Atlas location. Query then redeem. Not a stamp.

**Spec:** `docs/superpowers/specs/2026-08-28-tiktok-local-service-design.md`

## Global Constraints

- Official `localservice/saas` only. Locale `id-ID`.
- Voucher ≠ stamp. Do not invent visits/GMV.
- BRANCH role locked to that STORE for redeem.
- Do not mix Business Messaging tokens.
- Sequence: Joe Adds Local Service API on developers.tiktok.com **before** G3 sandbox.

## Tasks

### G1 — Catalog + legal
- [ ] Integration `tiktok_go`: merchantId, merchantAccessToken (or reuse client key + merchant_id).
- [ ] Privacy EN+ID: TikTok GO voucher codes, shop ids, redeem events; not ads; not DMs.

### G2 — Shop map
- [ ] Location field / SourceMapping `TIKTOK_GO_SHOP` + `third_shop_id`.
- [ ] Super Admin / brand: paste merchant_id + token.

### G3 — Query at till
- [ ] Scan UI: if payload starts with `TT-`, call `get_code_item_list`.
- [ ] Show name, validity, this-shop-ok. Errors in merchant language.

### G4 — Redeem
- [ ] Confirm → `redeem_code`. Audit. Idempotent on code.
- [ ] Tests: wrong shop, already used, bad QR.

### G5 — Runbook
- [ ] Add Local Service API product. Merchant Portal. Sandbox QR from TikTok. Demo video for app review.

### G6 — HQ WhatsApp template (after till)
- [ ] Broadcast: create MARKETING template `go_deal_optin` (EN+ID) — deal name, outlets, “buy in TikTok, QR at till, this chat is not the voucher, STOP”.
- [ ] Send path: opted-in HQ members only. Block CSV.
- [ ] Privacy: optional Join tick for GO deals, or reuse existing WA opt-in — never silent.
- [ ] Meta App Review notes: this template is Marketing; not Human Agent; not TikTok DM.
