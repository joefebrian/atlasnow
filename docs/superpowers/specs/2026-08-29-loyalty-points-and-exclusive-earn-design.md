# Loyalty: points + exclusive earn programs

Date: 2026-08-29  
Repo: AtlasNow  
Status: locked in founder chat. Do not implement until Joe says gas.  
Amends: [[AtlasNow-Loyalty-Decision]] — stamp and top spender stay; they are no longer allowed **on at the same time**. Birthday stays complimentary.

## Why

Stamp (1 receipt = 1 punch) and points (Rp → wallet) are different products. Running both on one ticket confuses cashier and HQ chat (`Status Stamp` vs poin). Top spender is a monthly rank, also a different engine. Owners still want to **see** all three and switch.

## Four programs

| # | Program | Earn from a valid ticket? | UI |
|---|---|---|---|
| 1 | Stamp | Yes | Checkbox. Stays visible. |
| 2 | Point | Yes | Checkbox. Stays visible. New. |
| 3 | Top spender | Yes (amount on the ticket) | Checkbox. Stays visible. |
| 4 | Birthday | **No.** Complimentary gift + greeting | Checkbox. Independent. |

A **valid ticket** is unchanged: member exists, unique receipt number, photo, amount, MATCH (or HQ Approve). One ticket may feed **the single earn program that is on**.

## Earn exclusivity (the save rule)

Checkboxes **do not hide**. Activation = checked.

On **Save**, count how many of `{ stamp, point, top spender }` are checked:

- **0** — allowed. Only birthday, or nothing.
- **1** — allowed.
- **2 or 3** — **Save fails.** No partial write.

Copy (EN): `Pick only one earn program: stamp, points, or top spender. Birthday can stay on.`  
Copy (ID): `Pilih satu program dari struk: stamp, poin, atau pelanggan teratas. Ultah boleh tetap nyala.`

Do not convert this into a radio that removes the other two. Founder: keep the ticks, fail the save.

## Switch (freeze)

If the brand turns A off and B on (save succeeds because only one earn is checked):

- Old stamp / points **freeze**: no new earn on that engine.
- Leftover stamps / points **still redeemable** at cashier until gone.
- New engine starts on the **next** valid ticket.
- Top spender: the month in progress for the old program does not convert into points or stamps.

Birthday is not frozen by this.

## Point engine

Brand sets two numbers (example, not a hardcode):

- Every **Rp 100.000** → **1.000** points  
- Remainder does not round up: Rp 250.000 → 2.000 points; Rp 99.000 → 0.

Formula: `floor(amount / unitRupiah) * pointsPerUnit`.

Redeem like stamp rows: `5.000 points → tumbler`. Enough balance, cashier redeems, **points decrease**. Gift rows do not reset the wallet to zero unless the brand later asks for that.

Not: QR join earns points. Not: TikTok GO voucher earns points. Not: Rp discount at POS (later).

## Birthday (unchanged job, named clearly)

Complimentary from the brand. Once a year at cashier. HQ WhatsApp **greeting** only to members who ticked birthday WA. Not a CSV. Not earned from the ticket.

## Out

- Invented visits / spend.
- Mixing stamp + points + spender on one save.
- Hiding checkboxes.
- Auto-converting frozen stamps into points.

## Done when (implementation, later)

- Settings: three earn checkboxes always shown; Save 409/400 with the copy above if >1.
- Point tab: unit Rp, points per unit, gift rows, cashier redeem deducts.
- One valid ticket increments only the active earn program.
- Tests: dual-check save fails; freeze then redeem leftover; birthday + one earn saves.
