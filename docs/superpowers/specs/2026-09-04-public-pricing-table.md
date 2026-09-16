# Public pricing table — draft for Joe review

Date: 2026-09-04  
Status: **Live on `/pricing`.** Extra outlet UI = `− n +`. Featured = Gold. Names: Free / Silver / Gold / **Platinum** / Diamond. **2026-09-06:** Silver = **Rp 500.000**, **1 Cloud HQ number + blast** (not branch WAHA). Platinum included = **15**. Wide shell `max-w-[1600px]`. Packages can still be adjusted later; existing SOWs grandfather.  
Master: Monetization PRD. WhatsApp **credits** stay a separate line (WABA spec), not a fifth metal.

**Cancel / refund (Joe 2026-09-07):** no cash refund of a paid invoice (unused days + 90-day pilot) or unused WhatsApp credits. Workspace stays on until the paid period ends. 30-day notice stops the next invoice. Copy lives on `/pricing#cancel` and `/terms#fees-cancellation-refunds`. Not a Creem/card refund flow.

Joe (this round): packages **Silver / Gold / Premium 8 jt / Diamond**. Extra outlet UI = **`−  n  +`**. Column for the **price increment**. Diamond = own domain + own server, **talk to us**. Packages can be adjusted later.

## Can we adjust later?

**Yes.** This file is a draft, not a contract.

| When | What happens |
|---|---|
| Now (unticked) | `/pricing` stays **Free + we’ll quote**. These metals exist only here + in chat. |
| After lock | Print on `/pricing`. New brands get the printed numbers. |
| After print, Joe changes a number | **New** SOWs use the new table. **Existing** brands stay on the SOW they signed (grandfather) unless Joe writes a change order. |
| Names / included doors / 150 rb | Same rule. Change the spec → tick again → then change the site. |

Do not surprise a paying brand with a silent bump.

## Monthly operate cost (Joe 2026-09-04)

AtlasNow only. **Not** p2plabs.asia VPS. Grok = **30%** of the 6 jt Labs seat (modal / copilot), not 100%.

| Line | IDR / month | In the fee? |
|---|---:|---|
| Grok (30% × 6 jt) | 1.800.000 | R&D / copilot — cover from **margin**, not from 2 free outlets |
| VPS AtlasNow (8 GB) | 500.000 | Yes — COGS (shared box for Silver–Premium) |
| Domain | 25.000 | Yes — COGS (last figure Joe gave) |
| Google Workspace (`hello@` + `support@` p2plabs.asia) | 500.000 | Yes — COGS |
| Manpower | 5.000.000 | Ops — cover from paying metals, not Free |
| **Total operate** | **7.825.000** | |
| of which hard infra (VPS+domain+mail) | **1.025.000** | Must be covered even in a quiet month |
| of which people + Grok slice | **6.800.000** | Needs paying brands |

WhatsApp Cloud / Maps / TikTok API: **not in this table** (Meta/Google bill the WABA or the key). Credits sit on top.

**Break-even vs this draft**

- **1 Premium** (8 jt) ≈ one quiet month of operate (7.825 jt). That is why Premium sits here.
- Infra 1,025 rb ≈ ½ of **Gold** (2 jt) or ~3 × **Silver** (350 rb).
- Extra cabang **150 rb** is **desk value**, not a new VPS — except **Diamond**, which *is* a dedicated box.

## Honest cost (so we don’t price “nambah server”)

One Biznet VPS already runs **all** Silver / Gold / Premium brands (app + Postgres + Caddy + WAHA). Adding outlet #3 is **rows in the database**, not a new machine.

| What actually grows | Who pays |
|---|---|
| RAM / disk on the shared box | Us, already. Cap Free at **2 outlets** to convert, not because of RAM. |
| Radit / follow-up time | Us. That’s why Free has no Cloud and login after follow-up. |
| Meta / Google / TikTok API | Their accounts + WhatsApp **credits** (WABA spec). |
| Per-outlet add-on | **Value** of the desk (list, till, later listings) — not a VM surcharge. |
| Dedicated VPS + custom domain | **Diamond only** — quoted. Here extra load *can* mean a bigger box. |

