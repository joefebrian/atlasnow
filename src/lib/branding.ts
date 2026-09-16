import { prisma } from "@/lib/db";
import {
  DEFAULT_BRANDING,
  DEFAULT_FLOW_STEPS,
  DEFAULT_FLOW_STEPS_ID,
  isStaleBrandingStory,
  localizeBranding,
  type Branding,
  type LocalizedBranding,
} from "@/lib/branding-defaults";
import type { Locale } from "@/lib/i18n/locale";

export type { Branding, LocalizedBranding };
export {
  DEFAULT_BRANDING,
  DEFAULT_FLOW_STEPS,
  DEFAULT_FLOW_STEPS_ID,
  localizeBranding,
};

function parseFlow(
  json: string | null | undefined,
  fallback: readonly string[]
): string[] {
  if (!json) return [...fallback];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      const steps = parsed.map((s) => s.trim()).filter(Boolean);
      return steps.length > 0 ? steps : [...fallback];
    }
  } catch {
    /* fall through */
  }
  return [...fallback];
}

type BrandingRow = {
  appName: string;
  logoUrl: string | null;
  logoLetter: string;
  tagline: string;
  heroHeadline: string;
  supportingNarrative: string;
  productPromise: string;
  flowStepsJson: string;
  taglineId: string | null;
  heroHeadlineId: string | null;
  supportingNarrativeId: string | null;
  productPromiseId: string | null;
  flowStepsJsonId: string | null;
  supportEmail: string | null;
  primaryColor: string;
};

export function rowToBranding(row: BrandingRow): Branding {
  return {
    appName: row.appName,
    logoUrl: row.logoUrl,
    logoLetter: row.logoLetter || "A",
    tagline: row.tagline,
    heroHeadline: row.heroHeadline,
    supportingNarrative: row.supportingNarrative,
    productPromise: row.productPromise,
    flowSteps: parseFlow(row.flowStepsJson, DEFAULT_FLOW_STEPS),
    taglineId: row.taglineId || DEFAULT_BRANDING.taglineId,
    heroHeadlineId: row.heroHeadlineId || DEFAULT_BRANDING.heroHeadlineId,
    supportingNarrativeId:
      row.supportingNarrativeId || DEFAULT_BRANDING.supportingNarrativeId,
    productPromiseId: row.productPromiseId || DEFAULT_BRANDING.productPromiseId,
    flowStepsId: parseFlow(row.flowStepsJsonId, DEFAULT_FLOW_STEPS_ID),
    supportEmail: row.supportEmail,
    primaryColor: row.primaryColor || "#4f46e5",
  };
}

export async function getBranding(): Promise<Branding> {
  try {
    const row = await prisma.brandingConfig.findUnique({ where: { id: "default" } });
    if (!row) {
      return {
        ...DEFAULT_BRANDING,
        flowSteps: [...DEFAULT_FLOW_STEPS],
        flowStepsId: [...DEFAULT_FLOW_STEPS_ID],
      };
    }
    const current = rowToBranding(row as BrandingRow);
    if (!isStaleBrandingStory(current)) return current;
    const healed = await prisma.brandingConfig.update({
      where: { id: "default" },
      data: {
        tagline: DEFAULT_BRANDING.tagline,
        heroHeadline: DEFAULT_BRANDING.heroHeadline,
        supportingNarrative: DEFAULT_BRANDING.supportingNarrative,
        productPromise: DEFAULT_BRANDING.productPromise,
        flowStepsJson: JSON.stringify(DEFAULT_BRANDING.flowSteps),
        taglineId: DEFAULT_BRANDING.taglineId,
        heroHeadlineId: DEFAULT_BRANDING.heroHeadlineId,
        supportingNarrativeId: DEFAULT_BRANDING.supportingNarrativeId,
        productPromiseId: DEFAULT_BRANDING.productPromiseId,
        flowStepsJsonId: JSON.stringify(DEFAULT_BRANDING.flowStepsId),
      },
    });
    return rowToBranding(healed as BrandingRow);
  } catch {
    return {
      ...DEFAULT_BRANDING,
      flowSteps: [...DEFAULT_FLOW_STEPS],
      flowStepsId: [...DEFAULT_FLOW_STEPS_ID],
    };
  }
}

