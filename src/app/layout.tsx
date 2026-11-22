import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { ProductAnalyticsConfig } from "@/components/product-analytics-config";
import { SplashScreen } from "@/components/splash-screen";
import { LandingSurface } from "@/components/landing-surface";
import { JOURNAL_SURFACE_SCRIPT, SURFACE_BOOT_SCRIPT, WEB_SURFACE_CSS, YANDEX_METRIKA_NOSCRIPT, YANDEX_METRIKA_SCRIPT } from "@/lib/landing";
import { landingMetadata } from "@/lib/landing-seo";
import { LAUNCH_THEME_SCRIPT, SPLASH_COVER_CSS } from "@/lib/launch-theme";
import { MAX_LAUNCH_BOOT_SCRIPT } from "@/lib/max-webapp";
import { posthogBrowserConfig } from "@/lib/posthog-env";
import "./globals.css";
import "@/components/brand.css";
import "./dawn.css";

export const metadata: Metadata = landingMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
  landing,
}: LayoutProps<"/"> & { landing: ReactNode }) {
  const posthog = posthogBrowserConfig({
    key: process.env.POSTHOG_KEY,
    host: process.env.POSTHOG_HOST,
  });
  return (
    <html
      lang="ru"
      translate="no"
      data-splash=""
      data-design="dawn" className="notranslate h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <style id="between-surface" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: WEB_SURFACE_CSS }} />
        <style dangerouslySetInnerHTML={{ __html: SPLASH_COVER_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: MAX_LAUNCH_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SURFACE_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: JOURNAL_SURFACE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: YANDEX_METRIKA_SCRIPT }} />
        <link rel="preload" href="/between-raccoon-mark.svg" as="image" fetchPriority="high" />
      </head>
      <body className="flex h-full flex-col overflow-hidden font-sans">
        <noscript dangerouslySetInnerHTML={{ __html: YANDEX_METRIKA_NOSCRIPT }} />
        {posthog ? <ProductAnalyticsConfig token={posthog.token} host={posthog.host} /> : null}
        <LandingSurface />
        <SplashScreen />
        {landing}
        <div className="app-root">{children}</div>
      </body>
    </html>
  );
}
