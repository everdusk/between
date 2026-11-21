"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { InvoiceStatuses } from "@twa-dev/types";
import { WeekSkeleton } from "@/components/journal-skeleton";
import { LegalLinks } from "@/components/legal-links";
import { useI18n } from "@/components/locale-provider";
import { trackAnalytics } from "@/lib/analytics-client";
import { SubscribeCheckout } from "@/components/subscribe-checkout";
import { PremiumPaywall } from "@/components/premium-paywall";
import { Button } from "@/components/ui/button";
import {
  createWeekInvoice,
  fetchWeekAccess,
  postSessionWeekAccess,
  postWeekAccess,
} from "@/lib/week-access-client";
import {
  type PremiumPlan,
  type WeekAccessView,
} from "@/lib/week-access";

interface WeekTabProps {
  active: boolean;
  ready: boolean;
  inTelegram: boolean;
  inMax?: boolean;
  initData: string;
  maxInitData?: string;
  reloadToken?: number;
  onAccess?: (view: WeekAccessView) => void;
  children: ReactNode;
}

export function WeekTab({
  active,
  ready,
  inTelegram,
  inMax = false,
  initData,
  maxInitData = "",
  reloadToken = 0,
  onAccess,
  children,
}: WeekTabProps) {
  const { t, count } = useI18n();
  const [access, setAccess] = useState<WeekAccessView | null>(null);
  const [failedOpen, setFailedOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [payingPlan, setPayingPlan] = useState<PremiumPlan | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const onAccessRef = useRef(onAccess);
  const alive = useRef(true);

  useEffect(() => {
    onAccessRef.current = onAccess;
  }, [onAccess]);

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
    if (!ready || (inMax && !maxInitData)) return;
    let cancelled = false;
    async function start() {
      const opened = inTelegram
        ? (initData ? await postWeekAccess(initData, "open") : null)
        : await postSessionWeekAccess("open", maxInitData);
      if (cancelled) return;
      setFailedOpen(!opened);
      if (opened) publish(opened);
    }
    void start();
    return () => { cancelled = true; };
  }, [ready, inTelegram, inMax, initData, maxInitData, reloadToken, retry]);

  useEffect(() => {
    if (!active || !access || access.status === "locked") return;
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
    if (inMax) trackAnalytics("paywall", "");
    else window.location.replace("/subscribe");
  }, [active, inTelegram, inMax, initData, access?.status]);

  async function dismissIntro() {
    if (!access) return;
    const seen = inTelegram
      ? await postWeekAccess(initData, "seen")
      : await postSessionWeekAccess("seen", maxInitData);
    if (!alive.current) return;
    // Hiding the introduction may be local; granting access may not.
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
        void refreshAfterPay();
        return;
      }
      setPayingPlan(null);
      if (status === "failed") setPayError(t("payFail"));
    });
  }

  if (!access) {
    if (failedOpen) return (
      <section className="glass space-y-3 rounded-3xl p-6" role="alert">
        <p className="text-sm text-muted-foreground">{t("accessUnavailable")}</p>
        <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>{t("accessRetry")}</Button>
      </section>
    );
    return <WeekSkeleton />;
  }

  if (access.status === "locked" && inTelegram) {
    return <section className="glass rounded-3xl p-5"><PremiumPaywall access={access} inTelegram inMax={false} payingPlan={payingPlan} payError={payError} onPay={plan=>void pay(plan)}/><LegalLinks telegram className="mt-4 text-xs"/></section>;
  }
  if (access.status === "locked" && inMax) {
    return (
      <SubscribeCheckout
        embed
        surface={"max"}
        monthly={access.rubPrice}
        stars={inTelegram ? access.prices : null}
        onStarsPay={(plan) => void pay(plan)}
        starsBusy={payingPlan !== null}
        starsError={payError}
      />
    );
  }

  if (access.status === "locked") return null;

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
      {access.paused && (
        <p className="px-2 text-xs text-muted-foreground">{t("pausedLine")}</p>
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