WAHA live Chromium still max **6** on the 8 GB box. Extra doors ≠ extra live WhatsApp sessions. Do not sell “unlimited chat phones.”

---

## Four metals (DRAFT)

English names on the site. **Free** stays the start (Rp 0, 2 outlets) — not a metal. IDR **DRAFT**.

Silver / Gold IDR **carried from last round** (350 rb / 2 jt) until Joe overwrites them. Premium **8.000.000** and Diamond **talk to us** are from this round.

| | **Silver** | **Gold** | **Premium** | **Diamond** |
|---|---|---|---|---|
| Badge | Till, no APIs | WhatsApp + Google + GO | Full desk, covers a quiet month | Own domain + own server |
| Price | **Rp 350.000** / month | **Rp 2.000.000** / month | **Rp 8.000.000** / month | **Talk to us** |
| Outlets included | **2** | **5** | **TBD — Joe** (rec below: **15**) | Quoted with the box |
| Extra outlet | **+150 rb** via `− n +` | Same add-on | Same add-on | Quoted (dedicated box) |
| Loyalty + kasir | Yes | Yes | Yes | Yes |
| Members + monthly report | Yes | Yes | Yes | Yes |
| HQ WhatsApp / Google / live TikTok GO | No | Yes | Yes | Yes |
| WhatsApp **pesan** | — | **Kredit** (Meta + later Atlas). 1.000 service free/phone is Meta’s, not this table. | Same | Same, on their stack |
| Infra | Shared AtlasNow VPS | Shared | Shared | **Own server + own domain** |
| Who | Rantai yang belum mau Cloud | Owner yang bayar inbox | Rantai yang mau meja penuh | Holding / white-label / isolation |

**Silver** = till + extra doors, still no Cloud.  
**Gold** = inbox + listings + GO till live. **5 cabang included**, then add-on.  
**Premium** = same product as Gold, bigger included doors + the 8 jt band (≈ operate).  
**Diamond** = we build on **their domain** and **their (or a dedicated) server**. No public IDR. CTA = **Talk to us**.

Free (not a column on the paid table): **Rp 0**, **2 outlets**, no Cloud. Login after follow-up.

### Premium included doors — recommendation (unticked)

8 jt is **4 × Gold**. Gold includes 5 doors. If we only included 5 on Premium, the 6 jt gap is pure margin / support, which is honest — but the table looks empty.

Rec (not locked): **15 included** on Premium.  
Then extra still **+150 rb**. 15 doors on shared infra is still cheap (DB rows). WAHA live sessions stay capped at 6 unless they buy Diamond / a bigger box.

Joe: tick **15**, pick another number, or “same 5 as Gold + the 8 jt is support.”

---

## Public page — feature cards (execution copy)

Joe 2026-09-04: pull the **attractive** features Free → Diamond so `/pricing` can ship.  
Rule: only what is **live today** (help `live-vs-later`). Do not sell Google posts, ads, weekly to-do, POS auto-approve, native TikTok/IG/Messenger inbox, or white-label mobile.

**Page shape**

1. Hero + lede (below).
2. Five cards: Free · Silver · Gold (**featured**) · Premium · Diamond.
3. One extra-outlet stepper under Silver/Gold/Premium + **pertambahan** + **total**.
4. Comparison table (full matrix).
5. Foot: WhatsApp credits billed separately · not live / not sold · honest numbers.

**Hero (EN / ID)**

- EN title: Start free. Pay when the inbox and listings go on.
- EN lede: Free is the membership desk — join QR, stamps, cashier photo. Silver adds doors. Gold turns on HQ WhatsApp, Google, and the TikTok GO till. Premium is the long chain on the shared box. Diamond is your domain and your server. Login stays off until we follow up. No card on sign-up.
- ID title: Mulai gratis. Bayar saat inbox dan listing nyala.
- ID lede: Gratis = meja membership — QR daftar, stamp, foto kasir. Silver nambah pintu. Gold nyalain WhatsApp HQ, Google, dan kasir TikTok GO. Premium = rantai panjang di server bersama. Diamond = domain dan server sendiri. Login belum nyala sampai kami follow up. Daftar tanpa kartu.

**Featured = Gold.** That is the desk the owner pays for (inbox + listings + GO). Not Premium (that is volume). Not Free (that is the hook).

