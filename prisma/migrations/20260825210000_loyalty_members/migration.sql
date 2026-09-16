ALTER TABLE "LoyaltyProgram" ADD COLUMN "joinKey" TEXT;
ALTER TABLE "LoyaltyProgram" ADD COLUMN "qrScope" TEXT NOT NULL DEFAULT 'BRAND';
ALTER TABLE "LoyaltyProgram" ADD COLUMN "birthdayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LoyaltyProgram" ADD COLUMN "birthdayRewardText" TEXT NOT NULL DEFAULT '';

UPDATE "LoyaltyProgram" SET "joinKey" = substr(md5(random()::text || id), 1, 16) WHERE "joinKey" IS NULL;
ALTER TABLE "LoyaltyProgram" ALTER COLUMN "joinKey" SET NOT NULL;
CREATE UNIQUE INDEX "LoyaltyProgram_joinKey_key" ON "LoyaltyProgram"("joinKey");

CREATE TABLE "LoyaltyMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "birthDate" TEXT,
    "birthdayWaOptIn" BOOLEAN NOT NULL DEFAULT false,
    "birthdayWaOptInAt" TIMESTAMP(3),
    "signupLocationId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'QR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyMember_tenantId_phone_key" ON "LoyaltyMember"("tenantId", "phone");
CREATE INDEX "LoyaltyMember_tenantId_createdAt_idx" ON "LoyaltyMember"("tenantId", "createdAt");

ALTER TABLE "LoyaltyMember" ADD CONSTRAINT "LoyaltyMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyMember" ADD CONSTRAINT "LoyaltyMember_signupLocationId_fkey" FOREIGN KEY ("signupLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
