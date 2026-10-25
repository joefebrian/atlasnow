# Booking provider contract

Status: **interface plus four deterministic mocks.** No network. No native inventory. No vendor SDK.

Code: `src/lib/conversational-commerce/provider.ts`, `registry.ts`, `mock-provider.ts`.

## Capability model

Every adapter exposes the same methods. Support is declared on `getCapabilities()`. Calling an unsupported method returns `UNSUPPORTED`. It does not throw and it does not create a booking.

| Operation | Native mock | External API mock | External checkout mock | Manual mock |
|---|---|---|---|---|
| `getCapabilities` | supported | supported | supported | supported |
| `getAvailability` | supported | supported | supported | unsupported |
| `getQuote` | supported | supported | unsupported | unsupported |
| `createBooking` | supported | supported | unsupported | supported |
| `holdReservation` | supported | unsupported unless opted in | unsupported | unsupported |
| `confirmBooking` | supported | supported | unsupported | supported |
| `getBooking` | supported | supported | unsupported | supported |
| `cancelBooking` | supported | supported | unsupported | supported |
| `getBookingStatus` | supported | supported | supported | supported |
| `getPaymentStatus` | unsupported | unsupported | unsupported | unsupported |

| Flag | Native | External API | External checkout | Manual |
|---|---|---|---|---|
| `supportsHold` | true | false by default | false | false |
| `authoritativeForCapacity` | true inside the mock only | false. The merchant system owns capacity | false | false |
| `canVerifyPayment` | false | false | false | false |
| `acceptsIdempotencyKey` | true | true | true | true |

`getPaymentStatus` stays unsupported so a booking adapter cannot report `PAID`. Money moves only through the payment ledger.

The native mock is not a booking engine. It records reservations the test created. It does not generate times, prices, or capacity.

## Results

Success:

```ts
{ ok: true, data: T, replay: boolean }
```

Failure:

```ts
{ ok: false, code, retryable, message }
```

| Code | Retryable | When |
|---|---|---|
| `UNSUPPORTED` | no | The capability map says the operation is unsupported |
| `UNAVAILABLE` | yes | The operation is down, or no whole-IDR price was supplied for a quote |
| `TIMEOUT` | yes at the provider, no at the orchestrator until the inflight key is released | The script times out before a row exists |
| `RETRYABLE` | yes | Reserved for a later transient failure |
| `CONFLICT` | no | Slot is already `HELD` or `CONFIRMED` for that tenant |
| `MISSING_REFERENCE` | no | An external confirm or create did not return a provider reference |
| `NOT_AUTHORITATIVE` | no | Tenant mismatch, or manual confirm without staff confirmation |
| `IDEMPOTENCY_CONFLICT` | no | Same key, different payload hash |
| `POLICY_BLOCKED` | no | Orchestrator refused before the provider ran |

A timeout response contains no booking. The orchestrator stores `PENDING_RESOLUTION` and the same key does not call the provider again until `releaseTimedOut`. A later call may try once. If the provider times out again, there is still no reservation.

## Availability and quotes

- Native `getAvailability` returns only the slots the caller supplied, minus occupied ones. `knownSlots: null` returns an empty list and `authoritative: false`. It does not mean the merchant has a free calendar
- External API echoes supplied slots with `authoritative: false`
- External checkout returns `slots: []`, `authoritative: false`, and a handoff URL on `https://booking.invalid/...`. The URL is a fixture, not a merchant site
- `getQuote` returns the supplied whole-IDR amount with `guaranteed: false`. A missing price is `UNAVAILABLE`. A quote is not a hold

## Create, hold, confirm, cancel

| Mode | `createBooking` | `holdReservation` | `confirmBooking` |
|---|---|---|---|
| Native | `CONFIRMED` with a `PRV-` reference. The orchestrator uses hold instead when `supportsHold` is true | `HELD` with a reference | Moves a held row to `CONFIRMED` |
| External API | `CONFIRMED` with a reference, or `MISSING_REFERENCE` when the script omits it | Unsupported by default | Requires the stored reference |
| External checkout | `UNSUPPORTED` | `UNSUPPORTED` | `UNSUPPORTED` |
| Manual | `REQUESTED`. The reference is not authoritative | `UNSUPPORTED` | `CONFIRMED` only when `merchantConfirmed` is true. `referenceAuthoritative` stays false |

Cancel moves `REQUESTED`, `HELD`, or `CONFIRMED` to `CANCELLED` when that transition is legal. It does not change payment. A second occupant is not created.

The slot key is `tenantId:locationId:offeringId:startsAt`. Another tenant is a different provider registration and a different mock store.

## Registry

`createRegistry().resolve({ tenantId, locationId }, providerId)`:

- Another tenant is `NOT_FOUND`, not a borrowed connection
- A location-specific registration does not serve a different location
- A tenant-wide registration (`locationId: null`) serves locations inside that tenant
- The orchestrator still checks the actor before resolve

## Idempotency

The provider stores the first success under the idempotency key and the request hash.

- Same key and same hash: `replay: true` and the same `bookingRef`
- Same key and a different hash: `IDEMPOTENCY_CONFLICT`
- The orchestrator applies the same rule and skips the provider on replay

On timeout the provider records the key as inflight and does not insert a booking. A different hash for that inflight key conflicts.

## Concurrency

The merchant system is authoritative for external capacity. The mock can only report a conflict for rows it already holds. It cannot promise a real calendar.

Rules for a later live adapter:

- Use the provider's atomic hold or create when one exists
- Send the idempotency key when the provider accepts one
- On timeout, read the original request by that key before creating another
- If the provider cannot guarantee the slot, return pending or the checkout handoff
- Do not mark `CONFIRMED` without a provider reference on an external mode
- Do not treat `getAvailability` as a reservation

The in-memory conflict check is not a database lock. A future table needs a unique occupant key or an equivalent single-row hold. That table is not in this milestone.

## Webhook contract

No HTTP route is registered.

Accepted event names, after the gate passes:

- `booking.created`
- `booking.confirmed`
- `booking.cancelled`
- `booking.rescheduled`
- `booking.expired`
- `payment.pending`
- `payment.paid`
- `payment.failed`
- `payment.expired`
- `payment.refunded`
- `payment.partially_refunded`
- `payment.chargeback`

A provider may support a subset. Unknown names are `UNSUPPORTED_EVENT`.

`assessWebhook` requires:

- Non-empty `providerId`, `tenantId`, and `eventId`
- HMAC-SHA256 of `` `${timestamp}.${rawBody}` `` using the provider secret
- Event time within five minutes of the supplied clock
- Duplicate detection by event id
- `outOfOrder` when a sequence number goes backwards

A missing secret or a bad signature is `UNSIGNED` even if the event id was seen. Tenant resolution is the caller's job. This function does not accept an unsigned body and guess the tenant from JSON.

`planBookingEvent`:

- `booking.created` on an unknown booking plans `REQUESTED`
- `booking.confirmed` from `REQUESTED` or `HELD` plans `CONFIRMED`
- `booking.cancelled` and `booking.expired` plan those states when the transition is legal
- External confirm, cancel, and expire require a provider reference
- `booking.rescheduled` is accepted and not applied. No new slot is created
- Duplicates are not applied again

Payment notices are applied by `applyPaymentNotice`, not by the booking planner.

## Tests that lock this contract

`conversational-commerce.test.ts` covers unsupported checkout, double hold conflict, idempotent replay, hash conflict, timeout without a second create, missing external reference, empty availability, and a quote that refuses to invent a price.
