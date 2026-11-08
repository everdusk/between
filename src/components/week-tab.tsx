"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { InvoiceStatuses } from "@twa-dev/types";
import { Lock, Star } from "lucide-react";
import { WeekSkeleton } from "@/components/journal-skeleton";
import { LegalLinks } from "@/components/legal-links";
import { useI18n } from "@/components/locale-provider";
import { trackAnalytics } from "@/lib/analytics-client";
import { captureProduct } from "@/lib/product-analytics";
import { Button } from "@/components/ui/button";
import {
  createWeekInvoice,
  fetchWeekAccess,
  localWeekView,
  postSessionWeekAccess,
  postWeekAccess,
  readLocalWeekAccess,
  writeLocalWeekAccess,
} from "@/lib/week-access-client";
import {
  markWeekIntroSeen,
  openWeekAccess,
  planPrice,
  type PremiumPlan,
  type WeekAccessView,
} from "@/lib/week-access";

interface WeekTabProps {
  active: boolean;
  ready: boolean;
  inTelegram: boolean;
  initData: string;
  reloadToken?: number;
  onAccess?: (view: WeekAccessView) => void;
  children: ReactNode;
}

const PLANS = ["month", "quarter", "year"] as const satisfies readonly PremiumPlan[];

export function WeekTab({
  active,
  ready,
  inTelegram,
  initData,
  reloadToken = 0,
  onAccess,
  children,
}: WeekTabProps) {
  const { t, count } = useI18n();
  const [access, setAccess] = useState<WeekAccessView | null>(null);
  const [failedOpen, setFailedOpen] = useState(false);
  const [payingPlan, setPayingPlan] = useState<PremiumPlan | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const onAccessRef = useRef(onAccess);
  onAccessRef.current = onAccess;
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function publish(view: WeekAccessView) {
    setAccess(view);
    onAccessRef.current?.(view);
  }

  useEffect(() => {
    if (!ready || inTelegram) return;
    let cancelled = false;

    async function start() {
      const opened = await postSessionWeekAccess("open", readLocalWeekAccess());
      if (cancelled) return;
      if (!opened) {
        const next = openWeekAccess(readLocalWeekAccess(), new Date());
        writeLocalWeekAccess(next);
        publish(localWeekView(next));
        return;
      }
      publish(opened);
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [ready, inTelegram, reloadToken]);

  useEffect(() => {
    if (!ready || !inTelegram) return;
    let cancelled = false;

    async function start() {
      if (!initData) {
        if (!cancelled) setFailedOpen(true);
        return;
      }
      const opened = await postWeekAccess(initData, "open");
      if (cancelled) return;
      if (!opened) {
        setFailedOpen(true);
        return;
      }
      publish(opened);
      setFailedOpen(false);
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [ready, inTelegram, initData, reloadToken]);

  useEffect(() => {
    if (!active || !access) return;
    if (inTelegram) {
      if (initData) trackAnalytics("week", initData);
      return;
    }
    trackAnalytics("week", "");
  }, [active, inTelegram, initData, access]);

  useEffect(() => {
    if (!active || access?.status !== "locked") return;
    if (inTelegram) {
      if (initData) trackAnalytics("paywall", initData);
      return;
    }
    trackAnalytics("paywall", "");
  }, [active, inTelegram, initData, access?.status]);

  async function dismissIntro() {
    if (!access) return;
    if (!inTelegram) {
      const seen = await postSessionWeekAccess("seen");
      if (!alive.current) return;
      if (seen) {
        publish(seen);
        return;
      }
      const next = markWeekIntroSeen(readLocalWeekAccess());
      writeLocalWeekAccess(next);
      publish(localWeekView(next));
      return;
    }
    const seen = await postWeekAccess(initData, "seen");
    if (!alive.current) return;
    publish(seen ?? { ...access, introSeen: true });
  }

  async function refreshAfterPay() {
    const first = await fetchWeekAccess(initData);
    if (!alive.current) return;
    if (first && first.status !== "locked") {
      publish(first);
      setPayingPlan(null);
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    const second = await fetchWeekAccess(initData);
    if (!alive.current) return;
    if (second) publish(second);
    setPayingPlan(null);
    if (!second || second.status === "locked") {
      setPayError(t("payPending"));
    }
  }

  async function pay(plan: PremiumPlan) {
    if (!inTelegram || !initData || payingPlan) return;
    setPayingPlan(plan);
    setPayError(null);
    const url = await createWeekInvoice(initData, plan);
    if (!alive.current) return;
    if (!url) {
      setPayingPlan(null);
      setPayError(t("payFail"));
      return;
    }
    trackAnalytics("checkout", initData, { plan });
    const webApp = (await import("@twa-dev/sdk")).default;
    webApp.openInvoice(url, (status: InvoiceStatuses) => {
      if (!alive.current) return;
      if (status === "paid") {
        captureProduct("paid", { plan });
        void refreshAfterPay();
        return;
      }
      setPayingPlan(null);
      if (status === "failed") setPayError(t("payFail"));
    });
  }

  function planLabel(plan: PremiumPlan, price: number) {
    if (payingPlan === plan) return t("paying");
    if (plan === "quarter") return t("payQuarter", { price });
    if (plan === "year") return t("payYear", { price });
    return t("payStars", { price });
  }

  function rubLabel(plan: PremiumPlan, monthly: number) {
    const price = planPrice(monthly, plan);
    if (plan === "quarter") return t("webWeekQuarter", { price });
    if (plan === "year") return t("webWeekYear", { price });
    return t("webWeekMonth", { price });
  }

  if (!access) {
    if (failedOpen) return <>{children}</>;
    return <WeekSkeleton />;
  }

  if (access.status === "locked") {
    return (
      <div className="space-y-4">
        <div className="space-y-2 px-2 pt-1 pb-1">
          <p className="eyebrow text-section-header">{t("weekTitle")}</p>
        </div>
        <section className="ink relative overflow-hidden rounded-3xl p-6 sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -end-16 size-64 rounded-full bg-ink-foreground/[0.07] blur-2xl"
          />
          <div className="relative space-y-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-ink-foreground/10">
              <Lock aria-hidden className="size-5 text-ink-foreground" />
            </div>
            <p className="font-display text-[1.5rem] leading-snug tracking-tight text-ink-foreground">
              {inTelegram
                ? t("paywallBody", { price: access.starPrice })
                : t("webWeekPaywall", { price: access.rubPrice })}
            </p>
            <div className="space-y-3">
              {inTelegram
                ? PLANS.map((plan) => (
                    <Button
                      key={plan}
                      type="button"
                      size="lg"
                      className="w-full bg-ink-foreground text-ink hover:bg-ink-foreground/90"
                      disabled={payingPlan !== null}
                      onClick={() => void pay(plan)}
                    >
                      <Star aria-hidden />
                      {planLabel(plan, access.prices[plan])}
                    </Button>
                  ))
                : PLANS.map((plan) => (
                    <p
                      key={plan}
                      className="rounded-full bg-ink-foreground px-4 py-3 text-center text-sm font-medium text-ink"
                    >
                      {rubLabel(plan, access.rubPrice)}
                    </p>
                  ))}
              {payError && (
                <p className="text-sm text-ink-muted" role="alert">
                  {payError}
                </p>
              )}
              <LegalLinks className="text-center text-xs leading-relaxed text-ink-foreground/80" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  const showIntro = !access.introSeen && (access.status === "trial" || access.status === "new");
  const introDays = access.daysLeft > 0 ? access.daysLeft : 7;

  return (
    <div className="space-y-4">
      {showIntro && (
        <section className="glass flex flex-col gap-5 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-sm leading-relaxed text-foreground/90 sm:text-base">
            {inTelegram
              ? t("intro", { days: count(introDays, "day"), price: access.starPrice })
              : t("webWeekIntro", { days: count(introDays, "day"), price: access.rubPrice })}
          </p>
          <Button type="button" variant="ink" className="shrink-0" onClick={() => void dismissIntro()}>
            {t("introOk")}
          </Button>
        </section>
      )}
      {access.status === "trial" && access.introSeen && (
        <p className="px-2 text-xs text-muted-foreground">
          {inTelegram
            ? t("trialLine", {
                days: count(access.daysLeft, "day"),
                price: access.starPrice,
              })
            : t("webWeekTrial", {
                days: count(access.daysLeft, "day"),
                price: access.rubPrice,
              })}
        </p>
      )}
      {children}
    </div>
  );
}
