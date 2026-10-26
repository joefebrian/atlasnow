-- CreateTable
CREATE TABLE "CcIntent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "intentRef" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "intentType" TEXT NOT NULL,
    "qualified" BOOLEAN NOT NULL,
    "customerRef" TEXT,
    "commerceOrderRef" TEXT,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CcTransaction" (
    "tenantId" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "locationId" TEXT,
    "intentRef" TEXT,
    "providerId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "bookingRef" TEXT,
    "orderRef" TEXT,
    "paymentStatus" TEXT NOT NULL,
    "verifiedPaid" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcTransaction_pkey" PRIMARY KEY ("tenantId","transactionRef")
);

-- CreateTable
CREATE TABLE "CcBooking" (
    "tenantId" TEXT NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerMode" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "providerReference" TEXT,
    "referenceAuthoritative" BOOLEAN NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "holdExpiryOwner" TEXT NOT NULL,
    "nativeExpiryPolicyId" TEXT,
    "pendingSlotKey" TEXT,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcBooking_pkey" PRIMARY KEY ("tenantId","bookingRef")
);

-- CreateTable
CREATE TABLE "CcProviderConnection" (
    "connectionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "providerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "health" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "credentialRef" TEXT,
    "webhookSecretRef" TEXT,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcProviderConnection_pkey" PRIMARY KEY ("connectionId")
);

-- CreateTable
CREATE TABLE "CcProviderCredential" (
    "credentialRef" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "ciphertext" TEXT,
    "rotatedFromRef" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CcProviderCredential_pkey" PRIMARY KEY ("credentialRef")
);

-- CreateTable
CREATE TABLE "CcExternalRef" (
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "owner" TEXT NOT NULL,
    "ownerRef" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "CcExternalRef_pkey" PRIMARY KEY ("tenantId","providerId","owner","externalId")
);

-- CreateTable
CREATE TABLE "CcPaymentAttempt" (
    "tenantId" TEXT NOT NULL,
    "attemptRef" TEXT NOT NULL,
    "locationId" TEXT,
    "transactionRef" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerMode" TEXT NOT NULL,
    "expectedAmountIdr" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcPaymentAttempt_pkey" PRIMARY KEY ("tenantId","attemptRef")
);

-- CreateTable
CREATE TABLE "CcPaymentLedger" (
    "tenantId" TEXT NOT NULL,
    "attemptRef" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountIdr" BIGINT,
    "refundedIdr" BIGINT NOT NULL DEFAULT 0,
    "verifiedPaid" BOOLEAN NOT NULL,
    "providerReference" TEXT,
    "detail" JSONB NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcPaymentLedger_pkey" PRIMARY KEY ("tenantId","attemptRef")
);

-- CreateTable
CREATE TABLE "CcPaymentEvent" (
    "tenantId" TEXT NOT NULL,
    "attemptRef" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountIdr" BIGINT NOT NULL,
    "providerReference" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER,

    CONSTRAINT "CcPaymentEvent_pkey" PRIMARY KEY ("tenantId","attemptRef","eventId")
);

-- CreateTable
CREATE TABLE "CcIdempotency" (
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "transactionRef" TEXT,
    "outcomeCode" TEXT,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcIdempotency_pkey" PRIMARY KEY ("tenantId","scope","idempotencyKey")
);

