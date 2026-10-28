-- Additive. Existing rows stay unspecified until the app marks a known synthetic order.
ALTER TABLE "YolaOrder" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'unspecified';
