-- Catalog file support. Does not enable catalog push, checkout, or payment.

ALTER TABLE "CommerceProduct" ADD COLUMN "publicUrl" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CommerceCatalogLink" ADD COLUMN "sourceSnapshot" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CommerceConnection" ADD COLUMN "catalogVertical" TEXT NOT NULL DEFAULT '';
