-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "agencyId" TEXT;

-- Backfill existing brands under P2P Labs so live work does not split.
UPDATE "Tenant" AS c
SET "agencyId" = a.id
FROM "Tenant" AS a
WHERE a.slug = 'p2p-labs'
  AND a.type = 'AGENCY'
  AND c.type = 'CLIENT'
  AND c."agencyId" IS NULL;

-- CreateTable
CREATE TABLE "AgencyUpgradeRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "agencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyUpgradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tenant_agencyId_idx" ON "Tenant"("agencyId");
CREATE INDEX "Tenant_type_agencyId_idx" ON "Tenant"("type", "agencyId");
CREATE INDEX "AgencyUpgradeRequest_status_idx" ON "AgencyUpgradeRequest"("status");
CREATE INDEX "AgencyUpgradeRequest_clientId_idx" ON "AgencyUpgradeRequest"("clientId");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgencyUpgradeRequest" ADD CONSTRAINT "AgencyUpgradeRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyUpgradeRequest" ADD CONSTRAINT "AgencyUpgradeRequest_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
