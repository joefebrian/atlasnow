-- AlterTable
ALTER TABLE "User" ADD COLUMN "noticeSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InboxNotice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxNotice_tenantId_createdAt_idx" ON "InboxNotice"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "InboxNotice" ADD CONSTRAINT "InboxNotice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
