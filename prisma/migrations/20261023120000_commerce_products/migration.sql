-- Commerce product master. No payment secrets. Catalog sync stays NOT_CONNECTED.

CREATE TABLE "CommerceProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "unitPriceIdr" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "catalogEligibility" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "catalogEligibilityNote" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceVariant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPriceIdr" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceProductOutlet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceProductOutlet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceCatalogLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL DEFAULT '',
    "retailerId" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "lastError" TEXT NOT NULL DEFAULT '',
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceCatalogLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceSyncLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceReadiness" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "whatsappStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "catalogStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "paymentProviderLabel" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceReadiness_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceProduct_tenantId_sku_key" ON "CommerceProduct"("tenantId", "sku");
CREATE INDEX "CommerceProduct_tenantId_status_idx" ON "CommerceProduct"("tenantId", "status");

CREATE UNIQUE INDEX "CommerceVariant_tenantId_sku_key" ON "CommerceVariant"("tenantId", "sku");
CREATE INDEX "CommerceVariant_productId_idx" ON "CommerceVariant"("productId");

CREATE UNIQUE INDEX "CommerceProductOutlet_productId_locationId_key" ON "CommerceProductOutlet"("productId", "locationId");
CREATE INDEX "CommerceProductOutlet_tenantId_locationId_idx" ON "CommerceProductOutlet"("tenantId", "locationId");

CREATE UNIQUE INDEX "CommerceCatalogLink_productId_key" ON "CommerceCatalogLink"("productId");
CREATE UNIQUE INDEX "CommerceCatalogLink_tenantId_retailerId_key" ON "CommerceCatalogLink"("tenantId", "retailerId");
CREATE INDEX "CommerceCatalogLink_tenantId_syncStatus_idx" ON "CommerceCatalogLink"("tenantId", "syncStatus");

CREATE INDEX "CommerceSyncLog_tenantId_createdAt_idx" ON "CommerceSyncLog"("tenantId", "createdAt");

CREATE UNIQUE INDEX "CommerceReadiness_tenantId_key" ON "CommerceReadiness"("tenantId");

ALTER TABLE "CommerceProduct" ADD CONSTRAINT "CommerceProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceVariant" ADD CONSTRAINT "CommerceVariant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceVariant" ADD CONSTRAINT "CommerceVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceProductOutlet" ADD CONSTRAINT "CommerceProductOutlet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceProductOutlet" ADD CONSTRAINT "CommerceProductOutlet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceProductOutlet" ADD CONSTRAINT "CommerceProductOutlet_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceCatalogLink" ADD CONSTRAINT "CommerceCatalogLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceCatalogLink" ADD CONSTRAINT "CommerceCatalogLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceSyncLog" ADD CONSTRAINT "CommerceSyncLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceSyncLog" ADD CONSTRAINT "CommerceSyncLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceReadiness" ADD CONSTRAINT "CommerceReadiness_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
