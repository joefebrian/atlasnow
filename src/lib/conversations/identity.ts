import { providerTreatsPeerAsPhone } from "./provider";

export type IdentityConfidence =
  | "PHONE_VERIFIED"
  | "LID_RESOLVED"
  | "OPAQUE_LID"
  | "PLATFORM_ID"
  | "UNKNOWN";

export type ResolvedIdentity = {
  identifier: string;
  phone: string | null;
  lid: string | null;
  confidence: IdentityConfidence;
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** 08xxxx → 628xxxx so branch profile phone matches WA JID. */
export function canonPhone(value: string): string {
  const d = digitsOnly(value);
  if (d.startsWith("0") && d.length >= 9) return `62${d.slice(1)}`;
  return d;
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = canonPhone(a);
  const y = canonPhone(b);
  return x.length >= 8 && x === y;
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

const PLATFORM_PREFIX: Record<string, string> = {
  INSTAGRAM: "ig",
  FACEBOOK: "fb",
  TIKTOK: "tt",
  THREADS: "th",
};

export function resolveIdentity(
  peerRaw: string,
  extraPhone?: string | null,
  provider?: string | null
): ResolvedIdentity {
  const raw = (peerRaw || "").trim();
  const extra = extraPhone ? digitsOnly(extraPhone) : "";
  const extraOk = extra.length >= 8;

  if (provider && !providerTreatsPeerAsPhone(provider)) {
    const prefix = PLATFORM_PREFIX[provider] || provider.toLowerCase();
    if (!raw) {
      return { identifier: "unknown", phone: extraOk ? extra : null, lid: null, confidence: extraOk ? "PHONE_VERIFIED" : "UNKNOWN" };
    }
    if (extraOk) {
      return {
        identifier: extra,
        phone: extra,
        lid: raw,
        confidence: "PHONE_VERIFIED",
      };
    }
    return {
      identifier: `${prefix}:${raw}`,
      phone: null,
      lid: raw,
      confidence: "PLATFORM_ID",
    };
  }

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
