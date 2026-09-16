-- CreateTable
CREATE TABLE "SitePageConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "aboutHeadlineEn" TEXT NOT NULL,
    "aboutBodyEn" TEXT NOT NULL,
    "aboutPointsJsonEn" TEXT NOT NULL,
    "aboutHeadlineId" TEXT NOT NULL,
    "aboutBodyId" TEXT NOT NULL,
    "aboutPointsJsonId" TEXT NOT NULL,
    "contactHeadlineEn" TEXT NOT NULL,
    "contactBodyEn" TEXT NOT NULL,
    "contactHeadlineId" TEXT NOT NULL,
    "contactBodyId" TEXT NOT NULL,
    "contactNoteEn" TEXT,
    "contactNoteId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "ipHash" TEXT,
    "mailSent" BOOLEAN NOT NULL DEFAULT false,
    "mailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_ipHash_createdAt_idx" ON "ContactMessage"("ipHash", "createdAt");
