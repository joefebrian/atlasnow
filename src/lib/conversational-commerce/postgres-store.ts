/**
 * PostgreSQL CommercePersistence for a disposable QA database.
 * Every mutation locks and updates only the rows for that operation.
 * Provider calls stay in the orchestrator, outside the database transaction.
 * Payment HMAC and gateway trust stay in payment.ts. This file does not call a provider.
 * Live-slot uniqueness is per provider. It is not global capacity across booking systems.
 * exportSnapshot() is a read-only diagnostic. It is not a write source.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { AmountRejected, assertSafeSum, idrFromBigInt } from "./idr-amount";
import { type PaymentLedger, type VerifiedPaymentEvent } from "./payment";
import { bindRowPersistence } from "./postgres-booking";
import { bindFinancePersistence } from "./postgres-finance";
import type { DisposableQaDatabase } from "./qa-database";
import type {
  CommercePersistence,
  PersistenceSnapshot,
  StoredAggregate,
  StoredAttempt,
  StoredBooking,
  StoredConnection,
  StoredCredential,
  StoredEvent,
  StoredExternalRef,
  StoredIdempotency,
  StoredInflight,
  StoredIntent,
  StoredLedger,
  StoredLedgerEvent,
  StoredPolicyEvidence,
  StoredTouchpoint,
  StoredTransaction,
  StoredWebhook,
} from "./ports";

type Db = PrismaClient | Prisma.TransactionClient;

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
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

async function readSnapshot(db: Db): Promise<PersistenceSnapshot> {
  const [intents, transactions, bookings, connections, credentials, externalRefs, attempts, ledgers, eventsPay, idempotency, inflight, webhooks, events, touchpoints, aggregates, policy] = await Promise.all([
    db.ccIntent.findMany(),
    db.ccTransaction.findMany(),
    db.ccBooking.findMany(),
    db.ccProviderConnection.findMany(),
    db.ccProviderCredential.findMany(),
    db.ccExternalRef.findMany(),
    db.ccPaymentAttempt.findMany(),
    db.ccPaymentLedger.findMany(),
    db.ccPaymentEvent.findMany(),
    db.ccIdempotency.findMany(),
    db.ccInflight.findMany(),
    db.ccWebhookEvent.findMany(),
    db.ccTransactionEvent.findMany(),
    db.ccTouchpoint.findMany(),
    db.ccAttributionAggregate.findMany(),
    db.ccPolicyEvidence.findMany(),
  ]);
  const snapshot: PersistenceSnapshot = {
    version: 1,
    intents: intents.map((row): StoredIntent => ({
      intentRef: row.intentRef,
      tenantId: row.tenantId,
      locationId: row.locationId,
      experience: row.experience as StoredIntent["experience"],
      intentType: row.intentType as StoredIntent["intentType"],
      qualified: row.qualified,
      customerRef: row.customerRef,
      commerceOrderRef: row.commerceOrderRef,
      version: row.version,
    })),
    transactions: transactions.map((row): StoredTransaction => ({
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
    })),
    bookings: bookings.map((row): StoredBooking => ({
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
      holdExpiresAt: iso(row.holdExpiresAt),
      holdExpiryOwner: row.holdExpiryOwner as StoredBooking["holdExpiryOwner"],
      nativeExpiryPolicyId: row.nativeExpiryPolicyId,
      pendingSlotKey: row.pendingSlotKey,
    })),
    connections: connections.map((row): StoredConnection => ({
      connectionId: row.connectionId,
      tenantId: row.tenantId,
      locationId: row.locationId,
      providerId: row.providerId,
      kind: row.kind as StoredConnection["kind"],
      mode: row.mode as StoredConnection["mode"],
      capabilities: row.capabilities as StoredConnection["capabilities"],
      status: row.status as StoredConnection["status"],
      health: row.health as StoredConnection["health"],
      lastCheckedAt: iso(row.lastCheckedAt),
      credentialRef: row.credentialRef,
      webhookSecretRef: row.webhookSecretRef,
      version: row.version,
    })),
    credentials: credentials.map((row): StoredCredential => ({
      credentialRef: row.credentialRef,
      tenantId: row.tenantId,
      connectionId: row.connectionId,
      purpose: row.purpose as StoredCredential["purpose"],
      keyVersion: row.keyVersion,
      status: row.status as StoredCredential["status"],
      rotatedFromRef: row.rotatedFromRef,
      revokedAt: iso(row.revokedAt),
    })),
    externalRefs: externalRefs.map((row): StoredExternalRef => ({
      tenantId: row.tenantId,
      locationId: row.locationId,
      owner: row.owner as StoredExternalRef["owner"],
      ownerRef: row.ownerRef,
      providerId: row.providerId,
      externalId: row.externalId,
    })),
    attempts: attempts.map((row): StoredAttempt => ({
      attemptRef: row.attemptRef,
      tenantId: row.tenantId,
      locationId: row.locationId,
      transactionRef: row.transactionRef,
      providerId: row.providerId,
      providerMode: row.providerMode as StoredAttempt["providerMode"],
      expectedAmountIdr: idrFromBigInt(row.expectedAmountIdr),
      currency: row.currency === "IDR" ? "IDR" : (() => { throw new AmountRejected("Payment currency is not IDR."); })(),
      version: row.version,
    })),
    ledgers: ledgers.map((row): StoredLedger => {
      const detail = ledgerDetail(row.detail);
      const amountIdr = row.amountIdr == null ? null : idrFromBigInt(row.amountIdr);
      const refundedIdr = idrFromBigInt(row.refundedIdr);
      return {
        tenantId: row.tenantId,
        attemptRef: row.attemptRef,
        providerId: row.providerId,
        transactionRef: row.transactionRef,
        version: row.version,
        ledger: {
          status: row.status as PaymentLedger["status"],
          amountIdr,
          refundedIdr,
          currency: detail.currency,
          verifiedPaid: row.verifiedPaid,
          appliedEventIds: detail.appliedEventIds,
          rejectedEventIds: detail.rejectedEventIds,
          queued: detail.queued,
          providerReference: row.providerReference,
        },
      };
    }),
    ledgerEvents: eventsPay.map((row): StoredLedgerEvent => ({
      tenantId: row.tenantId,
      attemptRef: row.attemptRef,
      eventId: row.eventId,
      type: row.type,
      amountIdr: idrFromBigInt(row.amountIdr),
      providerReference: row.providerReference,
      occurredAt: row.occurredAt.toISOString(),
      sequence: row.sequence,
    })),
    idempotency: idempotency.map((row): StoredIdempotency => ({
      tenantId: row.tenantId,
      scope: row.scope as StoredIdempotency["scope"],
      idempotencyKey: row.idempotencyKey,
      requestHash: row.requestHash,
      status: row.status as StoredIdempotency["status"],
      transactionRef: row.transactionRef,
      outcomeCode: row.outcomeCode,
      version: row.version,
    })),
    inflight: inflight.map((row): StoredInflight => ({
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
    })),
    webhooks: webhooks.map((row): StoredWebhook => ({
      dedupeKey: row.dedupeKey,
      connectionId: row.connectionId,
      providerId: row.providerId,
      eventId: row.eventId,
      tenantId: row.tenantId,
      eventType: row.eventType,
      status: row.status as StoredWebhook["status"],
      version: row.version,
    })),
    events: events.map((row): StoredEvent => ({
      eventId: row.eventId,
      tenantId: row.tenantId,
      transactionRef: row.transactionRef,
      type: row.type,
      at: row.at.toISOString(),
      payload: row.payload as StoredEvent["payload"],
      version: 1,
    })),
    touchpoints: touchpoints.map((row): StoredTouchpoint => ({
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
    })),
    aggregates: aggregates.map((row): StoredAggregate => ({
      aggregateId: row.aggregateId,
      tenantId: row.tenantId,
      locationId: row.locationId,
      channel: row.channel as StoredAggregate["channel"],
      count: row.count,
      version: row.version,
    })),
    policyEvidence: policy.map((row): StoredPolicyEvidence => ({
      tenantId: row.tenantId,
      offeringCategory: row.offeringCategory as StoredPolicyEvidence["offeringCategory"],
      experience: row.experience as StoredPolicyEvidence["experience"],
      source: "META_COMMERCE_POLICY",
      status: row.status === "VERIFIED" ? "VERIFIED" : "UNVERIFIED",
      reference: row.reference,
      validatedBy: row.validatedBy,
      integrity: row.integrity,
      version: row.version,
    })),
  };
  for (const row of snapshot.ledgers) {
    if (row.ledger.amountIdr != null) assertSafeSum(row.ledger.amountIdr);
    assertSafeSum(row.ledger.refundedIdr);
  }
  return snapshot;
}


export async function openPostgresCommerceStore(options: {
  client: PrismaClient;
  qa: DisposableQaDatabase;
  policyValidatorKey?: string;
}): Promise<CommercePersistence> {
  const client = options.client;
  const qa = options.qa;
  const policyValidatorKey = options.policyValidatorKey ?? "";
  await qa.assertIdentity(client);

  async function begin<T>(work: (tx: Db) => Promise<T>): Promise<T> {
    return client.$transaction(async (tx) => {
      await qa.assertIdentity(tx);
      const level = await tx.$queryRaw<Array<{ isolation: string }>>`SELECT current_setting('transaction_isolation') AS isolation`;
      if (level[0]?.isolation !== "read committed") throw new Error("PostgreSQL transaction is not read committed.");
      return work(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 15_000, timeout: 20_000 });
  }

  const ports = {} as CommercePersistence;
  const unbound = () => {
    throw new Error("PostgreSQL port is not bound.");
  };
  ports.transactions = { read: unbound, compareAndSwap: unbound };
  ports.intents = { save: unbound, read: unbound };
  ports.events = { append: unbound, list: unbound };
  ports.connections = {
    register: unbound,
    resolve: unbound,
    registerCredential: unbound,
    rotateCredential: unbound,
    revokeCredential: unbound,
    reportHealth: unbound,
  };
  const deps = {
    client,
    policyValidatorKey,
    begin,
    readSnapshot,
    assertOutside: () => qa.assertIdentity(client),
  };
  bindRowPersistence(ports, deps);
  bindFinancePersistence(ports, deps);
  return ports;
}
