import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: { absolute: "Политика конфиденциальности: Between" },
  description:
    "Политика конфиденциальности дневника Between для сайта и MAX. Самозанятая Ляторовская Анастасия Борисовна.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <LegalDocument kind="privacy" />;
}
