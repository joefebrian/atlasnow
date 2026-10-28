import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/google/crypto";
import { META_GRAPH } from "@/lib/meta/oauth";
import { findMetaPageForThread } from "@/lib/meta/service";
import {
  formatMetaPeerLabel,
  labelFromParticipants,
  type MetaPeerProfile,
} from "./meta-label";

export {
  formatMetaPeerLabel,
  isOpaqueMetaLabel,
  metaPeerIdFromContact,
  shouldFetchMetaDisplayName,
} from "./meta-label";

type GraphError = { message?: string; code?: number };

async function graphGet(
  token: string,
  path: string,
  params: Record<string, string>
): Promise<{ ok: boolean; data: Record<string, unknown> & { error?: GraphError } }> {
  const url = new URL(`${META_GRAPH}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: GraphError;
  };
  return { ok: res.ok && !data.error, data };
}

function asParticipants(raw: unknown): Array<MetaPeerProfile & { id?: string | null }> {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const data = root && Array.isArray(root.data) ? root.data : [];
  const first = data[0] && typeof data[0] === "object" ? (data[0] as Record<string, unknown>) : null;
  const parts = first && first.participants && typeof first.participants === "object"
    ? (first.participants as Record<string, unknown>)
    : null;
  const list = parts && Array.isArray(parts.data) ? parts.data : [];
  return list.filter((p) => p && typeof p === "object") as Array<
    MetaPeerProfile & { id?: string | null }
  >;
}

export async function lookupMetaPeerLabel(opts: {
  tenantId: string;
  provider: "FACEBOOK" | "INSTAGRAM";
  sessionId: string;
  peerId: string;
}): Promise<string | null> {
  const peerId = opts.peerId.trim();
  if (!peerId) return null;
  const connector = await prisma.connector.findUnique({
    where: { tenantId_provider_accountKey: { tenantId: opts.tenantId, provider: "META", accountKey: "" } },
    select: { metaJson: true, status: true },
  });
  if (!connector || connector.status === "DISCONNECTED") return null;
  const page = findMetaPageForThread(connector.metaJson, opts.provider, opts.sessionId);
  if (!page) return null;
  let token: string;
  try {
    token = decryptSecret(page.tokenEnc);
  } catch {
    return null;
  }

  const fields =
    opts.provider === "INSTAGRAM" ? "name,username" : "first_name,last_name,name";
  const profile = await graphGet(token, peerId, { fields });
  if (profile.ok) {
    const label = formatMetaPeerLabel(opts.provider, profile.data as MetaPeerProfile);
    if (label) return label;
  } else {
    console.warn("[meta profile]", peerId, profile.data.error?.message || "profile failed");
  }

  const platform = opts.provider === "INSTAGRAM" ? "instagram" : "messenger";
  const conv = await graphGet(token, `${page.id}/conversations`, {
    platform,
    user_id: peerId,
    fields: "participants{id,name,username}",
    limit: "1",
  });
  const label = labelFromParticipants(
    opts.provider,
    peerId,
    page.id,
    asParticipants(conv.data)
  );
  if (label) return label;
  if (!conv.ok) {
    console.warn(
      "[meta profile conversations]",
      peerId,
      conv.data.error?.message || "conversations failed"
    );
  }
  return null;
}
