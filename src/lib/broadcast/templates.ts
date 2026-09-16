import { META_GRAPH } from "@/lib/meta/oauth";
import type { CloudHqConfig } from "@/lib/conversations/cloud-hq";
import { namedPlaceholders } from "@/lib/loyalty/birthday-h2";
import { BIRTHDAY_NAMED_EXAMPLES } from "@/lib/loyalty/birthday-template";
import { GO_DEAL_BODY_EXAMPLES } from "@/lib/broadcast/go-deal-template";

export type WaTemplate = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  headerFormat: "IMAGE" | "DOCUMENT" | "TEXT" | "NONE";
  bodyText: string;
};

export async function listWabaTemplates(cfg: CloudHqConfig): Promise<WaTemplate[]> {
  if (!cfg.wabaId) return [];
  const url = new URL(`${META_GRAPH}/${encodeURIComponent(cfg.wabaId)}/message_templates`);
  url.searchParams.set("limit", "80");
  url.searchParams.set("fields", "id,name,language,status,category,components");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: Array<{
      id?: string;
      name?: string;
      language?: string;
      status?: string;
      category?: string;
      components?: Array<{ type?: string; format?: string; text?: string }>;
    }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message || `Template list failed (${res.status})`);
  return (json.data || []).map((row) => {
    const header = (row.components || []).find((c) => (c.type || "").toUpperCase() === "HEADER");
    const body = (row.components || []).find((c) => (c.type || "").toUpperCase() === "BODY");
    const format = (header?.format || "").toUpperCase();
    const headerFormat: WaTemplate["headerFormat"] =
      format === "IMAGE" || format === "DOCUMENT" || format === "TEXT" ? format : "NONE";
    return {
      id: String(row.id || ""),
      name: String(row.name || ""),
      language: String(row.language || "id"),
      status: String(row.status || ""),
      category: String(row.category || ""),
      headerFormat,
      bodyText: String(body?.text || ""),
    };
  });
}

export async function createWabaTemplate(
  cfg: CloudHqConfig,
  opts: {
    name: string;
    category: "MARKETING" | "UTILITY";
    language: string;
    body: string;
    header?: { format: "IMAGE" | "DOCUMENT"; handle: string } | null;
  }
): Promise<{ id: string; status: string }> {
  if (!cfg.wabaId) throw new Error("WABA ID missing on this brand’s HQ number");
  const name = opts.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
  if (!/^[a-z][a-z0-9_]{2,}$/.test(name)) {
    throw new Error("Template name: lowercase letters, numbers, underscore. Start with a letter.");
  }
  const body = opts.body.trim();
  if (body.length < 10) throw new Error("Write a template body of at least 10 characters");
  const language = (opts.language || "id").trim().slice(0, 8);
  const components: Array<Record<string, unknown>> = [];
  if (opts.header?.handle) {
    components.push({
      type: "HEADER",
      format: opts.header.format,
      example: { header_handle: [opts.header.handle] },
    });
  }
  const named = namedPlaceholders(body);
  const positional = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const bodyComp: Record<string, unknown> = { type: "BODY", text: body };
  if (named.length) {
    bodyComp.example = {
      body_text_named_params: named.map((param_name) => ({
        param_name,
        example: BIRTHDAY_NAMED_EXAMPLES[param_name] || "contoh",
      })),
    };
  } else if (positional.length) {
    const max = Math.max(...positional);
    const samples = Array.from({ length: max }, (_, i) => GO_DEAL_BODY_EXAMPLES[i] || `contoh${i + 1}`);
    bodyComp.example = { body_text: [samples] };
  }
  components.push(bodyComp);
  const res = await fetch(`${META_GRAPH}/${encodeURIComponent(cfg.wabaId)}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      language,
      category: opts.category,
      ...(named.length ? { parameter_format: "named" } : {}),
      components,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message || `Meta rejected the template (${res.status})`);
  }
  return { id: json.id, status: json.status || "PENDING" };
}
