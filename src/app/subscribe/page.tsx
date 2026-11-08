import type { Metadata } from "next";
import { SubscribeCheckout } from "@/components/subscribe-checkout";

export const metadata: Metadata = {
  title: { absolute: "Подписка Between" },
  description: "Премиум Between на месяц, 3 месяца или год. Оплата через СБП, чек на почту, без автопродления.",
  alternates: { canonical: "/subscribe" },
};

export default function SubscribePage() {
  return <SubscribeCheckout />;
}
