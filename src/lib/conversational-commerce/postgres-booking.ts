/**
 * Row-level conversational writes for the disposable QA database.
 * The in-memory store still decides the transition. This file locks the rows
 * for that operation, runs the existing memory method, and writes the diff.
 * Provider calls stay outside the transaction. There is no global advisory lock.
 * A returned failure throws inside the transaction so Prisma rolls back direct SQL writes.
 * Payment, webhook, attribution, policy, and credential diffs register through addDiffFlusher.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import { authorize } from "./auth";
import { AmountRejected } from "./idr-amount";
import { stableHash } from "./ids";
import {
  absorbMissingRows,
  createMemoryCommerceStore,
  emptyPersistenceSnapshot,
  mergeMissingRows,
} from "./memory-store";
import type {
  CommercePersistence,
  ConnectionCapabilities,
  IdempotencyScope,
  MaybeAsync,
  PersistenceSnapshot,
  PortFailure,
  PortResult,
  ReservationDraft,
  StoredBooking,
  StoredConnection,
  StoredCredential,
  StoredEvent,
  StoredExternalRef,
  StoredIdempotency,
  StoredInflight,
  StoredIntent,
  StoredPolicyEvidence,
  StoredTransaction,
} from "./ports";

type Db = PrismaClient | Prisma.TransactionClient;

export type RowScope = {
  mode: "rows";
  tx: Db;
  mem: CommercePersistence;
  baseline: PersistenceSnapshot;
  loadedEvents: Set<string>;
};

export type Live = { mode: "snapshot"; mem: CommercePersistence } | RowScope;

export const commerceLive = new AsyncLocalStorage<Live>();

export class RowVersionConflict extends Error {
  constructor() {
    super("VERSION_CONFLICT");
    this.name = "RowVersionConflict";
  }
}

/** A returned failure must abort the open transaction. Prisma commits a callback that returns. */
class RolledBackResult extends Error {
  readonly failure: PortFailure;
  constructor(failure: PortFailure) {
    super("ROLLED_BACK_RESULT");
    this.name = "RolledBackResult";
    this.failure = failure;
  }
}

function fail(code: PortFailure["code"], message: string): PortFailure {
  return { ok: false, code, message };
}

function snapshotOf(mem: CommercePersistence): PersistenceSnapshot {
  const exported = mem.exportSnapshot();
  if (exported instanceof Promise) throw new Error("The snapshot copy returned a promise.");
  return exported;
}

function errorText(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `${error.message} ${JSON.stringify(error.meta ?? {})}`;
  }
  return error instanceof Error ? error.message : "";
}

export function mapDbError(error: unknown): PortFailure | null {
  if (error instanceof RowVersionConflict) return fail("VERSION_CONFLICT", "The row version changed.");
  if (error instanceof AmountRejected) return fail("INVALID", error.message);
  const message = errorText(error);
  if (message.includes("VERSION_CONFLICT") || message.includes("deadlock detected") || message.includes("could not serialize access")) {
    return fail("VERSION_CONFLICT", "The row version changed.");
  }
  if (message.includes("cc_location_mismatch")) return fail("SCOPE_MISMATCH", "Transaction location does not match the related row.");
  if (message.includes("CcBooking_live_slot") || (message.includes("slotKey") && message.includes("Unique constraint"))) {
    return fail("SLOT_CONFLICT", "That slot is already reserved for this provider.");
  }
  if (message.includes("CcBooking_provider_ref") || message.includes("CcPaymentLedger_provider_ref")) {
    return fail("REFERENCE_CONFLICT", "That provider reference is already claimed.");
  }
  if (message.includes("CcBooking_tenantId_providerId_idempotencyKey")) {
    return fail("IDEMPOTENCY_CONFLICT", "This idempotency key already has a reservation.");
  }
  if (message.includes("CcPaymentLedger_one_live_capture")) return fail("ATTEMPT_CONFLICT", "This transaction already has a live capture.");
  if (message.includes("CcProviderCredential_one_active")) return fail("DUPLICATE", "Rotate the active credential instead of registering a second one.");
  if (message.includes("CcProviderConnection_scope")) return fail("DUPLICATE", "This connection is already registered.");
  if (message.includes("violates foreign key") || message.includes("Foreign key constraint")) {
    return fail("INVALID", "A referenced tenant, location, or transaction was rejected.");
  }
  if (message.includes("_amount_safe") || message.includes("_currency_idr")) return fail("INVALID", "Amount is not a safe whole rupiah value.");
  return null;
}

function asDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function txKey(tenantId: string, transactionRef: string): string {
  return `${tenantId}\0${transactionRef}`;
}

function absorb(scope: RowScope, partial: Partial<PersistenceSnapshot>): void {
  const filled = emptyPersistenceSnapshot();
  if (partial.transactions) filled.transactions = partial.transactions;
  if (partial.bookings) filled.bookings = partial.bookings;
  if (partial.idempotency) filled.idempotency = partial.idempotency;
  if (partial.inflight) filled.inflight = partial.inflight;
  if (partial.intents) filled.intents = partial.intents;
  if (partial.events) filled.events = partial.events;
  if (partial.externalRefs) filled.externalRefs = partial.externalRefs;
  if (partial.connections) filled.connections = partial.connections;
  if (partial.credentials) filled.credentials = partial.credentials;
  if (partial.policyEvidence) filled.policyEvidence = partial.policyEvidence;
  if (partial.attempts) filled.attempts = partial.attempts;
  if (partial.ledgers) filled.ledgers = partial.ledgers;
  if (partial.ledgerEvents) filled.ledgerEvents = partial.ledgerEvents;
  if (partial.webhooks) filled.webhooks = partial.webhooks;
  if (partial.touchpoints) filled.touchpoints = partial.touchpoints;
  if (partial.aggregates) filled.aggregates = partial.aggregates;
  absorbMissingRows(scope.mem, filled);
  mergeMissingRows(scope.baseline, filled);
}

export function absorbRows(scope: RowScope, partial: Partial<PersistenceSnapshot>): void {
  absorb(scope, partial);
}

