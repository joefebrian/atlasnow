import { DEFAULT_SOCIAL, socialList } from "@/lib/social";
import { SITE_EMAIL, SITE_NAME, SITE_OPERATOR, SITE_URL, homeDescription } from "./site";

export function organizationJsonLd() {
  const sameAs = socialList(DEFAULT_SOCIAL)
    .map((s) => s.href)
    .filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_OPERATOR,
    url: SITE_URL,
    email: SITE_EMAIL,
    brand: { "@type": "Brand", name: SITE_NAME },
    sameAs,
  };
}

export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: homeDescription(),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "IDR",
      description: "Free plan for one brand: join QR, stamps, receipt photo. No WhatsApp or Google APIs.",
    },
    publisher: { "@type": "Organization", name: SITE_OPERATOR, url: SITE_URL },
    featureList: [
      "Google Business Profile",
      "Google Maps",
      "WhatsApp CRM",
      "Outlet operations",
      "Revenue attribution from approved receipts",
    ],
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@type": "Organization", name: SITE_OPERATOR },
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
