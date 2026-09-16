import type { MetadataRoute } from "next";
import { HELP_ARTICLES, HELP_ORIGIN } from "@/lib/help/articles";
import { canonicalUrl, INDEXABLE_PATHS } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const main = INDEXABLE_PATHS.map((path) => ({
    url: canonicalUrl(path),
    lastModified,
    changeFrequency: (path === "/" || path === "/pricing" ? "weekly" : "monthly") as "weekly" | "monthly",
    priority: path === "/" ? 1 : path === "/pricing" ? 0.9 : path === "/signup" ? 0.6 : 0.8,
  }));
  const help = [
    {
      url: HELP_ORIGIN,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...HELP_ARTICLES.map((a) => ({
      url: `${HELP_ORIGIN}/${a.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
  return [...main, ...help];
}
