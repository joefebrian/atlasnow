export const DEFAULT_FLOW_STEPS = [
  "One brand, every outlet",
  "HQ WhatsApp lives here, not on a phone",
  "Members join by QR · stamps from a real receipt",
  "Reviews land with the same team",
  "See which outlet needs a person",
] as const;

export const DEFAULT_FLOW_STEPS_ID = [
  "Satu merek, semua cabang",
  "WhatsApp HQ di sini, bukan di HP kasir",
  "Member daftar lewat QR · stamp dari struk sah",
  "Ulasan masuk ke tim yang sama",
  "Lihat cabang mana yang butuh orang",
] as const;

/** Click-info on the login/signup split. Keyed by the step sentence (EN + ID + stale). */
export const DEFAULT_FLOW_TIPS: Record<string, string> = {
  "One brand, every outlet":
    "Many outlets of the same brand stay on One brand. Several brands is a Group — not “more outlets.”",
  "HQ WhatsApp lives here, not on a phone":
    "The brand number sits on AtlasNow. Staff can leave; the chats stay. AtlasNow does not answer from a branch phone.",
  "Members join by QR · stamps from a real receipt":
    "A stamp is not a paid voucher. It lands only after an approved till photo.",
  "Reviews land with the same team":
    "Google reviews sit next to the inbox. Same people, same shift — not a separate app.",
  "See which outlet needs a person":
    "Work for a human at that location. AtlasNow does not auto-reply.",
  // stale keys still in some workspaces until branding heals
  "Connect HQ WhatsApp":
    "The brand number sits on AtlasNow. Staff can leave; the chats stay.",
  "Join QR, then a real receipt":
    "A stamp is not a paid voucher. It lands only after an approved till photo.",
  "Run membership, inbox, and reviews":
    "Same team sees chats, members, and Google reviews.",
  "See which location needs a person":
    "Work for a human at that location. AtlasNow does not auto-reply.",
};

export const DEFAULT_FLOW_TIPS_ID: Record<string, string> = {
  "Satu merek, semua cabang":
    "Banyak cabang merek yang sama tetap di Satu merek. Beberapa merek = Grup — bukan “lebih banyak outlet.”",
  "WhatsApp HQ di sini, bukan di HP kasir":
    "Nomor merek duduk di AtlasNow. Staf bisa keluar; chat tetap. AtlasNow tidak membalas dari nomor cabang.",
  "Member daftar lewat QR · stamp dari struk sah":
    "Stamp bukan voucher berbayar. Masuk hanya setelah foto struk disetujui.",
  "Ulasan masuk ke tim yang sama":
    "Ulasan Google duduk di samping inbox. Tim yang sama, shift yang sama.",
  "Lihat cabang mana yang butuh orang":
    "Kerjaan untuk orang di cabang itu. AtlasNow tidak auto-reply.",
  "Sambung WhatsApp HQ":
    "Nomor merek duduk di AtlasNow. Staf bisa keluar; chat tetap.",
  "QR daftar, lalu struk sah":
    "Stamp bukan voucher berbayar. Masuk hanya setelah foto struk disetujui.",
  "Jalankan membership, inbox, dan ulasan":
    "Tim yang sama melihat chat, member, dan ulasan Google.",
  "Lihat lokasi mana yang butuh orang":
    "Kerjaan untuk orang di cabang itu. AtlasNow tidak auto-reply.",
};

export function tipForFlowStep(step: string, locale: "en" | "id"): string | null {
  const table = locale === "id" ? DEFAULT_FLOW_TIPS_ID : DEFAULT_FLOW_TIPS;
  return table[step] || DEFAULT_FLOW_TIPS[step] || DEFAULT_FLOW_TIPS_ID[step] || null;
}

export type Branding = {
  appName: string;
  logoUrl: string | null;
  logoLetter: string;
  /** English (primary) */
  tagline: string;
  heroHeadline: string;
  supportingNarrative: string;
  productPromise: string;
  flowSteps: string[];
  /** Bahasa Indonesia */
  taglineId: string;
  heroHeadlineId: string;
  supportingNarrativeId: string;
  productPromiseId: string;
  flowStepsId: string[];
  supportEmail: string | null;
  primaryColor: string;
};

/** Resolved copy for the active UI locale */
export type LocalizedBranding = {
  appName: string;
  logoUrl: string | null;
  logoLetter: string;
  tagline: string;
  heroHeadline: string;
  supportingNarrative: string;
  productPromise: string;
  flowSteps: string[];
  supportEmail: string | null;
  primaryColor: string;
  locale: "en" | "id";
};

export const DEFAULT_BRANDING: Branding = {
  appName: "AtlasNow",
  logoUrl: null,
  logoLetter: "A",
  tagline: "One desk for every location.",
  heroHeadline: "Optimize Every Outlet. Capture More Demand.",
  supportingNarrative:
    "AtlasNow is the brand desk: HQ WhatsApp inbox, membership stamps from real receipts, and reviews — every outlet on one login. A person replies, not a bot.",
  productPromise: "One brand. As many outlets as you have.",
  flowSteps: [...DEFAULT_FLOW_STEPS],
  taglineId: "Satu meja untuk setiap lokasi.",
  heroHeadlineId: "Optimize Every Outlet. Capture More Demand.",
  supportingNarrativeId:
    "AtlasNow adalah meja merek: inbox WhatsApp HQ, stamp membership dari struk sah, dan ulasan — semua cabang di satu login. Orang yang balas, bukan bot.",
  productPromiseId: "Satu merek. Sebanyak cabang yang Anda punya.",
  flowStepsId: [...DEFAULT_FLOW_STEPS_ID],
  supportEmail: "hello@atlasnow.co",
  primaryColor: "#4f46e5",
};

const STALE_NARRATIVE =
  /they are not the product|itu bukan produk utamanya|stamps stay honest|stamp tetap jujur/i;

export function isStaleBrandingStory(b: Pick<Branding, "supportingNarrative" | "supportingNarrativeId" | "heroHeadline">): boolean {
  return (
    STALE_NARRATIVE.test(b.supportingNarrative) ||
    STALE_NARRATIVE.test(b.supportingNarrativeId || "") ||
    /chats, members, and reviews should not live in different places/i.test(b.heroHeadline)
  );
}

export function localizeBranding(
  branding: Branding,
  locale: "en" | "id"
): LocalizedBranding {
  if (locale === "id") {
    return {
      appName: branding.appName,
      logoUrl: branding.logoUrl,
      logoLetter: branding.logoLetter,
      tagline: branding.taglineId || branding.tagline,
      heroHeadline: branding.heroHeadlineId || branding.heroHeadline,
      supportingNarrative:
        branding.supportingNarrativeId || branding.supportingNarrative,
      productPromise: branding.productPromiseId || branding.productPromise,
      flowSteps:
        branding.flowStepsId?.length > 0
          ? branding.flowStepsId
          : branding.flowSteps,
      supportEmail: branding.supportEmail,
      primaryColor: branding.primaryColor,
      locale: "id",
    };
  }
  return {
    appName: branding.appName,
    logoUrl: branding.logoUrl,
    logoLetter: branding.logoLetter,
    tagline: branding.tagline,
    heroHeadline: branding.heroHeadline,
    supportingNarrative: branding.supportingNarrative,
    productPromise: branding.productPromise,
    flowSteps: branding.flowSteps,
    supportEmail: branding.supportEmail,
    primaryColor: branding.primaryColor,
    locale: "en",
  };
}
