-- HQ location for brand WhatsApp Cloud API (not a cashier outlet).
ALTER TABLE "Location" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'STORE';

CREATE INDEX "Location_tenantId_kind_idx" ON "Location"("tenantId", "kind");
