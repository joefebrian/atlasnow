-- CreateTable
CREATE TABLE "LoyaltyBirthdayWaSend" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberPhone" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyBirthdayWaSend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyBirthdayWaSend_tenantId_memberPhone_periodKey_key" ON "LoyaltyBirthdayWaSend"("tenantId", "memberPhone", "periodKey");
CREATE INDEX "LoyaltyBirthdayWaSend_tenantId_periodKey_idx" ON "LoyaltyBirthdayWaSend"("tenantId", "periodKey");
CREATE INDEX "LoyaltyMember_tenantId_birthdayWaOptIn_idx" ON "LoyaltyMember"("tenantId", "birthdayWaOptIn");

ALTER TABLE "LoyaltyBirthdayWaSend" ADD CONSTRAINT "LoyaltyBirthdayWaSend_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
