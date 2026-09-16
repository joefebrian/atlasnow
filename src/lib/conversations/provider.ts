export const CONVERSATION_PROVIDERS = [
  "WAHA",
  "META_CLOUD",
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "THREADS",
] as const;

export type ConversationProvider = (typeof CONVERSATION_PROVIDERS)[number];

const META: Record<
  ConversationProvider,
  { label: string; short: string; family: "whatsapp" | "meta" | "tiktok" | "other" }
> = {
  WAHA: { label: "WhatsApp", short: "WA", family: "whatsapp" },
  META_CLOUD: { label: "WhatsApp HQ", short: "HQ", family: "whatsapp" },
  INSTAGRAM: { label: "Instagram", short: "IG", family: "meta" },
  FACEBOOK: { label: "Messenger", short: "FB", family: "meta" },
  TIKTOK: { label: "TikTok", short: "TT", family: "tiktok" },
  THREADS: { label: "Threads", short: "TH", family: "other" },
};

export function isConversationProvider(value: string): value is ConversationProvider {
  return (CONVERSATION_PROVIDERS as readonly string[]).includes(value);
}

export function providerLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (isConversationProvider(value)) return META[value].label;
  return value;
}

export function providerShort(value: string | null | undefined): string {
  if (!value) return "—";
  if (isConversationProvider(value)) return META[value].short;
  return value;
}

/** Native app a reviewer should open to confirm a live send. */
export function providerNativeClient(value: string | null | undefined): string | null {
  if (value === "FACEBOOK") return "Messenger";
  if (value === "INSTAGRAM") return "Instagram";
  if (value === "META_CLOUD") return "WhatsApp";
  return null;
}

/** Social DMs must never be parsed as phone digits (IGSID/PSID look numeric). */
export function providerTreatsPeerAsPhone(provider?: string | null): boolean {
  if (!provider) return true;
  return META[provider as ConversationProvider]?.family === "whatsapp" || provider === "WAHA";
}
