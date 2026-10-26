/**
 * PostgreSQL CommercePersistence for a disposable QA database.
 * Provider calls stay in the orchestrator, outside runAtomic.
 * Payment HMAC and gateway trust stay in payment.ts. This file only locks and stores.
 * Live-slot uniqueness is per provider. It is not global capacity across booking systems.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import { authorize } from "./auth";
import { AmountRejected, assertSafeSum, idrFromBigInt, idrToBigInt } from "./idr-amount";
import { createMemoryCommerceStore } from "./memory-store";
import { readTrustedPayment, type PaymentLedger, type VerifiedPaymentEvent } from "./payment";
import type { DisposableQaDatabase } from "./qa-database";
import type {
  CommercePersistence,
  MaybeAsync,
  PersistenceSnapshot,
  PortCode,
  PortFailure,
  PortResult,
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
type Live = { mem: CommercePersistence };

const liveStore = new AsyncLocalStorage<Live>();

function fail(code: PortCode, message: string): PortFailure {
  return { ok: false, code, message };
}

function isFailure(value: unknown): value is PortFailure {
  return Boolean(value && typeof value === "object" && "ok" in value && (value as { ok: boolean }).ok === false);
}

function snapshotOf(mem: CommercePersistence): PersistenceSnapshot {
  const exported = mem.exportSnapshot();
  if (exported instanceof Promise) throw new Error("The snapshot copy returned a promise.");
  return exported;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function asDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapDbError(error: unknown): PortFailure | null {
  if (error instanceof AmountRejected) return fail("INVALID", error.message);
  const message = error instanceof Error ? error.message : "";
  if (message.includes("cc_location_mismatch")) return fail("SCOPE_MISMATCH", "Transaction location does not match the related row.");
  if (message.includes("CcBooking_live_slot")) return fail("SLOT_CONFLICT", "That slot is already reserved for this provider.");
  if (message.includes("CcBooking_provider_ref") || message.includes("CcPaymentLedger_provider_ref")) {
    return fail("REFERENCE_CONFLICT", "That provider reference is already claimed.");
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

async function writeSnapshot(db: Db, snap: PersistenceSnapshot): Promise<void> {
  for (const row of snap.attempts) idrToBigInt(row.expectedAmountIdr);
  for (const row of snap.ledgers) {
    if (row.ledger.amountIdr != null) idrToBigInt(row.ledger.amountIdr);
    idrToBigInt(row.ledger.refundedIdr);
  }
  for (const row of snap.ledgerEvents) idrToBigInt(row.amountIdr);
  await db.ccPaymentEvent.deleteMany();
  await db.ccPaymentLedger.deleteMany();
  await db.ccWebhookEvent.deleteMany();
  await db.ccProviderCredential.deleteMany();
  await db.ccInflight.deleteMany();
  await db.ccIdempotency.deleteMany();
  await db.ccBooking.deleteMany();
  await db.ccTransactionEvent.deleteMany();
  await db.ccPaymentAttempt.deleteMany();
  await db.ccExternalRef.deleteMany();
  await db.ccTouchpoint.deleteMany();
  await db.ccAttributionAggregate.deleteMany();
  await db.ccTransaction.deleteMany();
  await db.ccIntent.deleteMany();
  await db.ccProviderConnection.deleteMany();
  await db.ccPolicyEvidence.deleteMany();
  if (snap.policyEvidence.length) {
    await db.ccPolicyEvidence.createMany({
      data: snap.policyEvidence.map((row) => ({
        tenantId: row.tenantId,
        offeringCategory: row.offeringCategory,
        experience: row.experience,
        source: row.source,
        status: row.status,
        reference: row.reference,
        validatedBy: row.validatedBy,
        integrity: row.integrity,
        version: row.version,
      })),
    });
  }
  if (snap.connections.length) {
    await db.ccProviderConnection.createMany({
      data: snap.connections.map((row) => ({
        connectionId: row.connectionId,
        tenantId: row.tenantId,
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
      })),
    });
  }
  if (snap.intents.length) {
    await db.ccIntent.createMany({
      data: snap.intents.map((row) => ({
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
      })),
    });
  }
  if (snap.transactions.length) {
    await db.ccTransaction.createMany({ data: snap.transactions.map((row) => ({ ...row })) });
  }
  if (snap.aggregates.length) await db.ccAttributionAggregate.createMany({ data: snap.aggregates });
  if (snap.touchpoints.length) {
    await db.ccTouchpoint.createMany({
      data: snap.touchpoints.map(({ warnings: _warnings, ...row }) => ({ ...row, erasedAt: asDate(row.erasedAt) })),
    });
  }
  if (snap.externalRefs.length) await db.ccExternalRef.createMany({ data: snap.externalRefs });
  if (snap.attempts.length) {
    await db.ccPaymentAttempt.createMany({
      data: snap.attempts.map((row) => ({ ...row, expectedAmountIdr: idrToBigInt(row.expectedAmountIdr) })),
    });
  }
  if (snap.events.length) {
    await db.ccTransactionEvent.createMany({
      data: snap.events.map((row) => ({
        tenantId: row.tenantId,
        eventId: row.eventId,
        transactionRef: row.transactionRef,
        type: row.type,
        at: new Date(row.at),
        payload: json(row.payload),
      })),
    });
  }
  if (snap.bookings.length) {
    await db.ccBooking.createMany({
      data: snap.bookings.map((row) => ({ ...row, holdExpiresAt: asDate(row.holdExpiresAt) })),
    });
  }
  if (snap.idempotency.length) await db.ccIdempotency.createMany({ data: snap.idempotency });
  if (snap.inflight.length) await db.ccInflight.createMany({ data: snap.inflight });
  if (snap.credentials.length) {
    await db.ccProviderCredential.createMany({
      data: snap.credentials.map((row) => ({ ...row, ciphertext: null, revokedAt: asDate(row.revokedAt) })),
    });
  }
  if (snap.webhooks.length) await db.ccWebhookEvent.createMany({ data: snap.webhooks });
  if (snap.ledgers.length) {
    await db.ccPaymentLedger.createMany({
      data: snap.ledgers.map((row) => ({
        tenantId: row.tenantId,
        attemptRef: row.attemptRef,
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
      })),
    });
  }
  if (snap.ledgerEvents.length) {
    await db.ccPaymentEvent.createMany({
      data: snap.ledgerEvents.map((row) => ({
        ...row,
        amountIdr: idrToBigInt(row.amountIdr),
        occurredAt: new Date(row.occurredAt),
      })),
    });
  }
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

  async function writeTransaction<T>(work: (tx: Db) => Promise<T>): Promise<T> {
    return client.$transaction(async (tx) => {
      await qa.assertIdentity(tx);
      const level = await tx.$queryRaw<Array<{ isolation: string }>>`SELECT current_setting('transaction_isolation') AS isolation`;
      if (level[0]?.isolation !== "read committed") throw new Error("PostgreSQL transaction is not read committed.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('atlasnow-cc'), hashtext('qa'))`;
      return work(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 15_000, timeout: 20_000 });
  }

  async function mutate<T>(work: (mem: CommercePersistence) => MaybeAsync<PortResult<T>>): Promise<PortResult<T>> {
    const existing = liveStore.getStore();
    if (existing) return work(existing.mem);
    try {
      return await writeTransaction(async (tx) => {
        const mem = createMemoryCommerceStore({ snapshot: await readSnapshot(tx), policyValidatorKey });
        const before = JSON.stringify(snapshotOf(mem));
        const result = await liveStore.run({ mem }, () => work(mem));
        if (isFailure(result)) return result;
        const after = snapshotOf(mem);
        if (JSON.stringify(after) !== before) await writeSnapshot(tx, after);
        for (const row of after.ledgers) {
          const net = after.ledgers.filter((item) => item.tenantId === row.tenantId && item.transactionRef === row.transactionRef);
          let refunded = BigInt(0);
          for (const item of net) refunded += BigInt(item.ledger.refundedIdr);
          if (refunded > BigInt(Number.MAX_SAFE_INTEGER)) throw new AmountRejected("Amount sum is not a safe whole rupiah value.");
        }
        return result;
      });
    } catch (error) {
      const mapped = mapDbError(error);
      if (mapped) return mapped;
      throw error;
    }
  }

  async function claim(actor: Parameters<CommercePersistence["idempotency"]["claim"]>[0], input: Parameters<CommercePersistence["idempotency"]["claim"]>[1]): Promise<PortResult<StoredIdempotency>> {
    const existing = liveStore.getStore();
    if (existing) return existing.mem.idempotency.claim(actor, input);
    const allowed = authorize(actor, { tenantId: input.tenantId, locationId: input.locationId }, "write");
    if (!allowed.ok) return fail(allowed.code, "The claim is outside this actor.");
    if (!input.idempotencyKey.trim() || !input.requestHash.trim() || !input.transactionRef.trim() || !input.offeringId.trim() || !input.startsAt.trim()) {
      return fail("INVALID", "A claim needs a key, a hash, a transaction id, an offering, and a start time.");
    }
    try {
      return await writeTransaction(async (tx) => {
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
          return { ok: true, replay: false, value: updated[0] };
        }
        return { ok: true, replay: true, value: row };
      });
    } catch (error) {
      const mapped = mapDbError(error);
      if (mapped) return mapped;
      throw error;
    }
  }

  const ports = {} as CommercePersistence;
  const memPorts = () => {
    throw new Error("PostgreSQL ports are bound per call.");
  };
  void memPorts;
  ports.intents = {
    save: (actor, intent) => mutate((mem) => mem.intents.save(actor, intent)),
    read: (actor, tenantId, intentRef) => mutate((mem) => mem.intents.read(actor, tenantId, intentRef)),
  };
  ports.transactions = {
    read: (actor, tenantId, transactionRef) => mutate((mem) => mem.transactions.read(actor, tenantId, transactionRef)),
    compareAndSwap: (actor, input) => mutate((mem) => mem.transactions.compareAndSwap(actor, input)),
  };
  ports.bookings = {
    read: (actor, tenantId, bookingRef) => mutate((mem) => mem.bookings.read(actor, tenantId, bookingRef)),
    list: (actor, tenantId, locationId) => mutate((mem) => mem.bookings.list(actor, tenantId, locationId)),
    openReservation: (draft) => mutate((mem) => mem.bookings.openReservation(draft)),
    transition: (actor, input) => mutate((mem) => mem.bookings.transition(actor, input)),
    requestReschedule: (actor, input) => mutate((mem) => mem.bookings.requestReschedule(actor, input)),
    commitReschedule: (actor, input) => mutate((mem) => mem.bookings.commitReschedule(actor, input)),
    expireDue: (actor, tenantId, locationId, nowIso) => mutate((mem) => mem.bookings.expireDue(actor, tenantId, locationId, nowIso)),
    findByExternalRef: (actor, tenantId, providerId, externalId) => mutate((mem) => mem.bookings.findByExternalRef(actor, tenantId, providerId, externalId)),
  };
  ports.connections = {
    register: (actor, input) => mutate((mem) => mem.connections.register(actor, input)),
    resolve: (actor, tenantId, locationId, providerId, kind) => mutate((mem) => mem.connections.resolve(actor, tenantId, locationId, providerId, kind)),
    registerCredential: (actor, input) => mutate((mem) => mem.connections.registerCredential(actor, input)),
    rotateCredential: (actor, input) => mutate((mem) => mem.connections.rotateCredential(actor, input)),
    revokeCredential: (actor, tenantId, credentialRef, revokedAt) => mutate((mem) => mem.connections.revokeCredential(actor, tenantId, credentialRef, revokedAt)),
    reportHealth: (actor, input) => mutate((mem) => mem.connections.reportHealth(actor, input)),
  };
  ports.payments = {
    openAttempt: (actor, input) => {
      try {
        idrToBigInt(input.expectedAmountIdr);
      } catch (error) {
        if (error instanceof AmountRejected) return fail("INVALID", error.message);
        throw error;
      }
      return mutate((mem) => mem.payments.openAttempt(actor, input));
    },
    applyEvent: (actor, evidence) => {
      const event = readTrustedPayment(evidence);
      if (!event) return fail("INVALID", "Payment settlement requires trusted evidence from the payment verifier.");
      try {
        idrToBigInt(event.amountIdr);
      } catch (error) {
        if (error instanceof AmountRejected) return fail("INVALID", error.message);
        throw error;
      }
      return mutate((mem) => mem.payments.applyEvent(actor, evidence));
    },
    reconcileTerminal: (actor, input) => mutate((mem) => mem.payments.reconcileTerminal(actor, input)),
    net: async (actor, tenantId, transactionRef) => {
      const result = await mutate((mem) => mem.payments.net(actor, tenantId, transactionRef));
      if (!result.ok) return result;
      try {
        assertSafeSum(result.value.netRevenueIdr);
        assertSafeSum(result.value.refundedIdr);
        assertSafeSum(result.value.chargebackIdr);
      } catch (error) {
        if (error instanceof AmountRejected) return fail("INVALID", error.message);
        throw error;
      }
      return result;
    },
  };
  ports.idempotency = {
    read: (actor, tenantId, scope, idempotencyKey) => mutate((mem) => mem.idempotency.read(actor, tenantId, scope, idempotencyKey)),
    recordTimeout: (actor, input) => mutate((mem) => mem.idempotency.recordTimeout(actor, input)),
    claim,
    finishDenied: (actor, input) => mutate((mem) => mem.idempotency.finishDenied(actor, input)),
    noteFound: (actor, tenantId, idempotencyKey, found) => mutate((mem) => mem.idempotency.noteFound(actor, tenantId, idempotencyKey, found)),
    clearAbsence: (actor, tenantId, idempotencyKey) => mutate((mem) => mem.idempotency.clearAbsence(actor, tenantId, idempotencyKey)),
    noteAbsence: (actor, tenantId, idempotencyKey, absence) => mutate((mem) => mem.idempotency.noteAbsence(actor, tenantId, idempotencyKey, absence)),
  };
  ports.webhooks = {
    accept: (actor, input) => mutate((mem) => mem.webhooks.accept(actor, input)),
    markApplied: (actor, tenantId, dedupeKey) => mutate((mem) => mem.webhooks.markApplied(actor, tenantId, dedupeKey)),
  };
  ports.events = {
    append: (actor, event) => mutate((mem) => mem.events.append(actor, event)),
    list: (actor, tenantId, transactionRef) => mutate((mem) => mem.events.list(actor, tenantId, transactionRef)),
  };
  ports.attribution = {
    saveTouchpoint: (actor, input) => mutate((mem) => mem.attribution.saveTouchpoint(actor, input)),
    saveAggregate: (actor, input) => mutate((mem) => mem.attribution.saveAggregate(actor, input)),
    eraseIdentifiers: (actor, tenantId, touchpointId, reason, erasedAt) => mutate((mem) => mem.attribution.eraseIdentifiers(actor, tenantId, touchpointId, reason, erasedAt)),
    readClass: (actor, tenantId, transactionRef) => mutate((mem) => mem.attribution.readClass(actor, tenantId, transactionRef)),
  };
  ports.policy = {
    submit: (actor, tenantId, scope, submission) => mutate((mem) => mem.policy.submit(actor, tenantId, scope, submission)),
    read: (actor, tenantId, scope) => mutate((mem) => mem.policy.read(actor, tenantId, scope)),
  };
  ports.runAtomic = (work) => mutate((mem) => mem.runAtomic(work));
  ports.exportSnapshot = async () => {
    const existing = liveStore.getStore();
    if (existing) return snapshotOf(existing.mem);
    await qa.assertIdentity(client);
    return readSnapshot(client);
  };
  return ports;
}
