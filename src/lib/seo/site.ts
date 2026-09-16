import type { Metadata } from "next";
import { LEGAL_CONTACT_EMAIL, LEGAL_OPERATOR, LEGAL_PRODUCT, LEGAL_SITE } from "@/lib/legal/copy";

export const SITE_URL = LEGAL_SITE;
export const SITE_NAME = LEGAL_PRODUCT;
export const SITE_OPERATOR = LEGAL_OPERATOR;
export const SITE_EMAIL = LEGAL_CONTACT_EMAIL;
export const OG_IMAGE = "/brand/og-1200x630.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const BRAND_LOGO = "/brand/atlasnow_logo.png";

/** Public pages Google and AI engines may index. */
export const INDEXABLE_PATHS = [
  "/",
  "/about",
  "/contact",
  "/faq",
  "/pricing",
  "/privacy",
  "/cookies",
  "/terms",
  "/data-deletion",
  "/signup",
  "/help",
] as const;

export const ROBOTS_DISALLOW = [
  "/api/",
  "/control-tower",
  "/settings",
  "/conversations",
  "/loyalty",
  "/customers",
  "/locations",
  "/reports",
  "/broadcast",
  "/channels",
  "/clients",
  "/agencies",
  "/activity",
  "/action-center",
  "/ads",
  "/posts",
  "/reputation",
  "/data-health",
  "/leakage-queue",
  "/deck_pitch",
  "/deck_train",
  "/demo/",
  "/join/",
  "/card/",
  "/c/",
  "/i/",
  "/signup/pending",
] as const;

export function canonicalUrl(path: string): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean.replace(/\/+$/, "")}`;
}

export function publicMetadata(opts: {
  path: string;
  title: string;
  description: string;
  index?: boolean;
}): Metadata {
  const url = canonicalUrl(opts.path);
  const index = opts.index !== false;
  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: { canonical: url },
    robots: index
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: false },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title: opts.title,
      description: opts.description,
      locale: "en_US",
      images: [{ url: OG_IMAGE, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [OG_IMAGE],
    },
  };
}

export function homeTitle(): string {
  return `${SITE_NAME} — WhatsApp CRM, Google Business Profile, and outlet operations`;
}

export function homeDescription(): string {
  return "AtlasNow is a WhatsApp CRM and outlet operations desk for multi-location brands. Google Business Profile and Google Maps stay on the same desk. Revenue attribution comes from approved till receipts — not invented Maps visits or leads. Optimize Every Outlet. Capture More Demand.";
}
