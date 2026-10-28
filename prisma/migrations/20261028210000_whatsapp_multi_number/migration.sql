-- Multiple WhatsApp numbers per workspace. Existing rows keep their ids.
-- accountKey stays empty for Google, Meta, TikTok, and other one-row connectors.

ALTER TABLE "Connector" ADD COLUMN "accountKey" TEXT NOT NULL DEFAULT '';

UPDATE "Connector"
SET "accountKey" = substring("metaJson" from '"phoneNumberId"[[:space:]]*:[[:space:]]*"([^"]+)"')
WHERE "provider" = 'WHATSAPP_CLOUD'
  AND "accountKey" = ''
  AND "metaJson" ~ '"phoneNumberId"[[:space:]]*:[[:space:]]*"[^"]+"';

DROP INDEX "Connector_tenantId_provider_key";

CREATE UNIQUE INDEX "Connector_tenantId_provider_accountKey_key"
  ON "Connector"("tenantId", "provider", "accountKey");

CREATE INDEX "Connector_provider_accountKey_idx"
  ON "Connector"("provider", "accountKey");

ALTER TABLE "WabaPhone" ADD COLUMN "alias" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WabaPhone" ADD COLUMN "locationId" TEXT;
ALTER TABLE "WabaPhone" ADD COLUMN "teamLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WabaPhone" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WabaPhone" ADD COLUMN "connectionMode" TEXT NOT NULL DEFAULT '';

CREATE INDEX "WabaPhone_locationId_idx" ON "WabaPhone"("locationId");

CREATE UNIQUE INDEX "WabaPhone_one_default_per_tenant"
  ON "WabaPhone"("tenantId")
  WHERE "isDefault" = true;

ALTER TABLE "WabaPhone"
  ADD CONSTRAINT "WabaPhone_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "WabaPhone" AS phone
SET "isDefault" = true
WHERE "isDefault" = false
  AND (
    SELECT COUNT(*) FROM "WabaPhone" AS peer WHERE peer."tenantId" = phone."tenantId"
  ) = 1;

ALTER TABLE "WaConversation" ADD COLUMN "businessPhoneNumberId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WaConversation" ADD COLUMN "assignedUserId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WaConversation" ADD COLUMN "leadStatus" TEXT NOT NULL DEFAULT '';

CREATE INDEX "WaConversation_tenantId_businessPhoneNumberId_idx"
  ON "WaConversation"("tenantId", "businessPhoneNumberId");

UPDATE "WaConversation"
SET "businessPhoneNumberId" = substring("sessionId" from '^cloud:(.+)$')
WHERE "provider" = 'META_CLOUD'
  AND "businessPhoneNumberId" = ''
  AND "sessionId" ~ '^cloud:.+';

ALTER TABLE "WaMessage" ADD COLUMN "referralJson" TEXT NOT NULL DEFAULT '';

CREATE TABLE "WhatsAppNumberAutomation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "phoneNumberId" TEXT NOT NULL,
  "inboundEnabled" BOOLEAN,
  "paymentFollowUpEnabled" BOOLEAN,
  "marketingEnabled" BOOLEAN,
  "pilotMode" BOOLEAN,
  "flowId" TEXT,
  "flowScreen" TEXT,
  "flowCta" TEXT,
  "inboundBody" TEXT,
  "triggerPhrases" TEXT,
  "paymentTriggerPhrases" TEXT,
  "paymentMessageText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppNumberAutomation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppNumberAutomation_tenantId_phoneNumberId_key"
  ON "WhatsAppNumberAutomation"("tenantId", "phoneNumberId");

CREATE INDEX "WhatsAppNumberAutomation_phoneNumberId_idx"
  ON "WhatsAppNumberAutomation"("phoneNumberId");

ALTER TABLE "WhatsAppNumberAutomation"
  ADD CONSTRAINT "WhatsAppNumberAutomation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
