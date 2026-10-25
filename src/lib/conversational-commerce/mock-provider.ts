import { bookingOccupiesCapacity, transitionBooking } from "./booking-state";
import { refFromMaterial } from "./ids";
import {
  providerError,
  unsupported,
  type AvailabilityQuery,
  type BookingLookup,
  type BookingProvider,
  type CancelCommand,
  type ConfirmCommand,
  type CreateBookingCommand,
  type HoldCommand,
  type PaymentLookup,
  type ProviderBooking,
  type ProviderCapabilities,
  type ProviderOperation,
  type ProviderResult,
  type QuoteQuery,
  type IdempotencyLookupQuery,
} from "./provider";
import type { BookingProviderMode, BookingState } from "./types";

export type MockOptions = {
  boundTenantId: string;
  providerId: string;
  mode: BookingProviderMode;
  supportsHold?: boolean;
  timeoutOn?: readonly ProviderOperation[];
  unavailableOn?: readonly ProviderOperation[];
  /** External provider returned no booking id. Native mocks still issue their own id. */
  omitExternalReference?: boolean;
  /**
   * The provider commits a reservation and then the response times out.
   * A second create with the same key adds another reservation unless
   * guaranteesIdempotency is true.
   */
  ambiguousTimeout?: boolean;
  /**
   * The provider stores a reservation, then returns an uncertain result.
   * INCOMPLETE_REFERENCE keeps the stored reference and omits it from the response.
   * A second create with the same key adds another reservation unless
   * guaranteesIdempotency is true.
   */
  commitThen?: "RETRYABLE" | "UNAVAILABLE" | "INCOMPLETE_REFERENCE";
  /** Documented provider promise. Distinct from merely accepting a key. */
  guaranteesIdempotency?: boolean;
  /**
   * Overrides findByIdempotencyKey.
   * `non-authoritative-empty` reports no row and does not prove absence.
   * `unsupported` removes the lookup operation.
   */
  lookup?: "default" | "non-authoritative-empty" | "unsupported";
  /** Replaces the slot on a found lookup so the orchestrator can reject a foreign booking. */
  lookupSlotKey?: string;
};

type Stored = ProviderBooking & {
  tenantId: string;
  locationId: string;
  idempotencyKey: string;
  requestHash: string;
};

export type MockProvider = BookingProvider & {
  calls: ProviderOperation[];
  bookingCount: () => number;
  /** Test hook. Changes a stored reservation so lookup can return a terminal state. */
  setState: (idempotencyKey: string, state: BookingState) => void;
};

