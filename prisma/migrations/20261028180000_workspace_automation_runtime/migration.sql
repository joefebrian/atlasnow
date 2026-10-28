-- Additive. Existing rows stay disabled. Null configuration cannot send.
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "marketingAuthorizedAt" TIMESTAMP(3);
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "flowId" TEXT;
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "flowScreen" TEXT;
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "flowCta" TEXT;
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "inboundBody" TEXT;
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "triggerPhrases" TEXT;
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "paymentTriggerPhrases" TEXT;
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "paymentMessageText" TEXT;
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "phoneNumberId" TEXT;
ALTER TABLE "WorkspaceAutomation" ADD COLUMN "wabaId" TEXT;

CREATE TABLE "WorkspaceAutomationAllowlist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "digits" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceAutomationAllowlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceAutomationAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceAutomationAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceAutomationOutbound" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "toDigits" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAutomationOutbound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceAutomationAllowlist_tenantId_digits_key" ON "WorkspaceAutomationAllowlist"("tenantId", "digits");
CREATE INDEX "WorkspaceAutomationAllowlist_tenantId_idx" ON "WorkspaceAutomationAllowlist"("tenantId");
CREATE INDEX "WorkspaceAutomationAudit_tenantId_createdAt_idx" ON "WorkspaceAutomationAudit"("tenantId", "createdAt");
CREATE UNIQUE INDEX "WorkspaceAutomationOutbound_dedupeKey_key" ON "WorkspaceAutomationOutbound"("dedupeKey");
CREATE INDEX "WorkspaceAutomationOutbound_tenantId_createdAt_idx" ON "WorkspaceAutomationOutbound"("tenantId", "createdAt");

ALTER TABLE "WorkspaceAutomationAllowlist" ADD CONSTRAINT "WorkspaceAutomationAllowlist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "WorkspaceAutomation"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceAutomationAudit" ADD CONSTRAINT "WorkspaceAutomationAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "WorkspaceAutomation"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceAutomationOutbound" ADD CONSTRAINT "WorkspaceAutomationOutbound_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "WorkspaceAutomation"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
