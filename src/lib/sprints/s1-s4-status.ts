/**
 * AtlasNow engineering sprint checklist S1–S4 (Blueprint tech tasks).
 * Used by Settings → Sprint readiness (honest status for ops).
 */

export type CheckState = "done" | "partial" | "planned";

export type SprintCheck = {
  id: string;
  label: string;
  state: CheckState;
  note?: string;
  href?: string;
};

export type SprintBlock = {
  id: string;
  title: string;
  summary: string;
  checks: SprintCheck[];
};

export const SPRINTS_S1_S4: SprintBlock[] = [
  {
    id: "S1",
    title: "S1 · Shell, auth, tenancy",
    summary: "App shell, login, agency/client tenants, roles, audit basics.",
    checks: [
      { id: "T-001", label: "App shell + nav (10 modules)", state: "done", href: "/control-tower" },
      { id: "T-003", label: "Staff login (JWT cookie)", state: "done", href: "/login" },
      { id: "T-004", label: "Tenant + membership + roles", state: "done", href: "/clients" },
      { id: "T-005", label: "Tenant-scoped access helpers", state: "done" },
      { id: "T-006", label: "AuditEvent writer", state: "done" },
      {
        id: "S1-brand",
        label: "Branding + EN|ID locale",
        state: "done",
        href: "/settings/branding",
      },
      {
        id: "S1-agency",
        label: "Agency Clients CRUD + activate login",
        state: "done",
        href: "/clients",
      },
      {
        id: "S1-api-hub",
        label: "Settings → API Configuration hub",
        state: "done",
        href: "/settings/api",
      },
    ],
  },
  {
    id: "S2",
    title: "S2 · Location Master",
    summary: "Immutable atlas_location_id, portfolio, CSV, readiness, Location 360, Maps fetch.",
    checks: [
      { id: "T-010", label: "Location + atlas_location_id", state: "done", href: "/locations" },
      { id: "T-011", label: "CSV import dry-run + commit", state: "done", href: "/locations/import" },
      { id: "T-012", label: "SourceMapping CRUD", state: "done" },
      { id: "T-013", label: "Duplicate external ID guard", state: "done" },
      { id: "T-014", label: "Readiness engine (DRAFT→MAPPED)", state: "done" },
      { id: "T-015", label: "Locations portfolio filters", state: "done", href: "/locations" },
      { id: "T-016", label: "Location 360 shell + profile push/pull", state: "done" },
      {
        id: "S2-maps",
        label: "Fetch from Maps URL (address + phone via Places)",
        state: "done",
        href: "/locations/new",
        note: "Phone needs Maps/Places API key in Settings → API",
      },
    ],
  },
  {
    id: "S3",
    title: "S3 · Google OAuth + map + Data Health",
    summary: "Agency OAuth LIVE, list/cache remotes, map to atlas_location_id, rate limits.",
    checks: [
      { id: "T-020", label: "Connector + SyncRun registry", state: "done" },
      {
        id: "T-021",
        label: "Google OAuth connect (agency)",
        state: "done",
        href: "/settings/google",
        note: "Requires Client ID/Secret + test users + quota",
      },
      {
        id: "T-022",
        label: "List GBP accounts/locations (BI APIs)",
        state: "done",
        note: "Cache 15m + Force refresh; backoff on 429",
      },
      { id: "T-023", label: "Map remote → atlas_location_id", state: "done", href: "/data-health/map" },
      { id: "T-029", label: "Data Health dashboard", state: "done", href: "/settings/google" },
      {
        id: "S3-write",
        label: "Location 360 Push/Pull Business Information",
        state: "done",
      },
      {
        id: "S3-rate",
        label: "Rate limit + exponential backoff + list cache",
        state: "done",
      },
      {
        id: "S3-mock",
        label: "Mock connect retired (LIVE only)",
        state: "done",
      },
    ],
  },
  {
    id: "S4",
    title: "S4 · Metric store + dictionary",
    summary: "MetricObservation grain, GBP dictionary, MetricCard contract, Visibility tab.",
    checks: [
      { id: "T-030", label: "MetricObservation store", state: "done" },
      {
        id: "T-031",
        label: "MetricCard data contract (8 fields + Why)",
        state: "done",
      },
      {
        id: "T-032",
        label: "GBP Performance metric dictionary",
        state: "done",
        href: "/settings/metrics",
      },
      {
        id: "T-033",
        label: "No data vs zero vs threshold vs error",
        state: "done",
      },
      { id: "T-034", label: "Timezone default Asia/Jakarta", state: "done" },
      {
        id: "T-024",
        label: "GSC property connect",
        state: "planned",
        note: "Honest portfolio-only stub until API wired",
        href: "/data-health/gsc",
      },
      {
        id: "T-025",
        label: "GSC page pattern mapping",
        state: "planned",
      },
      {
        id: "S4-live-perf",
        label: "Live Performance API pull → observations",
        state: "planned",
        note: "S5 — after Google quota / API approval",
      },
    ],
  },
  {
    id: "GO",
    title: "Wave A · TikTok GO + HQ WhatsApp",
    summary:
      "Local Service API: voucher at the till, mapped per outlet. Optional WA template to opt-in HQ chats — not a CSV, not a stamp, not TikTok DM inbox.",
    checks: [
      {
        id: "GO-app",
        label: "Add Local Service API on the AtlasNow TikTok developer app",
        state: "done",
        note: "Live 2026-09-02. Scopes local.shop / product / voucher.manage. Not DMs.",
      },
      {
        id: "GO-merchant",
        label: "Merchant Portal + merchant_id + NIB for first F&B brand",
        state: "partial",
        note: "Chat apps → TikTok GO till: paste merchant ID, fetch token after they Accept AtlasNow. Demo till works without this.",
      },
      {
        id: "GO-map",
        label: "Map each Location ↔ TikTok third_shop_id",
        state: "partial",
        href: "/settings/chat-apps",
        note: "Chat apps → TikTok GO till table, or Location 360 → TIKTOK_GO_SHOP. Demo till does not need this.",
      },
      {
        id: "GO-till",
        label: "Kasir scan TT- QR → query → redeem (this outlet only)",
        state: "partial",
        href: "/loyalty",
        note: "Sample QR TT-DEMO-* on Loyalty Scan. Live TT- after merchant token + shop map. Recap = tebus, not GMV.",
      },
      {
        id: "GO-wa-template",
        label: "Meta MARKETING template for GO deals (opt-in HQ only)",
        state: "partial",
        href: "/broadcast",
        note: "Preset go_deal_optin on Templates. Submit to Meta, send to birthday opt-in after APPROVED. Not a CSV.",
      },
      {
        id: "GO-privacy",
        label: "Privacy: TikTok GO voucher + WA opt-in for deals",
        state: "partial",
        href: "/privacy",
      },
    ],
  },
];

export function sprintSummary(blocks: SprintBlock[] = SPRINTS_S1_S4) {
  let done = 0;
  let partial = 0;
  let planned = 0;
  for (const b of blocks) {
    for (const c of b.checks) {
      if (c.state === "done") done++;
      else if (c.state === "partial") partial++;
      else planned++;
    }
  }
  return { done, partial, planned, total: done + partial + planned };
}
