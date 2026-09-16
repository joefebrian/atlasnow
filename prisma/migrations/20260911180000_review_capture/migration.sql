-- AlterTable
ALTER TABLE "Location" ADD COLUMN "reviewCaptureToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Location_reviewCaptureToken_key" ON "Location"("reviewCaptureToken");

-- CreateTable
CREATE TABLE "ReviewCaptureEvent" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'opened',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "deviceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewCaptureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewCaptureEvent_locationId_createdAt_idx" ON "ReviewCaptureEvent"("locationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewCaptureEvent_token_createdAt_idx" ON "ReviewCaptureEvent"("token", "createdAt");

-- AddForeignKey
ALTER TABLE "ReviewCaptureEvent" ADD CONSTRAINT "ReviewCaptureEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