function toTransaction(row: {
  tenantId: string;
  transactionRef: string;
  locationId: string | null;
  intentRef: string | null;
  providerId: string;
  state: string;
  bookingRef: string | null;
  orderRef: string | null;
  paymentStatus: string;
  verifiedPaid: boolean;
  version: number;
}): StoredTransaction {
  return {
    transactionRef: row.transactionRef,
    tenantId: row.tenantId,
    locationId: row.locationId,
    intentRef: row.intentRef,
    providerId: row.providerId,
    state: row.state as StoredTransaction["state"],
    bookingRef: row.bookingRef,
    orderRef: row.orderRef,
    paymentStatus: row.paymentStatus as StoredTransaction["paymentStatus"],
    verifiedPaid: row.verifiedPaid,
    version: row.version,
  };
}

function toBooking(row: {
  bookingRef: string;
  tenantId: string;
  locationId: string;
  transactionRef: string;
  providerId: string;
  providerMode: string;
  slotKey: string;
  state: string;
  providerReference: string | null;
  referenceAuthoritative: boolean;
  idempotencyKey: string;
  version: number;
  holdExpiresAt: Date | null;
  holdExpiryOwner: string;
  nativeExpiryPolicyId: string | null;
  pendingSlotKey: string | null;
}): StoredBooking {
  return {
    bookingRef: row.bookingRef,
    tenantId: row.tenantId,
    locationId: row.locationId,
    transactionRef: row.transactionRef,
    providerId: row.providerId,
    providerMode: row.providerMode as StoredBooking["providerMode"],
    slotKey: row.slotKey,
    state: row.state as StoredBooking["state"],
    providerReference: row.providerReference,
    referenceAuthoritative: row.referenceAuthoritative,
    idempotencyKey: row.idempotencyKey,
    version: row.version,
    holdExpiresAt: row.holdExpiresAt ? row.holdExpiresAt.toISOString() : null,
    holdExpiryOwner: row.holdExpiryOwner as StoredBooking["holdExpiryOwner"],
    nativeExpiryPolicyId: row.nativeExpiryPolicyId,
    pendingSlotKey: row.pendingSlotKey,
  };
}

function toIdempotency(row: {
  tenantId: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
  status: string;
  transactionRef: string | null;
  outcomeCode: string | null;
  version: number;
}): StoredIdempotency {
  return {
    tenantId: row.tenantId,
    scope: row.scope as StoredIdempotency["scope"],
    idempotencyKey: row.idempotencyKey,
    requestHash: row.requestHash,
    status: row.status as StoredIdempotency["status"],
    transactionRef: row.transactionRef,
    outcomeCode: row.outcomeCode,
    version: row.version,
  };
}

function toInflight(row: {
  tenantId: string;
  locationId: string;
  providerId: string;
  idempotencyKey: string;
  requestHash: string;
  slotKey: string;
  transactionRef: string;
  merchantConfirmed: boolean;
  experience: string;
  category: string;
  offeringId: string;
  startsAt: string;
  absenceVerified: boolean;
  adoptBookingRef: string | null;
  version: number;
}): StoredInflight {
  return {
    tenantId: row.tenantId,
    locationId: row.locationId,
    providerId: row.providerId,
    idempotencyKey: row.idempotencyKey,
    requestHash: row.requestHash,
    slotKey: row.slotKey,
    transactionRef: row.transactionRef,
    merchantConfirmed: row.merchantConfirmed,
    experience: row.experience as StoredInflight["experience"],
    category: row.category as StoredInflight["category"],
    offeringId: row.offeringId,
    startsAt: row.startsAt,
    absenceVerified: row.absenceVerified,
    adoptBookingRef: row.adoptBookingRef,
    version: row.version,
  };
}

function toIntent(row: {
  intentRef: string;
  tenantId: string;
  locationId: string | null;
  experience: string;
  intentType: string;
  qualified: boolean;
  customerRef: string | null;
  commerceOrderRef: string | null;
  version: number;
}): StoredIntent {
  return {
    intentRef: row.intentRef,
    tenantId: row.tenantId,
    locationId: row.locationId,
    experience: row.experience as StoredIntent["experience"],
    intentType: row.intentType as StoredIntent["intentType"],
    qualified: row.qualified,
    customerRef: row.customerRef,
    commerceOrderRef: row.commerceOrderRef,
    version: row.version,
  };
}

function toEvent(row: {
  tenantId: string;
  eventId: string;
  transactionRef: string;
  type: string;
  at: Date;
  payload: Prisma.JsonValue;
}): StoredEvent {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
  return {
    eventId: row.eventId,
    tenantId: row.tenantId,
    transactionRef: row.transactionRef,
    type: row.type,
    at: row.at.toISOString(),
    payload: payload as StoredEvent["payload"],
    version: 1,
  };
}

function toExternal(row: {
  tenantId: string;
  locationId: string | null;
  owner: string;
  ownerRef: string;
  providerId: string;
  externalId: string;
}): StoredExternalRef {
  return {
    tenantId: row.tenantId,
    locationId: row.locationId,
    owner: row.owner as StoredExternalRef["owner"],
    ownerRef: row.ownerRef,
    providerId: row.providerId,
    externalId: row.externalId,
  };
}

function toConnection(row: {
  connectionId: string;
  tenantId: string;
  locationId: string | null;
  providerId: string;
  kind: string;
  mode: string;
  capabilities: Prisma.JsonValue;
  status: string;
  health: string;
  lastCheckedAt: Date | null;
  credentialRef: string | null;
  webhookSecretRef: string | null;
  version: number;
}): StoredConnection {
  if (!row.capabilities || typeof row.capabilities !== "object" || Array.isArray(row.capabilities)) {
    throw new Error("Booking connection capabilities are incomplete.");
  }
  return {
    connectionId: row.connectionId,
    tenantId: row.tenantId,
    locationId: row.locationId,
    providerId: row.providerId,
    kind: row.kind as StoredConnection["kind"],
    mode: row.mode as StoredConnection["mode"],
    capabilities: row.capabilities as ConnectionCapabilities,
    status: row.status as StoredConnection["status"],
    health: row.health as StoredConnection["health"],
    lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
    credentialRef: row.credentialRef,
    webhookSecretRef: row.webhookSecretRef,
    version: row.version,
  };
}

