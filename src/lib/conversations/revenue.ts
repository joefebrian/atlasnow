/** Verified revenue needs a genuine order and a live provider settlement. A PAID status alone does not qualify. */

const GENUINE_ORIGINS = new Set(["pilot", "customer"]);
const REVERSAL_OUTCOMES = new Set(["REFUNDED", "REVERSED", "VOIDED", "REFUND"]);
const LIVE_PROVIDERS = new Set(["xendit"]);

export type RevenueEvent = {
  tenantId: string;
  orderId: string;
  eventId: string;
  provider: string;
  outcome: string;
  amountIdr: number;
  currency: string;
  live: boolean;
};

export type RevenueSession = {
  tenantId: string;
  orderId: string;
  provider: string;
  mode: string;
  status: string;
  amountIdr: number;
  currency: string;
};

export type RevenueOrder = {
  id: string;
  tenantId: string;
  origin: string;
  amountIdr: number;
  currency: string;
  sessions: RevenueSession[];
  events: RevenueEvent[];
};

export type OrderRevenueClass = {
  initiated: number;
  pending: number;
  simulated: number;
  unverifiedPaid: number;
  providerConfirmed: boolean;
  verifiedRevenueIdr: number;
  reason: string;
};

function sameMoney(amountIdr: number, currency: string, order: RevenueOrder) {
  return amountIdr === order.amountIdr && currency === order.currency;
}

export function classifyOrderRevenue(order: RevenueOrder): OrderRevenueClass {
  const sessions = order.sessions.filter((row) => row.tenantId === order.tenantId && row.orderId === order.id);
  const events = order.events.filter((row) => row.tenantId === order.tenantId && row.orderId === order.id);
  const reversed = events.some(
    (row) => REVERSAL_OUTCOMES.has(row.outcome.toUpperCase()) || (row.live && row.outcome === "FAILED")
  );
  const confirmedIds = new Set(
    events
      .filter(
        (row) =>
          row.live &&
          row.outcome === "PAID" &&
          LIVE_PROVIDERS.has(row.provider) &&
          sameMoney(row.amountIdr, row.currency, order)
      )
      .map((row) => row.eventId)
  );
  const providerConfirmed = confirmedIds.size > 0 && !reversed;
  const liveSession = sessions.some(
    (row) =>
      row.mode === "live" &&
      LIVE_PROVIDERS.has(row.provider) &&
      sameMoney(row.amountIdr, row.currency, order)
  );
  const genuine = GENUINE_ORIGINS.has(order.origin.trim().toLowerCase());
  const verified = providerConfirmed && genuine && liveSession;
  let reason = "verified";
  if (!verified) {
    if (reversed) reason = "reversed";
    else if (!genuine) reason = "origin";
    else if (!providerConfirmed) reason = "unverified";
    else reason = "session";
  }
  return {
    initiated: sessions.length,
    pending: sessions.filter((row) => row.status === "PENDING").length,
    simulated: sessions.filter((row) => row.status === "SIMULATED_PAID").length,
    unverifiedPaid: sessions.filter((row) => row.status === "PAID" && !verified).length,
    providerConfirmed,
    verifiedRevenueIdr: verified ? order.amountIdr : 0,
    reason,
  };
}
