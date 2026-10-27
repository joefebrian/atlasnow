-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "inboxImageRetentionDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "WaMessage" ADD COLUMN "inboxImage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mediaPurgedAt" TIMESTAMP(3);

UPDATE "WaMessage"
SET "inboxImage" = true
WHERE "mediaMime" <> ''
   OR "body" = '[image]'
   OR "body" LIKE '[image,%';
