ALTER TABLE "LoyaltyBirthdayWaSend" ADD COLUMN "voucherCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LoyaltyBirthdayWaSend" ADD COLUMN "voucherValue" TEXT NOT NULL DEFAULT '';
CREATE INDEX "LoyaltyBirthdayWaSend_tenantId_voucherCode_idx" ON "LoyaltyBirthdayWaSend"("tenantId", "voucherCode");
