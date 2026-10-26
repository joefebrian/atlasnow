/**
 * Row-level payment, webhook, attribution, policy, and credential writes.
 * The memory store decides each transition. This file locks that operation's rows
 * and flushes the diff. Lock order is connection, credential, transaction,
 * attempt, ledger, payment event, external ref, webhook, touchpoint, aggregate, policy.
 * A failure does not flush. A thrown write rolls the transaction back.
 * Provider calls and payment trust stay outside this file.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { AmountRejected, assertSafeSum, idrFromBigInt, idrToBigInt } from "./idr-amount";
import { refFromMaterial, stableHash } from "./ids";
import type { PaymentLedger, VerifiedPaymentEvent } from "./payment";
import {
  absorbRows,
  addDiffFlusher,
  runScoped,
  type Begin,
  type RowDeps,
  type RowScope,
} from "./postgres-booking";
import type {
  CommercePersistence,
  ConnectionCapabilities,
  PersistenceSnapshot,
  PortFailure,
  PortResult,
  StoredAggregate,
  StoredAttempt,
  StoredConnection,
  StoredCredential,
  StoredExternalRef,
  StoredLedger,
  StoredLedgerEvent,
  StoredPolicyEvidence,
  StoredTouchpoint,
  StoredWebhook,
} from "./ports";

type Db = PrismaClient | Prisma.TransactionClient;

function fail(code: PortFailure["code"], message: string): PortFailure {
  return { ok: false, code, message };
}

function asDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function isUnique(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return message.includes("23505") || message.includes("Unique constraint") || message.includes("duplicate key");
}

async function commitOnce<T>(run: () => Promise<PortResult<T>>): Promise<PortResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (!isUnique(error)) throw error;
    return run();
  }
}

function ledgerDetail(value: Prisma.JsonValue): Pick<PaymentLedger, "currency" | "appliedEventIds" | "rejectedEventIds" | "queued"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AmountRejected("Payment ledger detail is incomplete.");
  const row = value as Record<string, unknown>;
  if (row.currency != null && row.currency !== "IDR") throw new AmountRejected("Payment currency is not IDR.");
  if (!Array.isArray(row.appliedEventIds) || !Array.isArray(row.rejectedEventIds) || !Array.isArray(row.queued)) {
    throw new AmountRejected("Payment ledger detail is incomplete.");
  }
  return {
    currency: row.currency === "IDR" ? "IDR" : null,
    appliedEventIds: row.appliedEventIds.map(String),
    rejectedEventIds: row.rejectedEventIds.map(String),
    queued: row.queued as VerifiedPaymentEvent[],
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
    throw new Error("Connection capabilities are incomplete.");
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
    lastCheckedAt: iso(row.lastCheckedAt),
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
    revokedAt: iso(row.revokedAt),
  };
}

function toAttempt(row: {
  tenantId: string;
  attemptRef: string;
  locationId: string | null;
  transactionRef: string;
  providerId: string;
  providerMode: string;
  expectedAmountIdr: bigint;
  currency: string;
  version: number;
}): StoredAttempt {
  if (row.currency !== "IDR") throw new AmountRejected("Payment currency is not IDR.");
  return {
    attemptRef: row.attemptRef,
    tenantId: row.tenantId,
    locationId: row.locationId,
    transactionRef: row.transactionRef,
    providerId: row.providerId,
    providerMode: row.providerMode as StoredAttempt["providerMode"],
    expectedAmountIdr: idrFromBigInt(row.expectedAmountIdr),
    currency: "IDR",
    version: row.version,
  };
}

function toLedger(row: {
  tenantId: string;
  attemptRef: string;
  providerId: string;
  transactionRef: string;
  status: string;
  amountIdr: bigint | null;
  refundedIdr: bigint;
  verifiedPaid: boolean;
  providerReference: string | null;
  detail: Prisma.JsonValue;
  version: number;
}): StoredLedger {
  const detail = ledgerDetail(row.detail);
  return {
    tenantId: row.tenantId,
    attemptRef: row.attemptRef,
    providerId: row.providerId,
    transactionRef: row.transactionRef,
    version: row.version,
    ledger: {
      status: row.status as PaymentLedger["status"],
      amountIdr: row.amountIdr == null ? null : idrFromBigInt(row.amountIdr),
      refundedIdr: idrFromBigInt(row.refundedIdr),
      currency: detail.currency,
      verifiedPaid: row.verifiedPaid,
      appliedEventIds: detail.appliedEventIds,
      rejectedEventIds: detail.rejectedEventIds,
      queued: detail.queued,
      providerReference: row.providerReference,
    },
  };
}

function toLedgerEvent(row: {
  tenantId: string;
  attemptRef: string;
  eventId: string;
  type: string;
  amountIdr: bigint;
  providerReference: string;
  occurredAt: Date;
  sequence: number | null;
}): StoredLedgerEvent {
  return {
    tenantId: row.tenantId,
    attemptRef: row.attemptRef,
    eventId: row.eventId,
    type: row.type,
    amountIdr: idrFromBigInt(row.amountIdr),
    providerReference: row.providerReference,
    occurredAt: row.occurredAt.toISOString(),
    sequence: row.sequence,
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

function toWebhook(row: {
  dedupeKey: string;
  connectionId: string;
  providerId: string;
  eventId: string;
  tenantId: string;
  eventType: string;
  status: string;
  version: number;
}): StoredWebhook {
  return {
    dedupeKey: row.dedupeKey,
    connectionId: row.connectionId,
    providerId: row.providerId,
    eventId: row.eventId,
    tenantId: row.tenantId,
    eventType: row.eventType,
    status: row.status as StoredWebhook["status"],
    version: row.version,
  };
}

function toTouchpoint(row: {
  touchpointId: string;
  tenantId: string;
  locationId: string | null;
  transactionRef: string | null;
  intentRef: string | null;
  bookingRef: string | null;
  attemptRef: string | null;
  channel: string;
  confidence: string;
  userLevel: boolean;
  ctwaClid: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  qrCampaignId: string | null;
  erasedAt: Date | null;
  erasureReason: string | null;
  version: number;
}): StoredTouchpoint {
  return {
    touchpointId: row.touchpointId,
    tenantId: row.tenantId,
    locationId: row.locationId,
    transactionRef: row.transactionRef,
    intentRef: row.intentRef,
    bookingRef: row.bookingRef,
    attemptRef: row.attemptRef,
    channel: row.channel as StoredTouchpoint["channel"],
    confidence: row.confidence as StoredTouchpoint["confidence"],
    userLevel: row.userLevel,
    ctwaClid: row.ctwaClid,
    gclid: row.gclid,
    gbraid: row.gbraid,
    wbraid: row.wbraid,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    qrCampaignId: row.qrCampaignId,
    warnings: row.channel === "UNKNOWN" ? ["No attribution identifier was supplied."] : [],
    erasedAt: iso(row.erasedAt),
    erasureReason: row.erasureReason,
    version: row.version,
  };
}

function toAggregate(row: {
  aggregateId: string;
  tenantId: string;
  locationId: string | null;
  channel: string;
  count: number;
  version: number;
}): StoredAggregate {
  return {
    aggregateId: row.aggregateId,
    tenantId: row.tenantId,
    locationId: row.locationId,
    channel: row.channel as StoredAggregate["channel"],
    count: row.count,
    version: row.version,
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

async function absorbTransaction(scope: RowScope, tenantId: string, transactionRef: string): Promise<void> {
  const row = await scope.tx.ccTransaction.findUnique({ where: { tenantId_transactionRef: { tenantId, transactionRef } } });
  if (!row) return;
  absorbRows(scope, {
    transactions: [{
      transactionRef: row.transactionRef,
      tenantId: row.tenantId,
      locationId: row.locationId,
      intentRef: row.intentRef,
      providerId: row.providerId,
      state: row.state as PersistenceSnapshot["transactions"][number]["state"],
      bookingRef: row.bookingRef,
      orderRef: row.orderRef,
      paymentStatus: row.paymentStatus as PersistenceSnapshot["transactions"][number]["paymentStatus"],
      verifiedPaid: row.verifiedPaid,
      version: row.version,
    }],
  });
}

async function absorbAttempt(scope: RowScope, tenantId: string, attemptRef: string): Promise<void> {
  const row = await scope.tx.ccPaymentAttempt.findUnique({ where: { tenantId_attemptRef: { tenantId, attemptRef } } });
  if (row) absorbRows(scope, { attempts: [toAttempt(row)] });
}

async function absorbLedgers(scope: RowScope, tenantId: string, transactionRef: string, providerId: string, providerReference: string): Promise<void> {
  const reference = providerReference.trim();
  const rows = await scope.tx.ccPaymentLedger.findMany({
    where: reference
      ? { tenantId, OR: [{ transactionRef }, { providerId, providerReference: reference }] }
      : { tenantId, transactionRef },
  });
  absorbRows(scope, { ledgers: rows.map(toLedger) });
}

async function absorbPaymentEvents(scope: RowScope, tenantId: string, attemptRef: string): Promise<void> {
  const rows = await scope.tx.ccPaymentEvent.findMany({ where: { tenantId, attemptRef } });
  absorbRows(scope, { ledgerEvents: rows.map(toLedgerEvent) });
}

async function absorbPaymentRefs(scope: RowScope, tenantId: string, providerId: string, attemptRef: string, providerReference: string): Promise<void> {
  const reference = providerReference.trim();
  const rows = await scope.tx.ccExternalRef.findMany({
    where: {
      tenantId,
      providerId,
      owner: "PAYMENT",
      OR: [{ ownerRef: attemptRef }, ...(reference ? [{ externalId: reference }] : [])],
    },
  });
  absorbRows(scope, { externalRefs: rows.map(toExternal) });
}

async function absorbPaymentConnections(scope: RowScope, tenantId: string, providerId: string): Promise<void> {
  const rows = await scope.tx.ccProviderConnection.findMany({ where: { tenantId, providerId, kind: "PAYMENT" } });
  absorbRows(scope, { connections: rows.map(toConnection) });
  if (!rows.length) return;
  const credentials = await scope.tx.ccProviderCredential.findMany({ where: { connectionId: { in: rows.map((row) => row.connectionId) } } });
  absorbRows(scope, { credentials: credentials.map(toCredential) });
}

async function lockPaymentScope(scope: RowScope, tenantId: string, providerId: string, transactionRef: string, attemptRef: string): Promise<void> {
  await scope.tx.$queryRaw`
    SELECT 1 FROM "CcProviderConnection"
    WHERE "tenantId" = ${tenantId} AND "providerId" = ${providerId} AND "kind" = 'PAYMENT'
    ORDER BY "connectionId"
    FOR UPDATE
  `;
  await scope.tx.$queryRaw`
    SELECT 1 FROM "CcProviderCredential"
    WHERE "connectionId" IN (
      SELECT "connectionId" FROM "CcProviderConnection"
      WHERE "tenantId" = ${tenantId} AND "providerId" = ${providerId} AND "kind" = 'PAYMENT'
    )
    ORDER BY "credentialRef"
    FOR UPDATE
  `;
  await scope.tx.$queryRaw`
    SELECT 1 FROM "CcTransaction"
    WHERE "tenantId" = ${tenantId} AND "transactionRef" = ${transactionRef}
    FOR UPDATE
  `;
  await scope.tx.$queryRaw`
    SELECT 1 FROM "CcPaymentAttempt"
    WHERE "tenantId" = ${tenantId} AND "attemptRef" = ${attemptRef}
    FOR UPDATE
  `;
}

async function updateCounted(count: number): Promise<void> {
  if (count !== 1) throw new Error("VERSION_CONFLICT");
}

async function flushFinanceDiff(tx: Db, before: PersistenceSnapshot, after: PersistenceSnapshot): Promise<void> {
  const connectionsBefore = new Map(before.connections.map((row) => [row.connectionId, row]));
  for (const row of after.connections) {
    const prior = connectionsBefore.get(row.connectionId);
    if (!prior || stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccProviderConnection.updateMany({
      where: { connectionId: row.connectionId, version: prior.version },
      data: {
        locationId: row.locationId,
        providerId: row.providerId,
        kind: row.kind,
        mode: row.mode,
        capabilities: json(row.capabilities),
        status: row.status,
        health: row.health,
        lastCheckedAt: asDate(row.lastCheckedAt),
        credentialRef: row.credentialRef,
        webhookSecretRef: row.webhookSecretRef,
        version: row.version,
      },
    });
    await updateCounted(updated.count);
  }

  const credentialsBefore = new Map(before.credentials.map((row) => [row.credentialRef, row]));
  for (const row of after.credentials) {
    const prior = credentialsBefore.get(row.credentialRef);
    if (!prior) {
      await tx.ccProviderCredential.create({
        data: { ...row, ciphertext: null, revokedAt: asDate(row.revokedAt) },
      });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccProviderCredential.updateMany({
      where: { credentialRef: row.credentialRef, status: prior.status },
      data: {
        purpose: row.purpose,
        keyVersion: row.keyVersion,
        status: row.status,
        rotatedFromRef: row.rotatedFromRef,
        revokedAt: asDate(row.revokedAt),
      },
    });
    await updateCounted(updated.count);
  }

  const attemptsBefore = new Map(before.attempts.map((row) => [`${row.tenantId}\0${row.attemptRef}`, row]));
  for (const row of after.attempts) {
    const key = `${row.tenantId}\0${row.attemptRef}`;
    const prior = attemptsBefore.get(key);
    if (!prior) {
      idrToBigInt(row.expectedAmountIdr);
      await tx.ccPaymentAttempt.create({ data: { ...row, expectedAmountIdr: idrToBigInt(row.expectedAmountIdr) } });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccPaymentAttempt.updateMany({
      where: { tenantId: row.tenantId, attemptRef: row.attemptRef, version: prior.version },
      data: {
        locationId: row.locationId,
        transactionRef: row.transactionRef,
        providerId: row.providerId,
        providerMode: row.providerMode,
        expectedAmountIdr: idrToBigInt(row.expectedAmountIdr),
        currency: row.currency,
        version: row.version,
      },
    });
    await updateCounted(updated.count);
  }

  const ledgersBefore = new Map(before.ledgers.map((row) => [`${row.tenantId}\0${row.attemptRef}`, row]));
  for (const row of after.ledgers) {
    const prior = ledgersBefore.get(`${row.tenantId}\0${row.attemptRef}`);
    const data = {
      providerId: row.providerId,
      transactionRef: row.transactionRef,
      status: row.ledger.status,
      amountIdr: row.ledger.amountIdr == null ? null : idrToBigInt(row.ledger.amountIdr),
      refundedIdr: idrToBigInt(row.ledger.refundedIdr),
      verifiedPaid: row.ledger.verifiedPaid,
      providerReference: row.ledger.providerReference,
      detail: json({
        currency: row.ledger.currency,
        appliedEventIds: row.ledger.appliedEventIds,
        rejectedEventIds: row.ledger.rejectedEventIds,
        queued: row.ledger.queued,
      }),
      version: row.version,
    };
    if (!prior) {
      await tx.ccPaymentLedger.create({ data: { tenantId: row.tenantId, attemptRef: row.attemptRef, ...data } });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccPaymentLedger.updateMany({
      where: { tenantId: row.tenantId, attemptRef: row.attemptRef, version: prior.version },
      data,
    });
    await updateCounted(updated.count);
  }

  const eventsBefore = new Set(before.ledgerEvents.map((row) => `${row.tenantId}\0${row.attemptRef}\0${row.eventId}`));
  for (const row of after.ledgerEvents) {
    if (eventsBefore.has(`${row.tenantId}\0${row.attemptRef}\0${row.eventId}`)) continue;
    await tx.ccPaymentEvent.create({
      data: { ...row, amountIdr: idrToBigInt(row.amountIdr), occurredAt: new Date(row.occurredAt) },
    });
  }

  const hooksBefore = new Map(before.webhooks.map((row) => [row.dedupeKey, row]));
  for (const row of after.webhooks) {
    const prior = hooksBefore.get(row.dedupeKey);
    if (!prior) {
      await tx.ccWebhookEvent.create({ data: row });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccWebhookEvent.updateMany({
      where: { dedupeKey: row.dedupeKey, version: prior.version },
      data: { status: row.status, eventType: row.eventType, version: row.version },
    });
    await updateCounted(updated.count);
  }

  const policyBefore = new Map(before.policyEvidence.map((row) => [`${row.tenantId}\0${row.offeringCategory}\0${row.experience}`, row]));
  for (const row of after.policyEvidence) {
    const prior = policyBefore.get(`${row.tenantId}\0${row.offeringCategory}\0${row.experience}`);
    if (!prior) {
      await tx.ccPolicyEvidence.create({ data: row });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccPolicyEvidence.updateMany({
      where: {
        tenantId: row.tenantId,
        offeringCategory: row.offeringCategory,
        experience: row.experience,
        version: prior.version,
      },
      data: {
        source: row.source,
        status: row.status,
        reference: row.reference,
        validatedBy: row.validatedBy,
        integrity: row.integrity,
        version: row.version,
      },
    });
    await updateCounted(updated.count);
  }

  const touchesBefore = new Map(before.touchpoints.map((row) => [row.touchpointId, row]));
  for (const row of after.touchpoints) {
    const { warnings: _warnings, ...stored } = row;
    const prior = touchesBefore.get(row.touchpointId);
    if (!prior) {
      await tx.ccTouchpoint.create({ data: { ...stored, erasedAt: asDate(row.erasedAt) } });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccTouchpoint.updateMany({
      where: { touchpointId: row.touchpointId, version: prior.version },
      data: {
        locationId: row.locationId,
        transactionRef: row.transactionRef,
        intentRef: row.intentRef,
        bookingRef: row.bookingRef,
        attemptRef: row.attemptRef,
        channel: row.channel,
        confidence: row.confidence,
        userLevel: row.userLevel,
        ctwaClid: row.ctwaClid,
        gclid: row.gclid,
        gbraid: row.gbraid,
        wbraid: row.wbraid,
        utmSource: row.utmSource,
        utmMedium: row.utmMedium,
        utmCampaign: row.utmCampaign,
        qrCampaignId: row.qrCampaignId,
        erasedAt: asDate(row.erasedAt),
        erasureReason: row.erasureReason,
        version: row.version,
      },
    });
    await updateCounted(updated.count);
  }

  const aggregatesBefore = new Map(before.aggregates.map((row) => [row.aggregateId, row]));
  for (const row of after.aggregates) {
    const prior = aggregatesBefore.get(row.aggregateId);
    if (!prior) {
      await tx.ccAttributionAggregate.create({ data: row });
      continue;
    }
    if (stableHash(prior) === stableHash(row)) continue;
    const updated = await tx.ccAttributionAggregate.updateMany({
      where: { aggregateId: row.aggregateId, version: prior.version },
      data: { count: row.count, version: row.version },
    });
    await updateCounted(updated.count);
  }
}

addDiffFlusher(flushFinanceDiff);

function guardMoney<T extends { ledger: PaymentLedger; netRevenueIdr: number }>(result: PortResult<T>): PortResult<T> {
  if (!result.ok) return result;
  assertSafeSum(result.value.netRevenueIdr);
  assertSafeSum(result.value.ledger.refundedIdr);
  if (result.value.ledger.amountIdr != null) assertSafeSum(result.value.ledger.amountIdr);
  return result;
}

export function bindFinancePersistence(ports: CommercePersistence, deps: RowDeps & { begin: Begin }): void {
  const openAttempt: CommercePersistence["payments"]["openAttempt"] = (actor, input) => {
    try {
      idrToBigInt(input.expectedAmountIdr);
    } catch (error) {
      if (error instanceof AmountRejected) return fail("INVALID", error.message);
      throw error;
    }
    const run = () => runScoped(deps, "write", async (scope, lock) => {
      if (lock) await lockPaymentScope(scope, input.tenantId, input.providerId, input.transactionRef, input.attemptRef);
      await absorbPaymentConnections(scope, input.tenantId, input.providerId);
      await absorbTransaction(scope, input.tenantId, input.transactionRef);
      await absorbAttempt(scope, input.tenantId, input.attemptRef);
    }, (mem) => mem.payments.openAttempt(actor, input));
    return commitOnce(run);
  };

  const applyEvent: CommercePersistence["payments"]["applyEvent"] = (actor, evidence) => {
    const event = evidence.event;
    const run = () => runScoped(deps, "write", async (scope, lock) => {
      if (!event?.tenantId || !event.attemptRef || !event.transactionRef || !event.providerId) return;
      if (lock) {
        await scope.tx.$queryRaw`
          SELECT 1 FROM "CcTransaction"
          WHERE "tenantId" = ${event.tenantId} AND "transactionRef" = ${event.transactionRef}
          FOR UPDATE
        `;
        await scope.tx.$queryRaw`
          SELECT 1 FROM "CcPaymentAttempt"
          WHERE "tenantId" = ${event.tenantId} AND "attemptRef" = ${event.attemptRef}
          FOR UPDATE
        `;
        await scope.tx.$queryRaw`
          SELECT 1 FROM "CcPaymentLedger"
          WHERE "tenantId" = ${event.tenantId}
            AND (
              "transactionRef" = ${event.transactionRef}
              OR ("providerId" = ${event.providerId} AND "providerReference" = ${event.providerReference})
            )
          ORDER BY "attemptRef"
          FOR UPDATE
        `;
        await scope.tx.$queryRaw`
          SELECT 1 FROM "CcPaymentEvent"
          WHERE "tenantId" = ${event.tenantId} AND "attemptRef" = ${event.attemptRef}
          ORDER BY "eventId"
          FOR UPDATE
        `;
        if (event.providerReference.trim()) {
          await scope.tx.$queryRaw`
            SELECT 1 FROM "CcExternalRef"
            WHERE "tenantId" = ${event.tenantId}
              AND "providerId" = ${event.providerId}
              AND "owner" = 'PAYMENT'
              AND ("externalId" = ${event.providerReference} OR "ownerRef" = ${event.attemptRef})
            ORDER BY "externalId"
            FOR UPDATE
          `;
        }
      }
      await absorbTransaction(scope, event.tenantId, event.transactionRef);
      await absorbAttempt(scope, event.tenantId, event.attemptRef);
      await absorbLedgers(scope, event.tenantId, event.transactionRef, event.providerId, event.providerReference);
      await absorbPaymentEvents(scope, event.tenantId, event.attemptRef);
      await absorbPaymentRefs(scope, event.tenantId, event.providerId, event.attemptRef, event.providerReference);
    }, async (mem) => guardMoney(await Promise.resolve(mem.payments.applyEvent(actor, evidence))));
    return commitOnce(run);
  };

  const reconcileTerminal: CommercePersistence["payments"]["reconcileTerminal"] = (actor, input) => {
    const run = () => runScoped(deps, "write", async (scope, lock) => {
      const attempt = await scope.tx.ccPaymentAttempt.findUnique({
        where: { tenantId_attemptRef: { tenantId: input.tenantId, attemptRef: input.attemptRef } },
      });
      if (lock && attempt) {
        await lockPaymentScope(scope, input.tenantId, input.providerId, attempt.transactionRef, input.attemptRef);
        await scope.tx.$queryRaw`
          SELECT 1 FROM "CcPaymentLedger"
          WHERE "tenantId" = ${input.tenantId} AND "transactionRef" = ${attempt.transactionRef}
          ORDER BY "attemptRef"
          FOR UPDATE
        `;
      }
      if (!attempt) return;
      await absorbPaymentConnections(scope, input.tenantId, input.providerId);
      await absorbTransaction(scope, input.tenantId, attempt.transactionRef);
      await absorbAttempt(scope, input.tenantId, input.attemptRef);
      await absorbLedgers(scope, input.tenantId, attempt.transactionRef, input.providerId, "");
    }, async (mem) => guardMoney(await Promise.resolve(mem.payments.reconcileTerminal(actor, input))));
    return commitOnce(run);
  };

  const net: CommercePersistence["payments"]["net"] = async (actor, tenantId, transactionRef) => {
    try {
      const result = await runScoped(deps, "read", async (scope) => {
        await absorbTransaction(scope, tenantId, transactionRef);
        await absorbLedgers(scope, tenantId, transactionRef, "", "");
      }, (mem) => mem.payments.net(actor, tenantId, transactionRef));
      if (!result.ok) return result;
      assertSafeSum(result.value.netRevenueIdr);
      assertSafeSum(result.value.refundedIdr);
      assertSafeSum(result.value.chargebackIdr);
      return result;
    } catch (error) {
      if (error instanceof AmountRejected) return fail("INVALID", error.message);
      throw error;
    }
  };

  ports.payments = { openAttempt, applyEvent, reconcileTerminal, net };

  ports.webhooks = {
    accept: (actor, input) => commitOnce(() => runScoped(deps, "write", async (scope, lock) => {
      const dedupeKey = `${input.connectionId}:${input.eventId}`;
      if (lock) {
        await scope.tx.$queryRaw`SELECT 1 FROM "CcProviderConnection" WHERE "connectionId" = ${input.connectionId} FOR UPDATE`;
        await scope.tx.$queryRaw`SELECT 1 FROM "CcWebhookEvent" WHERE "dedupeKey" = ${dedupeKey} FOR UPDATE`;
      }
      const connection = await scope.tx.ccProviderConnection.findUnique({ where: { connectionId: input.connectionId } });
      if (connection) absorbRows(scope, { connections: [toConnection(connection)] });
      const hook = await scope.tx.ccWebhookEvent.findUnique({ where: { dedupeKey } });
      if (hook) absorbRows(scope, { webhooks: [toWebhook(hook)] });
    }, (mem) => mem.webhooks.accept(actor, input))),
    markApplied: (actor, tenantId, dedupeKey) => runScoped(deps, "write", async (scope, lock) => {
      const peek = await scope.tx.ccWebhookEvent.findFirst({ where: { dedupeKey, tenantId } });
      if (lock && peek) {
        await scope.tx.$queryRaw`SELECT 1 FROM "CcProviderConnection" WHERE "connectionId" = ${peek.connectionId} FOR UPDATE`;
        await scope.tx.$queryRaw`SELECT 1 FROM "CcWebhookEvent" WHERE "dedupeKey" = ${dedupeKey} FOR UPDATE`;
      }
      const hook = await scope.tx.ccWebhookEvent.findFirst({ where: { dedupeKey, tenantId } });
      if (!hook) return;
      absorbRows(scope, { webhooks: [toWebhook(hook)] });
      const connection = await scope.tx.ccProviderConnection.findUnique({ where: { connectionId: hook.connectionId } });
      if (connection) absorbRows(scope, { connections: [toConnection(connection)] });
    }, (mem) => mem.webhooks.markApplied(actor, tenantId, dedupeKey)),
  };

  const loadCredential = async (scope: RowScope, tenantId: string, credentialRef: string, lock: boolean) => {
    const peek = await scope.tx.ccProviderCredential.findFirst({ where: { credentialRef, tenantId } });
    if (lock && peek) {
      await scope.tx.$queryRaw`SELECT 1 FROM "CcProviderConnection" WHERE "connectionId" = ${peek.connectionId} FOR UPDATE`;
      await scope.tx.$queryRaw`SELECT 1 FROM "CcProviderCredential" WHERE "connectionId" = ${peek.connectionId} ORDER BY "credentialRef" FOR UPDATE`;
    }
    const rows = peek
      ? await scope.tx.ccProviderCredential.findMany({ where: { connectionId: peek.connectionId } })
      : [];
    absorbRows(scope, { credentials: rows.map(toCredential) });
    if (!peek) return;
    const connection = await scope.tx.ccProviderConnection.findUnique({ where: { connectionId: peek.connectionId } });
    if (connection) absorbRows(scope, { connections: [toConnection(connection)] });
  };

  const loadConnectionCredentials = async (scope: RowScope, tenantId: string, connectionId: string, lock: boolean) => {
    if (lock) {
      await scope.tx.$queryRaw`SELECT 1 FROM "CcProviderConnection" WHERE "connectionId" = ${connectionId} FOR UPDATE`;
      await scope.tx.$queryRaw`SELECT 1 FROM "CcProviderCredential" WHERE "connectionId" = ${connectionId} ORDER BY "credentialRef" FOR UPDATE`;
    }
    const connection = await scope.tx.ccProviderConnection.findFirst({ where: { connectionId, tenantId } });
    if (connection) absorbRows(scope, { connections: [toConnection(connection)] });
    const credentials = await scope.tx.ccProviderCredential.findMany({ where: { connectionId } });
    absorbRows(scope, { credentials: credentials.map(toCredential) });
  };

  ports.connections = {
    ...ports.connections,
    registerCredential: (actor, input) => commitOnce(() => runScoped(
      deps,
      "write",
      (scope, lock) => loadConnectionCredentials(scope, input.tenantId, input.connectionId, lock),
      (mem) => mem.connections.registerCredential(actor, input),
    )),
    rotateCredential: (actor, input) => commitOnce(() => runScoped(
      deps,
      "write",
      (scope, lock) => loadConnectionCredentials(scope, input.tenantId, input.connectionId, lock),
      (mem) => mem.connections.rotateCredential(actor, input),
    )),
    revokeCredential: (actor, tenantId, credentialRef, revokedAt) => runScoped(
      deps,
      "write",
      (scope, lock) => loadCredential(scope, tenantId, credentialRef, lock),
      (mem) => mem.connections.revokeCredential(actor, tenantId, credentialRef, revokedAt),
    ),
    reportHealth: (actor, input) => runScoped(deps, "write", async (scope, lock) => {
      if (lock) {
        await scope.tx.$queryRaw`SELECT 1 FROM "CcProviderConnection" WHERE "connectionId" = ${input.connectionId} FOR UPDATE`;
      }
      const connection = await scope.tx.ccProviderConnection.findFirst({ where: { connectionId: input.connectionId, tenantId: input.tenantId } });
      if (connection) absorbRows(scope, { connections: [toConnection(connection)] });
    }, (mem) => mem.connections.reportHealth(actor, input)),
  };

  ports.attribution = {
    saveTouchpoint: (actor, input) => commitOnce(() => runScoped(deps, "write", async (scope, lock) => {
      if (input.transactionRef && lock) {
        await scope.tx.$queryRaw`
          SELECT 1 FROM "CcTransaction"
          WHERE "tenantId" = ${input.tenantId} AND "transactionRef" = ${input.transactionRef}
          FOR UPDATE
        `;
      }
      if (input.transactionRef) await absorbTransaction(scope, input.tenantId, input.transactionRef);
    }, (mem) => mem.attribution.saveTouchpoint(actor, input))),
    saveAggregate: (actor, input) => {
      const aggregateId = refFromMaterial("AGG", `${input.tenantId}:${input.locationId ?? ""}:${input.channel}`);
      return commitOnce(() => runScoped(deps, "write", async (scope, lock) => {
        if (lock) {
          await scope.tx.$queryRaw`SELECT 1 FROM "CcAttributionAggregate" WHERE "aggregateId" = ${aggregateId} FOR UPDATE`;
        }
        const row = await scope.tx.ccAttributionAggregate.findUnique({ where: { aggregateId } });
        if (row) absorbRows(scope, { aggregates: [toAggregate(row)] });
      }, (mem) => mem.attribution.saveAggregate(actor, input)));
    },
    eraseIdentifiers: (actor, tenantId, touchpointId, reason, erasedAt) => runScoped(deps, "write", async (scope, lock) => {
      if (lock) {
        await scope.tx.$queryRaw`SELECT 1 FROM "CcTouchpoint" WHERE "touchpointId" = ${touchpointId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      }
      const row = await scope.tx.ccTouchpoint.findFirst({ where: { touchpointId, tenantId } });
      if (row) absorbRows(scope, { touchpoints: [toTouchpoint(row)] });
    }, (mem) => mem.attribution.eraseIdentifiers(actor, tenantId, touchpointId, reason, erasedAt)),
    readClass: (actor, tenantId, transactionRef) => runScoped(deps, "read", async (scope) => {
      await absorbTransaction(scope, tenantId, transactionRef);
      const transaction = await scope.tx.ccTransaction.findUnique({ where: { tenantId_transactionRef: { tenantId, transactionRef } } });
      if (transaction?.bookingRef) {
        const booking = await scope.tx.ccBooking.findUnique({ where: { tenantId_bookingRef: { tenantId, bookingRef: transaction.bookingRef } } });
        if (booking) {
          absorbRows(scope, {
            bookings: [{
              bookingRef: booking.bookingRef,
              tenantId: booking.tenantId,
              locationId: booking.locationId,
              transactionRef: booking.transactionRef,
              providerId: booking.providerId,
              providerMode: booking.providerMode as PersistenceSnapshot["bookings"][number]["providerMode"],
              slotKey: booking.slotKey,
              state: booking.state as PersistenceSnapshot["bookings"][number]["state"],
              providerReference: booking.providerReference,
              referenceAuthoritative: booking.referenceAuthoritative,
              idempotencyKey: booking.idempotencyKey,
              version: booking.version,
              holdExpiresAt: iso(booking.holdExpiresAt),
              holdExpiryOwner: booking.holdExpiryOwner as PersistenceSnapshot["bookings"][number]["holdExpiryOwner"],
              nativeExpiryPolicyId: booking.nativeExpiryPolicyId,
              pendingSlotKey: booking.pendingSlotKey,
            }],
          });
        }
      }
      const touches = await scope.tx.ccTouchpoint.findMany({ where: { tenantId, transactionRef } });
      absorbRows(scope, { touchpoints: touches.map(toTouchpoint) });
    }, (mem) => mem.attribution.readClass(actor, tenantId, transactionRef)),
  };

  ports.policy = {
    submit: (actor, tenantId, scopeName, submission) => commitOnce(() => runScoped(deps, "write", async (scope, lock) => {
      if (lock) {
        await scope.tx.$queryRaw`
          SELECT 1 FROM "CcPolicyEvidence"
          WHERE "tenantId" = ${tenantId}
            AND "offeringCategory" = ${scopeName.offeringCategory}
            AND "experience" = ${scopeName.experience}
          FOR UPDATE
        `;
      }
      const row = await scope.tx.ccPolicyEvidence.findUnique({
        where: {
          tenantId_offeringCategory_experience: {
            tenantId,
            offeringCategory: scopeName.offeringCategory,
            experience: scopeName.experience,
          },
        },
      });
      if (row) absorbRows(scope, { policyEvidence: [toPolicy(row)] });
    }, (mem) => mem.policy.submit(actor, tenantId, scopeName, submission))),
    read: (actor, tenantId, scopeName) => runScoped(deps, "read", async (scope) => {
      const row = await scope.tx.ccPolicyEvidence.findUnique({
        where: {
          tenantId_offeringCategory_experience: {
            tenantId,
            offeringCategory: scopeName.offeringCategory,
            experience: scopeName.experience,
          },
        },
      });
      if (row) absorbRows(scope, { policyEvidence: [toPolicy(row)] });
    }, (mem) => mem.policy.read(actor, tenantId, scopeName)),
  };
}
