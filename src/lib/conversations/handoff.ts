import { prisma } from "@/lib/db";
import { handoffExpiry } from "@/lib/conversations/customer-inbound";

export async function markHumanHandoff(conversationId: string, at: Date) {
  return prisma.waConversation.update({
    where: { id: conversationId },
    data: { handoffState: "HUMAN_ACTIVE", handoffUntil: handoffExpiry(at) },
  });
}

export async function resumeAutomation(conversationId: string) {
  return prisma.waConversation.update({
    where: { id: conversationId },
    data: { handoffState: "", handoffUntil: null },
  });
}
