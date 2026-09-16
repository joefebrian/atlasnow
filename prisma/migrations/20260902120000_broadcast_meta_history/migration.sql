-- CreateTable
CREATE TABLE "BroadcastBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "kind" TEXT NOT NULL,
    "templateName" TEXT,
    "attemptedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BroadcastSend" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "wamid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" INTEGER,
    "errorTitle" TEXT NOT NULL DEFAULT '',
    "pricingCategory" TEXT,
    "pricingType" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastSend_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BroadcastBatch_tenantId_createdAt_idx" ON "BroadcastBatch"("tenantId", "createdAt");
CREATE UNIQUE INDEX "BroadcastSend_wamid_key" ON "BroadcastSend"("wamid");
CREATE INDEX "BroadcastSend_tenantId_phone_sentAt_idx" ON "BroadcastSend"("tenantId", "phone", "sentAt");
CREATE INDEX "BroadcastSend_batchId_idx" ON "BroadcastSend"("batchId");

ALTER TABLE "BroadcastBatch" ADD CONSTRAINT "BroadcastBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BroadcastBatch" ADD CONSTRAINT "BroadcastBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BroadcastSend" ADD CONSTRAINT "BroadcastSend_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BroadcastBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BroadcastSend" ADD CONSTRAINT "BroadcastSend_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
