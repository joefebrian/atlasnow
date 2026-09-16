-- CreateTable
CREATE TABLE "WaContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "displayName" TEXT,
    "identityConfidence" TEXT NOT NULL,
    "phone" TEXT,
    "lid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'WAHA',
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "firstMessageAt" DATETIME NOT NULL,
    "lastMessageAt" DATETIME NOT NULL,
    "lastInboundAt" DATETIME,
    "lastOutboundAt" DATETIME,
    "lastPreview" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WaConversation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WaConversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WaContact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "fromMe" BOOLEAN NOT NULL DEFAULT false,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WaConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WaContact_tenantId_phone_idx" ON "WaContact"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "WaContact_tenantId_lid_idx" ON "WaContact"("tenantId", "lid");

-- CreateIndex
CREATE UNIQUE INDEX "WaContact_tenantId_identifier_key" ON "WaContact"("tenantId", "identifier");

-- CreateIndex
CREATE INDEX "WaConversation_tenantId_lastMessageAt_idx" ON "WaConversation"("tenantId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "WaConversation_locationId_lastMessageAt_idx" ON "WaConversation"("locationId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "WaConversation_contactId_sessionId_status_idx" ON "WaConversation"("contactId", "sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WaMessage_externalId_key" ON "WaMessage"("externalId");

-- CreateIndex
CREATE INDEX "WaMessage_conversationId_sentAt_idx" ON "WaMessage"("conversationId", "sentAt");
