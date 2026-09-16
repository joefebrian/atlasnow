export type LocationReadiness = "DRAFT" | "PARTIAL" | "READY" | "MAPPED" | "BLOCKED";

export type ReadinessInput = {
  status: string;
  name?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  phone?: string | null;
  hasActiveGoogleMapping?: boolean;
};

export type ReadinessResult = {
  readiness: LocationReadiness;
  reasons: string[];
};

/**
 * Compute location readiness for Control / Google Business Profile onboarding.
 * READY = core fields for portfolio ops.
 * MAPPED = READY + active Google Business Profile mapping.
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const reasons: string[] = [];

  if (input.status === "ARCHIVED") {
    return { readiness: "BLOCKED", reasons: ["Location is archived"] };
  }
  if (input.status === "INACTIVE") {
    reasons.push("Location marked inactive");
  }

  const hasName = Boolean(input.name?.trim());
  const hasCity = Boolean(input.city?.trim());
  const hasAddress = Boolean(input.addressLine1?.trim());
  const hasPhone = Boolean(input.phone?.trim());

  if (!hasName) reasons.push("Missing name");
  if (!hasCity) reasons.push("Missing city");
  if (!hasAddress) reasons.push("Missing address");
  if (!hasPhone) reasons.push("Missing phone");

  if (!hasName && !hasCity) {
    return { readiness: "DRAFT", reasons: reasons.length ? reasons : ["Draft — incomplete core fields"] };
  }

  const coreComplete = hasName && hasCity && hasAddress && hasPhone;
  if (!coreComplete) {
    return { readiness: "PARTIAL", reasons };
  }

  if (input.hasActiveGoogleMapping) {
    return {
      readiness: "MAPPED",
      reasons: ["Core profile complete", "Google Business Profile mapped"],
    };
  }

  return {
    readiness: "READY",
    reasons: [
      "Core profile complete",
      "Awaiting Google Business Profile map (Data Health → Map locations)",
    ],
  };
}

export function readinessBadgeClass(readiness: string): string {
  switch (readiness) {
    case "MAPPED":
      return "an-badge-yes";
    case "READY":
      return "an-badge-live";
    case "PARTIAL":
      return "an-badge-warn";
    case "BLOCKED":
      return "an-badge-no";
    default:
      return "an-badge-muted";
  }
}
