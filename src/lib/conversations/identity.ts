export type IdentityConfidence =
  | "PHONE_VERIFIED"
  | "LID_RESOLVED"
  | "OPAQUE_LID"
  | "UNKNOWN";

export type ResolvedIdentity = {
  identifier: string;
  phone: string | null;
  lid: string | null;
  confidence: IdentityConfidence;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function resolveIdentity(
  peerRaw: string,
  extraPhone?: string | null
): ResolvedIdentity {
  const raw = (peerRaw || "").trim();
  const extra = extraPhone ? digitsOnly(extraPhone) : "";
  const extraOk = extra.length >= 8;

  const lidMatch = raw.match(/^([^@]+)@lid$/i);
  if (lidMatch) {
    const lid = lidMatch[1];
    if (extraOk) {
      return {
        identifier: extra,
        phone: extra,
        lid,
        confidence: "LID_RESOLVED",
      };
    }
    return {
      identifier: `${lid}@lid`,
      phone: null,
      lid,
      confidence: "OPAQUE_LID",
    };
  }

  const user = raw.includes("@") ? raw.slice(0, raw.indexOf("@")) : raw;
  const phone = digitsOnly(user);
  if (phone.length >= 8) {
    return {
      identifier: phone,
      phone,
      lid: null,
      confidence: "PHONE_VERIFIED",
    };
  }

  if (extraOk) {
    return {
      identifier: extra,
      phone: extra,
      lid: null,
      confidence: "PHONE_VERIFIED",
    };
  }

  if (!raw) {
    return { identifier: "unknown", phone: null, lid: null, confidence: "UNKNOWN" };
  }
  return { identifier: raw, phone: null, lid: null, confidence: "UNKNOWN" };
}

export function mergeIdentity(
  existing: ResolvedIdentity,
  incoming: ResolvedIdentity
): ResolvedIdentity {
  const phone = incoming.phone ?? existing.phone;
  const lid = existing.lid ?? incoming.lid;
  let confidence = existing.confidence;
  if (incoming.phone) {
    confidence =
      incoming.confidence === "PHONE_VERIFIED" ? "PHONE_VERIFIED" : "LID_RESOLVED";
  }
  return {
    identifier: phone || existing.identifier,
    phone,
    lid,
    confidence,
  };
}