### Card bullets — EN

Keep ≤ 6 ticks. Grey “not on this plan” under each card.

**Free** — Rp 0 · badge Start here · CTA Start free  
Sub: One brand. Two outlets. Use the desk before any API is connected.

- 2 outlets on one brand. Stop at 2.
- Join QR is sign-up only — name, phone, birthday. Member card after.
- Loyalty: stamp, points, or top spender — pick one. Birthday can stay on.
- Cashier photos the receipt. A stamp only if number and Rp match.
- Members and the monthly report from approved tickets — not invented visits.

Not on this plan: HQ WhatsApp · Google listings · TikTok GO live till · blast · outlet #3.

**Silver** — Rp 350.000/mo · badge Till, no APIs · CTA Start Silver  
Sub: Same desk as Free. Extra doors. Still no Cloud.

- Everything in Free.
- Extra outlets with − n +. Free stops at 2.
- Every branch on one list: hours, till, which door still needs a person.
- HQ Approve queue when the photo is blurry or the paper does not match.
- Report = receipts, stamps, gifts handed over. We do not invent visits, leads, or revenue.

Not on this plan: HQ WhatsApp inbox · Google · TikTok GO live · blast.

**Gold** — Rp 2.000.000/mo · badge Inbox + listings + GO · CTA Start Gold · **featured**  
Sub: The official brand number, Google, and the TikTok GO till. This is what the owner pays for.

- Everything in Silver. **5 outlets** included, then − n +.
- HQ WhatsApp inbox on the official brand number. A person replies — not a bot.
- Branch chats can be watched. Atlas does not reply from the branch number.
- Google listings: name, pin, hours, phone. Review replies by a person.
- TikTok GO till: check, redeem, recap per outlet, invite them to join. A paid GO voucher is not a stamp.
- Opt-in templates from that HQ number. Meta’s rate extra (credits). STOP still works.

Not on this plan: own domain · own server · native TikTok / IG / Messenger inbox.

**Premium** — Rp 8.000.000/mo · badge Long chain, one desk · CTA Start Premium  
Sub: Same product as Gold. More doors included. Covers a quiet month of AtlasNow.

- Everything in Gold. **15 outlets** included (rec — Joe tick), then − n +.
- One recap across every door: stamps, GO vouchers handed over, receipts, which outlet is quiet.
- Shared AtlasNow server — you do not need Diamond yet.
- Training on the desk. Login after follow-up, same as Gold.

Not on this plan: own domain · own server.

**Diamond** — Talk to us · badge Own domain + own server · CTA Talk to us  
Sub: We build AtlasNow on your domain and your server. Isolation from the shared box.

- Everything in Premium, on a stack that is yours.
- Your domain. Your (or a dedicated) server. Quoted with the box.
- Group desk if you run more than one brand. Each brand keeps its own HQ number and members.
- WAHA live-session cap sized to *your* box — not the shared 6.
- A person quotes. No card on this page.

Not on this plan: we do not sell a white-label mobile app as live. We do not sell Meta Business Agent.

### Card bullets — ID

**Gratis** — Rp 0 · Mulai di sini · Mulai gratis  
Sub: Satu merek. Dua outlet. Pakai mejanya dulu, sebelum API mana pun nyambung.

- 2 outlet di satu merek. Berhenti di 2.
- QR daftar hanya daftar — nama, HP, ultah. Kartu member setelah itu.
- Loyalty: stamp, poin, atau pelanggan teratas — pilih satu. Ultah boleh tetap nyala.
- Kasir foto struk. Stamp hanya kalau nomor dan Rp cocok.
- Member dan laporan bulanan dari tiket yang disetujui — bukan kunjungan karangan.

Tidak di paket ini: WhatsApp HQ · listing Google · kasir TikTok GO live · blast · outlet ke-3.

**Silver** — Rp 350.000/bln · Kasir, tanpa API · Mulai Silver  
Sub: Meja yang sama dengan Gratis. Pintu extra. Masih tanpa Cloud.

