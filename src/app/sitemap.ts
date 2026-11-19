import type { MetadataRoute } from "next";
import { LANDING_ORIGIN } from "@/lib/landing-seo";
import { guides } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...Object.values(guides).map(({ path }) => ({ url: LANDING_ORIGIN + path })),
    {
      url: `${LANDING_ORIGIN}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
