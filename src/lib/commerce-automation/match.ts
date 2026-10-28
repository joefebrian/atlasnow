export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

const FLOW_ID = /^\d{10,25}$/;
const SCREEN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

export type AutomationInput = {
  inboundEnabled: boolean;
  paymentFollowUpEnabled: boolean;
  marketingEnabled: boolean;
  pilotMode: boolean;
  flowId: string;
  flowScreen: string;
  flowCta: string;
  inboundBody: string;
  triggerPhrases: string;
  paymentTriggerPhrases: string;
  paymentMessageText: string;
};

export function parsePhrases(raw: string | null | undefined) {
  if (!raw) return [];
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const phrase = line.trim().toLowerCase();
    if (phrase.length < 2 || phrase.length > 80) continue;
    if (!out.includes(phrase)) out.push(phrase);
  }
  return out.slice(0, 20);
}

export function matchesPhrase(body: string, phrases: string[]) {
  const hay = body.trim().toLowerCase();
  if (!hay || phrases.length === 0) return false;
  return phrases.some((phrase) => hay.includes(phrase));
}

export function recipientDigits(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return digits;
}

export function maskDigits(digits: string) {
  return `••••${digits.slice(-4)}`;
}

export function parseAllowlist(lines: string[]) {
  const digits: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const value = recipientDigits(trimmed);
    if (!value || value !== trimmed.replace(/\D/g, "")) {
      return { ok: false as const, error: "Each test recipient must be 8 to 15 digits." };
    }
    if (!digits.includes(value)) digits.push(value);
  }
  if (digits.length > 20) return { ok: false as const, error: "Test recipient list is limited to 20 numbers." };
  return { ok: true as const, digits };
}

export function withinServiceWindow(lastInboundAt: Date | null, now: Date) {
  if (!lastInboundAt) return false;
  const age = now.getTime() - lastInboundAt.getTime();
  return age >= 0 && age <= SERVICE_WINDOW_MS;
}

export function inboundAt(sentAt: string, fallback: Date) {
  const sec = Number(sentAt);
  if (!Number.isFinite(sec) || sec < 1_000_000_000) return fallback;
  return new Date(sec * 1000);
}

export function workspaceFlowPayload(input: {
  to: string;
  flowId: string;
  flowToken: string;
  screen: string;
  body: string;
  cta: string;
}) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientDigits(input.to),
    type: "interactive" as const,
    interactive: {
      type: "flow" as const,
      body: { text: input.body },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_id: input.flowId,
          flow_cta: input.cta,
          flow_token: input.flowToken,
          flow_action: "navigate",
          flow_action_payload: { screen: input.screen },
        },
      },
    },
  };
}

export function workspaceTextPayload(to: string, body: string) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientDigits(to),
    type: "text" as const,
    text: { preview_url: false, body },
  };
}

function cleanLine(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length > max) return null;
  if (/[\u0000\r\n]/.test(trimmed)) return null;
  return trimmed;
}

export function validateAutomationInput(input: AutomationInput) {
  const flowId = input.flowId.trim();
  const flowScreen = input.flowScreen.trim();
  const flowCta = cleanLine(input.flowCta, 30);
  const inboundBody = input.inboundBody.trim();
  const paymentMessageText = input.paymentMessageText.trim();
  if (flowCta == null) return { ok: false as const, error: "Flow button label must be one line of at most 30 characters." };
  if (flowId && !FLOW_ID.test(flowId)) return { ok: false as const, error: "Flow ID must be the published numeric ID." };
  if (flowScreen && !SCREEN.test(flowScreen)) return { ok: false as const, error: "Flow screen name is not valid." };
  if (inboundBody.length > 1000) return { ok: false as const, error: "Inbound message is too long." };
  if (paymentMessageText.length > 1000) return { ok: false as const, error: "Payment message is too long." };
  const phrases = parsePhrases(input.triggerPhrases);
  const paymentPhrases = parsePhrases(input.paymentTriggerPhrases);
  if (input.inboundEnabled) {
    if (!flowId || !flowScreen || !flowCta || !inboundBody || phrases.length === 0) {
      return { ok: false as const, error: "Inbound automation needs a published Flow, screen, button, message, and at least one trigger." };
    }
  }
  if (input.paymentFollowUpEnabled && !paymentMessageText) {
    return { ok: false as const, error: "Payment follow-up needs a message before it can be enabled." };
  }
  return {
    ok: true as const,
    value: {
      ...input,
      flowId,
      flowScreen,
      flowCta,
      inboundBody,
      paymentMessageText,
      phrases,
      paymentPhrases,
    },
  };
}
