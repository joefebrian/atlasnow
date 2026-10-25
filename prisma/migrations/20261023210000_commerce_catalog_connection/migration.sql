-- Merchant Meta connection, variant catalog mapping, and idempotent sync jobs.
-- Tokens stay in tokenEnc. This migration does not enable checkout or live sync.

ALTER TABLE "CommerceCatalogLink" ADD COLUMN "externalCatalogId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "metaProductId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "CommerceCatalogLink_tenant_meta_product_key"
ON "CommerceCatalogLink" ("tenantId", "metaProductId")
WHERE "metaProductId" <> '';

CREATE TABLE "CommerceVariantMap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL DEFAULT '',
    "metaProductId" TEXT NOT NULL DEFAULT '',
    "syncStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "reviewStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastError" TEXT NOT NULL DEFAULT '',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceVariantMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceVariantMap_variantId_key" ON "CommerceVariantMap"("variantId");
CREATE UNIQUE INDEX "CommerceVariantMap_tenantId_retailerId_key" ON "CommerceVariantMap"("tenantId", "retailerId");
CREATE INDEX "CommerceVariantMap_productId_idx" ON "CommerceVariantMap"("productId");
CREATE UNIQUE INDEX "CommerceVariantMap_tenant_meta_product_key"
ON "CommerceVariantMap" ("tenantId", "metaProductId")
WHERE "metaProductId" <> '';

ALTER TABLE "CommerceVariantMap" ADD CONSTRAINT "CommerceVariantMap_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceVariantMap" ADD CONSTRAINT "CommerceVariantMap_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceVariantMap" ADD CONSTRAINT "CommerceVariantMap_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CommerceVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommerceConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT '',
    "businessName" TEXT NOT NULL DEFAULT '',
    "wabaId" TEXT NOT NULL DEFAULT '',
    "phoneNumberId" TEXT NOT NULL DEFAULT '',
    "phoneMasked" TEXT NOT NULL DEFAULT '',
    "catalogId" TEXT NOT NULL DEFAULT '',
    "catalogName" TEXT NOT NULL DEFAULT '',
    "grantedScopes" TEXT NOT NULL DEFAULT '',
    "tokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "permissionError" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceConnection_tenantId_key" ON "CommerceConnection"("tenantId");
ALTER TABLE "CommerceConnection" ADD CONSTRAINT "CommerceConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommerceSyncJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CommerceSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceSyncJob_tenantId_idempotencyKey_key" ON "CommerceSyncJob"("tenantId", "idempotencyKey");
CREATE INDEX "CommerceSyncJob_tenantId_status_idx" ON "CommerceSyncJob"("tenantId", "status");
ALTER TABLE "CommerceSyncJob" ADD CONSTRAINT "CommerceSyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceSyncJob" ADD CONSTRAINT "CommerceSyncJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
