-- Catalog batch handles, confirmed payload hashes, and one-time commerce OAuth nonces.
-- Does not enable checkout or live catalog sync. Does not drop product rows.

ALTER TABLE "CommerceCatalogLink" ADD COLUMN "processedPayloadHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN "processedPublicUrl" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CommerceSyncJob" ADD COLUMN "batchHandle" TEXT NOT NULL DEFAULT '',
ADD COLUMN "itemResults" TEXT NOT NULL DEFAULT '';

CREATE TABLE "CommerceOAuthNonce" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceOAuthNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceOAuthNonce_userId_nonce_key" ON "CommerceOAuthNonce"("userId", "nonce");
CREATE INDEX "CommerceOAuthNonce_expiresAt_idx" ON "CommerceOAuthNonce"("expiresAt");

ALTER TABLE "CommerceOAuthNonce" ADD CONSTRAINT "CommerceOAuthNonce_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
