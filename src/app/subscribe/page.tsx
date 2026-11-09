import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SubscribeCheckout, SubscribeWithoutSession } from "@/components/subscribe-checkout";
import { SUBSCRIBE_LEAVE_SCRIPT } from "@/lib/subscribe-access";
import { SESSION_COOKIE, sessionSecret } from "@/lib/web-account";
import { accountFromSession } from "@/lib/web-account-store";
import { rubPriceFromEnv } from "@/lib/week-access";

export const metadata: Metadata = {
  title: { absolute: "Подписка Between" },
  description: "Премиум Between на месяц, 3 месяца или год. Оплата через СБП, чек на почту, без автопродления.",
  alternates: { canonical: "/subscribe" },
};

export default function SubscribePage() {
  return (
    <Suspense fallback={null}>
      <SubscribeEntry />
    </Suspense>
  );
}

async function SubscribeEntry() {
  const monthly = rubPriceFromEnv(process.env.WEEK_RUB_PRICE);
  const secret = sessionSecret();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = secret && token ? await accountFromSession(token, secret) : null;
  if (account) return <SubscribeCheckout monthly={monthly} />;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SUBSCRIBE_LEAVE_SCRIPT }} />
      <SubscribeWithoutSession monthly={monthly} />
    </>
  );
}
