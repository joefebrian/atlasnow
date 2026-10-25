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
}): NormalizedExperience {
  const intentType = intentFor(input.experience, input.event, Boolean(input.qualified));
  const qualified = intentType === "QUALIFIED_INQUIRY" || intentType === "BOOKING_REQUEST" || intentType === "PRODUCT_ORDER";
  return {
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
