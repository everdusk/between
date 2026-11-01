import type { Metadata, Viewport } from "next";
import { Literata, Manrope } from "next/font/google";
import { SplashScreen } from "@/components/splash-screen";
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
  description: "Дневник к сеансу.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      data-splash=""
      className={`${literata.variable} ${manrope.variable} h-full antialiased`}
      style={{ backgroundColor: SPLASH_CHROME }}
    >
      <head>
        <link rel="preload" href="/splash.webp" as="image" fetchPriority="high" />
      </head>
      <body className="flex h-full flex-col overflow-hidden font-sans">
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
