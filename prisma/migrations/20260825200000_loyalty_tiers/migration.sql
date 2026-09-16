-- Multi-reward stamp milestones and top-spender places.
ALTER TABLE "LoyaltyProgram" ADD COLUMN "stampTiersJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "LoyaltyProgram" ADD COLUMN "spenderTiersJson" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "LoyaltyRedemption" ADD COLUMN "tierKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LoyaltyRedemption" ADD COLUMN "resetsCard" BOOLEAN NOT NULL DEFAULT false;

-- Legacy stamp-card redeem emptied the whole card.
UPDATE "LoyaltyRedemption" SET "resetsCard" = true WHERE "kind" = 'STAMP_CARD';

DROP INDEX IF EXISTS "LoyaltyRedemption_tenantId_memberPhone_kind_periodKey_key";
CREATE UNIQUE INDEX "LoyaltyRedemption_tenantId_memberPhone_kind_periodKey_tierKey_key" ON "LoyaltyRedemption"("tenantId", "memberPhone", "kind", "periodKey", "tierKey");
