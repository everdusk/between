"use client";

import { useId, useState } from "react";
import "./subscribe-checkout.css";
import { Star } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPremiumStatus } from "@/lib/messages";
import { LEGAL_INN } from "@/lib/legal";
import type { PremiumPlan, WeekAccessView } from "@/lib/week-access";

const PLANS = ["month", "quarter", "year"] as const satisfies readonly PremiumPlan[];

/** The premium block from the account sheet. Telegram pays in Stars, MAX and the site in rubles. */
export function PremiumPaywall({
  access,
  unavailable = false,
  inTelegram,
  inMax,
  canSubscribe = false,
  payingPlan,
  payError,
  onPay,
}: {
  access: WeekAccessView | null;
  unavailable?: boolean;
  inTelegram: boolean;
  inMax: boolean;
  canSubscribe?: boolean;
  payingPlan: PremiumPlan | null;
  payError: string | null;
  onPay: (plan: PremiumPlan) => void;
}) {
  const { t, locale } = useI18n();
  const premiumText = access ? formatPremiumStatus(locale, access) : t(unavailable ? "accessUnavailable" : "loading");

  const [selected, setSelected] = useState<PremiumPlan>("month");
  const radioName = useId();
  function duration(plan: PremiumPlan) {
    const unit = plan === "year" ? "year" : "month";
    return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(plan === "quarter" ? 3 : 1);
  }

  const showSbp = !inTelegram && (canSubscribe || inMax);

  return (
    <section className="space-y-3">
      <h3 className="paywall-heading font-display text-lg tracking-tight text-foreground">{t("premiumMark")}</h3>
      {inTelegram && access && access.premium !== "forever" && (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-muted-foreground">{t("webLead")}</p>
        </div>
      )}
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{premiumText}</p>
      {access && access.premium !== "forever" ? (
        <div className="space-y-2">
          {inTelegram
            ? (<>
                <fieldset className="space-y-2" disabled={payingPlan !== null}>
                  <legend className="sr-only">{t("premiumMark")}</legend>
                  {PLANS.map(plan => (
                    <label key={plan} className={selected === plan ? "sub-plan sub-plan-on" : "sub-plan"}>
                      <input type="radio" name={radioName} checked={selected === plan} onChange={() => setSelected(plan)} />
                      <span>{duration(plan)}</span>
                      <strong className="ms-auto whitespace-nowrap">{access.prices[plan]} Stars</strong>
                    </label>
                  ))}
                </fieldset>
                {selected === "month" && <p className="text-xs text-muted-foreground">{t("starsRenewal")}</p>}
                <Button data-confirm="" type="button" className="w-full" disabled={payingPlan !== null} onClick={() => onPay(selected)}>
                  <Star aria-hidden />{t(payingPlan ? "paying" : "payInTelegram")}
                </Button>
                {locale === "ru" && <p className="mt-5 text-center text-xs text-muted-foreground">ИНН {LEGAL_INN}</p>}
              </>)
            : showSbp ? (
                <a data-confirm="" href="/subscribe" className={buttonVariants({ className: "w-full" })}>
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