export function createMockProvider(options: MockOptions): MockProvider {
  const calls: ProviderOperation[] = [];
  const bookings = new Map<string, Stored>();
  const byKey = new Map<string, string>();
  const inflight = new Map<string, string>();
  const capabilities = buildCapabilities(options);

  function failTenant(tenantId: string): ProviderResult<never> | null {
    if (tenantId === options.boundTenantId) return null;
    return providerError("NOT_AUTHORITATIVE", "Tenant does not match this provider connection.", "NO_COMMIT");
  }

  function gate(operation: ProviderOperation, tenantId: string, idempotencyKey?: string, requestHash?: string): ProviderResult<never> | null {
    calls.push(operation);
    const denied = failTenant(tenantId);
    if (denied) return denied;
    if (capabilities.operations[operation] !== "supported") return unsupported(operation);
    if (options.unavailableOn?.includes(operation)) {
      return providerError("UNAVAILABLE", `${operation} is unavailable.`, "NO_COMMIT");
    }
    if (options.timeoutOn?.includes(operation)) {
      if (idempotencyKey && requestHash) {
        const previous = inflight.get(idempotencyKey);
        if (previous && previous !== requestHash) {
          return providerError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different request.", "NO_COMMIT");
        }
        inflight.set(idempotencyKey, requestHash);
      }
      return providerError("TIMEOUT", `${operation} timed out before a reservation existed.`);
    }
    return null;
  }

  function remember(row: Stored): ProviderResult<ProviderBooking> {
    bookings.set(row.bookingRef, row);
    byKey.set(row.idempotencyKey, row.bookingRef);
    inflight.delete(row.idempotencyKey);
    return { ok: true, data: toPublic(row), replay: false };
  }

  function replayOrConflict(idempotencyKey: string, requestHash: string): ProviderResult<ProviderBooking> | null {
    const existingRef = byKey.get(idempotencyKey);
    if (!existingRef) return null;
    const existing = bookings.get(existingRef);
    if (!existing) return null;
    if (existing.requestHash !== requestHash) {
      return providerError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different request.", "NO_COMMIT");
    }
    return { ok: true, data: toPublic(existing), replay: true };
  }

  function occupy(slotKey: string, idempotencyKey: string): ProviderResult<ProviderBooking> | null {
    if (options.mode === "MANUAL") return null;
    for (const row of bookings.values()) {
      if (row.slotKey === slotKey && row.idempotencyKey !== idempotencyKey && bookingOccupiesCapacity(row.state)) {
        return providerError("CONFLICT", "That slot is already held or confirmed.", "NO_COMMIT");
      }
    }
    return null;
  }

  async function create(input: CreateBookingCommand, state: BookingState, authoritative: boolean): Promise<ProviderResult<ProviderBooking>> {
    const operation: ProviderOperation = state === "HELD" ? "holdReservation" : "createBooking";
    if (options.ambiguousTimeout) return ambiguousCommit(input, state, authoritative, operation, "TIMEOUT");
    if (options.commitThen) return ambiguousCommit(input, state, authoritative, operation, options.commitThen);
    const blocked = gate(operation, input.tenantId, input.idempotencyKey, input.requestHash);
    if (blocked) return blocked;
    const replay = replayOrConflict(input.idempotencyKey, input.requestHash);
    if (replay) return replay;
    if (options.mode === "EXTERNAL_API" && options.omitExternalReference) {
      return providerError("MISSING_REFERENCE", "The external provider did not return a booking reference.", "NO_COMMIT");
    }
    const slotKey = slotOf(input);
    const conflict = occupy(slotKey, input.idempotencyKey);
    if (conflict) return conflict;
    const bookingRef = refFromMaterial("CBK", `${input.tenantId}:${input.idempotencyKey}:${slotKey}`);
    const issued = options.mode === "MANUAL" ? null : refFromMaterial("PRV", `${options.providerId}:${bookingRef}`);
    return remember({
      bookingRef,
      state,
      slotKey,
      providerReference: issued,
      referenceAuthoritative: authoritative && Boolean(issued),
      handoffUrl: null,
      tenantId: input.tenantId,
      locationId: input.locationId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
    });
  }

  return {
    calls,
    bookingCount: () => bookings.size,
    setState(idempotencyKey, state) {
      const bookingRef = byKey.get(idempotencyKey);
      const row = bookingRef ? bookings.get(bookingRef) : undefined;
      if (row) row.state = state;
    },
    getCapabilities: () => capabilities,
    async getAvailability(input: AvailabilityQuery) {
      const blocked = gate("getAvailability", input.tenantId);
      if (blocked) return blocked;
      if (options.mode === "EXTERNAL_CHECKOUT") {
        return {
          ok: true,
          replay: false,
          data: {
            slots: [],
            authoritative: false,
            handoffUrl: `https://booking.invalid/handoff/${options.providerId}`,
            handoffReference: refFromMaterial("HO", `${options.providerId}:${input.tenantId}:${input.offeringId}`),
          },
        };
      }
      const known = input.knownSlots ?? [];
      const slots = known.filter((slot) => {
        if (slot.locationId !== input.locationId || slot.offeringId !== input.offeringId) return false;
        const key = `${input.tenantId}:${input.locationId}:${slot.offeringId}:${slot.startsAt}`;
        return ![...bookings.values()].some((row) => row.slotKey === key && bookingOccupiesCapacity(row.state));
      });
      return {
        ok: true,
        replay: false,
        data: {
          slots: slots.map((slot) => ({ ...slot })),
          authoritative: options.mode === "NATIVE" && input.knownSlots != null,
          handoffUrl: null,
          handoffReference: null,
        },
      };
    },
    async getQuote(input: QuoteQuery) {
      const blocked = gate("getQuote", input.tenantId);
      if (blocked) return blocked;
      if (input.unitPriceIdr == null || !Number.isSafeInteger(input.unitPriceIdr) || input.unitPriceIdr < 1) {
        return providerError("UNAVAILABLE", "No whole-IDR price was supplied. The provider will not invent one.", "NO_COMMIT");
      }
      return { ok: true, replay: false, data: { currency: "IDR", amountIdr: input.unitPriceIdr, guaranteed: false } };
    },
    async createBooking(input) {
      if (options.mode === "MANUAL" && input.merchantConfirmed) {
        return create(input, "CONFIRMED", false);
      }
      if (options.mode === "MANUAL") return create(input, "REQUESTED", false);
      if (options.mode === "EXTERNAL_API") return create(input, "CONFIRMED", true);
      return create(input, "CONFIRMED", true);
    },
    async holdReservation(input: HoldCommand) {
      return create(input, "HELD", options.mode !== "MANUAL");
    },
    async confirmBooking(input: ConfirmCommand) {
      const blocked = gate("confirmBooking", input.tenantId, input.idempotencyKey, input.requestHash);
      if (blocked) return blocked;
      const row = bookings.get(input.bookingRef);
      if (!row || row.tenantId !== input.tenantId) {
        return providerError("MISSING_REFERENCE", "No booking exists for that reference.", "NO_COMMIT");
      }
      if (options.mode === "MANUAL" && !input.merchantConfirmed) {
        return providerError("NOT_AUTHORITATIVE", "Manual confirmation was not provided. An inquiry is not a booking.", "NO_COMMIT");
      }
      if (options.mode === "EXTERNAL_API" && (options.omitExternalReference || !row.providerReference)) {
        return providerError("MISSING_REFERENCE", "The external provider did not return a booking reference.", "NO_COMMIT");
      }
      const move = transitionBooking(row.state, "CONFIRMED", { supportsHold: capabilities.supportsHold });
      if (!move.ok) return providerError("UNAVAILABLE", `Cannot confirm from ${row.state}.`, "NO_COMMIT");
      row.state = "CONFIRMED";
      if (options.mode === "MANUAL") row.referenceAuthoritative = false;
      return { ok: true, data: toPublic(row), replay: false };
    },
    async getBooking(input: BookingLookup) {
      return lookup(input, "getBooking");
    },
    async cancelBooking(input: CancelCommand) {
      const blocked = gate("cancelBooking", input.tenantId);
      if (blocked) return blocked;
      const row = bookings.get(input.bookingRef);
      if (!row || row.tenantId !== input.tenantId) {
        return providerError("MISSING_REFERENCE", "No booking exists for that reference.", "NO_COMMIT");
      }
      const move = transitionBooking(row.state, "CANCELLED", { supportsHold: capabilities.supportsHold });
      if (!move.ok) return providerError("UNAVAILABLE", `Cannot cancel from ${row.state}.`, "NO_COMMIT");
      row.state = "CANCELLED";
      return { ok: true, data: toPublic(row), replay: false };
    },
    async getBookingStatus(input) {
      const found = await lookup(input, "getBookingStatus");
      if (!found.ok) return found;
      return { ok: true, replay: found.replay, data: { state: found.data.state } };
    },
    async getPaymentStatus(_input: PaymentLookup) {
      calls.push("getPaymentStatus");
      return unsupported("getPaymentStatus");
    },
    async findByIdempotencyKey(input: IdempotencyLookupQuery) {
      if (options.lookup === "non-authoritative-empty") {
        calls.push("findByIdempotencyKey");
        const denied = failTenant(input.tenantId);
        if (denied) return denied;
        return { ok: true, replay: false, data: { found: null, authoritative: false } };
      }
      const blocked = gate("findByIdempotencyKey", input.tenantId);
      if (blocked) return blocked;
      const bookingRef = byKey.get(input.idempotencyKey);
      const row = bookingRef ? bookings.get(bookingRef) : undefined;
      if (!row || row.tenantId !== input.tenantId) {
        return { ok: true, replay: false, data: { found: null, authoritative: true } };
      }
      const found = toPublic(row);
      if (options.lookupSlotKey) found.slotKey = options.lookupSlotKey;
      return { ok: true, replay: false, data: { found, authoritative: true } };
    },
  };

  function ambiguousCommit(
    input: CreateBookingCommand,
    state: BookingState,
    authoritative: boolean,
    operation: ProviderOperation,
    result: "TIMEOUT" | "RETRYABLE" | "UNAVAILABLE" | "INCOMPLETE_REFERENCE",
  ): ProviderResult<ProviderBooking> {
    calls.push(operation);
    const denied = failTenant(input.tenantId);
    if (denied) return denied;
    if (capabilities.operations[operation] !== "supported") return unsupported(operation);
    const existingRef = byKey.get(input.idempotencyKey);
    const existing = existingRef ? bookings.get(existingRef) : undefined;
    if (existing && options.guaranteesIdempotency) {
      return { ok: true, data: toPublic(existing), replay: true };
    }
    if (existing) {
      const bookingRef = refFromMaterial("CBK", `${input.tenantId}:${input.idempotencyKey}:dup:${bookings.size}`);
      bookings.set(bookingRef, {
        ...existing,
        bookingRef,
        idempotencyKey: `${input.idempotencyKey}#${bookings.size}`,
      });
      return uncertainResult(result, "A second reservation was committed because this provider does not guarantee idempotency.");
    }
    const slotKey = slotOf(input);
    const bookingRef = refFromMaterial("CBK", `${input.tenantId}:${input.idempotencyKey}:${slotKey}`);
    const issued = options.mode === "MANUAL" ? null : refFromMaterial("PRV", `${options.providerId}:${bookingRef}`);
    const row: Stored = {
      bookingRef,
      state,
      slotKey,
      providerReference: issued,
      referenceAuthoritative: authoritative && Boolean(issued),
      handoffUrl: null,
      tenantId: input.tenantId,
      locationId: input.locationId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
    };
    bookings.set(bookingRef, row);
    byKey.set(input.idempotencyKey, bookingRef);
    if (result === "INCOMPLETE_REFERENCE") {
      return { ok: true, data: { ...toPublic(row), providerReference: null }, replay: false };
    }
    return uncertainResult(result, "The provider committed a reservation and then returned an uncertain result.");
  }

  function uncertainResult(
    result: "TIMEOUT" | "RETRYABLE" | "UNAVAILABLE" | "INCOMPLETE_REFERENCE",
    message: string,
  ): ProviderResult<ProviderBooking> {
    if (result === "INCOMPLETE_REFERENCE") return providerError("RETRYABLE", message);
    return providerError(result, message);
  }

  async function lookup(input: BookingLookup, operation: ProviderOperation): Promise<ProviderResult<ProviderBooking>> {
    const blocked = gate(operation, input.tenantId);
    if (blocked) return blocked;
    const row = bookings.get(input.bookingRef);
    if (!row || row.tenantId !== input.tenantId) {
      return providerError("MISSING_REFERENCE", "No booking exists for that reference.", "NO_COMMIT");
    }
    return { ok: true, data: toPublic(row), replay: false };
  }
}

