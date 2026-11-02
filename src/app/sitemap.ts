import type { MetadataRoute } from "next";
import { LANDING_ORIGIN } from "@/lib/landing-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${LANDING_ORIGIN}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
