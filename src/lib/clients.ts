export const SELF_SERVE_NOTE_PREFIX = "Self-serve signup";

export function isSelfServeSignup(notes: string | null | undefined): boolean {
  return (notes || "").startsWith(SELF_SERVE_NOTE_PREFIX);
}

export function needsFollowUp(client: {
  loginEnabled: boolean;
  status: string;
}): boolean {
  return client.status !== "ARCHIVED" && client.loginEnabled === false;
}
