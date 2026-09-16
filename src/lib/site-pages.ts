import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/locale";
import { LEGAL_CONTACT_EMAIL, LEGAL_OPERATOR, LEGAL_PRODUCT } from "@/lib/legal/copy";
import { DEFAULT_FAQ, parseFaqJson, type FaqItem } from "@/lib/faq";
import {
  DEFAULT_SOCIAL,
  mergeSocialItem,
  parseSocialJson,
  type SocialItem,
  type SocialLinks,
} from "@/lib/social";

export const CONTACT_INBOX = LEGAL_CONTACT_EMAIL;

export type SitePages = {
  aboutHeadlineEn: string;
  aboutBodyEn: string;
  aboutPointsEn: string[];
  aboutHeadlineId: string;
  aboutBodyId: string;
  aboutPointsId: string[];
  contactHeadlineEn: string;
  contactBodyEn: string;
  contactHeadlineId: string;
  contactBodyId: string;
  contactNoteEn: string;
  contactNoteId: string;
  social: SocialLinks;
  faqs: FaqItem[];
};

export type LocalizedSitePages = {
  aboutHeadline: string;
  aboutBody: string;
  aboutPoints: string[];
  contactHeadline: string;
  contactBody: string;
  contactNote: string;
  contactEmail: string;
  social: SocialLinks;
  faqs: FaqItem[];
  locale: Locale;
};

export const DEFAULT_SITE_PAGES: SitePages = {
  aboutHeadlineEn: "One desk for every location.",
  aboutBodyEn:
    `${LEGAL_PRODUCT} is multi-location operations for owners and ops leads who run more than one outlet. HQ WhatsApp is the inbox and the member list. Stamps stay honest: join is daftar, a stamp is an approved receipt. Reviews sit with the same team.\n\nA group is optional — only if you run more than one brand. P2P Labs builds it. The merk stays the merk.`,
  aboutPointsEn: [
    "Inbox — one official HQ WhatsApp per brand. Branch phones can be watched, not replied from Atlas.",
    "Membership — join QR, then a real receipt. Prospect until that stamp.",
    "Loyalty — stamp, top spender, birthday. You set the gift. Kasir Redeem.",
    "Outlets — every branch, reviews included. Any industry with more than one door.",
  ],
  aboutHeadlineId: "Satu meja untuk setiap lokasi.",
  aboutBodyId:
    `${LEGAL_PRODUCT} adalah operasi multi-lokasi untuk owner dan kepala operasional yang pegang lebih dari satu outlet. WhatsApp HQ adalah inbox dan daftar member. Stamp jujur: daftar tetap daftar, stamp = struk yang di-Approve. Ulasan duduk di tim yang sama.\n\nGrup opsional — hanya kalau kamu pegang lebih dari satu merek. P2P Labs yang membangun. Merk tetap merk.`,
  aboutPointsId: [
    "Inbox — satu WhatsApp HQ resmi per merek. HP cabang bisa diawasi, tidak dibalas dari Atlas.",
    "Membership — QR daftar, lalu struk sah. Calon sampai stamp itu.",
    "Loyalty — stamp, top spender, ultah. Hadiah kamu yang tentukan. Kasir Redeem.",
    "Outlet — semua cabang, termasuk ulasan. Industri apa pun yang punya lebih dari satu pintu.",
  ],
  contactHeadlineEn: "Talk to us.",
  contactBodyEn: "Owners, ops leads, groups, and partners — write here. A person reads it.",
  contactHeadlineId: "Hubungi kami.",
  contactBodyId: "Owner, kepala operasional, grup, dan partner — tulis di sini. Orang yang membaca.",
  contactNoteEn: "No bot auto-reply.",
  contactNoteId: "Bukan bot auto-reply.",
  social: { ...DEFAULT_SOCIAL },
  faqs: DEFAULT_FAQ.map((f) => ({ ...f })),
};

