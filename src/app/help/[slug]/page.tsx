import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticleView } from "@/components/help/HelpArticleView";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { getBranding } from "@/lib/branding";
import { localizeBranding } from "@/lib/branding-defaults";
import { HELP_ARTICLES, HELP_ORIGIN, helpArticle, tHelp } from "@/lib/help/articles";
import { getLocale } from "@/lib/i18n/get-locale";
import { readSession } from "@/lib/auth";
import { getSitePages } from "@/lib/site-pages";
import { publicMetadata } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = helpArticle(slug);
  if (!article) return { title: "Help" };
  const locale = await getLocale();
  return {
    ...publicMetadata({
      path: `/help/${article.slug}`,
      title: `${tHelp(article.title, locale)} · AtlasNow help`,
      description: tHelp(article.summary, locale),
    }),
    alternates: { canonical: `${HELP_ORIGIN}/${article.slug}` },
  };
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = helpArticle(slug);
  if (!article) notFound();
  const locale = await getLocale();
  const session = await readSession();
  const branding = localizeBranding(await getBranding(), locale);
  const { social } = await getSitePages();
  return (
    <MarketingChrome locale={locale} branding={branding} social={social} signedIn={Boolean(session)} padded={false}>
      <HelpArticleView article={article} locale={locale} />
    </MarketingChrome>
  );
}
