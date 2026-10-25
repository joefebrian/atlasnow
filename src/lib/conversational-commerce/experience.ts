import type { CommerceIntent, CustomerExperience, IntentType } from "./types";

export const EXPERIENCE_EVENTS = [
  "catalog.order",
  "catalog.cart",
  "flow.submission",
  "flow.selection",
  "chat.message",
] as const;
export type ExperienceEventName = (typeof EXPERIENCE_EVENTS)[number];

export type NormalizedExperience = {
  intent: CommerceIntent;
  /** A catalog message or a Flow submission is never a confirmed booking. */
  bookingState: null;
  confirmed: false;
  createsReservation: false;
  /** A catalog order is not a verified payment. */
  verifiesPayment: false;
};

export type NormalizeResult =
  | { ok: true; value: NormalizedExperience }
  | { ok: false; code: "EXPERIENCE_EVENT_MISMATCH" };

const ALLOWED_EVENTS: Record<CustomerExperience, readonly ExperienceEventName[]> = {
  WHATSAPP_CATALOG: ["catalog.order", "catalog.cart"],
  WHATSAPP_FLOW: ["flow.submission", "flow.selection"],
  WHATSAPP_CHAT: ["chat.message"],
};

export function normalizeCustomerExperience(input: {
  tenantId: string;
  locationId: string | null;
  experience: CustomerExperience;
  event: ExperienceEventName;
  qualified?: boolean;
  customerRef?: string | null;
  commerceOrderRef?: string | null;
  intentRef?: string | null;
}): NormalizeResult {
  if (!ALLOWED_EVENTS[input.experience].includes(input.event)) {
    return { ok: false, code: "EXPERIENCE_EVENT_MISMATCH" };
  }
  const intentType = intentFor(input.experience, input.event, Boolean(input.qualified));
  const qualified = intentType === "QUALIFIED_INQUIRY" || intentType === "BOOKING_REQUEST" || intentType === "PRODUCT_ORDER";
  return {
    ok: true,
    value: {
    intent: {
      intentRef: input.intentRef ?? "",
      tenantId: input.tenantId,
      locationId: input.locationId,
      experience: input.experience,
      intentType,
      qualified,
      customerRef: input.customerRef ?? null,
      commerceOrderRef: input.event === "catalog.order" ? input.commerceOrderRef ?? null : null,
    },
    bookingState: null,
    confirmed: false,
    createsReservation: false,
    verifiesPayment: false,
    },
  };
}

function intentFor(experience: CustomerExperience, event: ExperienceEventName, qualified: boolean): IntentType {
  if (experience === "WHATSAPP_CATALOG") {
    return event === "catalog.cart" ? "ENGAGEMENT" : "PRODUCT_ORDER";
  }
  if (experience === "WHATSAPP_FLOW") {
    return event === "flow.selection" ? "BOOKING_REQUEST" : "STRUCTURED_RESPONSE";
  }
  return qualified ? "QUALIFIED_INQUIRY" : "ENGAGEMENT";
}
