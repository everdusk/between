import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: { absolute: "Политика конфиденциальности — Between" },
  description:
    "Политика конфиденциальности дневника Between. Самозанятая Ляторовская Анастасия Борисовна, ИНН 770507475005.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <LegalDocument kind="privacy" />;
}
