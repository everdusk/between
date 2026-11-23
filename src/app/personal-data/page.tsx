import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: { absolute: "Согласие на обработку персональных данных · Between" },
  description: "Какие данные Between обрабатывает, для чего они нужны и как отозвать согласие.",
  alternates: { canonical: "/personal-data" },
};

export default function PersonalDataPage() {
  return <LegalDocument kind="personal-data" />;
}
