import { prisma } from "@/lib/db";

export type AutomationPurpose = "flow_invite" | "payment_link" | "marketing";

export type WorkspaceAutomationState = {
  configured: boolean;
  inboundEnabled: boolean;
  paymentFollowUpEnabled: boolean;
  marketingEnabled: boolean;
  pilotMode: boolean;
};

const disabledState: WorkspaceAutomationState = {
  configured: false,
  inboundEnabled: false,
  paymentFollowUpEnabled: false,
  marketingEnabled: false,
  pilotMode: true,
};

export async function readWorkspaceAutomation(tenantId: string): Promise<WorkspaceAutomationState> {
  const row = await prisma.workspaceAutomation.findUnique({ where: { tenantId } });
  if (!row) return disabledState;
  return {
    configured: true,
    inboundEnabled: row.inboundEnabled,
    paymentFollowUpEnabled: row.paymentFollowUpEnabled,
    marketingEnabled: row.marketingEnabled,
    pilotMode: row.pilotMode,
  };
}

/**
 * One purpose at a time. A legacy env flag of false always wins.
 * A legacy flag of true keeps today's YOLA behavior. Null means a future
 * workspace, which stays off until its own row is enabled.
 */
export function purposePermitted(input: {
  purpose: AutomationPurpose;
  legacyFlag: boolean | null;
  workspace: WorkspaceAutomationState;
}) {
  if (input.legacyFlag === false) return false;
  if (input.legacyFlag === true) return true;
  if (input.purpose === "flow_invite") return input.workspace.inboundEnabled;
  if (input.purpose === "payment_link") return input.workspace.paymentFollowUpEnabled;
  return input.workspace.marketingEnabled;
}