export async function getLocalizedBranding(locale: Locale): Promise<LocalizedBranding> {
  const branding = await getBranding();
  return localizeBranding(branding, locale);
}

export async function ensureBrandingSeeded() {
  await prisma.brandingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      appName: DEFAULT_BRANDING.appName,
      logoUrl: null,
      logoLetter: DEFAULT_BRANDING.logoLetter,
      tagline: DEFAULT_BRANDING.tagline,
      heroHeadline: DEFAULT_BRANDING.heroHeadline,
      supportingNarrative: DEFAULT_BRANDING.supportingNarrative,
      productPromise: DEFAULT_BRANDING.productPromise,
      flowStepsJson: JSON.stringify(DEFAULT_BRANDING.flowSteps),
      taglineId: DEFAULT_BRANDING.taglineId,
      heroHeadlineId: DEFAULT_BRANDING.heroHeadlineId,
      supportingNarrativeId: DEFAULT_BRANDING.supportingNarrativeId,
      productPromiseId: DEFAULT_BRANDING.productPromiseId,
      flowStepsJsonId: JSON.stringify(DEFAULT_BRANDING.flowStepsId),
      supportEmail: DEFAULT_BRANDING.supportEmail,
      primaryColor: DEFAULT_BRANDING.primaryColor,
    },
  });
}

export type BrandingUpdateInput = {
  appName?: string;
  logoUrl?: string | null;
  logoLetter?: string;
  tagline?: string;
  heroHeadline?: string;
  supportingNarrative?: string;
  productPromise?: string;
  flowSteps?: string[];
  taglineId?: string;
  heroHeadlineId?: string;
  supportingNarrativeId?: string;
  productPromiseId?: string;
  flowStepsId?: string[];
  supportEmail?: string | null;
  primaryColor?: string;
};

const MAX_LOGO_CHARS = 900_000;

export async function updateBranding(input: BrandingUpdateInput): Promise<Branding> {
  await ensureBrandingSeeded();
  const current = await getBranding();

  const logoUrl =
    input.logoUrl === undefined
      ? current.logoUrl
      : input.logoUrl === null || input.logoUrl === ""
        ? null
        : input.logoUrl.length > MAX_LOGO_CHARS
          ? current.logoUrl
          : input.logoUrl;

  const flowSteps =
    input.flowSteps && input.flowSteps.length > 0
      ? input.flowSteps.map((s) => s.trim()).filter(Boolean).slice(0, 8)
      : current.flowSteps;

  const flowStepsId =
    input.flowStepsId && input.flowStepsId.length > 0
      ? input.flowStepsId.map((s) => s.trim()).filter(Boolean).slice(0, 8)
      : current.flowStepsId;

  const row = await prisma.brandingConfig.update({
    where: { id: "default" },
    data: {
      appName: (input.appName ?? current.appName).trim() || "AtlasNow",
      logoUrl,
      logoLetter: ((input.logoLetter ?? current.logoLetter).trim() || "A").slice(0, 2),
      tagline: (input.tagline ?? current.tagline).trim(),
      heroHeadline: (input.heroHeadline ?? current.heroHeadline).trim(),
      supportingNarrative: (
        input.supportingNarrative ?? current.supportingNarrative
      ).trim(),
      productPromise: (input.productPromise ?? current.productPromise).trim(),
      flowStepsJson: JSON.stringify(flowSteps),
      taglineId: (input.taglineId ?? current.taglineId).trim(),
      heroHeadlineId: (input.heroHeadlineId ?? current.heroHeadlineId).trim(),
      supportingNarrativeId: (
        input.supportingNarrativeId ?? current.supportingNarrativeId
      ).trim(),
      productPromiseId: (input.productPromiseId ?? current.productPromiseId).trim(),
      flowStepsJsonId: JSON.stringify(flowStepsId),
      supportEmail:
        input.supportEmail === undefined
          ? current.supportEmail
          : input.supportEmail?.trim() || null,
      primaryColor: (input.primaryColor ?? current.primaryColor).trim() || "#4f46e5",
    },
  });

  return rowToBranding(row as BrandingRow);
}
