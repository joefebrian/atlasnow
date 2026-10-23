import type { CatalogItem } from "@/lib/commerce/catalog-sync";
import { batchBody } from "@/lib/commerce/catalog-sync";

/**
 * Commerce Graph client. Inbox OAuth stays on v21.0 in src/lib/meta/oauth.ts.
 * v25.0 is a supported Graph version. Catalog batch status samples use this version.
 * POST /{catalog}/batch is deprecated and removed in v27, so commerce posts to /items_batch.
 * This module was not verified against a live Meta app.
 */
export const COMMERCE_GRAPH = "https://graph.facebook.com/v25.0";

const PAGE_CAP = 10;

export class GraphError extends Error {
  permission: boolean;
  code: number | undefined;
  constructor(message: string, permission: boolean, code?: number) {
    super(scrubSecret(message));
    this.permission = permission;
    this.code = code;
  }
}

type FetchLike = typeof fetch;

type GraphJson = {
  data?: Array<Record<string, unknown>> | { scopes?: string[]; is_valid?: boolean; app_id?: string; expires_at?: number };
  error?: { message?: string; code?: number };
  paging?: { cursors?: { after?: string } };
  handles?: string[];
  validation_status?: Array<{
    retailer_id?: string;
    errors?: Array<{ message?: string }>;
    warnings?: Array<{ message?: string }>;
  }>;
};

export type ItemValidation = {
  retailerId: string;
  errors: string[];
  warnings: string[];
};

export type TokenInspection = {
  valid: boolean;
  appId: string;
  scopes: string[];
  expiresAt: Date | null;
  reason: string;
};

export type BatchStatus = {
  handle: string;
  status: string;
  errorsTotal: number;
  invalidIds: string[];
  items: ItemValidation[];
};

export function scrubSecret(value: string): string {
  return value
    .replace(/EAA[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .slice(0, 500);
}

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
    throw new GraphError(message, permissionCode(body.error?.code, message), body.error?.code);
  }
  return body;
}

