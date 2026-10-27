import { yolaAccessToken, yolaPublishedFlowId, yolaTemplateName, yolaWabaId } from "@/lib/yola/config";

export type VerifiedTemplate = {
  verified: true;
  status: "APPROVED";
  category: "MARKETING";
  source: "meta_api";
  id: string;
  name: string;
  language: string;
  flowId: string;
  buttonIndex: number;
  buttonText: string;
  navigateScreen: string;
};

export type VerifyResult =
  | { ok: true; template: VerifiedTemplate }
  | { ok: false; status: "UNVERIFIED"; reason: string };

type GraphButton = { type?: string; text?: string; flow_id?: string | number; navigate_screen?: string };
type GraphComponent = { type?: string; buttons?: GraphButton[] };
type GraphTemplate = {
  id?: string;
  name?: string;
  status?: string;
  language?: string;
  category?: string;
  components?: GraphComponent[];
};

function flowButton(components: GraphComponent[] | undefined) {
  const block = (components || []).find((item) => item.type === "BUTTONS");
  const buttons = block?.buttons || [];
  const index = buttons.findIndex((button) => button.type === "FLOW" && button.flow_id && button.navigate_screen);
  if (index < 0) return null;
  const button = buttons[index];
  return {
    index,
    text: String(button.text || ""),
    flowId: String(button.flow_id),
    navigateScreen: String(button.navigate_screen),
  };
}

/**
 * Accept one APPROVED MARKETING template with a FLOW button.
 * A configured name must match that template. Several matches stay unverified.
 */
export function selectApprovedFlowTemplate(rows: GraphTemplate[], configuredName: string): VerifyResult {
  const matches = rows.flatMap((row) => {
    const button = flowButton(row.components);
    if (row.status !== "APPROVED" || row.category !== "MARKETING" || !button || !row.name || !row.language || !row.id) {
      return [];
    }
    if (configuredName && row.name !== configuredName) return [];
    const template: VerifiedTemplate = {
      verified: true,
      status: "APPROVED",
      category: "MARKETING",
      source: "meta_api",
      id: row.id,
      name: row.name,
      language: row.language,
      flowId: button.flowId,
      buttonIndex: button.index,
      buttonText: button.text,
      navigateScreen: button.navigateScreen,
    };
    return [template];
  });
  if (matches.length === 1) return { ok: true, template: matches[0] };
  if (matches.length > 1) return { ok: false, status: "UNVERIFIED", reason: "ambiguous" };
  return { ok: false, status: "UNVERIFIED", reason: "not_approved" };
}

export function templatePayload(input: {
  to: string;
  template: VerifiedTemplate;
  flowToken: string;
}) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to.replace(/\D/g, ""),
    type: "template",
    template: {
      name: input.template.name,
      language: { code: input.template.language },
      components: [
        {
          type: "button",
          sub_type: "flow",
          index: String(input.template.buttonIndex),
          parameters: [
            {
              type: "action",
              action: {
                flow_token: input.flowToken,
                flow_action_data: { screen: input.template.navigateScreen },
              },
            },
          ],
        },
      ],
    },
  };
}

export function flowInvitePayload(input: { to: string; flowId: string; flowToken: string; screen: string }) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to.replace(/\D/g, ""),
    type: "interactive",
    interactive: {
      type: "flow",
      body: { text: "YOLA FUN Kartu Presale 2× Masuk. Rp499.000 termasuk pajak. Jam yang dipilih adalah preferensi, bukan slot yang dijamin." },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_id: input.flowId,
          flow_cta: "Lihat penawaran",
          flow_token: input.flowToken,
          flow_action: "navigate",
          flow_action_payload: { screen: input.screen },
        },
      },
    },
  };
}

/** Read-only Graph call. No template is created. No message is sent. */
export async function fetchMarketingTemplates(fetchImpl: typeof fetch = fetch): Promise<VerifyResult> {
  const token = yolaAccessToken();
  if (!token) return { ok: false, status: "UNVERIFIED", reason: "meta_api_unavailable" };
  const wabaId = yolaWabaId();
  if (!wabaId) return { ok: false, status: "UNVERIFIED", reason: "waba_unconfigured" };
  const url = new URL(`https://graph.facebook.com/v25.0/${encodeURIComponent(wabaId)}/message_templates`);
  url.searchParams.set("fields", "id,name,status,language,category,components");
  url.searchParams.set("limit", "100");
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, status: "UNVERIFIED", reason: "meta_error" };
  }
  if (!response.ok) return { ok: false, status: "UNVERIFIED", reason: "meta_error" };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: "UNVERIFIED", reason: "meta_error" };
  }
  const data = body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
    ? ((body as { data: GraphTemplate[] }).data)
    : null;
  if (!data) return { ok: false, status: "UNVERIFIED", reason: "meta_error" };
  const selected = selectApprovedFlowTemplate(data, yolaTemplateName());
  if (!selected.ok) return selected;
  const configuredFlow = yolaPublishedFlowId();
  if (configuredFlow && configuredFlow !== selected.template.flowId) {
    return { ok: false, status: "UNVERIFIED", reason: "flow_id_mismatch" };
  }
  return selected;
}

/** Bulk sends stay off even if the flag is later flipped. There is no campaign sender. */
export function sendBulkCampaign() {
  return { ok: false as const, reason: "bulk_disabled" as const };
}
