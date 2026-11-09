import type { Metadata } from "next";
import { SubscribeGate } from "@/components/subscribe-checkout";
import { rubPriceFromEnv } from "@/lib/week-access";

export const metadata: Metadata = {
  title: { absolute: "Подписка Between" },
  description: "Премиум Between на месяц, 3 месяца или год. Оплата через СБП, чек на почту, без автопродления.",
  alternates: { canonical: "/subscribe" },
};

export default function SubscribePage() {
  return <SubscribeGate monthly={rubPriceFromEnv(process.env.WEEK_RUB_PRICE)} />;
}
