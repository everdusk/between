import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: { absolute: "Условия использования — Between" },
  description:
    "Условия использования дневника Between. Самозанятая Ляторовская Анастасия Борисовна, ИНН 770507475005.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <LegalDocument kind="terms" />;
}
