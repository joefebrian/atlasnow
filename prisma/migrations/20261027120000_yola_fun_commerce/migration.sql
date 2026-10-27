-- YOLA FUN tables only. Pre-existing loyalty index drift is not part of this migration.
-- CreateTable
CREATE TABLE "YolaCustomer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YolaCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YolaFlowSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "flowToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "source" TEXT NOT NULL DEFAULT 'direct',
    "phoneNumberId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YolaFlowSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YolaOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sessionId" TEXT,
    "waId" TEXT NOT NULL,
    "wamid" TEXT NOT NULL,
    "flowToken" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerPhoneE164" TEXT NOT NULL,
    "phoneMismatch" BOOLEAN NOT NULL DEFAULT false,
    "visitDate" TEXT NOT NULL,
    "visitTime" TEXT NOT NULL,
    "amountIdr" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "preferenceNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YolaOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YolaPaymentSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'sandbox',
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountIdr" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "nonceHash" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YolaPaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YolaPaymentEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "amountIdr" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "live" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YolaPaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YolaTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "remaining" INTEGER NOT NULL DEFAULT 2,
    "issuanceMode" TEXT NOT NULL DEFAULT 'TEST',
    "validFrom" TEXT NOT NULL,
    "validUntil" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YolaTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YolaRedemption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "remainingAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YolaRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YolaAutomationEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YolaAutomationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YolaOutboundMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'held',
    "body" TEXT NOT NULL DEFAULT '',
    "payloadJson" TEXT NOT NULL DEFAULT '',
    "providerWamid" TEXT NOT NULL DEFAULT '',
    "deliveryStatus" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YolaOutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YolaOrderDaySeq" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "YolaOrderDaySeq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YolaCustomer_tenantId_idx" ON "YolaCustomer"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "YolaCustomer_tenantId_waId_key" ON "YolaCustomer"("tenantId", "waId");

-- CreateIndex
CREATE INDEX "YolaFlowSession_tenantId_waId_status_idx" ON "YolaFlowSession"("tenantId", "waId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "YolaFlowSession_tenantId_flowToken_key" ON "YolaFlowSession"("tenantId", "flowToken");

-- CreateIndex
CREATE INDEX "YolaOrder_tenantId_createdAt_idx" ON "YolaOrder"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "YolaOrder_tenantId_humanId_key" ON "YolaOrder"("tenantId", "humanId");

-- CreateIndex
CREATE UNIQUE INDEX "YolaOrder_tenantId_wamid_key" ON "YolaOrder"("tenantId", "wamid");

-- CreateIndex
CREATE UNIQUE INDEX "YolaOrder_tenantId_flowToken_key" ON "YolaOrder"("tenantId", "flowToken");

-- CreateIndex
CREATE INDEX "YolaPaymentSession_tenantId_orderId_idx" ON "YolaPaymentSession"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "YolaPaymentEvent_orderId_idx" ON "YolaPaymentEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "YolaPaymentEvent_tenantId_eventId_key" ON "YolaPaymentEvent"("tenantId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "YolaTicket_orderId_key" ON "YolaTicket"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "YolaTicket_tokenHash_key" ON "YolaTicket"("tokenHash");

-- CreateIndex
CREATE INDEX "YolaTicket_tenantId_idx" ON "YolaTicket"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "YolaTicket_tenantId_publicId_key" ON "YolaTicket"("tenantId", "publicId");

-- CreateIndex
CREATE INDEX "YolaRedemption_tenantId_idx" ON "YolaRedemption"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "YolaRedemption_ticketId_idempotencyKey_key" ON "YolaRedemption"("ticketId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "YolaAutomationEvent_tenantId_createdAt_idx" ON "YolaAutomationEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "YolaAutomationEvent_tenantId_dedupeKey_key" ON "YolaAutomationEvent"("tenantId", "dedupeKey");

-- CreateIndex
CREATE INDEX "YolaOutboundMessage_tenantId_waId_createdAt_idx" ON "YolaOutboundMessage"("tenantId", "waId", "createdAt");

-- CreateIndex
CREATE INDEX "YolaOutboundMessage_providerWamid_idx" ON "YolaOutboundMessage"("providerWamid");

-- CreateIndex
CREATE UNIQUE INDEX "YolaOrderDaySeq_tenantId_dayKey_key" ON "YolaOrderDaySeq"("tenantId", "dayKey");

-- AddForeignKey
ALTER TABLE "YolaCustomer" ADD CONSTRAINT "YolaCustomer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaFlowSession" ADD CONSTRAINT "YolaFlowSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaFlowSession" ADD CONSTRAINT "YolaFlowSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "YolaCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaOrder" ADD CONSTRAINT "YolaOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaOrder" ADD CONSTRAINT "YolaOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "YolaCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaOrder" ADD CONSTRAINT "YolaOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "YolaFlowSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaPaymentSession" ADD CONSTRAINT "YolaPaymentSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaPaymentSession" ADD CONSTRAINT "YolaPaymentSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "YolaOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaPaymentEvent" ADD CONSTRAINT "YolaPaymentEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaPaymentEvent" ADD CONSTRAINT "YolaPaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "YolaOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaTicket" ADD CONSTRAINT "YolaTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaTicket" ADD CONSTRAINT "YolaTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "YolaOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaRedemption" ADD CONSTRAINT "YolaRedemption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaRedemption" ADD CONSTRAINT "YolaRedemption_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "YolaTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaAutomationEvent" ADD CONSTRAINT "YolaAutomationEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaOutboundMessage" ADD CONSTRAINT "YolaOutboundMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YolaOrderDaySeq" ADD CONSTRAINT "YolaOrderDaySeq_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "LoyaltyRedemption_tenantId_memberPhone_kind_periodKey_tierKey_k" RENAME TO "LoyaltyRedemption_tenantId_memberPhone_kind_periodKey_tierK_key";