function toCredential(row: {
  credentialRef: string;
  tenantId: string;
  connectionId: string;
  purpose: string;
  keyVersion: number;
  status: string;
  rotatedFromRef: string | null;
  revokedAt: Date | null;
}): StoredCredential {
  return {
    credentialRef: row.credentialRef,
    tenantId: row.tenantId,
    connectionId: row.connectionId,
    purpose: row.purpose as StoredCredential["purpose"],
    keyVersion: row.keyVersion,
    status: row.status as StoredCredential["status"],
    rotatedFromRef: row.rotatedFromRef,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

function toPolicy(row: {
  tenantId: string;
  offeringCategory: string;
  experience: string;
  status: string;
  reference: string;
  validatedBy: string | null;
  integrity: string | null;
  version: number;
}): StoredPolicyEvidence {
  return {
    tenantId: row.tenantId,
    offeringCategory: row.offeringCategory as StoredPolicyEvidence["offeringCategory"],
    experience: row.experience as StoredPolicyEvidence["experience"],
    source: "META_COMMERCE_POLICY",
    status: row.status === "VERIFIED" ? "VERIFIED" : "UNVERIFIED",
    reference: row.reference,
    validatedBy: row.validatedBy,
    integrity: row.integrity,
    version: row.version,
  };
}

async function loadTransaction(scope: RowScope, tenantId: string, transactionRef: string, lock: boolean): Promise<void> {
  if (lock) {
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcTransaction" WHERE "tenantId" = ${tenantId} AND "transactionRef" = ${transactionRef} FOR UPDATE
    `;
  }
  const row = await scope.tx.ccTransaction.findUnique({ where: { tenantId_transactionRef: { tenantId, transactionRef } } });
  if (row) absorb(scope, { transactions: [toTransaction(row)] });
}

async function loadBooking(scope: RowScope, tenantId: string, bookingRef: string, lock: boolean): Promise<void> {
  if (lock) {
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcBooking" WHERE "tenantId" = ${tenantId} AND "bookingRef" = ${bookingRef} FOR UPDATE
    `;
  }
  const row = await scope.tx.ccBooking.findUnique({ where: { tenantId_bookingRef: { tenantId, bookingRef } } });
  if (row) absorb(scope, { bookings: [toBooking(row)] });
}

async function loadBookingsForTransaction(scope: RowScope, tenantId: string, transactionRef: string, lock: boolean): Promise<void> {
  if (lock) {
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcBooking" WHERE "tenantId" = ${tenantId} AND "transactionRef" = ${transactionRef} FOR UPDATE
    `;
  }
  const rows = await scope.tx.ccBooking.findMany({ where: { tenantId, transactionRef } });
  absorb(scope, { bookings: rows.map(toBooking) });
}

async function loadLiveSlot(
  scope: RowScope,
  tenantId: string,
  locationId: string,
  providerId: string,
  slotKey: string,
  lock: boolean,
): Promise<void> {
  if (lock) {
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcBooking"
      WHERE "tenantId" = ${tenantId}
        AND "locationId" = ${locationId}
        AND "providerId" = ${providerId}
        AND "slotKey" = ${slotKey}
        AND "state" IN ('HELD', 'CONFIRMED')
      FOR UPDATE
    `;
  }
  const rows = await scope.tx.ccBooking.findMany({
    where: { tenantId, locationId, providerId, slotKey, state: { in: ["HELD", "CONFIRMED"] } },
  });
  absorb(scope, { bookings: rows.map(toBooking) });
}

async function loadProviderReference(scope: RowScope, tenantId: string, providerId: string, providerReference: string, lock: boolean): Promise<void> {
  if (lock) {
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcBooking"
      WHERE "tenantId" = ${tenantId} AND "providerId" = ${providerId} AND "providerReference" = ${providerReference}
      FOR UPDATE
    `;
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcExternalRef"
      WHERE "tenantId" = ${tenantId} AND "providerId" = ${providerId} AND "owner" = 'BOOKING' AND "externalId" = ${providerReference}
      FOR UPDATE
    `;
  }
  const bookings = await scope.tx.ccBooking.findMany({ where: { tenantId, providerId, providerReference } });
  const refs = await scope.tx.ccExternalRef.findMany({
    where: { tenantId, providerId, owner: "BOOKING", externalId: providerReference },
  });
  absorb(scope, { bookings: bookings.map(toBooking), externalRefs: refs.map(toExternal) });
}

async function loadIdempotency(scope: RowScope, tenantId: string, idempotencyScope: IdempotencyScope, idempotencyKey: string, lock: boolean): Promise<void> {
  if (lock) {
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcIdempotency"
      WHERE "tenantId" = ${tenantId} AND "scope" = ${idempotencyScope} AND "idempotencyKey" = ${idempotencyKey}
      FOR UPDATE
    `;
  }
  const row = await scope.tx.ccIdempotency.findUnique({
    where: { tenantId_scope_idempotencyKey: { tenantId, scope: idempotencyScope, idempotencyKey } },
  });
  if (row) absorb(scope, { idempotency: [toIdempotency(row)] });
}

async function loadInflight(scope: RowScope, tenantId: string, idempotencyKey: string, lock: boolean): Promise<void> {
  if (lock) {
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcInflight" WHERE "tenantId" = ${tenantId} AND "idempotencyKey" = ${idempotencyKey} FOR UPDATE
    `;
  }
  const row = await scope.tx.ccInflight.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
  if (row) absorb(scope, { inflight: [toInflight(row)] });
}

async function loadEvents(scope: RowScope, tenantId: string, transactionRef: string, lock: boolean): Promise<void> {
  const key = txKey(tenantId, transactionRef);
  if (scope.loadedEvents.has(key)) return;
  if (lock) {
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcTransactionEvent" WHERE "tenantId" = ${tenantId} AND "transactionRef" = ${transactionRef} FOR UPDATE
    `;
  }
  const rows = await scope.tx.ccTransactionEvent.findMany({ where: { tenantId, transactionRef } });
  absorb(scope, { events: rows.map(toEvent) });
  scope.loadedEvents.add(key);
}

async function loadIntent(scope: RowScope, tenantId: string, intentRef: string, lock: boolean): Promise<void> {
  if (lock) {
    await scope.tx.$queryRaw`
      SELECT 1 FROM "CcIntent" WHERE "tenantId" = ${tenantId} AND "intentRef" = ${intentRef} FOR UPDATE
    `;
  }
  const row = await scope.tx.ccIntent.findUnique({ where: { tenantId_intentRef: { tenantId, intentRef } } });
  if (row) absorb(scope, { intents: [toIntent(row)] });
}

async function loadBookingConnection(scope: RowScope, tenantId: string, locationId: string, providerId: string): Promise<void> {
  const rows = await scope.tx.ccProviderConnection.findMany({
    where: { tenantId, providerId, kind: "BOOKING", OR: [{ locationId }, { locationId: null }] },
  });
  absorb(scope, { connections: rows.map(toConnection) });
  const refs = rows.flatMap((row) => [row.credentialRef, row.webhookSecretRef].filter((ref): ref is string => Boolean(ref)));
  if (!refs.length) return;
  const credentials = await scope.tx.ccProviderCredential.findMany({ where: { credentialRef: { in: refs } } });
  absorb(scope, { credentials: credentials.map(toCredential) });
}

async function loadPolicy(scope: RowScope, tenantId: string, category: StoredPolicyEvidence["offeringCategory"], experience: StoredPolicyEvidence["experience"]): Promise<void> {
  const row = await scope.tx.ccPolicyEvidence.findUnique({
    where: { tenantId_offeringCategory_experience: { tenantId, offeringCategory: category, experience } },
  });
  if (row) absorb(scope, { policyEvidence: [toPolicy(row)] });
}

async function preloadOpen(scope: RowScope, draft: ReservationDraft, lock: boolean): Promise<void> {
  const slotKey = `${draft.tenantId}:${draft.locationId}:${draft.offeringId}:${draft.startsAt}`;
  await loadTransaction(scope, draft.tenantId, draft.transactionRef, lock);
  await loadIdempotency(scope, draft.tenantId, "RESERVE", draft.idempotencyKey, lock);
  await loadInflight(scope, draft.tenantId, draft.idempotencyKey, lock);
  await loadBooking(scope, draft.tenantId, draft.bookingRef, lock);
  await loadBookingsForTransaction(scope, draft.tenantId, draft.transactionRef, lock);
  await loadLiveSlot(scope, draft.tenantId, draft.locationId, draft.providerId, slotKey, lock);
  if (draft.providerReference) await loadProviderReference(scope, draft.tenantId, draft.providerId, draft.providerReference, lock);
  await loadBookingConnection(scope, draft.tenantId, draft.locationId, draft.providerId);
  await loadPolicy(scope, draft.tenantId, draft.category, draft.experience);
}

function bookingFrom(scope: RowScope, tenantId: string, bookingRef: string): StoredBooking | undefined {
  return snapshotOf(scope.mem).bookings.find((row) => row.tenantId === tenantId && row.bookingRef === bookingRef);
}

function inflightFrom(scope: RowScope, tenantId: string, idempotencyKey: string): StoredInflight | undefined {
  return snapshotOf(scope.mem).inflight.find((row) => row.tenantId === tenantId && row.idempotencyKey === idempotencyKey);
}

async function ensureKnownEvents(scope: RowScope): Promise<void> {
  const transactions = snapshotOf(scope.mem).transactions;
  for (const row of transactions) await loadEvents(scope, row.tenantId, row.transactionRef, true);
}

async function updateCounted(
  count: number,
): Promise<void> {
  if (count !== 1) throw new RowVersionConflict();
}

async function flushBookingDiff(tx: Db, before: PersistenceSnapshot, after: PersistenceSnapshot): Promise<void> {
  const transactionsBefore = new Map(before.transactions.map((row) => [txKey(row.tenantId, row.transactionRef), row]));
  for (const row of after.transactions) {
    const prior = transactionsBefore.get(txKey(row.tenantId, row.transactionRef));
    if (!prior) {
      await tx.ccTransaction.create({
        data: {
          tenantId: row.tenantId,
          transactionRef: row.transactionRef,
          locationId: row.locationId,
          intentRef: row.intentRef,
          providerId: row.providerId,
          state: row.state,
          bookingRef: row.bookingRef,
          orderRef: row.orderRef,
          paymentStatus: row.paymentStatus,
          verifiedPaid: row.verifiedPaid,
          version: row.version,
        },
      });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccTransaction.updateMany({
      where: { tenantId: row.tenantId, transactionRef: row.transactionRef, version: prior.version },
      data: {
        locationId: row.locationId,
        intentRef: row.intentRef,
        providerId: row.providerId,
        state: row.state,
        bookingRef: row.bookingRef,
        orderRef: row.orderRef,
        paymentStatus: row.paymentStatus,
        verifiedPaid: row.verifiedPaid,
        version: row.version,
      },
    });
    await updateCounted(updated.count);
  }

  const bookingsBefore = new Map(before.bookings.map((row) => [`${row.tenantId}\0${row.bookingRef}`, row]));
  for (const row of after.bookings) {
    const prior = bookingsBefore.get(`${row.tenantId}\0${row.bookingRef}`);
    const data = {
      locationId: row.locationId,
      transactionRef: row.transactionRef,
      providerId: row.providerId,
      providerMode: row.providerMode,
      slotKey: row.slotKey,
      state: row.state,
      providerReference: row.providerReference,
      referenceAuthoritative: row.referenceAuthoritative,
      idempotencyKey: row.idempotencyKey,
      holdExpiresAt: asDate(row.holdExpiresAt),
      holdExpiryOwner: row.holdExpiryOwner,
      nativeExpiryPolicyId: row.nativeExpiryPolicyId,
      pendingSlotKey: row.pendingSlotKey,
      version: row.version,
    };
    if (!prior) {
      await tx.ccBooking.create({
        data: { tenantId: row.tenantId, bookingRef: row.bookingRef, ...data },
      });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccBooking.updateMany({
      where: { tenantId: row.tenantId, bookingRef: row.bookingRef, version: prior.version },
      data,
    });
    await updateCounted(updated.count);
  }

  const refsBefore = new Map(before.externalRefs.map((row) => [`${row.tenantId}\0${row.providerId}\0${row.owner}\0${row.externalId}`, row]));
  const refsAfter = new Map(after.externalRefs.map((row) => [`${row.tenantId}\0${row.providerId}\0${row.owner}\0${row.externalId}`, row]));
  for (const [key, prior] of refsBefore) {
    if (refsAfter.has(key)) continue;
    await tx.ccExternalRef.delete({
      where: {
        tenantId_providerId_owner_externalId: {
          tenantId: prior.tenantId,
          providerId: prior.providerId,
          owner: prior.owner,
          externalId: prior.externalId,
        },
      },
    });
  }
  for (const [key, row] of refsAfter) {
    const prior = refsBefore.get(key);
    if (!prior) {
      await tx.ccExternalRef.create({ data: { ...row } });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    await tx.ccExternalRef.update({
      where: {
        tenantId_providerId_owner_externalId: {
          tenantId: row.tenantId,
          providerId: row.providerId,
          owner: row.owner,
          externalId: row.externalId,
        },
      },
      data: { locationId: row.locationId, ownerRef: row.ownerRef },
    });
  }

  const idemBefore = new Map(before.idempotency.map((row) => [`${row.tenantId}\0${row.scope}\0${row.idempotencyKey}`, row]));
  for (const row of after.idempotency) {
    const prior = idemBefore.get(`${row.tenantId}\0${row.scope}\0${row.idempotencyKey}`);
    if (!prior) {
      await tx.ccIdempotency.create({ data: { ...row } });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccIdempotency.updateMany({
      where: { tenantId: row.tenantId, scope: row.scope, idempotencyKey: row.idempotencyKey, version: prior.version },
      data: {
        requestHash: row.requestHash,
        status: row.status,
        transactionRef: row.transactionRef,
        outcomeCode: row.outcomeCode,
        version: row.version,
      },
    });
    await updateCounted(updated.count);
  }

  const inflightBefore = new Map(before.inflight.map((row) => [`${row.tenantId}\0${row.idempotencyKey}`, row]));
  const inflightAfter = new Map(after.inflight.map((row) => [`${row.tenantId}\0${row.idempotencyKey}`, row]));
  for (const [key, prior] of inflightBefore) {
    if (inflightAfter.has(key)) continue;
    const deleted = await tx.ccInflight.deleteMany({
      where: { tenantId: prior.tenantId, idempotencyKey: prior.idempotencyKey, version: prior.version },
    });
    await updateCounted(deleted.count);
  }
  for (const [key, row] of inflightAfter) {
    const prior = inflightBefore.get(key);
    if (!prior) {
      await tx.ccInflight.create({ data: { ...row } });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccInflight.updateMany({
      where: { tenantId: row.tenantId, idempotencyKey: row.idempotencyKey, version: prior.version },
      data: {
        locationId: row.locationId,
        providerId: row.providerId,
        requestHash: row.requestHash,
        slotKey: row.slotKey,
        transactionRef: row.transactionRef,
        merchantConfirmed: row.merchantConfirmed,
        experience: row.experience,
        category: row.category,
        offeringId: row.offeringId,
        startsAt: row.startsAt,
        absenceVerified: row.absenceVerified,
        adoptBookingRef: row.adoptBookingRef,
        version: row.version,
      },
    });
    await updateCounted(updated.count);
  }

  const eventsBefore = new Set(before.events.map((row) => `${row.tenantId}\0${row.eventId}`));
  for (const row of after.events) {
    if (eventsBefore.has(`${row.tenantId}\0${row.eventId}`)) continue;
    await tx.ccTransactionEvent.create({
      data: {
        tenantId: row.tenantId,
        eventId: row.eventId,
        transactionRef: row.transactionRef,
        type: row.type,
        at: new Date(row.at),
        payload: json(row.payload),
      },
    });
  }

  const intentsBefore = new Map(before.intents.map((row) => [`${row.tenantId}\0${row.intentRef}`, row]));
  for (const row of after.intents) {
    const prior = intentsBefore.get(`${row.tenantId}\0${row.intentRef}`);
    if (!prior) {
      await tx.ccIntent.create({
        data: {
          id: `${row.tenantId}:${row.intentRef}`,
          tenantId: row.tenantId,
          locationId: row.locationId,
          intentRef: row.intentRef,
          experience: row.experience,
          intentType: row.intentType,
          qualified: row.qualified,
          customerRef: row.customerRef,
          commerceOrderRef: row.commerceOrderRef,
          version: row.version,
        },
      });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccIntent.updateMany({
      where: { tenantId: row.tenantId, intentRef: row.intentRef, version: prior.version },
      data: {
        locationId: row.locationId,
        experience: row.experience,
        intentType: row.intentType,
        qualified: row.qualified,
        customerRef: row.customerRef,
        commerceOrderRef: row.commerceOrderRef,
        version: row.version,
      },
    });
    await updateCounted(updated.count);
  }
  for (const flush of diffFlushers) await flush(tx, before, after);
}

const diffFlushers: Array<(tx: Db, before: PersistenceSnapshot, after: PersistenceSnapshot) => Promise<void>> = [];

export function addDiffFlusher(flush: (tx: Db, before: PersistenceSnapshot, after: PersistenceSnapshot) => Promise<void>): void {
  diffFlushers.push(flush);
}

export type Begin = <T>(work: (tx: Db) => Promise<T>) => Promise<T>;

export type RowDeps = {
  client: PrismaClient;
  policyValidatorKey: string;
  begin: Begin;
};

function newScope(tx: Db, policyValidatorKey: string): RowScope {
  return {
    mode: "rows",
    tx,
    mem: createMemoryCommerceStore({ policyValidatorKey }),
    baseline: emptyPersistenceSnapshot(),
    loadedEvents: new Set(),
  };
}

async function settle<T>(value: MaybeAsync<PortResult<T>>): Promise<PortResult<T>> {
  return await Promise.resolve(value);
}

export async function runScoped<T>(
  deps: RowDeps,
  kind: "read" | "write",
  load: (scope: RowScope, lock: boolean) => Promise<void>,
  work: (mem: CommercePersistence) => MaybeAsync<PortResult<T>>,
): Promise<PortResult<T>> {
  const live = commerceLive.getStore();
  if (live?.mode === "snapshot") return settle(work(live.mem));
  if (live?.mode === "rows") {
    await load(live, true);
    return settle(work(live.mem));
  }
  if (kind === "read") {
    const scope = newScope(deps.client, deps.policyValidatorKey);
    await load(scope, false);
    return settle(work(scope.mem));
  }
  try {
    return await deps.begin(async (tx) => {
      const scope = newScope(tx, deps.policyValidatorKey);
      const result = await commerceLive.run(scope, async () => {
        await load(scope, true);
        return settle(work(scope.mem));
      });
      if (!result.ok) throw new RolledBackResult(result);
      await flushBookingDiff(tx, scope.baseline, snapshotOf(scope.mem));
      return result;
    });
  } catch (error) {
    if (error instanceof RolledBackResult) return error.failure;
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export function bindRowPersistence(
  ports: CommercePersistence,
  deps: {
    client: PrismaClient;
    policyValidatorKey: string;
    begin: Begin;
    readSnapshot: (db: Db) => Promise<PersistenceSnapshot>;
    assertOutside: () => Promise<void>;
  },
): void {
  const withRows = <T>(
    kind: "read" | "write",
    load: (scope: RowScope, lock: boolean) => Promise<void>,
    work: (mem: CommercePersistence) => MaybeAsync<PortResult<T>>,
  ) => runScoped(deps, kind, load, work);

  ports.bookings = {
    read: (actor, tenantId, bookingRef) => withRows("read", (scope, lock) => loadBooking(scope, tenantId, bookingRef, lock), (mem) => mem.bookings.read(actor, tenantId, bookingRef)),
    list: (actor, tenantId, locationId) => withRows("read", async (scope) => {
      const rows = await scope.tx.ccBooking.findMany({ where: locationId == null ? { tenantId } : { tenantId, locationId } });
      absorb(scope, { bookings: rows.map(toBooking) });
    }, (mem) => mem.bookings.list(actor, tenantId, locationId)),
    openReservation: (draft) => withRows("write", (scope, lock) => preloadOpen(scope, draft, lock), (mem) => mem.bookings.openReservation(draft)),
    transition: (actor, input) => withRows("write", async (scope, lock) => {
      await loadBooking(scope, input.tenantId, input.bookingRef, lock);
      const booking = bookingFrom(scope, input.tenantId, input.bookingRef);
      if (!booking) return;
      await loadTransaction(scope, input.tenantId, booking.transactionRef, lock);
      await loadBookingConnection(scope, input.tenantId, booking.locationId, booking.providerId);
    }, (mem) => mem.bookings.transition(actor, input)),
    requestReschedule: (actor, input) => withRows("write", (scope, lock) => loadBooking(scope, input.tenantId, input.bookingRef, lock), (mem) => mem.bookings.requestReschedule(actor, input)),
    commitReschedule: (actor, input) => withRows("write", async (scope, lock) => {
      await loadBooking(scope, input.tenantId, input.bookingRef, lock);
      const booking = bookingFrom(scope, input.tenantId, input.bookingRef);
      if (!booking?.pendingSlotKey) return;
      await loadLiveSlot(scope, booking.tenantId, booking.locationId, booking.providerId, booking.pendingSlotKey, lock);
    }, (mem) => mem.bookings.commitReschedule(actor, input)),
    expireDue: (actor, tenantId, locationId, nowIso) => withRows("write", async (scope, lock) => {
      if (lock) {
        await scope.tx.$queryRaw`
          SELECT 1 FROM "CcBooking"
          WHERE "tenantId" = ${tenantId} AND "locationId" = ${locationId} AND "state" IN ('HELD', 'REQUESTED')
          FOR UPDATE
        `;
      }
      const rows = await scope.tx.ccBooking.findMany({
        where: { tenantId, locationId, state: { in: ["HELD", "REQUESTED"] } },
      });
      absorb(scope, { bookings: rows.map(toBooking) });
    }, (mem) => mem.bookings.expireDue(actor, tenantId, locationId, nowIso)),
    findByExternalRef: (actor, tenantId, providerId, externalId) => withRows("read", async (scope) => {
      const rows = await scope.tx.ccBooking.findMany({ where: { tenantId, providerId, providerReference: externalId } });
      absorb(scope, { bookings: rows.map(toBooking) });
    }, (mem) => mem.bookings.findByExternalRef(actor, tenantId, providerId, externalId)),
  };

  ports.transactions = {
    ...ports.transactions,
    read: (actor, tenantId, transactionRef) => withRows("read", (scope, lock) => loadTransaction(scope, tenantId, transactionRef, lock), (mem) => mem.transactions.read(actor, tenantId, transactionRef)),
    compareAndSwap: (actor, input) => withRows("write", (scope, lock) => loadTransaction(scope, input.tenantId, input.transactionRef, lock), (mem) => mem.transactions.compareAndSwap(actor, input)),
  };

  ports.intents = {
    ...ports.intents,
    save: (actor, intent) => withRows("write", (scope, lock) => loadIntent(scope, intent.tenantId, intent.intentRef, lock), (mem) => mem.intents.save(actor, intent)),
    read: (actor, tenantId, intentRef) => withRows("read", (scope, lock) => loadIntent(scope, tenantId, intentRef, lock), (mem) => mem.intents.read(actor, tenantId, intentRef)),
  };

  ports.events = {
    ...ports.events,
    append: (actor, event) => withRows("write", async (scope, lock) => {
      await loadTransaction(scope, event.tenantId, event.transactionRef, lock);
      await loadEvents(scope, event.tenantId, event.transactionRef, lock);
    }, (mem) => mem.events.append(actor, event)),
    list: (actor, tenantId, transactionRef) => withRows("read", async (scope, lock) => {
      await loadTransaction(scope, tenantId, transactionRef, lock);
      await loadEvents(scope, tenantId, transactionRef, lock);
    }, (mem) => mem.events.list(actor, tenantId, transactionRef)),
  };

  ports.idempotency = {
    read: (actor, tenantId, scopeName, idempotencyKey) => withRows("read", async (scope, lock) => {
      await loadIdempotency(scope, tenantId, scopeName, idempotencyKey, lock);
      await loadInflight(scope, tenantId, idempotencyKey, lock);
    }, (mem) => mem.idempotency.read(actor, tenantId, scopeName, idempotencyKey)),
    recordTimeout: (actor, input) => withRows("write", async (scope, lock) => {
      await loadInflight(scope, input.tenantId, input.idempotencyKey, lock);
      await loadIdempotency(scope, input.tenantId, "RESERVE", input.idempotencyKey, lock);
      await loadTransaction(scope, input.tenantId, input.transactionRef, lock);
      const pending = inflightFrom(scope, input.tenantId, input.idempotencyKey);
      if (pending && pending.transactionRef !== input.transactionRef) {
        await loadTransaction(scope, input.tenantId, pending.transactionRef, lock);
      }
    }, (mem) => mem.idempotency.recordTimeout(actor, input)),
    claim: (actor, input) => claimIdempotency(deps, actor, input),
    finishDenied: (actor, input) => withRows("write", async (scope, lock) => {
      await loadIdempotency(scope, input.tenantId, "RESERVE", input.idempotencyKey, lock);
      await loadInflight(scope, input.tenantId, input.idempotencyKey, lock);
      const idem = snapshotOf(scope.mem).idempotency.find((row) => row.tenantId === input.tenantId && row.scope === "RESERVE" && row.idempotencyKey === input.idempotencyKey);
      if (!idem?.transactionRef) return;
      await loadTransaction(scope, input.tenantId, idem.transactionRef, lock);
      await loadBookingsForTransaction(scope, input.tenantId, idem.transactionRef, lock);
    }, (mem) => mem.idempotency.finishDenied(actor, input)),
    noteFound: (actor, tenantId, idempotencyKey, found) => withRows("write", (scope, lock) => loadInflight(scope, tenantId, idempotencyKey, lock), (mem) => mem.idempotency.noteFound(actor, tenantId, idempotencyKey, found)),
    clearAbsence: (actor, tenantId, idempotencyKey) => withRows("write", (scope, lock) => loadInflight(scope, tenantId, idempotencyKey, lock), (mem) => mem.idempotency.clearAbsence(actor, tenantId, idempotencyKey)),
    noteAbsence: (actor, tenantId, idempotencyKey, claim) => withRows("write", async (scope, lock) => {
      await loadInflight(scope, tenantId, idempotencyKey, lock);
      const pending = inflightFrom(scope, tenantId, idempotencyKey);
      if (!pending) return;
      await loadBookingConnection(scope, tenantId, pending.locationId, pending.providerId);
    }, (mem) => mem.idempotency.noteAbsence(actor, tenantId, idempotencyKey, claim)),
  };

  const previousConnections = ports.connections;
  ports.connections = {
    ...previousConnections,
    register: (actor, input) => registerConnection(deps, actor, input),
    resolve: (actor, tenantId, locationId, providerId, kind) => resolveConnection(deps, actor, tenantId, locationId, providerId, kind),
  };

  ports.runAtomic = (work) => {
    const live = commerceLive.getStore();
    if (live?.mode === "snapshot") return live.mem.runAtomic(work);
    if (live?.mode === "rows") return work(ports);
    return (async () => {
      try {
        return await deps.begin(async (tx) => {
          const scope = newScope(tx, deps.policyValidatorKey);
          const result = await commerceLive.run(scope, async () => settle(work(ports)));
          if (!result.ok) throw new RolledBackResult(result);
          await flushBookingDiff(tx, scope.baseline, snapshotOf(scope.mem));
          return result;
        });
      } catch (error) {
        if (error instanceof RolledBackResult) return error.failure;
        const mapped = mapDbError(error);
        if (mapped) return mapped;
        throw error;
      }
    })();
  };

  ports.exportSnapshot = async () => {
    const live = commerceLive.getStore();
    if (live?.mode === "rows") {
      await ensureKnownEvents(live);
      return snapshotOf(live.mem);
    }
    if (live?.mode === "snapshot") return snapshotOf(live.mem);
    await deps.assertOutside();
    return deps.readSnapshot(deps.client);
  };
}

async function claimIdempotency(
  deps: { begin: Begin },
  actor: Parameters<CommercePersistence["idempotency"]["claim"]>[0],
  input: Parameters<CommercePersistence["idempotency"]["claim"]>[1],
): Promise<PortResult<StoredIdempotency>> {
  const live = commerceLive.getStore();
  if (live?.mode === "snapshot") return settle(live.mem.idempotency.claim(actor, input));
  if (live?.mode === "rows") {
    await loadInflight(live, input.tenantId, input.idempotencyKey, true);
    await loadIdempotency(live, input.tenantId, "RESERVE", input.idempotencyKey, true);
    await loadTransaction(live, input.tenantId, input.transactionRef, true);
    return settle(live.mem.idempotency.claim(actor, input));
  }
  const allowed = authorize(actor, { tenantId: input.tenantId, locationId: input.locationId }, "write");
  if (!allowed.ok) return fail(allowed.code, "The claim is outside this actor.");
  if (!input.idempotencyKey.trim() || !input.requestHash.trim() || !input.transactionRef.trim() || !input.offeringId.trim() || !input.startsAt.trim()) {
    return fail("INVALID", "A claim needs a key, a hash, a transaction id, an offering, and a start time.");
  }
  try {
    return await deps.begin(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "CcTransaction" (
          "tenantId", "transactionRef", "locationId", "intentRef", "providerId", "state",
          "bookingRef", "orderRef", "paymentStatus", "verifiedPaid", "version"
        ) VALUES (
          ${input.tenantId}, ${input.transactionRef}, ${input.locationId}, NULL, ${input.providerId}, 'PENDING_RESOLUTION',
          NULL, NULL, 'NOT_STARTED', false, 1
        )
        ON CONFLICT ("tenantId", "transactionRef") DO NOTHING
      `;
      const inserted = await tx.$queryRaw<Array<{ tenantId: string }>>`
        INSERT INTO "CcIdempotency" (
          "tenantId", "scope", "idempotencyKey", "requestHash", "status", "transactionRef", "outcomeCode", "version"
        ) VALUES (
          ${input.tenantId}, 'RESERVE', ${input.idempotencyKey}, ${input.requestHash}, 'IN_PROGRESS', ${input.transactionRef}, NULL, 1
        )
        ON CONFLICT ("tenantId", "scope", "idempotencyKey") DO NOTHING
        RETURNING "tenantId"
      `;
      if (inserted.length === 1) {
        await tx.$executeRaw`
          INSERT INTO "CcInflight" (
            "tenantId", "idempotencyKey", "locationId", "providerId", "requestHash", "slotKey", "transactionRef",
            "merchantConfirmed", "experience", "category", "offeringId", "startsAt", "absenceVerified", "adoptBookingRef", "version"
          ) VALUES (
            ${input.tenantId}, ${input.idempotencyKey}, ${input.locationId}, ${input.providerId}, ${input.requestHash}, ${input.slotKey},
            ${input.transactionRef}, ${input.merchantConfirmed}, ${input.experience}, ${input.category}, ${input.offeringId}, ${input.startsAt},
            false, NULL, 1
          )
        `;
        return {
          ok: true as const,
          replay: false,
          value: {
            tenantId: input.tenantId,
            scope: "RESERVE" as const,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            status: "IN_PROGRESS" as const,
            transactionRef: input.transactionRef,
            outcomeCode: null,
            version: 1,
          },
        };
      }
      const locked = await tx.$queryRaw<StoredIdempotency[]>`
        SELECT "tenantId", "scope", "idempotencyKey", "requestHash", "status", "transactionRef", "outcomeCode", "version"
        FROM "CcIdempotency"
        WHERE "tenantId" = ${input.tenantId} AND "scope" = 'RESERVE' AND "idempotencyKey" = ${input.idempotencyKey}
        FOR UPDATE
      `;
      const row = locked[0];
      if (!row) return fail("NOT_FOUND", "Idempotency key not found.");
      if (row.requestHash !== input.requestHash) return fail("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different request.");
      await tx.$queryRaw`
        SELECT "idempotencyKey" FROM "CcInflight"
        WHERE "tenantId" = ${input.tenantId} AND "idempotencyKey" = ${input.idempotencyKey}
        FOR UPDATE
      `;
      const retried = await tx.$queryRaw<Array<{ transactionRef: string }>>`
        UPDATE "CcInflight"
        SET "absenceVerified" = false, "version" = "version" + 1
        WHERE "tenantId" = ${input.tenantId}
          AND "idempotencyKey" = ${input.idempotencyKey}
          AND "absenceVerified" = true
          AND "requestHash" = ${input.requestHash}
          AND "providerId" = ${input.providerId}
          AND "locationId" = ${input.locationId}
        RETURNING "transactionRef"
      `;
      if (retried.length === 1) {
        const updated = await tx.$queryRaw<StoredIdempotency[]>`
          UPDATE "CcIdempotency"
          SET "status" = 'IN_PROGRESS', "outcomeCode" = NULL, "transactionRef" = ${retried[0].transactionRef}, "version" = "version" + 1
          WHERE "tenantId" = ${input.tenantId} AND "scope" = 'RESERVE' AND "idempotencyKey" = ${input.idempotencyKey}
          RETURNING "tenantId", "scope", "idempotencyKey", "requestHash", "status", "transactionRef", "outcomeCode", "version"
        `;
        return { ok: true, replay: false, value: { ...updated[0], scope: "RESERVE", status: updated[0].status } };
      }
      return { ok: true, replay: true, value: { ...row, scope: "RESERVE" } };
    });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

type ConnectionRegister = CommercePersistence["connections"]["register"];
type ConnectionResolve = CommercePersistence["connections"]["resolve"];

async function registerConnection(
  deps: { client: PrismaClient; begin: Begin },
  actor: Parameters<ConnectionRegister>[0],
  input: Parameters<ConnectionRegister>[1],
): Promise<PortResult<StoredConnection>> {
  const live = commerceLive.getStore();
  if (live?.mode === "snapshot") return settle(live.mem.connections.register(actor, input));
  const run = async (tx: Db): Promise<PortResult<StoredConnection>> => {
    const rows = await tx.ccProviderConnection.findMany({
      where: { tenantId: input.tenantId, providerId: input.providerId, kind: input.kind, locationId: input.locationId },
    });
    if (live?.mode === "rows") {
      absorb(live, { connections: rows.map(toConnection) });
      const nested = await settle(live.mem.connections.register(actor, input));
      if (nested.ok && !nested.replay && !rows.some((row) => row.connectionId === nested.value.connectionId)) {
        await tx.ccProviderConnection.create({
          data: {
            connectionId: nested.value.connectionId,
            tenantId: nested.value.tenantId,
            locationId: nested.value.locationId,
            providerId: nested.value.providerId,
            kind: nested.value.kind,
            mode: nested.value.mode,
            capabilities: json(nested.value.capabilities),
            status: nested.value.status,
            health: nested.value.health,
            lastCheckedAt: asDate(nested.value.lastCheckedAt),
            credentialRef: nested.value.credentialRef,
            webhookSecretRef: nested.value.webhookSecretRef,
            version: nested.value.version,
          },
        });
      }
      return nested;
    }
    const seed = emptyPersistenceSnapshot();
    seed.connections = rows.map(toConnection);
    const mem = createMemoryCommerceStore({ snapshot: seed });
    const result = await settle(mem.connections.register(actor, input));
    if (!result.ok || result.replay) return result;
    await tx.ccProviderConnection.create({
      data: {
        connectionId: result.value.connectionId,
        tenantId: result.value.tenantId,
        locationId: result.value.locationId,
        providerId: result.value.providerId,
        kind: result.value.kind,
        mode: result.value.mode,
        capabilities: json(result.value.capabilities),
        status: result.value.status,
        health: result.value.health,
        lastCheckedAt: asDate(result.value.lastCheckedAt),
        credentialRef: result.value.credentialRef,
        webhookSecretRef: result.value.webhookSecretRef,
        version: result.value.version,
      },
    });
    return result;
  };
  if (live?.mode === "rows") return run(live.tx);
  try {
    return await deps.begin(run);
  } catch (error) {
    if (isUnique(error)) {
      const replayed = await replayRegister(deps.client, actor, input);
      if (replayed.ok || replayed.code === "SCOPE_MISMATCH") return replayed;
    }
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

function isUnique(error: unknown): boolean {
  const message = errorText(error);
  return message.includes("23505") || message.includes("Unique constraint") || message.includes("duplicate key");
}

async function replayRegister(
  client: PrismaClient,
  actor: Parameters<ConnectionRegister>[0],
  input: Parameters<ConnectionRegister>[1],
): Promise<PortResult<StoredConnection>> {
  const rows = await client.ccProviderConnection.findMany({
    where: { tenantId: input.tenantId, providerId: input.providerId, kind: input.kind, locationId: input.locationId },
  });
  const seed = emptyPersistenceSnapshot();
  seed.connections = rows.map(toConnection);
  const mem = createMemoryCommerceStore({ snapshot: seed });
  return settle(mem.connections.register(actor, input));
}

async function resolveConnection(
  deps: { client: PrismaClient },
  actor: Parameters<ConnectionResolve>[0],
  tenantId: string,
  locationId: string | null,
  providerId: string,
  kind: Parameters<ConnectionResolve>[4],
): Promise<PortResult<StoredConnection>> {
  const live = commerceLive.getStore();
  if (live?.mode === "snapshot") return settle(live.mem.connections.resolve(actor, tenantId, locationId, providerId, kind));
  const tx = live?.mode === "rows" ? live.tx : deps.client;
  const rows = await tx.ccProviderConnection.findMany({ where: { tenantId, providerId, kind } });
  if (live?.mode === "rows") {
    absorb(live, { connections: rows.map(toConnection) });
    return settle(live.mem.connections.resolve(actor, tenantId, locationId, providerId, kind));
  }
  const seed = emptyPersistenceSnapshot();
  seed.connections = rows.map(toConnection);
  const mem = createMemoryCommerceStore({ snapshot: seed });
  return settle(mem.connections.resolve(actor, tenantId, locationId, providerId, kind));
}
