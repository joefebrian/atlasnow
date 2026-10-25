import type { AttributionTouchpoint, BookingState, EvidenceLevel, PaymentState } from "./types";

export type OutcomeClass = {
  level: EvidenceLevel;
  /** Booking estimates are never revenue. Only current verified settled funds count. */
  countsAsRevenue: boolean;
  revenue: "FULL" | "PARTIAL" | "NONE";
};

/**
 * Level A needs a verified payment still in PAID or PARTIALLY_REFUNDED.
 * Level B needs a confirmed reservation and an authoritative provider reference.
 * A confirmed booking with unpaid payment stays at B. A paid payment does not confirm a booking.
 */
export function classifyOutcome(input: {
  paymentStatus: PaymentState;
  paymentVerified: boolean;
  bookingState: BookingState | null;
  authoritativeBookingRef: string | null;
  qualifiedLead: boolean;
  engaged: boolean;
}): OutcomeClass {
  if (input.paymentStatus === "PAID" && input.paymentVerified) {
    return { level: "A", countsAsRevenue: true, revenue: "FULL" };
  }
  if (input.paymentStatus === "PARTIALLY_REFUNDED" && input.paymentVerified) {
    return { level: "A", countsAsRevenue: true, revenue: "PARTIAL" };
  }
  const confirmed = input.bookingState === "CONFIRMED" || input.bookingState === "COMPLETED";
  if (confirmed && input.authoritativeBookingRef) {
    return { level: "B", countsAsRevenue: false, revenue: "NONE" };
  }
  if (input.qualifiedLead) return { level: "C", countsAsRevenue: false, revenue: "NONE" };
  if (input.engaged) return { level: "D", countsAsRevenue: false, revenue: "NONE" };
  return { level: "D", countsAsRevenue: false, revenue: "NONE" };
}

/** A displayed quote or WhatsApp cart sum is not revenue. */
export function estimateCountsAsRevenue(): false {
  return false;
}

export type TouchpointInput = {
  tenantId: string;
  locationId: string | null;
  transactionRef: string | null;
  ctwaClid?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  qrCampaignId?: string | null;
  directWhatsApp?: boolean;
  /** Aggregated counts. Never copied onto a person. */
  gscClicks?: number | null;
  gbpViews?: number | null;
};

export function buildTouchpoint(input: TouchpointInput): AttributionTouchpoint {
  const warnings: string[] = [];
  const ctwaClid = clean(input.ctwaClid);
  const gclid = clean(input.gclid);
  const gbraid = clean(input.gbraid);
  const wbraid = clean(input.wbraid);
  const utmSource = clean(input.utmSource);
  const utmMedium = clean(input.utmMedium);
  const utmCampaign = clean(input.utmCampaign);
  const qrCampaignId = clean(input.qrCampaignId);
  const hasAggregate = (input.gscClicks ?? 0) > 0 || (input.gbpViews ?? 0) > 0;
  if (hasAggregate) {
    warnings.push("Aggregated Search Console or Business Profile metrics are not a user-level click.");
  }

  const base = {
    tenantId: input.tenantId,
    locationId: input.locationId,
    transactionRef: input.transactionRef,
    ctwaClid,
    gclid,
    gbraid,
    wbraid,
    utmSource,
    utmMedium,
    utmCampaign,
    qrCampaignId,
    warnings,
  };

  if (ctwaClid) {
    return { ...base, channel: "META_CTWA", confidence: "HIGH", userLevel: true };
  }
  if (gclid || gbraid || wbraid) {
    return { ...base, channel: "GOOGLE_ADS", confidence: "HIGH", userLevel: true };
  }
  if (utmSource || utmMedium || utmCampaign) {
    return { ...base, channel: "WEBSITE_UTM", confidence: "MEDIUM", userLevel: false };
  }
  if (qrCampaignId) {
    return { ...base, channel: "QR", confidence: "MEDIUM", userLevel: false };
  }
  if (input.directWhatsApp) {
    return { ...base, channel: "DIRECT_WHATSAPP", confidence: "LOW", userLevel: false };
  }
  if (hasAggregate && (input.gscClicks ?? 0) > 0) {
    return { ...base, channel: "GOOGLE_SEARCH", confidence: "NONE", userLevel: false };
  }
  if (hasAggregate) {
    return { ...base, channel: "GOOGLE_MAPS", confidence: "NONE", userLevel: false };
  }
  warnings.push("No attribution identifier was supplied.");
  return { ...base, channel: "UNKNOWN", confidence: "NONE", userLevel: false, warnings };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
