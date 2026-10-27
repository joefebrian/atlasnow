import type { Referral } from "@/lib/yola/policy";

export type InboundKind = "text" | "nfm" | "status" | "other";

export type InboundEvent = {
  wamid: string;
  fromWaId: string;
  phoneNumberId: string;
  kind: InboundKind;
  body: string;
  responseJson: string;
  referral: Referral | null;
  sentAt: string;
  deliveryStatus: string;
};

function record(row: unknown): Record<string, unknown> | null {
  return row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : null;
}

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** Cloud API messages only. WAHA payloads have no entry/changes shape and yield nothing. */
export function readInbound(body: unknown): InboundEvent[] {
  const root = record(body);
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  const found: InboundEvent[] = [];
  for (const entry of entries) {
    const changes = Array.isArray(record(entry)?.changes) ? (record(entry)?.changes as unknown[]) : [];
    for (const change of changes) {
      const value = record(record(change)?.value);
      if (!value) continue;
      const phoneNumberId = str(record(value.metadata)?.phone_number_id);
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const status of statuses) {
        const row = record(status);
        const wamid = str(row?.id).trim();
        if (!wamid) continue;
        found.push({
          wamid,
          fromWaId: "",
          phoneNumberId,
          kind: "status",
          body: "",
          responseJson: "",
          referral: null,
          sentAt: "",
          deliveryStatus: str(row?.status),
        });
      }
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        const row = record(message);
        if (!row) continue;
        const wamid = str(row.id).trim();
        if (!wamid) continue;
        const referralRow = record(row.referral);
        const referral: Referral | null = referralRow
          ? {
              sourceType: str(referralRow.source_type),
              sourceId: str(referralRow.source_id),
              sourceUrl: str(referralRow.source_url),
              headline: str(referralRow.headline),
              ctwaClid: str(referralRow.ctwa_clid),
            }
          : null;
        const interactive = record(row.interactive);
        const nfm = record(interactive?.nfm_reply);
        const kind: InboundKind =
          str(row.type) === "interactive" && str(interactive?.type) === "nfm_reply" && nfm
            ? "nfm"
            : str(row.type) === "text"
              ? "text"
              : "other";
        found.push({
          wamid,
          fromWaId: str(row.from).trim(),
          phoneNumberId,
          kind,
          body: str(record(row.text)?.body),
          responseJson: nfm ? str(nfm.response_json) : "",
          referral,
          sentAt: str(row.timestamp),
          deliveryStatus: "",
        });
      }
    }
  }
  return found;
}