- Semua yang ada di Gratis.
- Tambah outlet dengan − n +. Gratis berhenti di 2.
- Semua cabang di satu daftar: jam, kasir, mana yang masih butuh orang.
- Antrian Approve HQ kalau foto buram atau kertas tidak cocok.
- Laporan = struk, stamp, hadiah yang diserahkan. Kami tidak mengarang kunjungan, lead, atau omzet.

Tidak di paket ini: inbox WhatsApp HQ · Google · TikTok GO live · blast.

**Gold** — Rp 2.000.000/bln · Inbox + listing + GO · Mulai Gold · **featured**  
Sub: Nomor resmi merek, Google, dan kasir TikTok GO. Ini yang owner bayar.

- Semua yang ada di Silver. **5 outlet** included, lalu − n +.
- Inbox WhatsApp HQ di nomor resmi merek. Orang yang membalas — bukan bot.
- Chat cabang bisa dilihat. Atlas tidak membalas dari nomor cabang.
- Listing Google: nama, pin, jam, telepon. Balasan ulasan oleh orang.
- Kasir TikTok GO: cek, tukar, recap per cabang, ajak daftar. Voucher GO berbayar bukan stamp.
- Template opt-in dari nomor HQ itu. Tarif Meta terpisah (kredit). STOP tetap jalan.

Tidak di paket ini: domain sendiri · server sendiri · inbox native TikTok / IG / Messenger.

**Premium** — Rp 8.000.000/bln · Rantai panjang, satu meja · Mulai Premium  
Sub: Produk yang sama dengan Gold. Lebih banyak pintu included. Setara sebulan operate AtlasNow.

- Semua yang ada di Gold. **15 outlet** included (rec — Joe tick), lalu − n +.
- Satu recap semua pintu: stamp, voucher GO yang diserahkan, struk, cabang mana yang sepi.
- Server bersama AtlasNow — belum perlu Diamond.
- Training di meja. Login setelah follow-up, sama seperti Gold.

Tidak di paket ini: domain sendiri · server sendiri.

**Diamond** — Talk to us · Domain + server sendiri · Talk to us  
Sub: Kami pasang AtlasNow di domain dan server kamu. Isolasi dari box bersama.

- Semua yang ada di Premium, di stack yang milik kamu.
- Domain kamu. Server kamu (atau dedicated). Harga ikut box.
- Meja Grup kalau kamu pegang lebih dari satu merek. Tiap merek tetap punya nomor HQ dan member sendiri.
- Cap sesi live WAHA mengikuti *box kamu* — bukan 6 di server bersama.
- Orang yang pasang. Tidak ada kartu di halaman ini.

Tidak di paket ini: kami tidak menjual aplikasi mobile white-label sebagai live. Kami tidak menjual Meta Business Agent.

---

## Comparison table (same page, under the cards)

✓ = on the plan. — = not on the plan. Kredit = billed separately.

| | **Free** | **Silver** | **Gold** | **Premium** | **Diamond** |
|---|---|---|---|---|---|
| Price | Rp 0 | Rp 350.000 | Rp 2.000.000 | Rp 8.000.000 | Talk to us |
| Outlets included | 2 | 2 | 5 | 15 rec | Quoted |
| Extra outlet +150 rb (`− n +`) | — (hard stop) | ✓ | ✓ | ✓ | Quoted |
| Join QR + member card | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stamp / points / top spender + birthday | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cashier receipt photo + HQ Approve | ✓ | ✓ | ✓ | ✓ | ✓ |
| Members + monthly report (receipts, not visits) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Outlet list (hours, who needs a person) | 2 doors | ✓ | ✓ | ✓ | ✓ |
| HQ WhatsApp inbox (person, not a bot) | — | — | ✓ | ✓ | ✓ |
| Branch chat watch (no send from branch) | — | — | ✓ | ✓ | ✓ |
| Google listings + human review replies | — | — | ✓ | ✓ | ✓ |
| TikTok GO till (scan, redeem, recap, invite join) | — | — | ✓ | ✓ | ✓ |
| Opt-in WhatsApp blast | — | — | Kredit | Kredit | Kredit |
| Training on the desk | — | — | — | ✓ | ✓ |
| Group desk (several brands) | — | — | — | — | Quoted |
| Own domain | — | — | — | — | ✓ |
| Own / dedicated server | — | — | — | — | ✓ |