async function listEdge(path: string, fields: string, token: string, fetchImpl: FetchLike) {
  const rows: Record<string, unknown>[] = [];
  let after = "";
  for (let page = 0; page < PAGE_CAP; page += 1) {
    const url = new URL(`${COMMERCE_GRAPH}/${path}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "50");
    if (after) url.searchParams.set("after", after);
    const body = await graphGet(url, token, fetchImpl);
    const chunk = Array.isArray(body.data) ? body.data : [];
    rows.push(...chunk);
    const next = body.paging?.cursors?.after || "";
    if (!next || next === after || chunk.length === 0) break;
    after = next;
  }
  return rows;
}

export async function inspectCommerceToken(opts: {
  inputToken: string;
  appId: string;
  appSecret: string;
  fetchImpl?: FetchLike;
}): Promise<TokenInspection> {
  const fetchImpl = opts.fetchImpl || fetch;
  const url = new URL(`${COMMERCE_GRAPH}/debug_token`);
  url.searchParams.set("input_token", opts.inputToken);
  const body = await graphGet(url, `${opts.appId}|${opts.appSecret}`, fetchImpl);
  const data = (body.data && !Array.isArray(body.data) ? body.data : {}) as {
    scopes?: string[];
    is_valid?: boolean;
    app_id?: string | number;
    expires_at?: number;
  };
  const scopes = Array.isArray(data.scopes) ? data.scopes.map(String) : [];
  const appId = data.app_id != null ? String(data.app_id) : "";
  const expiresAt = typeof data.expires_at === "number" && data.expires_at > 0 ? new Date(data.expires_at * 1000) : null;
  if (data.is_valid === false) {
    return { valid: false, appId, scopes, expiresAt, reason: "Meta token is expired or revoked." };
  }
  if (!appId || appId !== opts.appId) {
    return { valid: false, appId, scopes, expiresAt, reason: "Meta token was not issued for this app." };
  }
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return { valid: false, appId, scopes, expiresAt, reason: "Meta token expired. Connect again." };
  }
  return { valid: true, appId, scopes, expiresAt, reason: "" };
}

export async function listBusinesses(token: string, fetchImpl: FetchLike = fetch) {
  const rows = await listEdge("me/businesses", "id,name", token, fetchImpl);
  return rows
    .map((row) => ({ id: String(row.id || ""), name: String(row.name || "") }))
    .filter((row) => row.id);
}

export async function listCatalogs(businessId: string, token: string, fetchImpl: FetchLike = fetch) {
  const rows = await listEdge(
    `${encodeURIComponent(businessId)}/owned_product_catalogs`,
    "id,name",
    token,
    fetchImpl
  );
  return rows
    .map((row) => ({ id: String(row.id || ""), name: String(row.name || row.id || "") }))
    .filter((row) => row.id);
}

export async function listWabas(businessId: string, token: string, fetchImpl: FetchLike = fetch) {
  const rows = await listEdge(
    `${encodeURIComponent(businessId)}/owned_whatsapp_business_accounts`,
    "id,name",
    token,
    fetchImpl
  );
  return rows
    .map((row) => ({ id: String(row.id || ""), name: String(row.name || "") }))
    .filter((row) => row.id);
}

export async function listPhones(wabaId: string, token: string, fetchImpl: FetchLike = fetch) {
  const rows = await listEdge(
    `${encodeURIComponent(wabaId)}/phone_numbers`,
    "id,display_phone_number,verified_name",
    token,
    fetchImpl
  );
  return rows
    .map((row) => ({
      id: String(row.id || ""),
      display: String(row.display_phone_number || ""),
      name: String(row.verified_name || ""),
    }))
    .filter((row) => row.id);
}

function itemMessages(rows: Array<{ message?: string }> | undefined): string[] {
  return (rows || []).map((row) => scrubSecret(String(row.message || ""))).filter(Boolean);
}

export async function pushCatalogItems(opts: {
  catalogId: string;
  token: string;
  items: CatalogItem[];
  existingRetailerIds: Set<string>;
  link: string;
  fetchImpl?: FetchLike;
}): Promise<{ handles: string[]; validation: ItemValidation[] }> {
  const fetchImpl = opts.fetchImpl || fetch;
  const url = `${COMMERCE_GRAPH}/${encodeURIComponent(opts.catalogId)}/items_batch`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      access_token: opts.token,
      item_type: "PRODUCT_ITEM",
      ...batchBody(opts.items, opts.existingRetailerIds, opts.link),
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = (await res.json().catch(() => ({}))) as GraphJson;
  if (!res.ok) {
    const message = body.error?.message || `Catalog batch failed (${res.status})`;
    throw new GraphError(message, permissionCode(body.error?.code, message), body.error?.code);
  }
  const validation = (body.validation_status || []).map((row) => ({
    retailerId: String(row.retailer_id || ""),
    errors: itemMessages(row.errors),
    warnings: itemMessages(row.warnings),
  }));
  return {
    handles: Array.isArray(body.handles) ? body.handles.map(String).filter(Boolean) : [],
    validation,
  };
}

export function classifyBatchStatus(opts: {
  status: string;
  errorsTotal: number;
  invalidIds: string[];
}): "SUBMITTED" | "PROCESSING" | "SUCCEEDED" | "FAILED" {
  const status = opts.status.trim().toLowerCase();
  if (status === "finished") {
    if (opts.errorsTotal === 0 && opts.invalidIds.length === 0) return "SUCCEEDED";
    return "FAILED";
  }
  if (status === "error" || status === "canceled" || status === "cancelled") return "FAILED";
  if (status === "started" || status === "dispatched" || status === "in_progress" || status === "processing") {
    return "PROCESSING";
  }
  return "SUBMITTED";
}

export function batchFailureMessage(opts: { invalidIds: string[]; itemCount: number }): string {
  if (opts.invalidIds.length > 0 && opts.invalidIds.length < opts.itemCount) {
    return `Meta finished the batch with errors on some items: ${opts.invalidIds.join(", ")}.`;
  }
  return "Meta rejected the catalog batch. No item was confirmed.";
}

export async function checkBatchStatus(opts: {
  catalogId: string;
  handle: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<BatchStatus> {
  const fetchImpl = opts.fetchImpl || fetch;
  const url = new URL(`${COMMERCE_GRAPH}/${encodeURIComponent(opts.catalogId)}/check_batch_request_status`);
  url.searchParams.set("handle", opts.handle);
  url.searchParams.set("load_ids_of_invalid_requests", "true");
  url.searchParams.set("fields", "handle,status,errors,warnings,errors_total_count,ids_of_invalid_requests");
  const body = await graphGet(url, opts.token, fetchImpl);
  const row = (Array.isArray(body.data) ? body.data[0] : {}) || {};
  const warnings = Array.isArray(row.warnings) ? (row.warnings as Array<{ id?: string; message?: string }>) : [];
  const errors = Array.isArray(row.errors) ? (row.errors as Array<{ id?: string; message?: string }>) : [];
  const invalidIds = Array.isArray(row.ids_of_invalid_requests)
    ? (row.ids_of_invalid_requests as unknown[]).map(String).filter(Boolean)
    : [];
  const byId = new Map<string, ItemValidation>();
  for (const item of [...warnings, ...errors]) {
    const retailerId = String(item.id || "");
    const current = byId.get(retailerId) || { retailerId, errors: [], warnings: [] };
    const message = scrubSecret(String(item.message || ""));
    if (!message) continue;
    if (errors.includes(item)) current.errors.push(message);
    else current.warnings.push(message);
    byId.set(retailerId, current);
  }
  return {
    handle: String(row.handle || opts.handle),
    status: String(row.status || ""),
    errorsTotal: Number(row.errors_total_count || 0) || invalidIds.length,
    invalidIds,
    items: [...byId.values()],
  };
}

export type RemoteCatalogRow = {
  id: string;
  retailerId: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  availability: string;
  imageUrl: string;
  reviewStatus: string;
  groupId: string;
  variantKeys: string[];
};

const CATALOG_ITEM_FIELDS = [
  "id",
  "retailer_id",
  "name",
  "description",
  "price",
  "currency",
  "availability",
  "image_url",
  "review_status",
  "retailer_product_group_id",
  "additional_variant_attributes",
].join(",");

function variantKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const key = (row as { key?: unknown }).key;
    if (typeof key === "string" && key.trim()) keys.push(key.trim());
  }
  return keys;
}

function remoteRow(row: Record<string, unknown>): RemoteCatalogRow {
  const price = row.price;
  return {
    id: String(row.id || ""),
    retailerId: String(row.retailer_id || "").trim(),
    name: String(row.name || "").trim(),
    description: String(row.description || "").trim(),
    price: typeof price === "number" || typeof price === "string" ? String(price).trim() : "",
    currency: String(row.currency || "").trim().toUpperCase(),
    availability: String(row.availability || "").trim().toLowerCase(),
    imageUrl: String(row.image_url || "").trim(),
    reviewStatus: String(row.review_status || "").trim().toLowerCase(),
    groupId: String(row.retailer_product_group_id || "").trim(),
    variantKeys: variantKeys(row.additional_variant_attributes),
  };
}

/** Reads product items already in a catalog. Does not post a batch. */
export async function listCatalogItems(
  catalogId: string,
  token: string,
  fetchImpl: FetchLike = fetch
): Promise<{ items: RemoteCatalogRow[]; truncated: boolean }> {
  const items: RemoteCatalogRow[] = [];
  let after = "";
  for (let page = 0; page < PAGE_CAP; page += 1) {
    const url = new URL(`${COMMERCE_GRAPH}/${encodeURIComponent(catalogId)}/products`);
    url.searchParams.set("fields", CATALOG_ITEM_FIELDS);
    url.searchParams.set("limit", "50");
    if (after) url.searchParams.set("after", after);
    const body = await graphGet(url, token, fetchImpl);
    const chunk = Array.isArray(body.data) ? body.data : [];
    items.push(...chunk.map(remoteRow));
    const next = body.paging?.cursors?.after || "";
    if (!next || next === after || chunk.length === 0) return { items, truncated: false };
    after = next;
    if (page === PAGE_CAP - 1) return { items, truncated: true };
  }
  return { items, truncated: true };
}

export async function lookupCatalogProducts(opts: {
  catalogId: string;
  retailerIds: string[];
  token: string;
  fetchImpl?: FetchLike;
}): Promise<{ retailerId: string; metaProductId: string }[]> {
  if (!opts.retailerIds.length) return [];
  const fetchImpl = opts.fetchImpl || fetch;
  const url = new URL(`${COMMERCE_GRAPH}/${encodeURIComponent(opts.catalogId)}/products`);
  url.searchParams.set("fields", "id,retailer_id");
  url.searchParams.set("filter", JSON.stringify({ retailer_id: { is_any: opts.retailerIds } }));
  url.searchParams.set("limit", "50");
  const body = await graphGet(url, opts.token, fetchImpl);
  const rows = Array.isArray(body.data) ? body.data : [];
  return rows
    .map((row) => ({ retailerId: String(row.retailer_id || ""), metaProductId: String(row.id || "") }))
    .filter((row) => row.retailerId && row.metaProductId);
}
