import type { Metadata } from "next";

/** Public site. Apex redirects here, so search engines should keep a single address. */
export const LANDING_ORIGIN = "https://www.between-journal.ru";

export const LANDING_TITLE = "Between: дневник между сессиями терапии";

export const LANDING_DESCRIPTION =
  "Дневник в Telegram или MAX для тех, кто в терапии. Between сам спрашивает, как прошёл день, и к сессии собирает, что стоит рассказать.";

export const LANDING_OG_IMAGE = "/landing/og.png";

export const landingMetadata: Metadata = {
  metadataBase: new URL(LANDING_ORIGIN),
  title: { absolute: LANDING_TITLE },
  description: LANDING_DESCRIPTION,
  applicationName: "Between",
  keywords: [
    "дневник для терапии",
    "дневник между сессиями",
    "дневник в Telegram",
    "дневник в MAX",
    "психотерапия",
    "Between",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: LANDING_ORIGIN,
    siteName: "Between",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    images: [
      {
        url: LANDING_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: LANDING_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    images: [LANDING_OG_IMAGE],
  },
  // The journal has its own languages. Chrome's translate bar otherwise paints a faint "Google" strip on the dark page.
  other: { google: "notranslate" },
};

/** Structured data for the public page. The Mini App is the same document, so the graph stays about the site. */
export function landingJsonLd(): string {
  const url = `${LANDING_ORIGIN}/`;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Between",
        url,
        inLanguage: "ru",
        description: LANDING_DESCRIPTION,
      },
      {
        "@type": "WebPage",
        name: LANDING_TITLE,
        url,
        inLanguage: "ru",
        description: LANDING_DESCRIPTION,
        isPartOf: { "@type": "WebSite", name: "Between", url },
      },
    ],
  });
}
