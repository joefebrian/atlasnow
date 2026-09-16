-- AlterTable
ALTER TABLE "Location" ADD COLUMN "waOutletPhone" TEXT;
ALTER TABLE "Location" ADD COLUMN "waOutletConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stampEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stampGoal" INTEGER NOT NULL DEFAULT 10,
    "stampMinAmount" INTEGER NOT NULL DEFAULT 0,
    "stampRewardText" TEXT NOT NULL DEFAULT '',
    "stampExpiry" TEXT NOT NULL DEFAULT 'lifetime',
    "spenderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "spenderScope" TEXT NOT NULL DEFAULT 'BRAND',
    "spenderLocationId" TEXT,
    "spenderMinAmount" INTEGER NOT NULL DEFAULT 0,
    "spenderTopN" INTEGER NOT NULL DEFAULT 1,
    "spenderRewardText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyProgram_tenantId_key" ON "LoyaltyProgram"("tenantId");

CREATE TABLE "LoyaltyIntake" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "trxId" TEXT NOT NULL,
    "amount" INTEGER,
    "invoiceRef" TEXT,
    "source" TEXT NOT NULL DEFAULT 'FORM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notifyStatus" TEXT NOT NULL DEFAULT 'NONE',
    "notifyError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyIntake_tenantId_trxId_key" ON "LoyaltyIntake"("tenantId", "trxId");
CREATE INDEX "LoyaltyIntake_tenantId_status_createdAt_idx" ON "LoyaltyIntake"("tenantId", "status", "createdAt");
CREATE INDEX "LoyaltyIntake_locationId_createdAt_idx" ON "LoyaltyIntake"("locationId", "createdAt");

CREATE TABLE "LoyaltyStamp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberPhone" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "amount" INTEGER,
    "stampedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyStamp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoyaltyStamp_tenantId_memberPhone_stampedAt_idx" ON "LoyaltyStamp"("tenantId", "memberPhone", "stampedAt");

CREATE TABLE "LoyaltyRedemption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberPhone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT,
    "locationId" TEXT,
    "actorId" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoyaltyRedemption_tenantId_memberPhone_kind_idx" ON "LoyaltyRedemption"("tenantId", "memberPhone", "kind");

ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyIntake" ADD CONSTRAINT "LoyaltyIntake_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyIntake" ADD CONSTRAINT "LoyaltyIntake_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyStamp" ADD CONSTRAINT "LoyaltyStamp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyStamp" ADD CONSTRAINT "LoyaltyStamp_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "LoyaltyIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyStamp" ADD CONSTRAINT "LoyaltyStamp_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
