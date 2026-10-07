import type { Metadata } from "next";
import { Literata, Manrope } from "next/font/google";
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
  title: "Therapy Helper — дневник к сеансу",
  description:
    "Личный дневник для подготовки к психотерапии: ежедневные записи, недельный обзор и итоги сеанса.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${literata.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
