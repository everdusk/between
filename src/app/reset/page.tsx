import type { Metadata } from "next";
import { ResetPassword } from "@/components/reset-password";

export const metadata: Metadata = {
  title: { absolute: "Новый пароль — Between" },
  description: "Задайте новый пароль для дневника Between.",
  robots: { index: false, follow: false },
};

export default function ResetPage() {
  return <ResetPassword />;
}
