-- Records when a Meta catalog item was copied into the product master.
-- Does not enable catalog push, checkout, or payment.

ALTER TABLE "CommerceCatalogLink" ADD COLUMN "lastImportedAt" TIMESTAMP(3);