function toPublic(row: Stored): ProviderBooking {
  return {
    bookingRef: row.bookingRef,
    state: row.state,
    slotKey: row.slotKey,
    providerReference: row.providerReference,
    referenceAuthoritative: row.referenceAuthoritative,
    handoffUrl: row.handoffUrl,
  };
}

function slotOf(input: { tenantId: string; locationId: string; offeringId: string; startsAt: string }): string {
  return `${input.tenantId}:${input.locationId}:${input.offeringId}:${input.startsAt}`;
}

function buildCapabilities(options: MockOptions): ProviderCapabilities {
  const supportsHold = options.mode === "NATIVE" ? options.supportsHold !== false : options.supportsHold === true;
  const operations = unsupportedMap();
  operations.getCapabilities = "supported";
  if (options.mode === "NATIVE") {
    turnOn(operations, ["getAvailability", "getQuote", "createBooking", "holdReservation", "confirmBooking", "getBooking", "cancelBooking", "getBookingStatus", "findByIdempotencyKey"]);
  } else if (options.mode === "EXTERNAL_API") {
    turnOn(operations, ["getAvailability", "getQuote", "createBooking", "confirmBooking", "getBooking", "cancelBooking", "getBookingStatus", "findByIdempotencyKey"]);
    if (supportsHold) operations.holdReservation = "supported";
  } else if (options.mode === "EXTERNAL_CHECKOUT") {
    turnOn(operations, ["getAvailability", "getBookingStatus"]);
  } else {
    turnOn(operations, ["createBooking", "confirmBooking", "getBooking", "cancelBooking", "getBookingStatus", "findByIdempotencyKey"]);
  }
  if (options.lookup === "unsupported") operations.findByIdempotencyKey = "unsupported";
  return {
    providerId: options.providerId,
    mode: options.mode,
    operations,
    supportsHold,
    authoritativeForCapacity: options.mode === "NATIVE",
    canVerifyPayment: false,
    acceptsIdempotencyKey: true,
    guaranteesIdempotency: options.guaranteesIdempotency === true,
  };
}

function unsupportedMap(): ProviderCapabilities["operations"] {
  return {
    getCapabilities: "unsupported",
    getAvailability: "unsupported",
    getQuote: "unsupported",
    createBooking: "unsupported",
    holdReservation: "unsupported",
    confirmBooking: "unsupported",
    getBooking: "unsupported",
    cancelBooking: "unsupported",
    getBookingStatus: "unsupported",
    getPaymentStatus: "unsupported",
    findByIdempotencyKey: "unsupported",
  };
}

function turnOn(operations: ProviderCapabilities["operations"], names: ProviderOperation[]) {
  for (const name of names) operations[name] = "supported";
}
