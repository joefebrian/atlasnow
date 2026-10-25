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
| `TIMEOUT` | yes at the provider, no at the orchestrator until reconciliation allows one retry | The response timed out. That is not proof that no reservation exists |
| `RETRYABLE` | yes | Reserved for a later transient failure |
| `CONFLICT` | no | Slot is already `HELD` or `CONFIRMED` for that tenant |
| `MISSING_REFERENCE` | no | An external confirm or create did not return a provider reference |
| `NOT_AUTHORITATIVE` | no | Tenant mismatch, or manual confirm without staff confirmation |
| `IDEMPOTENCY_CONFLICT` | no | Same key, different payload hash |
| `POLICY_BLOCKED` | no | Orchestrator refused before the provider ran |

A timeout is not proof that the provider created nothing. The orchestrator keeps the operation in `PENDING_RESOLUTION` and keeps the original idempotency key. `releaseTimedOut` records that a person saw the timeout. It does not delete the inflight record and it does not authorize a second create.

`reconcileTimedOut` is the only resolver. It uses the stored tenant, location, provider, idempotency key, and request hash. The actor is authorized against that stored scope. A command that names another provider or location returns `SCOPE_MISMATCH` and does not call either provider. That mismatch does not verify absence and does not authorize a retry. The transaction stays `PENDING_RESOLUTION`.

- `guaranteesIdempotency` on the original adapter: retry the same create or hold with the original key and the original request hash. Accepting a key is not this guarantee. The flag is true only when the provider documents that the same key cannot create a second reservation.
- Otherwise call `findByIdempotencyKey` on the original provider only. A found row is adopted only when its slot matches the original tenant, location, offering, and start. A found `CONFIRMED`, `HELD`, `REQUESTED`, or `COMPLETED` row is adopted onto the original transaction. A found `CANCELLED`, `REJECTED`, `EXPIRED`, or `NO_SHOW` closes the key as `TERMINAL`. An authoritative empty result from that same provider allows one later `reserve` on the same key. A non-authoritative empty result, a lookup failure, or a booking that does not match the original request stays `PENDING_RESOLUTION` and does not create.
- An authoritative empty result from any other provider is not absence.

A human release alone never sets absence as verified.

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
- `register` compares `providerId` and `mode` with `getCapabilities()`. A native adapter registered as `EXTERNAL_API`, or the reverse, returns `PROVIDER_MISMATCH` and is not stored

## Idempotency

The provider stores the first success under the idempotency key and the request hash.

- Same key and same hash: `replay: true` and the same `bookingRef`
- Same key and a different hash: `IDEMPOTENCY_CONFLICT`
- The orchestrator applies the same rule and skips the provider on replay
- `acceptsIdempotencyKey` means the adapter will send a key. `guaranteesIdempotency` means the provider documents that the same key returns the original reservation

The standard timeout script returns `TIMEOUT` before it inserts a row. The ambiguous timeout script inserts the reservation and then returns `TIMEOUT` with no booking payload. A second create on that script inserts another row unless `guaranteesIdempotency` is true. The orchestrator must not issue that second create. Lookup adopts the first row.

## Concurrency

The merchant system is authoritative for external capacity. The mock can only report a conflict for rows it already holds. It cannot promise a real calendar.

Rules for a later live adapter:

- Use the provider's atomic hold or create when one exists
- Send the idempotency key when the provider accepts one
- On timeout, read the original request by that key, or rely on a documented idempotency guarantee, before creating another
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

`assessWebhook` takes a stored `connection` (`providerId`, `tenantId`). That mapping is the tenant. A `claimedTenantId` or `claimedProviderId` copied from JSON must match the connection or the gate returns `TENANT_MISMATCH` or `PROVIDER_MISMATCH` before the signature is trusted. A missing claim does not let the JSON body choose the merchant. The success payload copies tenant and provider from the connection.

Four clocks and identities stay separate:

| Field | Role |
|---|---|
| `deliveredAt` | Authenticated delivery time. The HMAC is SHA-256 of `` `${deliveredAt}.${rawBody}` ``. Replay rejects a delivery more than five minutes from `nowIso` |
| `occurredAt` | Business event time. A delayed booking or payment stays acceptable when delivery is fresh and this timestamp parses. It is not the replay clock |
| `eventId` | Provider event id |
| `connection` | Provider connection identity and the verified tenant |

Durable dedupe key is `` `${providerId}:${eventId}` ``. `seenEventIds` must be that durable set before a repeat is marked `duplicate`. The in-memory list is the contract check only. A missing secret or a bad signature is `UNSIGNED`. An empty connection tenant is `MISSING_TENANT`. Ordering still flags `outOfOrder` when `sequence` is lower than `lastSequence`. Unknown names are `UNSUPPORTED_EVENT`. Fail closed. No HTTP route calls this.

`planBookingEvent`:

- `booking.created` on an unknown booking plans `REQUESTED`
- `booking.confirmed` from `REQUESTED` or `HELD` plans `CONFIRMED`
- `booking.cancelled` and `booking.expired` plan those states when the transition is legal
- External confirm, cancel, and expire require a provider reference
- `booking.rescheduled` is accepted and not applied. No new slot is created
- Duplicates are not applied again

Payment notices are applied by `applyPaymentNotice`, not by the booking planner.

## Tests that lock this contract

`conversational-commerce.test.ts` covers unsupported checkout, double hold conflict, idempotent replay, hash conflict, a pre-commit timeout, a timeout after the provider committed, a non-authoritative empty lookup, a cancelled lookup, idempotency guarantee replay, missing external reference, registry mode mismatch, empty availability, and a quote that refuses to invent a price. Webhook tests cover a fresh delivery of an old business event, a stale delivery timestamp, and a tenant claim that does not match the connection.
