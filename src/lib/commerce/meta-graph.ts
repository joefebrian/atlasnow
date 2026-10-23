import { META_GRAPH } from "@/lib/meta/oauth";
import type { CatalogItem } from "@/lib/commerce/catalog-sync";
import { batchBody } from "@/lib/commerce/catalog-sync";

export class GraphError extends Error {
  permission: boolean;
  constructor(message: string, permission: boolean) {
    super(message);
    this.permission = permission;
  }
}

type FetchLike = typeof fetch;

type GraphJson = {
  data?: Array<Record<string, unknown>>;
  error?: { message?: string; code?: number };
  id?: string;
  scopes?: string[];
  granular_scopes?: unknown;
};

function permissionCode(code: number | undefined, message: string): boolean {
  if (code === 10 || code === 200 || code === 190) return true;
  return /permission|oauth|requires the |not authorized/i.test(message);
}

async function graphGet(url: URL, token: string, fetchImpl: FetchLike): Promise<GraphJson> {
  url.searchParams.set("access_token", token);
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  const body = (await res.json().catch(() => ({}))) as GraphJson;
  if (!res.ok) {
    const message = body.error?.message || `Meta request failed (${res.status})`;
    throw new GraphError(message, permissionCode(body.error?.code, message));
  }
  return body;
}

export async function debugTokenScopes(opts: {
  inputToken: string;
  appId: string;
  appSecret: string;
  fetchImpl?: FetchLike;
}): Promise<string[]> {
  const fetchImpl = opts.fetchImpl || fetch;
  const url = new URL(`${META_GRAPH}/debug_token`);
  url.searchParams.set("input_token", opts.inputToken);
  const body = await graphGet(url, `${opts.appId}|${opts.appSecret}`, fetchImpl);
  const data = body as GraphJson & { data?: { scopes?: string[] } };
  const scopes = (data.data as { scopes?: string[] } | undefined)?.scopes;
  return Array.isArray(scopes) ? scopes : [];
}

export async function listBusinesses(token: string, fetchImpl: FetchLike = fetch) {
  const url = new URL(`${META_GRAPH}/me/businesses`);
  url.searchParams.set("fields", "id,name");
  const body = await graphGet(url, token, fetchImpl);
  return (body.data || [])
    .map((row) => ({ id: String(row.id || ""), name: String(row.name || "") }))
    .filter((row) => row.id);
}

export async function listCatalogs(businessId: string, token: string, fetchImpl: FetchLike = fetch) {
  const url = new URL(`${META_GRAPH}/${encodeURIComponent(businessId)}/owned_product_catalogs`);
  url.searchParams.set("fields", "id,name");
  const body = await graphGet(url, token, fetchImpl);
  return (body.data || [])
    .map((row) => ({ id: String(row.id || ""), name: String(row.name || row.id || "") }))
    .filter((row) => row.id);
}

export async function listWabas(businessId: string, token: string, fetchImpl: FetchLike = fetch) {
  const url = new URL(`${META_GRAPH}/${encodeURIComponent(businessId)}/owned_whatsapp_business_accounts`);
  url.searchParams.set("fields", "id,name");
  const body = await graphGet(url, token, fetchImpl);
  return (body.data || [])
    .map((row) => ({ id: String(row.id || ""), name: String(row.name || "") }))
    .filter((row) => row.id);
}

export async function listPhones(wabaId: string, token: string, fetchImpl: FetchLike = fetch) {
  const url = new URL(`${META_GRAPH}/${encodeURIComponent(wabaId)}/phone_numbers`);
  url.searchParams.set("fields", "id,display_phone_number,verified_name");
  const body = await graphGet(url, token, fetchImpl);
  return (body.data || [])
    .map((row) => ({
      id: String(row.id || ""),
      display: String(row.display_phone_number || ""),
      name: String(row.verified_name || ""),
    }))
    .filter((row) => row.id);
}

export async function pushCatalogItems(opts: {
  catalogId: string;
  token: string;
  items: CatalogItem[];
  existingRetailerIds: Set<string>;
  link: string;
  fetchImpl?: FetchLike;
}): Promise<{ ids: string[] }> {
  const fetchImpl = opts.fetchImpl || fetch;
  const url = `${META_GRAPH}/${encodeURIComponent(opts.catalogId)}/batch`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      access_token: opts.token,
      ...batchBody(opts.items, opts.existingRetailerIds, opts.link),
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = (await res.json().catch(() => ({}))) as GraphJson & { handles?: string[] };
  if (!res.ok) {
    const message = body.error?.message || `Catalog batch failed (${res.status})`;
    throw new GraphError(message, permissionCode(body.error?.code, message));
  }
  return { ids: Array.isArray(body.handles) ? body.handles.map(String) : [] };
}
