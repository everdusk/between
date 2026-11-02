import type { MetadataRoute } from "next";
import { LANDING_ORIGIN } from "@/lib/landing-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${LANDING_ORIGIN}/sitemap.xml`,
    host: LANDING_ORIGIN,
  };
}