**Do not put a ✓ on:** native TikTok DMs · Instagram / Messenger as Wave A inbox · Google posts · ads · weekly to-do · POS auto-approve · white-label mobile · Meta Business Agent · “unlimited WhatsApp.”

**Foot extras (already on `/pricing` today)**

- WhatsApp templates: opt-in from the official HQ number. Meta’s rate. Not a CSV. STOP works. 1.000 free service msgs / WABA phone / month is Meta’s gift from 1 Oct 2026, not this table.
- Not live, not sold: Google posts, ads, weekly to-do, POS auto-approve.
- Honest: reports are receipts, stamps, and gifts handed over. A paid TikTok GO voucher is not a stamp. We do not invent visits, leads, or revenue.

**Hook line under each price (one sentence)**

| Plan | EN | ID |
|---|---|---|
| Free | Use the desk first. | Pakai mejanya dulu. |
| Silver | Many doors. Not ready for Cloud. | Banyak pintu. Belum mau Cloud. |
| Gold | They write HQ. You keep them. | Mereka nulis HQ. Kamu yang menahan. |
| Premium | The long chain on one desk. | Rantai panjang di satu meja. |
| Diamond | Your domain. Your server. | Domain kamu. Server kamu. |

---

## Extra-outlet UI — `−  n  +` + increment column

Not a dropdown. Not “unlimited” as a word. A stepper on **every extra door after the included ones**.

```
Extra outlets     [ − ]   2   [ + ]
```

- Starts at **0** (use only what’s included).
- `+` goes 1, 2, 3, … no public cap on **door count** (DB is cheap).
- `−` stops at 0.
- **Diamond** has no public stepper — extra doors go in the quote.

### Increment column (same add-on, all three metals)

Add-on = **Rp 150.000** / extra outlet / month. Column updates as they click.

| Extra (`n`) | Increment column | How it reads |
|---:|---:|---|
| 0 | **+ Rp 0** | Included doors only |
| 1 | **+ Rp 150.000** | |
| 2 | **+ Rp 300.000** | |
| 3 | **+ Rp 450.000** | Joe’s “1 / 2 / 3” example |
| 4 | **+ Rp 600.000** | …and so on |

**Total this month** = metal price + increment. WhatsApp credits **not** in this total.

### Worked examples (DRAFT) — stepper at **+3** extra

| Metal | Base | Extra `n=3` | Total / month |
|---|---:|---:|---:|
| Silver | 350.000 | +450.000 | **Rp 800.000** |
| Gold | 2.000.000 | +450.000 | **Rp 2.450.000** |
| Premium | 8.000.000 | +450.000 | **Rp 8.450.000** |
| Diamond | — | — | **Talk to us** |

### Worked examples — real setups

| Setup | Math | / month |
|---|---|---|
| 2 outlets, coba loyalty | Free | **0** |
| 2 outlets, till only | Silver (2 included), stepper 0 | **Rp 350.000** |
| 5 outlets, till only | Silver 350 + 3 × 150 | **Rp 800.000** |
| 5 outlets + APIs | Gold (5 included), stepper 0 | **Rp 2.000.000** |
| 8 outlets + APIs | Gold 2 jt + 3 × 150 | **Rp 2.450.000** |
| 15 outlets + APIs | Premium 8 jt (if 15 included), stepper 0 | **Rp 8.000.000** |
| 18 outlets + APIs | Premium 8 jt + 3 × 150 | **Rp 8.450.000** |
| 40 outlets + APIs on shared box | Gold 2 jt + 35 × 150 | **Rp 7.250.000** |
| Own domain + own VPS | Diamond | **Talk to us** |

Blast / service after Meta’s 1.000: **not in these numbers** (wallet).

### Public calculator (shipped)

One stepper drives Silver / Gold / Premium. Free ignores it. Diamond has no stepper.

```
                 Silver          Gold            Premium         Diamond
Price            Rp 350.000      Rp 2.000.000    Rp 8.000.000    Talk to us
Included         2 outlets       5 outlets       15              Quoted
Extra outlets    [−] 3 [+]       [−] 3 [+]       [−] 3 [+]       —
Pertambahan      + Rp 450.000    + Rp 450.000    + Rp 450.000    —
Total / month    Rp 800.000      Rp 2.450.000    Rp 8.450.000    Talk to us
CTA              Start Silver    Start Gold      Start Premium   Talk to us
```

