-- Product photo bytes stay off the list payload. Case-insensitive SKU is unique per merchant.

ALTER TABLE "CommerceProduct" ADD COLUMN "imageData" BYTEA,
ADD COLUMN "imageMime" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "CommerceProduct_tenantId_sku_lower_key" ON "CommerceProduct" ("tenantId", lower("sku"));
CREATE UNIQUE INDEX "CommerceVariant_tenantId_sku_lower_key" ON "CommerceVariant" ("tenantId", lower("sku"));
