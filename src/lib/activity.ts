import type { Locale } from "@/lib/i18n/locale";

export type ActivityKind = "person" | "system" | "access";

export type ActivityView = {
  id: string;
  at: string;
  action: string;
  title: string;
  detail: string;
  kind: ActivityKind;
  actorLabel: string;
  tenantName: string | null;
};

const PERSON: Record<string, { en: string; id: string }> = {
  SIGNUP: { en: "Signed up (waiting for follow-up)", id: "Daftar (menunggu follow-up)" },
  LOGIN: { en: "Signed in", id: "Masuk" },
  LOGOUT: { en: "Signed out", id: "Keluar" },
  CLIENT_CREATE: { en: "Added a brand", id: "Tambah merek" },
  CLIENT_UPDATE: { en: "Updated a brand", id: "Ubah merek" },
  CLIENT_DELETE: { en: "Deleted a brand", id: "Hapus merek" },
  CLIENT_LOGIN_ACTIVATE: { en: "Turned brand login on", id: "Nyalakan login merek" },
  CLIENT_LOGIN_DEACTIVATE: { en: "Turned brand login off", id: "Matikan login merek" },
  AGENCY_LOGIN_ACTIVATE: { en: "Turned agency login on", id: "Nyalakan login agency" },
  AGENCY_UPGRADE_APPLY: { en: "Applied to become an agency", id: "Ajukan jadi agency" },
  AGENCY_UPGRADE_APPROVE: { en: "Approved agency upgrade", id: "Setujui jadi agency" },
  AGENCY_UPGRADE_REJECT: { en: "Rejected agency upgrade", id: "Tolak jadi agency" },
  LOCATION_CREATE: { en: "Added an outlet", id: "Tambah cabang" },
  LOCATION_UPDATE: { en: "Updated an outlet", id: "Ubah cabang" },
  LOCATION_DELETE: { en: "Removed an outlet", id: "Hapus cabang" },
  LOCATION_IMPORT: { en: "Imported outlets", id: "Impor cabang" },
  GOOGLE_OAUTH_START: { en: "Started Google connect", id: "Mulai hubungkan Google" },
  GOOGLE_OAUTH_SUCCESS: { en: "Connected Google", id: "Google terhubung" },
  GOOGLE_DISCONNECT: { en: "Disconnected Google", id: "Putus Google" },
  META_OAUTH_START: { en: "Started Facebook connect", id: "Mulai hubungkan Facebook" },
  META_OAUTH_SUCCESS: { en: "Connected Facebook Page", id: "Page Facebook terhubung" },
  META_DISCONNECT: { en: "Disconnected Facebook", id: "Putus Facebook" },
  WAHA_RELINK: { en: "Reconnected WhatsApp (new QR)", id: "Hubungkan ulang WhatsApp (QR baru)" },
  REVIEW_REPLY_DRAFT: { en: "Saved a review reply draft", id: "Simpan draf balasan ulasan" },
  REVIEW_REPLY_PUBLISH: { en: "Published a review reply", id: "Kirim balasan ulasan" },
  EMAIL_CHANGE: { en: "Changed email", id: "Ganti email" },
  PASSWORD_CHANGE: { en: "Changed password", id: "Ganti kata sandi" },
  BRANDING_UPDATE: { en: "Updated branding", id: "Ubah branding" },
  SITE_PAGES_UPDATE: { en: "Updated public pages", id: "Ubah halaman publik" },
  SMTP_TEST: { en: "Sent an SMTP test email", id: "Kirim tes email SMTP" },
};

const SYSTEM: Record<string, { en: string; id: string }> = {
  WAHA_SESSION_DOWN: { en: "WhatsApp disconnected", id: "WhatsApp terputus" },
  WAHA_SESSION_UP: { en: "WhatsApp connected again", id: "WhatsApp tersambung lagi" },
};

export function activityKind(action: string): ActivityKind {
  if (SYSTEM[action]) return "system";
  if (action === "LOGIN" || action === "LOGOUT") return "access";
  return "person";
}

export function humanizeAction(action: string, locale: Locale): string {
  const row = PERSON[action] || SYSTEM[action];
  if (!row) return action.replace(/_/g, " ").toLowerCase();
  return locale === "id" ? row.id : row.en;
}

export function actorLabel(opts: {
  actorName: string | null;
  actorEmail: string | null;
  actorIsPlatformAdmin: boolean;
  locale: Locale;
}): string {
  if (!opts.actorEmail && !opts.actorName) {
    return opts.locale === "id" ? "Sistem" : "System";
  }
  const name = opts.actorName || opts.actorEmail || "";
  if (opts.actorIsPlatformAdmin) {
    return opts.locale === "id" ? `${name} (AtlasNow)` : `${name} (AtlasNow)`;
  }
  return name;
}
