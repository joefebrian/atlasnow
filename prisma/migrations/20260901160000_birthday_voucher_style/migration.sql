ALTER TABLE "LoyaltyProgram" ADD COLUMN "birthdayVoucherPrefix" TEXT NOT NULL DEFAULT 'BDY';
ALTER TABLE "LoyaltyProgram" ADD COLUMN "birthdayVoucherYear" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LoyaltyProgram" ADD COLUMN "birthdayVoucherSuffixLen" INTEGER NOT NULL DEFAULT 4;

ALTER TABLE "LoyaltyRedemption" ADD COLUMN "voucherCode" TEXT NOT NULL DEFAULT '';
CREATE INDEX "LoyaltyRedemption_tenantId_voucherCode_idx" ON "LoyaltyRedemption"("tenantId", "voucherCode");
