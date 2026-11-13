import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingIncludes: {
    "/api/telegram/webhook": ["./public/welcome-flow.png"],
    "/api/telegram/introduce": ["./public/welcome-flow.png"],
    "/api/max/webhook": ["./public/welcome-flow.png"],
    "/api/telegram/digest": [
      "./public/fonts/Unbounded-SemiBold.ttf",
      "./public/fonts/Manrope-Regular.ttf",
      "./public/fonts/Manrope-SemiBold.ttf",
      "./public/fonts/NotoSansArabic-Regular.ttf",
      "./public/fonts/NotoSansDevanagari-Regular.ttf",
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
