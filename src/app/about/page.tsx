import type { Metadata } from "next";
import { LANDING_ORIGIN, LANDING_TITLE, LANDING_DESCRIPTION } from "@/lib/landing-seo";

export const metadata: Metadata = {
  title: LANDING_TITLE,
  description: LANDING_DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { url: `${LANDING_ORIGIN}/about` },
};

export default function AboutPage() { return null; }
