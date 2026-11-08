import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import type { LegalSurface } from "@/lib/legal";

export const metadata: Metadata = {
  title: { absolute: "Условия использования: Between" },
  description:
    "Условия использования дневника Between для сайта и MAX. Самозанятая Ляторовская Анастасия Борисовна, ИНН 770507475005.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const params = await searchParams;
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const surface: LegalSurface = from === "telegram" ? "telegram" : "web";
  return <LegalDocument kind="terms" surface={surface} />;
}
