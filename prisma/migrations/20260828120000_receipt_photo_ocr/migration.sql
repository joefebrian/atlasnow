-- AlterTable
ALTER TABLE "LoyaltyProgram" ADD COLUMN "receiptAuditMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LoyaltyIntake" ADD COLUMN "photoImage" BYTEA,
ADD COLUMN "photoMime" TEXT NOT NULL DEFAULT '',
ADD COLUMN "ocrJson" TEXT NOT NULL DEFAULT '',
ADD COLUMN "matchStatus" TEXT NOT NULL DEFAULT 'SKIPPED';
