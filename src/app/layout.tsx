import type { Metadata, Viewport } from "next";
import { Literata, Manrope, Unbounded } from "next/font/google";
import { ProductAnalyticsConfig } from "@/components/product-analytics-config";
import { SplashScreen } from "@/components/splash-screen";
import { LandingPage } from "@/components/landing-page";
import { LandingSurface } from "@/components/landing-surface";
import { APP_SURFACE_CSS, SURFACE_BOOT_SCRIPT, WEB_SURFACE_CSS, YANDEX_METRIKA_NOSCRIPT, YANDEX_METRIKA_SCRIPT } from "@/lib/landing";
import { landingJsonLd, landingMetadata } from "@/lib/landing-seo";
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

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600", "700"],
});

/** `/journal` is the browser app. The boot script only looks at the Telegram hash, so this runs before Metrika. */
const JOURNAL_SURFACE_SCRIPT = `try{var p=location.pathname||"";if(p==="/journal"||p.indexOf("/journal/")===0){document.documentElement.setAttribute("data-between","app");document.documentElement.setAttribute("data-journal","web");var scheme="night";try{var saved=localStorage.getItem("between:scheme");if(saved==="day"||saved==="night")scheme=saved;}catch(e){}document.documentElement.setAttribute("data-scheme",scheme);var s=document.getElementById("between-surface");if(s)s.textContent=${JSON.stringify(APP_SURFACE_CSS)};}}catch(e){}`;

export const metadata: Metadata = landingMetadata;

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
      className={`${literata.variable} ${manrope.variable} ${unbounded.variable} h-full antialiased`}
      style={{ backgroundColor: SPLASH_CHROME }}
      suppressHydrationWarning
    >
      <head>
        <style id="between-surface" dangerouslySetInnerHTML={{ __html: WEB_SURFACE_CSS }} />
        <style dangerouslySetInnerHTML={{ __html: SPLASH_COVER_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SURFACE_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: JOURNAL_SURFACE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: YANDEX_METRIKA_SCRIPT }} />
        <link rel="preload" href="/splash.webp" as="image" fetchPriority="high" />
      </head>
      <body className="flex h-full flex-col overflow-hidden font-sans">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: landingJsonLd() }} />
        <noscript dangerouslySetInnerHTML={{ __html: YANDEX_METRIKA_NOSCRIPT }} />
        {posthog ? <ProductAnalyticsConfig token={posthog.token} host={posthog.host} /> : null}
        <LandingSurface />
        <SplashScreen />
        <LandingPage />
        <div className="app-root">{children}</div>
      </body>
    </html>
  );
}
