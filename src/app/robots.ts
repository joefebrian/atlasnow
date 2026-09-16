import type { MetadataRoute } from "next";
import { INDEXABLE_PATHS, ROBOTS_DISALLOW, SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [...INDEXABLE_PATHS],
        disallow: [...ROBOTS_DISALLOW],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: "atlasnow.co",
  };
}