-- CreateTable
CREATE TABLE "CcInflight" (
    "tenantId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "merchantConfirmed" BOOLEAN NOT NULL,
    "experience" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "startsAt" TEXT NOT NULL,
    "absenceVerified" BOOLEAN NOT NULL,
    "adoptBookingRef" TEXT,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcInflight_pkey" PRIMARY KEY ("tenantId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "CcWebhookEvent" (
    "connectionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcWebhookEvent_pkey" PRIMARY KEY ("connectionId","eventId")
);

-- CreateTable
CREATE TABLE "CcTransactionEvent" (
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "CcTransactionEvent_pkey" PRIMARY KEY ("tenantId","eventId")
);

-- CreateTable
CREATE TABLE "CcTouchpoint" (
    "touchpointId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "transactionRef" TEXT,
    "intentRef" TEXT,
    "bookingRef" TEXT,
    "attemptRef" TEXT,
    "channel" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "userLevel" BOOLEAN NOT NULL,
    "ctwaClid" TEXT,
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "qrCampaignId" TEXT,
    "erasedAt" TIMESTAMP(3),
    "erasureReason" TEXT,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcTouchpoint_pkey" PRIMARY KEY ("touchpointId")
);

-- CreateTable
CREATE TABLE "CcAttributionAggregate" (
    "aggregateId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "channel" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcAttributionAggregate_pkey" PRIMARY KEY ("aggregateId")
);

-- CreateTable
CREATE TABLE "CcPolicyEvidence" (
    "tenantId" TEXT NOT NULL,
    "offeringCategory" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "validatedBy" TEXT,
    "integrity" TEXT,
    "version" INTEGER NOT NULL,

    CONSTRAINT "CcPolicyEvidence_pkey" PRIMARY KEY ("tenantId","offeringCategory","experience")
);

-- CreateIndex
CREATE UNIQUE INDEX "CcIntent_tenantId_intentRef_key" ON "CcIntent"("tenantId", "intentRef");

-- CreateIndex
CREATE UNIQUE INDEX "CcBooking_tenantId_providerId_idempotencyKey_key" ON "CcBooking"("tenantId", "providerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CcProviderConnection_tenantId_connectionId_key" ON "CcProviderConnection"("tenantId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CcWebhookEvent_dedupeKey_key" ON "CcWebhookEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "CcTouchpoint_tenantId_transactionRef_idx" ON "CcTouchpoint"("tenantId", "transactionRef");


-- AddForeignKey
ALTER TABLE "CcIntent" ADD CONSTRAINT "CcIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcIntent" ADD CONSTRAINT "CcIntent_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcTransaction" ADD CONSTRAINT "CcTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcTransaction" ADD CONSTRAINT "CcTransaction_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcBooking" ADD CONSTRAINT "CcBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcBooking" ADD CONSTRAINT "CcBooking_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcBooking" ADD CONSTRAINT "CcBooking_tenantId_transactionRef_fkey" FOREIGN KEY ("tenantId", "transactionRef") REFERENCES "CcTransaction"("tenantId", "transactionRef") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcProviderConnection" ADD CONSTRAINT "CcProviderConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcProviderConnection" ADD CONSTRAINT "CcProviderConnection_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcProviderCredential" ADD CONSTRAINT "CcProviderCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcProviderCredential" ADD CONSTRAINT "CcProviderCredential_tenantId_connectionId_fkey" FOREIGN KEY ("tenantId", "connectionId") REFERENCES "CcProviderConnection"("tenantId", "connectionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcExternalRef" ADD CONSTRAINT "CcExternalRef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcExternalRef" ADD CONSTRAINT "CcExternalRef_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcPaymentAttempt" ADD CONSTRAINT "CcPaymentAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcPaymentAttempt" ADD CONSTRAINT "CcPaymentAttempt_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcPaymentAttempt" ADD CONSTRAINT "CcPaymentAttempt_tenantId_transactionRef_fkey" FOREIGN KEY ("tenantId", "transactionRef") REFERENCES "CcTransaction"("tenantId", "transactionRef") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcPaymentLedger" ADD CONSTRAINT "CcPaymentLedger_tenantId_attemptRef_fkey" FOREIGN KEY ("tenantId", "attemptRef") REFERENCES "CcPaymentAttempt"("tenantId", "attemptRef") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcPaymentEvent" ADD CONSTRAINT "CcPaymentEvent_tenantId_attemptRef_fkey" FOREIGN KEY ("tenantId", "attemptRef") REFERENCES "CcPaymentAttempt"("tenantId", "attemptRef") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcIdempotency" ADD CONSTRAINT "CcIdempotency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcIdempotency" ADD CONSTRAINT "CcIdempotency_tenantId_transactionRef_fkey" FOREIGN KEY ("tenantId", "transactionRef") REFERENCES "CcTransaction"("tenantId", "transactionRef") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcInflight" ADD CONSTRAINT "CcInflight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcInflight" ADD CONSTRAINT "CcInflight_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcInflight" ADD CONSTRAINT "CcInflight_tenantId_transactionRef_fkey" FOREIGN KEY ("tenantId", "transactionRef") REFERENCES "CcTransaction"("tenantId", "transactionRef") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcWebhookEvent" ADD CONSTRAINT "CcWebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcWebhookEvent" ADD CONSTRAINT "CcWebhookEvent_tenantId_connectionId_fkey" FOREIGN KEY ("tenantId", "connectionId") REFERENCES "CcProviderConnection"("tenantId", "connectionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcTransactionEvent" ADD CONSTRAINT "CcTransactionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcTransactionEvent" ADD CONSTRAINT "CcTransactionEvent_tenantId_transactionRef_fkey" FOREIGN KEY ("tenantId", "transactionRef") REFERENCES "CcTransaction"("tenantId", "transactionRef") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcTouchpoint" ADD CONSTRAINT "CcTouchpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcTouchpoint" ADD CONSTRAINT "CcTouchpoint_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcAttributionAggregate" ADD CONSTRAINT "CcAttributionAggregate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcAttributionAggregate" ADD CONSTRAINT "CcAttributionAggregate_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcPolicyEvidence" ADD CONSTRAINT "CcPolicyEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Live-slot uniqueness is scoped by provider (tenant, location, provider, slot).
-- It does not protect capacity across different booking systems.
CREATE UNIQUE INDEX "CcBooking_live_slot"
  ON "CcBooking" ("tenantId", "locationId", "providerId", "slotKey")
  WHERE "state" IN ('HELD', 'CONFIRMED');

-- Blank provider references are not unique.
CREATE UNIQUE INDEX "CcBooking_provider_ref"
  ON "CcBooking" ("tenantId", "providerId", "providerReference")
  WHERE "providerReference" IS NOT NULL AND btrim("providerReference") <> '';

CREATE UNIQUE INDEX "CcProviderConnection_scope"
  ON "CcProviderConnection" ("tenantId", COALESCE("locationId", ''), "providerId", "kind");

CREATE UNIQUE INDEX "CcProviderCredential_one_active"
  ON "CcProviderCredential" ("connectionId", "purpose")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "CcPaymentLedger_provider_ref"
  ON "CcPaymentLedger" ("tenantId", "providerId", "providerReference")
  WHERE "providerReference" IS NOT NULL AND btrim("providerReference") <> '';

-- One live capture per transaction until split tender is specified.
-- REFUNDED and CHARGEBACK do not occupy this index.
CREATE UNIQUE INDEX "CcPaymentLedger_one_live_capture"
  ON "CcPaymentLedger" ("tenantId", "transactionRef")
  WHERE "status" IN ('PAID', 'PARTIALLY_REFUNDED');

ALTER TABLE "CcPaymentAttempt" ADD CONSTRAINT "CcPaymentAttempt_amount_safe"
  CHECK ("expectedAmountIdr" >= 0 AND "expectedAmountIdr" <= 9007199254740991);
ALTER TABLE "CcPaymentAttempt" ADD CONSTRAINT "CcPaymentAttempt_currency_idr"
  CHECK ("currency" = 'IDR');
ALTER TABLE "CcPaymentLedger" ADD CONSTRAINT "CcPaymentLedger_amount_safe"
  CHECK (
    ("amountIdr" IS NULL OR ("amountIdr" >= 0 AND "amountIdr" <= 9007199254740991))
    AND "refundedIdr" >= 0 AND "refundedIdr" <= 9007199254740991
  );
ALTER TABLE "CcPaymentEvent" ADD CONSTRAINT "CcPaymentEvent_amount_safe"
  CHECK ("amountIdr" >= 0 AND "amountIdr" <= 9007199254740991);

-- Booking, payment attempt, and inflight locations must match the transaction.
-- A null payment-attempt location matches a null transaction location.
CREATE OR REPLACE FUNCTION "cc_assert_same_location"() RETURNS trigger AS $$
DECLARE
  txn_location TEXT;
BEGIN
  SELECT "locationId" INTO txn_location
  FROM "CcTransaction"
  WHERE "tenantId" = NEW."tenantId" AND "transactionRef" = NEW."transactionRef";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cc_location_mismatch transaction missing';
  END IF;
  IF txn_location IS DISTINCT FROM NEW."locationId" THEN
    RAISE EXCEPTION 'cc_location_mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CcBooking_location_match"
  BEFORE INSERT OR UPDATE OF "locationId", "transactionRef", "tenantId"
  ON "CcBooking"
  FOR EACH ROW EXECUTE FUNCTION "cc_assert_same_location"();

CREATE TRIGGER "CcPaymentAttempt_location_match"
  BEFORE INSERT OR UPDATE OF "locationId", "transactionRef", "tenantId"
  ON "CcPaymentAttempt"
  FOR EACH ROW EXECUTE FUNCTION "cc_assert_same_location"();

CREATE TRIGGER "CcInflight_location_match"
  BEFORE INSERT OR UPDATE OF "locationId", "transactionRef", "tenantId"
  ON "CcInflight"
  FOR EACH ROW EXECUTE FUNCTION "cc_assert_same_location"();
