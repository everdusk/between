import type { Metadata } from "next";
import { DeleteData } from "@/components/delete-data";

export const metadata: Metadata = {
  title: { absolute: "Удаление данных — Between" },
  description: "Полное удаление дневника Between: заметки, вход и связка с Telegram.",
  alternates: { canonical: "/delete" },
  robots: { index: true, follow: true },
};

export default function DeletePage() {
  return <DeleteData />;
}
