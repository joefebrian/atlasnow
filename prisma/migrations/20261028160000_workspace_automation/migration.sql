-- Additive. A missing row means commerce automation is off.
CREATE TABLE "WorkspaceAutomation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentFollowUpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "marketingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pilotMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAutomation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceAutomation_tenantId_key" ON "WorkspaceAutomation"("tenantId");

ALTER TABLE "WorkspaceAutomation" ADD CONSTRAINT "WorkspaceAutomation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
