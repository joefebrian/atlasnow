export type NumberAutomationOverride = {
  inboundEnabled: boolean | null;
  paymentFollowUpEnabled: boolean | null;
  marketingEnabled: boolean | null;
  pilotMode: boolean | null;
  flowId: string | null;
  flowScreen: string | null;
  flowCta: string | null;
  inboundBody: string | null;
  triggerPhrases: string | null;
  paymentTriggerPhrases: string | null;
  paymentMessageText: string | null;
};

export type WorkspaceAutomationDefaults = NumberAutomationOverride & {
  phoneNumberId: string | null;
  wabaId: string | null;
  marketingAuthorizedAt: Date | null;
  allowlist: { digits: string }[];
};

export type EffectiveNumberAutomation = {
  tenantId: string;
  usesWorkspaceDefault: boolean;
  phoneNumberId: string;
  wabaId: string | null;
  marketingAuthorizedAt: Date | null;
  allowlist: { digits: string }[];
  inboundEnabled: boolean;
  paymentFollowUpEnabled: boolean;
  marketingEnabled: boolean;
  pilotMode: boolean;
  flowId: string | null;
  flowScreen: string | null;
  flowCta: string | null;
  inboundBody: string | null;
  triggerPhrases: string | null;
  paymentTriggerPhrases: string | null;
  paymentMessageText: string | null;
};

/** A new number does not inherit another number's enabled automation. */
export function numberUsesWorkspaceDefault(input: {
  workspacePhoneNumberId: string | null | undefined;
  phoneNumberId: string;
  isDefault: boolean;
  connectedCount: number;
}): boolean {
  const bound = (input.workspacePhoneNumberId || "").trim();
  if (bound) return bound === input.phoneNumberId;
  if (input.connectedCount <= 1) return true;
  return input.isDefault;
}

function pickBool(
  override: boolean | null | undefined,
  workspace: boolean | null | undefined,
  usesDefault: boolean,
  fallback: boolean
) {
  if (typeof override === "boolean") return override;
  if (usesDefault && typeof workspace === "boolean") return workspace;
  return fallback;
}

function pickText(
  override: string | null | undefined,
  workspace: string | null | undefined,
  usesDefault: boolean
) {
  const own = (override || "").trim();
  if (own) return own;
  if (!usesDefault) return null;
  const inherited = (workspace || "").trim();
  return inherited || null;
}

export function effectiveNumberAutomation(input: {
  tenantId: string;
  phoneNumberId: string;
  wabaId: string;
  isDefault: boolean;
  connectedCount: number;
  workspace: WorkspaceAutomationDefaults | null;
  override: NumberAutomationOverride | null;
}): EffectiveNumberAutomation | null {
  if (!input.workspace && !input.override) return null;
  const usesWorkspaceDefault = numberUsesWorkspaceDefault({
    workspacePhoneNumberId: input.workspace?.phoneNumberId,
    phoneNumberId: input.phoneNumberId,
    isDefault: input.isDefault,
    connectedCount: input.connectedCount,
  });
  const workspace = input.workspace;
  const override = input.override;
  return {
    tenantId: input.tenantId,
    usesWorkspaceDefault,
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId || workspace?.wabaId || "",
    marketingAuthorizedAt: usesWorkspaceDefault ? workspace?.marketingAuthorizedAt ?? null : null,
    allowlist: usesWorkspaceDefault ? workspace?.allowlist ?? [] : [],
    inboundEnabled: pickBool(override?.inboundEnabled, workspace?.inboundEnabled, usesWorkspaceDefault, false),
    paymentFollowUpEnabled: pickBool(
      override?.paymentFollowUpEnabled,
      workspace?.paymentFollowUpEnabled,
      usesWorkspaceDefault,
      false
    ),
    marketingEnabled: pickBool(override?.marketingEnabled, workspace?.marketingEnabled, usesWorkspaceDefault, false),
    pilotMode: pickBool(override?.pilotMode, workspace?.pilotMode, usesWorkspaceDefault, true),
    flowId: pickText(override?.flowId, workspace?.flowId, usesWorkspaceDefault),
    flowScreen: pickText(override?.flowScreen, workspace?.flowScreen, usesWorkspaceDefault),
    flowCta: pickText(override?.flowCta, workspace?.flowCta, usesWorkspaceDefault),
    inboundBody: pickText(override?.inboundBody, workspace?.inboundBody, usesWorkspaceDefault),
    triggerPhrases: pickText(override?.triggerPhrases, workspace?.triggerPhrases, usesWorkspaceDefault),
    paymentTriggerPhrases: pickText(
      override?.paymentTriggerPhrases,
      workspace?.paymentTriggerPhrases,
      usesWorkspaceDefault
    ),
    paymentMessageText: pickText(override?.paymentMessageText, workspace?.paymentMessageText, usesWorkspaceDefault),
  };
}
