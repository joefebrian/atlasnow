-- CreateTable
CREATE TABLE "WabaPhone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL DEFAULT '',
    "phoneNumberId" TEXT NOT NULL,
    "displayPhone" TEXT NOT NULL DEFAULT '',
    "billingOwner" TEXT NOT NULL DEFAULT 'BRAND',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "paymentMethodOk" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WabaPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WabaServiceMonth" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "serviceCount" INTEGER NOT NULL DEFAULT 0,
    "freeCap" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "WabaServiceMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WabaServiceDelivery" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "wamid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WabaServiceDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WabaOutbound" (
    "wamid" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WabaOutbound_pkey" PRIMARY KEY ("wamid")
);

-- CreateIndex
CREATE UNIQUE INDEX "WabaPhone_phoneNumberId_key" ON "WabaPhone"("phoneNumberId");

-- CreateIndex
CREATE INDEX "WabaPhone_tenantId_idx" ON "WabaPhone"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WabaServiceMonth_phoneNumberId_periodKey_key" ON "WabaServiceMonth"("phoneNumberId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "WabaServiceDelivery_wamid_key" ON "WabaServiceDelivery"("wamid");

-- CreateIndex
CREATE INDEX "WabaServiceDelivery_phoneNumberId_periodKey_idx" ON "WabaServiceDelivery"("phoneNumberId", "periodKey");

-- CreateIndex
CREATE INDEX "WabaOutbound_phoneNumberId_idx" ON "WabaOutbound"("phoneNumberId");

-- AddForeignKey
ALTER TABLE "WabaPhone" ADD CONSTRAINT "WabaPhone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WabaServiceMonth" ADD CONSTRAINT "WabaServiceMonth_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "WabaPhone"("phoneNumberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WabaServiceDelivery" ADD CONSTRAINT "WabaServiceDelivery_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "WabaPhone"("phoneNumberId") ON DELETE CASCADE ON UPDATE CASCADE;
