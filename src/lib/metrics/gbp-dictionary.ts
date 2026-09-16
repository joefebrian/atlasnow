/**
 * Google Business Profile Performance metric dictionary (PRD §8.2).
 * Labels are strict — never claim visits from directions, leads from calls, etc.
 */

export type MetricSourceSystem =
  | "GBP_PERFORMANCE"
  | "GSC"
  | "ADS"
  | "WAHA"
  | "MANUAL"
  | "ATLAS_CALCULATED";

export type GbpMetricDef = {
  /** API / storage key (Google Performance enum when source is GBP) */
  metricKey: string;
  sourceSystem: MetricSourceSystem;
  uiLabel: string;
  interpretation: string;
  /** Forbidden claims — shown in “Why this number?” */
  forbidden: string;
  caveat: string;
  grain: "location_day";
  group: "impressions" | "actions" | "commerce";
};

export const GBP_PERFORMANCE_METRICS: GbpMetricDef[] = [
  {
    metricKey: "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "Desktop Maps impressions",
    interpretation: "Profile impression on Maps desktop",
    forbidden: "Unique people or store visits",
    caveat: "Impression count from Google; not unique users or foot traffic.",
    grain: "location_day",
    group: "impressions",
  },
  {
    metricKey: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "Desktop Search impressions",
    interpretation: "Profile impression on Search desktop",
    forbidden: "Store traffic",
    caveat: "Search surface impression only — not website sessions.",
    grain: "location_day",
    group: "impressions",
  },
  {
    metricKey: "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "Mobile Maps impressions",
    interpretation: "Profile impression on Maps mobile",
    forbidden: "Unique people or store visits",
    caveat: "Impression count from Google; not unique users or foot traffic.",
    grain: "location_day",
    group: "impressions",
  },
  {
    metricKey: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "Mobile Search impressions",
    interpretation: "Profile impression on Search mobile",
    forbidden: "Store traffic",
    caveat: "Search surface impression only — not website sessions.",
    grain: "location_day",
    group: "impressions",
  },
  {
    metricKey: "BUSINESS_DIRECTION_REQUESTS",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "Direction requests / visit intent",
    interpretation: "Request for directions",
    forbidden: "Store visit",
    caveat: "Visit intent signal only — never report as completed visits.",
    grain: "location_day",
    group: "actions",
  },
  {
    metricKey: "CALL_CLICKS",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "Call-button clicks",
    interpretation: "Click on call action",
    forbidden: "Answered call or qualified lead",
    caveat: "Platform-reported click intent; not an answered call.",
    grain: "location_day",
    group: "actions",
  },
  {
    metricKey: "WEBSITE_CLICKS",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "Website clicks",
    interpretation: "Click to website",
    forbidden: "Form lead or transaction",
    caveat: "Outbound click only — not conversion or revenue.",
    grain: "location_day",
    group: "actions",
  },
  {
    metricKey: "BUSINESS_CONVERSATIONS",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "GBP conversations started",
    interpretation: "Platform-reported conversation action",
    forbidden: "Qualified lead",
    caveat: "Conversation start count; quality unknown without CRM match.",
    grain: "location_day",
    group: "actions",
  },
  {
    metricKey: "BUSINESS_BOOKINGS",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "GBP bookings",
    interpretation: "Platform-reported booking",
    forbidden: "Attended appointment",
    caveat: "Booking request/action — not show-up confirmation.",
    grain: "location_day",
    group: "commerce",
  },
  {
    metricKey: "BUSINESS_FOOD_ORDERS",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "GBP food orders",
    interpretation: "Platform-reported order action",
    forbidden: "Net revenue without order match",
    caveat: "Order action count only unless POS-matched later.",
    grain: "location_day",
    group: "commerce",
  },
  {
    metricKey: "BUSINESS_FOOD_MENU_CLICKS",
    sourceSystem: "GBP_PERFORMANCE",
    uiLabel: "Food-menu clicks",
    interpretation: "Click to menu",
    forbidden: "Order",
    caveat: "Menu open/click intent — not a completed order.",
    grain: "location_day",
    group: "commerce",
  },
];

const byKey = Object.fromEntries(
  GBP_PERFORMANCE_METRICS.map((m) => [m.metricKey, m])
) as Record<string, GbpMetricDef>;

export function getGbpMetricDef(metricKey: string): GbpMetricDef | undefined {
  return byKey[metricKey];
}

/** Primary cards for Location 360 Visibility (S4 UI). */
export const LOCATION_VISIBILITY_PRIMARY_KEYS = [
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_DIRECTION_REQUESTS",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_CONVERSATIONS",
] as const;

export function sourceBadge(sourceSystem: string): string {
  switch (sourceSystem) {
    case "GBP_PERFORMANCE":
      return "GBP";
    case "GSC":
      return "GSC";
    case "ADS":
      return "ADS";
    case "WAHA":
      return "WAHA";
    case "MANUAL":
      return "MANUAL";
    case "ATLAS_CALCULATED":
      return "ATLAS";
    default:
      return sourceSystem;
  }
}
