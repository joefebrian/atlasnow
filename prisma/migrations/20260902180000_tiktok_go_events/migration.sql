-- CreateTable
CREATE TABLE "LoyaltyGoEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "codeHint" TEXT NOT NULL DEFAULT '',
    "shopOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyGoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyGoEvent_tenantId_createdAt_idx" ON "LoyaltyGoEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyGoEvent_tenantId_locationId_createdAt_idx" ON "LoyaltyGoEvent"("tenantId", "locationId", "createdAt");

-- AddForeignKey
ALTER TABLE "LoyaltyGoEvent" ADD CONSTRAINT "LoyaltyGoEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyGoEvent" ADD CONSTRAINT "LoyaltyGoEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
