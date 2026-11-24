import type { MetadataRoute } from "next";
import { LANDING_ORIGIN } from "@/lib/landing-seo";
import { guideIndex, guides } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: LANDING_ORIGIN + guideIndex.path },
    ...Object.values(guides).map(({ path }) => ({ url: LANDING_ORIGIN + path })),
    {
      url: `${LANDING_ORIGIN}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
