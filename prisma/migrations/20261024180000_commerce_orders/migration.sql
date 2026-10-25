-- Inbound WhatsApp catalog orders. Does not enable payment, tickets, or catalog sync.

CREATE TABLE "CommerceOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "validation" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'NOT_INITIATED',
    "source" TEXT NOT NULL DEFAULT 'WHATSAPP_ORDER',
    "wabaId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "customerWaId" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT '',
    "estimatedTotal" INTEGER,
    "masterTotalIdr" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceOrderLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT '',
    "itemPriceEstimate" INTEGER,
    "masterUnitPriceIdr" INTEGER,
    "productId" TEXT,
    "variantId" TEXT,
    "validation" TEXT NOT NULL,

    CONSTRAINT "CommerceOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceOrder_waMessageId_key" ON "CommerceOrder"("waMessageId");
CREATE UNIQUE INDEX "CommerceOrder_tenantId_reference_key" ON "CommerceOrder"("tenantId", "reference");
CREATE INDEX "CommerceOrder_tenantId_receivedAt_idx" ON "CommerceOrder"("tenantId", "receivedAt");
CREATE INDEX "CommerceOrderLine_tenantId_idx" ON "CommerceOrderLine"("tenantId");
CREATE INDEX "CommerceOrderLine_orderId_idx" ON "CommerceOrderLine"("orderId");

ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderLine" ADD CONSTRAINT "CommerceOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderLine" ADD CONSTRAINT "CommerceOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderLine" ADD CONSTRAINT "CommerceOrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CommerceVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
