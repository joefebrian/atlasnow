export type MetaPeerProfile = {
  username?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/** IGSID / PSID / ig:… / fb:… — never show these as the inbox title. */
export function isOpaqueMetaLabel(value: string | null | undefined): boolean {
  const s = (value || "").trim();
  if (!s) return true;
  if (/^(ig|fb):/i.test(s)) return true;
  return /^\d{10,}$/.test(s);
}

export function shouldFetchMetaDisplayName(displayName: string | null | undefined): boolean {
  return isOpaqueMetaLabel(displayName);
}

export function formatMetaPeerLabel(
  provider: "FACEBOOK" | "INSTAGRAM",
  profile: MetaPeerProfile
): string | null {
  const username = (profile.username || "").trim().replace(/^@+/, "");
  if (provider === "INSTAGRAM" && username && !isOpaqueMetaLabel(username)) {
    return `@${username}`;
  }
  const joined = [profile.first_name, profile.last_name]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(" ");
  const name = (profile.name || "").trim() || joined;
  if (name && !/^instagram user$/i.test(name) && !isOpaqueMetaLabel(name)) return name;
  if (username && !isOpaqueMetaLabel(username)) {
    return provider === "INSTAGRAM" ? `@${username}` : username;
  }
  return null;
}

export function labelFromParticipants(
  provider: "FACEBOOK" | "INSTAGRAM",
  peerId: string,
  pageId: string,
  participants: Array<MetaPeerProfile & { id?: string | null }>
): string | null {
  const peer =
    participants.find((p) => (p.id || "") === peerId) ||
    participants.find((p) => p.id && p.id !== pageId) ||
    null;
  return peer ? formatMetaPeerLabel(provider, peer) : null;
}

export function metaPeerIdFromContact(contact: {
  lid: string | null;
  identifier: string;
}): string {
  if (contact.lid) return contact.lid;
  const ident = contact.identifier || "";
  return ident.replace(/^(ig|fb):/i, "");
}
