import { resolveIdentity } from "./identity";
import { getWahaBaseUrl, getWahaWebhookKey } from "./waha-config";

/** GET /api/{session}/lids/{lid} → { lid, pn: "628…@c.us" } */
export async function resolveLidToPhone(
  session: string,
  lid: string
): Promise<string | null> {
  const base = await getWahaBaseUrl();
  const key = await getWahaWebhookKey();
  if (!base || !key || !session || !lid) return null;
  const clean = lid.replace(/@lid$/i, "").split(":")[0];
  if (!clean) return null;
  const url = `${base}/api/${encodeURIComponent(session)}/lids/${encodeURIComponent(clean)}`;
  try {
    const res = await fetch(url, {
      headers: { "X-Api-Key": key },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { pn?: unknown };
    if (typeof data.pn !== "string") return null;
    return resolveIdentity(data.pn).phone;
  } catch {
    return null;
  }
}
