-- AlterTable
ALTER TABLE "Review" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'GOOGLE_BUSINESS_PROFILE';

-- CreateIndex
CREATE INDEX "Review_locationId_sourceType_idx" ON "Review"("locationId", "sourceType");
