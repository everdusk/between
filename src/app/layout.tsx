import type { Metadata, Viewport } from "next";
import { Literata, Manrope } from "next/font/google";
import { SplashScreen } from "@/components/splash-screen";
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
      className={`${literata.variable} ${manrope.variable} h-full antialiased`}
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
