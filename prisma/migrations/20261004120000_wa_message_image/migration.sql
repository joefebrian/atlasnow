-- AlterTable
ALTER TABLE "WaMessage" ADD COLUMN "mediaImage" BYTEA,
ADD COLUMN "mediaMime" TEXT NOT NULL DEFAULT '';
