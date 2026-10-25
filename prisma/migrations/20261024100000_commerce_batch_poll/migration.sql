-- Poll bookkeeping and catalog-mapping freshness.
-- Does not enable checkout or live catalog sync. Does not drop product rows or external ids.

ALTER TABLE "CommerceCatalogLink" ADD COLUMN "mappingCurrent" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "CommerceVariantMap" ADD COLUMN "mappingCurrent" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "CommerceSyncJob" ADD COLUMN "catalogId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "publicUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN "pollAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextPollAt" TIMESTAMP(3),
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockToken" TEXT NOT NULL DEFAULT '';

CREATE INDEX "CommerceSyncJob_status_nextPollAt_idx" ON "CommerceSyncJob"("status", "nextPollAt");
