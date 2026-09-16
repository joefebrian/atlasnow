-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CLIENT',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "loginEnabled" BOOLEAN NOT NULL DEFAULT false,
    "industry" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "objectType" TEXT,
    "objectId" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "atlasLocationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'ID',
    "phone" TEXT,
    "website" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "readiness" TEXT NOT NULL DEFAULT 'DRAFT',
    "readinessJson" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "reviewerName" TEXT,
    "starRating" INTEGER NOT NULL,
    "comment" TEXT,
    "createTime" TIMESTAMP(3),
    "updateTime" TIMESTAMP(3),
    "replyComment" TEXT,
    "replyUpdateTime" TIMESTAMP(3),
    "rawJson" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReplyDraft" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewReplyDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceMapping" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalLabel" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'HIGH',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "displayName" TEXT,
    "accountEmail" TEXT,
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'LIVE',
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LIST_LOCATIONS',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "statsJson" TEXT,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleRemoteLocation" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storeCode" TEXT,
    "addressLine" TEXT,
    "locality" TEXT,
    "administrativeArea" TEXT,
    "postalCode" TEXT,
    "regionCode" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "rawJson" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleRemoteLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandingConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "appName" TEXT NOT NULL DEFAULT 'AtlasNow',
    "logoUrl" TEXT,
    "logoLetter" TEXT NOT NULL DEFAULT 'A',
    "tagline" TEXT NOT NULL,
    "heroHeadline" TEXT NOT NULL,
    "supportingNarrative" TEXT NOT NULL,
    "productPromise" TEXT NOT NULL,
    "flowStepsJson" TEXT NOT NULL,
    "taglineId" TEXT,
    "heroHeadlineId" TEXT,
    "supportingNarrativeId" TEXT,
    "productPromiseId" TEXT,
    "flowStepsJsonId" TEXT,
    "supportEmail" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#4f46e5',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricObservation" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'GBP_PERFORMANCE',
    "observedOn" TIMESTAMP(3) NOT NULL,
    "valueJson" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "syncRunId" TEXT,
    "rawExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'AUTO',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT,
    "publicJson" TEXT NOT NULL DEFAULT '{}',
    "secretsEnc" TEXT,
    "notes" TEXT,
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "AppErrorLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "displayName" TEXT,
    "identityConfidence" TEXT NOT NULL,
    "phone" TEXT,
    "lid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'WAHA',
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "firstMessageAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "lastPreview" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "fromMe" BOOLEAN NOT NULL DEFAULT false,
    "rawJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_type_status_idx" ON "Tenant"("type", "status");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Location_atlasLocationId_key" ON "Location"("atlasLocationId");

-- CreateIndex
CREATE INDEX "Location_tenantId_status_idx" ON "Location"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Location_tenantId_city_idx" ON "Location"("tenantId", "city");

-- CreateIndex
CREATE INDEX "Location_tenantId_readiness_idx" ON "Location"("tenantId", "readiness");

-- CreateIndex
CREATE UNIQUE INDEX "Location_tenantId_code_key" ON "Location"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Review_externalId_key" ON "Review"("externalId");

-- CreateIndex
CREATE INDEX "Review_locationId_updateTime_idx" ON "Review"("locationId", "updateTime");

-- CreateIndex
CREATE INDEX "Review_starRating_idx" ON "Review"("starRating");

-- CreateIndex
CREATE INDEX "ReviewReplyDraft_reviewId_status_idx" ON "ReviewReplyDraft"("reviewId", "status");

-- CreateIndex
CREATE INDEX "SourceMapping_locationId_idx" ON "SourceMapping"("locationId");

-- CreateIndex
CREATE INDEX "SourceMapping_sourceType_status_idx" ON "SourceMapping"("sourceType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SourceMapping_sourceType_externalId_key" ON "SourceMapping"("sourceType", "externalId");

-- CreateIndex
CREATE INDEX "Connector_provider_status_idx" ON "Connector"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Connector_tenantId_provider_key" ON "Connector"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "SyncRun_connectorId_startedAt_idx" ON "SyncRun"("connectorId", "startedAt");

-- CreateIndex
CREATE INDEX "GoogleRemoteLocation_connectorId_idx" ON "GoogleRemoteLocation"("connectorId");

-- CreateIndex
CREATE INDEX "GoogleRemoteLocation_locality_idx" ON "GoogleRemoteLocation"("locality");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleRemoteLocation_connectorId_externalId_key" ON "GoogleRemoteLocation"("connectorId", "externalId");

-- CreateIndex
CREATE INDEX "MetricObservation_locationId_observedOn_idx" ON "MetricObservation"("locationId", "observedOn");

-- CreateIndex
CREATE INDEX "MetricObservation_metricKey_observedOn_idx" ON "MetricObservation"("metricKey", "observedOn");

-- CreateIndex
CREATE INDEX "MetricObservation_sourceSystem_observedOn_idx" ON "MetricObservation"("sourceSystem", "observedOn");

-- CreateIndex
CREATE UNIQUE INDEX "MetricObservation_locationId_metricKey_sourceSystem_observe_key" ON "MetricObservation"("locationId", "metricKey", "sourceSystem", "observedOn");

-- CreateIndex
CREATE INDEX "AppErrorLog_createdAt_idx" ON "AppErrorLog"("createdAt");

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

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReplyDraft" ADD CONSTRAINT "ReviewReplyDraft_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMapping" ADD CONSTRAINT "SourceMapping_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleRemoteLocation" ADD CONSTRAINT "GoogleRemoteLocation_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricObservation" ADD CONSTRAINT "MetricObservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricObservation" ADD CONSTRAINT "MetricObservation_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaContact" ADD CONSTRAINT "WaContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaConversation" ADD CONSTRAINT "WaConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaConversation" ADD CONSTRAINT "WaConversation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaConversation" ADD CONSTRAINT "WaConversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WaContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaMessage" ADD CONSTRAINT "WaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

