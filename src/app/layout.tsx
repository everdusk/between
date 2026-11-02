import type { Metadata, Viewport } from "next";
import { Literata, Manrope } from "next/font/google";
import { ProductAnalyticsConfig } from "@/components/product-analytics-config";
import { SplashScreen } from "@/components/splash-screen";
import { LandingPage } from "@/components/landing-page";
import { LandingSurface } from "@/components/landing-surface";
import { SURFACE_BOOT_SCRIPT } from "@/lib/landing";
import { LAUNCH_THEME_SCRIPT, SPLASH_COVER_CSS } from "@/lib/launch-theme";
import { posthogBrowserConfig } from "@/lib/posthog-env";
import { SPLASH_CHROME } from "@/lib/telegram";
import "./globals.css";

const literata = Literata({
  variable: "--font-display",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Between — дневник к сеансу",
  description:
    "Пара слов боту, неделя складывается сама, и к разговору уже есть о чём говорить.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const posthog = posthogBrowserConfig({
    key: process.env.POSTHOG_KEY,
    host: process.env.POSTHOG_HOST,
  });
  return (
    <html
      lang="ru"
      data-splash=""
      className={`${literata.variable} ${manrope.variable} h-full antialiased`}
      style={{ backgroundColor: SPLASH_CHROME }}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: SPLASH_COVER_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SURFACE_BOOT_SCRIPT }} />
        <link rel="preload" href="/splash.webp" as="image" fetchPriority="high" />
      </head>
      <body className="flex h-full flex-col overflow-hidden font-sans">
        {posthog ? <ProductAnalyticsConfig token={posthog.token} host={posthog.host} /> : null}
        <LandingSurface />
        <SplashScreen />
        <LandingPage />
        <div className="app-root">{children}</div>
      </body>
    </html>
  );
}
