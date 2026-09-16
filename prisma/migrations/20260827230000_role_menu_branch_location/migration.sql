-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "locationId" TEXT;

-- CreateIndex
CREATE INDEX "Membership_locationId_idx" ON "Membership"("locationId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "RoleMenuConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hrefsJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleMenuConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleMenuConfig_tenantId_role_key" ON "RoleMenuConfig"("tenantId", "role");

-- CreateIndex
CREATE INDEX "RoleMenuConfig_tenantId_idx" ON "RoleMenuConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "RoleMenuConfig" ADD CONSTRAINT "RoleMenuConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