function parsePoints(json: string | null | undefined, fallback: string[]): string[] {
  if (!json) return [...fallback];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      const points = parsed.map((s) => s.trim()).filter(Boolean);
      return points.length ? points : [...fallback];
    }
  } catch {
    /* fall through */
  }
  return [...fallback];
}

export function pointsFromText(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function rowToPages(row: {
  aboutHeadlineEn: string;
  aboutBodyEn: string;
  aboutPointsJsonEn: string;
  aboutHeadlineId: string;
  aboutBodyId: string;
  aboutPointsJsonId: string;
  contactHeadlineEn: string;
  contactBodyEn: string;
  contactHeadlineId: string;
  contactBodyId: string;
  contactNoteEn: string | null;
  contactNoteId: string | null;
  socialJson?: string | null;
  faqJson?: string | null;
}): SitePages {
  return {
    aboutHeadlineEn: row.aboutHeadlineEn,
    aboutBodyEn: row.aboutBodyEn,
    aboutPointsEn: parsePoints(row.aboutPointsJsonEn, DEFAULT_SITE_PAGES.aboutPointsEn),
    aboutHeadlineId: row.aboutHeadlineId,
    aboutBodyId: row.aboutBodyId,
    aboutPointsId: parsePoints(row.aboutPointsJsonId, DEFAULT_SITE_PAGES.aboutPointsId),
    contactHeadlineEn: row.contactHeadlineEn,
    contactBodyEn: row.contactBodyEn,
    contactHeadlineId: row.contactHeadlineId,
    contactBodyId: row.contactBodyId,
    contactNoteEn: row.contactNoteEn || DEFAULT_SITE_PAGES.contactNoteEn,
    contactNoteId: row.contactNoteId || DEFAULT_SITE_PAGES.contactNoteId,
    social: parseSocialJson(row.socialJson),
    faqs: parseFaqJson(row.faqJson),
  };
}

export function localizeSitePages(pages: SitePages, locale: Locale): LocalizedSitePages {
  if (locale === "id") {
    return {
      aboutHeadline: pages.aboutHeadlineId || pages.aboutHeadlineEn,
      aboutBody: pages.aboutBodyId || pages.aboutBodyEn,
      aboutPoints: pages.aboutPointsId.length ? pages.aboutPointsId : pages.aboutPointsEn,
      contactHeadline: pages.contactHeadlineId || pages.contactHeadlineEn,
      contactBody: pages.contactBodyId || pages.contactBodyEn,
      contactNote: pages.contactNoteId || pages.contactNoteEn,
      contactEmail: CONTACT_INBOX,
      social: pages.social,
      faqs: pages.faqs,
      locale,
    };
  }
  return {
    aboutHeadline: pages.aboutHeadlineEn,
    aboutBody: pages.aboutBodyEn,
    aboutPoints: pages.aboutPointsEn,
    contactHeadline: pages.contactHeadlineEn,
    contactBody: pages.contactBodyEn,
    contactNote: pages.contactNoteEn,
    contactEmail: CONTACT_INBOX,
    social: pages.social,
    faqs: pages.faqs,
    locale,
  };
}

function createPayload() {
  return {
    id: "default" as const,
    aboutHeadlineEn: DEFAULT_SITE_PAGES.aboutHeadlineEn,
    aboutBodyEn: DEFAULT_SITE_PAGES.aboutBodyEn,
    aboutPointsJsonEn: JSON.stringify(DEFAULT_SITE_PAGES.aboutPointsEn),
    aboutHeadlineId: DEFAULT_SITE_PAGES.aboutHeadlineId,
    aboutBodyId: DEFAULT_SITE_PAGES.aboutBodyId,
    aboutPointsJsonId: JSON.stringify(DEFAULT_SITE_PAGES.aboutPointsId),
    contactHeadlineEn: DEFAULT_SITE_PAGES.contactHeadlineEn,
    contactBodyEn: DEFAULT_SITE_PAGES.contactBodyEn,
    contactHeadlineId: DEFAULT_SITE_PAGES.contactHeadlineId,
    contactBodyId: DEFAULT_SITE_PAGES.contactBodyId,
    contactNoteEn: DEFAULT_SITE_PAGES.contactNoteEn,
    contactNoteId: DEFAULT_SITE_PAGES.contactNoteId,
    socialJson: JSON.stringify(DEFAULT_SITE_PAGES.social),
    faqJson: JSON.stringify(DEFAULT_SITE_PAGES.faqs),
  };
}

export async function getSitePages(): Promise<SitePages> {
  try {
    const row = await prisma.sitePageConfig.findUnique({ where: { id: "default" } });
    if (!row) return { ...DEFAULT_SITE_PAGES };
    return rowToPages(row);
  } catch {
    return { ...DEFAULT_SITE_PAGES };
  }
}

export async function getLocalizedSitePages(locale: Locale): Promise<LocalizedSitePages> {
  return localizeSitePages(await getSitePages(), locale);
}

export async function ensureSitePagesSeeded() {
  await prisma.sitePageConfig.upsert({
    where: { id: "default" },
    update: {},
    create: createPayload(),
  });
}

export type SitePagesUpdateInput = Partial<{
  aboutHeadlineEn: string;
  aboutBodyEn: string;
  aboutPointsEn: string[];
  aboutHeadlineId: string;
  aboutBodyId: string;
  aboutPointsId: string[];
  contactHeadlineEn: string;
  contactBodyEn: string;
  contactHeadlineId: string;
  contactBodyId: string;
  contactNoteEn: string;
  contactNoteId: string;
  social: Partial<Record<keyof SocialLinks, Partial<SocialItem> | string>>;
  faqs: FaqItem[];
}>;

export async function updateSitePages(input: SitePagesUpdateInput): Promise<SitePages> {
  await ensureSitePagesSeeded();
  const current = await getSitePages();

  const next = {
    aboutHeadlineEn: input.aboutHeadlineEn?.trim() || current.aboutHeadlineEn,
    aboutBodyEn: input.aboutBodyEn?.trim() || current.aboutBodyEn,
    aboutPointsJsonEn: JSON.stringify(input.aboutPointsEn ?? current.aboutPointsEn),
    aboutHeadlineId: input.aboutHeadlineId?.trim() || current.aboutHeadlineId,
    aboutBodyId: input.aboutBodyId?.trim() || current.aboutBodyId,
    aboutPointsJsonId: JSON.stringify(input.aboutPointsId ?? current.aboutPointsId),
    contactHeadlineEn: input.contactHeadlineEn?.trim() || current.contactHeadlineEn,
    contactBodyEn: input.contactBodyEn?.trim() || current.contactBodyEn,
    contactHeadlineId: input.contactHeadlineId?.trim() || current.contactHeadlineId,
    contactBodyId: input.contactBodyId?.trim() || current.contactBodyId,
    contactNoteEn:
      input.contactNoteEn === undefined ? current.contactNoteEn : input.contactNoteEn.trim(),
    contactNoteId:
      input.contactNoteId === undefined ? current.contactNoteId : input.contactNoteId.trim(),
    socialJson: JSON.stringify(
      input.social
        ? {
            instagram: mergeSocialItem("instagram", input.social.instagram, current.social.instagram),
            facebook: mergeSocialItem("facebook", input.social.facebook, current.social.facebook),
            threads: mergeSocialItem("threads", input.social.threads, current.social.threads),
            tiktok: mergeSocialItem("tiktok", input.social.tiktok, current.social.tiktok),
            x: mergeSocialItem("x", input.social.x, current.social.x),
          }
        : current.social
    ),
    faqJson: JSON.stringify(input.faqs !== undefined ? input.faqs : current.faqs),
  };

  const row = await prisma.sitePageConfig.update({
    where: { id: "default" },
    data: next,
  });
  return rowToPages(row);
}
