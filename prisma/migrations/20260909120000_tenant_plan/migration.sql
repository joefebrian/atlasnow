-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';

-- Brands that already have more than two store doors are not Free.
UPDATE "Tenant" AS t
SET "plan" = 'gold'
WHERE t."type" = 'CLIENT'
  AND (
    SELECT COUNT(*)::int
    FROM "Location" AS l
    WHERE l."tenantId" = t."id"
      AND l."status" <> 'ARCHIVED'
      AND l."kind" <> 'HQ'
  ) > 2;
