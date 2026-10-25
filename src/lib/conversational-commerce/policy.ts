import type { CustomerExperience } from "./types";

export const OFFERING_CATEGORIES = [
  "GENERAL_GOODS",
  "ADMISSION_TICKET",
  "VOUCHER",
  "GIFT_CARD",
  "SERVICE",
  "UNKNOWN",
] as const;
export type OfferingCategory = (typeof OFFERING_CATEGORIES)[number];

export type MerchantEligibility = "UNKNOWN" | "ELIGIBLE" | "INELIGIBLE";

/**
 * A reference string is not Meta approval.
 * Only status VERIFIED from META_COMMERCE_POLICY counts, and this milestone
 * does not contact Meta to produce that status.
 */
export type ApprovalEvidence = {
  source: "META_COMMERCE_POLICY";
  status: "VERIFIED" | "UNVERIFIED";
  reference: string;
} | null;

export function approvalIsVerified(evidence: ApprovalEvidence): boolean {
  if (!evidence) return false;
  if (evidence.source !== "META_COMMERCE_POLICY") return false;
  if (evidence.status !== "VERIFIED") return false;
  return evidence.reference.trim().length > 0;
}

export type PolicyDecision = {
  transactional: "ALLOW" | "DENY";
  /** Inquiry capture is not a booking and is not a payment. */
  leadCapture: "ALLOW";
  reasons: string[];
};

const FLOW_BLOCKED = new Set<OfferingCategory>(["ADMISSION_TICKET", "VOUCHER", "GIFT_CARD", "SERVICE"]);

/**
 * Unknown eligibility fails closed for catalog and Flow transactions.
 * A Flow cannot carry a restricted admission, voucher, gift card, or service.
 * Services stay off both Catalog and Flow. Chat may record a lead only.
 */
export function evaluateEligibility(input: {
  merchantEligibility: MerchantEligibility;
  offeringCategory: OfferingCategory;
  experience: CustomerExperience;
  approvalEvidence: ApprovalEvidence;
}): PolicyDecision {
  const lead: PolicyDecision = { transactional: "DENY", leadCapture: "ALLOW", reasons: [] };
  const deny = (reason: string): PolicyDecision => ({ ...lead, reasons: [reason] });

  if (input.experience === "WHATSAPP_CHAT") {
    return deny("Chat records intent. It does not confirm a booking or a payment.");
  }
  if (input.merchantEligibility !== "ELIGIBLE") {
    return deny("Merchant eligibility is not ELIGIBLE. Transactional WhatsApp commerce stays off.");
  }
  if (input.offeringCategory === "UNKNOWN") {
    return deny("Offering category is unknown.");
  }
  if (input.offeringCategory === "SERVICE") {
    return deny("Services stay off WhatsApp Catalog and WhatsApp Flow.");
  }
  if (input.experience === "WHATSAPP_FLOW" && FLOW_BLOCKED.has(input.offeringCategory)) {
    return deny("WhatsApp Flow cannot carry a restricted admission, voucher, or gift-card transaction.");
  }
  if (!approvalIsVerified(input.approvalEvidence)) {
    return deny("Approval evidence is not a verified Meta commerce policy record.");
  }
  return { transactional: "ALLOW", leadCapture: "ALLOW", reasons: [] };
}
