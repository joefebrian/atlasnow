# WhatsApp experience and policy contract

Status: **pure eligibility checks.** No merchant is onboarded. No Flow is published. No catalog write. The QA catalog and the imported product are unchanged.

## Experiences

`WHATSAPP_CATALOG`, `WHATSAPP_FLOW`, and `WHATSAPP_CHAT` are customer interfaces. They share the orchestrator. They do not each own a transaction engine.

| Source event | Intent | Reservation |
|---|---|---|
| `catalog.order` | `PRODUCT_ORDER`. May carry `CommerceOrder.reference` as a pointer | Not created. `confirmed` is false |
| `catalog.cart` | `ENGAGEMENT` | Not created |
| `flow.submission` | `STRUCTURED_RESPONSE` | Not created |
| `flow.selection` | `BOOKING_REQUEST` | Not created. The next booking state, if a provider later accepts it, would be `REQUESTED`, not `CONFIRMED` |
| `chat.message` with qualification | `QUALIFIED_INQUIRY` | Not created |
| `chat.message` without qualification | `ENGAGEMENT` | Not created |

Chat is denied as a transaction. It can still be a lead.

## Eligibility record

A later persisted check needs these facts. This milestone only evaluates the inputs it is given:

| Fact | Values | Fail closed when |
|---|---|---|
| Merchant | `UNKNOWN`, `ELIGIBLE`, `INELIGIBLE` | Not `ELIGIBLE` |
| Offering category | `GENERAL_GOODS`, `ADMISSION_TICKET`, `VOUCHER`, `GIFT_CARD`, `SERVICE`, `UNKNOWN` | `UNKNOWN`, or a restricted category without a matching allow |
| Experience | Catalog, Flow, chat | Chat for any transaction. Flow for restricted categories |
| Surface | Catalog and Flow are the transactional surfaces in this check | A service on either surface |
| Approval evidence | A non-empty reference string | Missing, blank, or unknown |
| Review status | Not copied from Meta review on the product | Internal catalog eligibility is still never set to `ELIGIBLE` by the product form |

`evaluateEligibility` returns `transactional: DENY | ALLOW` and `leadCapture: ALLOW`. Lead capture is not a booking and not a payment.

## Rules implemented

1. `WHATSAPP_CHAT` never allows a transaction
2. Merchant eligibility other than `ELIGIBLE` denies the transaction, including `UNKNOWN` and `INELIGIBLE`
3. Offering category `UNKNOWN` denies the transaction
4. `SERVICE` is denied on Catalog and on Flow
5. `ADMISSION_TICKET`, `VOUCHER`, and `GIFT_CARD` are denied on Flow even when an evidence reference is present. Flow must not be used to route around a catalog restriction
6. Any remaining allow requires a non-empty approval evidence reference
7. `GENERAL_GOODS` on Catalog or Flow is allowed only when the merchant is `ELIGIBLE` and evidence is present
8. `ADMISSION_TICKET` on Catalog is allowed only when the merchant is `ELIGIBLE` and evidence is present. The string is not proof that Meta has approved the seller. A later slice has to store the real approval. Until that exists, callers must pass null and the check stays denied

`reserve` runs this check before it resolves a provider. A denial does not call the provider.

## What this does not do

- It does not create a tenant, a location, a WABA row, or a commerce connection
- It does not import, sync, or relink a catalog
- It does not change `catalogEligibility` on `CommerceProduct`. That field remains `UNKNOWN` or `INELIGIBLE` in the product master. The policy type `ELIGIBLE` is an orchestrator input, not a value the product form can save
- It does not send a Flow or a template
- It does not treat Meta review `APPROVED` as internal eligibility. Catalog import already keeps those separate

## Pilot boundary

Transactional WhatsApp for admission tickets, vouchers, gift cards, and services stays off until merchant eligibility and approval evidence are both real records. A public marketing page that lists inquiries is not that evidence.

No pilot name is branched on in code. Do not add a workspace, a product, a flag, or a connection to satisfy this contract.

## Catalog commerce that already exists

Discovery, import, publish preview, and the product master stay on their current switches. This policy module is not consulted by those routes. Turning on a catalog switch is still a separate decision. Order capture stays off. Payments stay off. `items_batch` is not called from this module.

## UX later

When a screen exists, a denied category shows as blocked. It does not show a book or pay action. Unknown is not displayed as eligible. Chat can show follow-up. It cannot show a confirmed booking created from the message alone.
