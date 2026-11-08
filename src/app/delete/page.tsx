import type { Metadata } from "next";
import { DeleteData } from "@/components/delete-data";

export const metadata: Metadata = {
  title: { absolute: "Удалить дневник: Between" },
  description: "Полное удаление дневника Between: заметки, вход и связанные Telegram и MAX.",
  robots: { index: false, follow: false },
};

export default function DeletePage() {
  return <DeleteData />;
}
