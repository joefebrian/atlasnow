-- Workspace payment handoff. Missing row means the existing demo checkout.
CREATE TABLE "YolaPaymentConfig" (
    "tenantId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'DEMO_CHECKOUT',
    "merchantUrl" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YolaPaymentConfig_pkey" PRIMARY KEY ("tenantId")
);

ALTER TABLE "YolaPaymentConfig" ADD CONSTRAINT "YolaPaymentConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
