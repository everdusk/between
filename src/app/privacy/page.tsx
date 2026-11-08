import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import type { LegalSurface } from "@/lib/legal";

export const metadata: Metadata = {
  title: { absolute: "Политика конфиденциальности: Between" },
  description:
    "Политика конфиденциальности дневника Between для сайта и MAX. Самозанятая Ляторовская Анастасия Борисовна, ИНН 770507475005.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const params = await searchParams;
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const surface: LegalSurface = from === "telegram" ? "telegram" : "web";
  return <LegalDocument kind="privacy" surface={surface} />;
}
