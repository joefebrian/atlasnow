ALTER TABLE "WaConversation" ADD COLUMN "handoffState" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WaConversation" ADD COLUMN "handoffUntil" TIMESTAMP(3);