---

## Why these rupiah (Joe 2026-09-04 + this round)

- **Silver 350 rb** = monitoring doors, no Cloud. 2 included. (was “Outlet / Desk”)
- **Gold 2 jt** = inbox + Google + GO live. 5 included. (was “Brand / Connect”)
- **Premium 8 jt** = Joe this round. ≈ monthly operate. **15** included (gas 2026-09-04).
- **+150 rb / extra cabang** on Silver, Gold, Premium. One rule. Stepper shows 1 / 2 / 3 as they click.
- **Diamond** = dedicated domain + server. No list price. Talk to us.
- Round numbers. Not Rp 356,65.

## Vendor bills — who can make us boncos

| Vendor | Does AtlasNow get an invoice? | Boncos if… | Rule |
|---|---|---|---|
| **Meta WhatsApp Cloud** | Only if **P2P’s WABA** (payment method on *our* account) | Blast without prepaid credits; service after 1.000 on *our* number | Default **`billingOwner = BRAND`**. Their WABA, their Meta bill. P2P WABA → **hard block** if wallet empty. Payment method on WABA by **30 Sep 2026** or Meta **stops delivering** service 1 Oct. |
| **Meta** app / Messenger / IG | No per-message like WA for Page inbox | Almost none | Don’t turn on Meta Business Agent (~4–5¢ USD/msg). |
| **Google Business Profile** APIs | Usually **no** per-call fee for *their* listings | Staff time, quota 0 until Google allowlist | Brand’s Google login. |
| **Google Maps / Places** (if we switch the key on) | **Yes** — GCP billing | Uncapped geocode/places | Keep keys **off** until Brand + budget alert in GCP. Nominatim stays free for address. |
| **TikTok** Developer / GO Local Service | **No** per-scan bill to us that we should price in | None expected for redeem | Merchant’s GO `merchant_id`. Our app keys stay ours. Don’t mix with DMs. |
| **Google Workspace** | Already in operate cost (500 rb) | Fixed | Two mailboxes. |
| **Dedicated VPS + domain (Diamond)** | **Yes** — we buy or they buy | Underspec’d box / we eat their RAM | Quote includes the box. Not hidden in 150 rb. |

**Fear check:** with brand WABA (merchant pays Meta) + Maps keys off, vendor surprise on Silver–Premium ≈ **0**. The hole is only **P2P WABA + blast/service** without credits — that’s why wallet + block exists. Diamond: the hole is **we forget to bill the box**.

## What stays off the table

- Invented visits, leads, omzet.
- “Unlimited WhatsApp.”
- Meta Business Agent.
- Pack IDR for credits (still DRAFT).
- Self-serve card checkout.
## Lock list (Joe gas 2026-09-04)

- [x] We can change names/IDR later; live brands grandfather via SOW.
- [x] Free = **2 outlets**, 1 brand; Cloud/WABA on Free still a separate tick (1.000 service = Meta, blast = kredit).
- [x] Extra outlet add-on = **Rp 150.000** / month. UI = **`− n +`**. Increment column = `n × 150 rb`. No cap on door count (DB is cheap). WAHA still max **6** live sessions on the shared 8 GB box — not sold as unlimited chat phones.
- [x] **Silver** = **Rp 350.000** / month (2 included, no Cloud).
- [x] **Gold** = **Rp 2.000.000** / month (**5** included, APIs on).
- [x] **Premium** = **Rp 8.000.000** / month. Included outlets: **15** (Joe gas 2026-09-04).
- [x] **Diamond** = own domain + own server, **Talk to us** (no public IDR).
- [x] WhatsApp usage = **kredit**, not a metal column.
- [x] Card bullets + comparison table in this spec (Free → Diamond). Featured = **Gold**.
- [x] Print on `/pricing` (Joe gas 2026-09-04).

Shipped: `pricing.ts` + `PricingPage.tsx` / `PricingTable.tsx` (5 cards + stepper + comparison table) + landing teaser.
