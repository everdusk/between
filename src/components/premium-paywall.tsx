"use client";

import { Star } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPremiumStatus } from "@/lib/messages";
import type { PremiumPlan, WeekAccessView } from "@/lib/week-access";

const PLANS = ["month", "quarter", "year"] as const satisfies readonly PremiumPlan[];

/** The premium block from the account sheet. Telegram pays in Stars, MAX and the site in rubles. */
export function PremiumPaywall({
  access,
  inTelegram,
  inMax,
  canSubscribe = false,
  payingPlan,
  payError,
  onPay,
}: {
  access: WeekAccessView | null;
  inTelegram: boolean;
  inMax: boolean;
  canSubscribe?: boolean;
  payingPlan: PremiumPlan | null;
  payError: string | null;
  onPay: (plan: PremiumPlan) => void;
}) {
  const { t, locale } = useI18n();
  const premiumText = access ? formatPremiumStatus(locale, access) : t("loading");

  function planLabel(plan: PremiumPlan, price: number) {
    if (payingPlan === plan) return t("paying");
    if (plan === "quarter") return t("payQuarter", { price });
    if (plan === "year") return t("payYear", { price });
    return t("payStars", { price });
  }

  const showSbp = !inTelegram && (canSubscribe || inMax);

  return (
    <section className="space-y-3">
      <h3 className="font-display text-lg tracking-tight text-foreground">{t("premiumMark")}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{premiumText}</p>
      {access && access.premium !== "forever" ? (
        <div className="space-y-2">
          {inTelegram
            ? PLANS.map((plan) => (
                <Button
                  key={plan}
                  type="button"
                  className="w-full"
                  disabled={payingPlan !== null}
                  onClick={() => onPay(plan)}
                >
                  <Star aria-hidden />
                  {planLabel(plan, access.prices[plan])}
                </Button>
              ))
            : showSbp ? (
                <a href="/subscribe" className={buttonVariants({ className: "w-full" })}>
                  {t("sbpBuy")}
                </a>
              ) : null}
          {payError ? (
            <p className="text-sm text-destructive" role="alert">
              {payError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
