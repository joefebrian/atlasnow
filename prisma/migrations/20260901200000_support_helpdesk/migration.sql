-- CreateTable
CREATE TABLE "SupportDeskSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "openHm" TEXT NOT NULL DEFAULT '09:00',
    "closeHm" TEXT NOT NULL DEFAULT '17:00',
    "daysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "agentSeenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportDeskSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportThread" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "visitorKind" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "roleLabel" TEXT NOT NULL DEFAULT '',
    "firstPath" TEXT NOT NULL DEFAULT '',
    "lastPath" TEXT NOT NULL DEFAULT '',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "lastVisitorAt" TIMESTAMP(3),
    "lastAgentAt" TIMESTAMP(3),
    "lastPreview" TEXT NOT NULL DEFAULT '',
    "silenceDeadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportThread_status_queuedAt_idx" ON "SupportThread"("status", "queuedAt");
CREATE INDEX "SupportThread_email_status_idx" ON "SupportThread"("email", "status");
CREATE INDEX "SupportThread_userId_status_idx" ON "SupportThread"("userId", "status");
CREATE INDEX "SupportMessage_threadId_sentAt_idx" ON "SupportMessage"("threadId", "sentAt");

ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "SupportThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SupportDeskSettings" ("id", "enabled", "openHm", "closeHm", "daysOfWeek", "timezone", "updatedAt")
VALUES ('default', true, '09:00', '17:00', '1,2,3,4,5,6,7', 'Asia/Jakarta', CURRENT_TIMESTAMP);
