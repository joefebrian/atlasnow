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

/** Strip WhatsApp `:device` suffix (`62812…:12` → `62812…`). */
function userWithoutDevice(user: string): string {
  const colon = user.indexOf(":");
  return colon >= 0 ? user.slice(0, colon) : user;
}

function phoneFromUser(user: string): string | null {
  const phone = digitsOnly(userWithoutDevice(user));
  return phone.length >= 8 ? phone : null;
}

export function resolveIdentity(
  peerRaw: string,
  extraPhone?: string | null
): ResolvedIdentity {
  const raw = (peerRaw || "").trim();
  const extra = extraPhone ? digitsOnly(extraPhone) : "";
  const extraOk = extra.length >= 8;

  const at = raw.lastIndexOf("@");
  const user = at >= 0 ? raw.slice(0, at) : raw;
  const host = at >= 0 ? raw.slice(at + 1).toLowerCase() : "";

  if (host === "lid") {
    const lid = user;
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

  const isPhoneJid = host === "c.us" || host === "s.whatsapp.net";
  if (isPhoneJid || host === "") {
    const phone = phoneFromUser(user);
    if (phone) {
      return {
        identifier: phone,
        phone,
        lid: null,
        confidence: "PHONE_VERIFIED",
      };
    }
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
