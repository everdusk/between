"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { InvoiceStatuses } from "@twa-dev/types";
import { Lock } from "lucide-react";
import { WeekSkeleton } from "@/components/journal-skeleton";
import { LegalLinks } from "@/components/legal-links";
import { useI18n } from "@/components/locale-provider";
import { trackAnalytics } from "@/lib/analytics-client";
import { SubscribeCheckout } from "@/components/subscribe-checkout";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  createWeekInvoice,
  fetchWeekAccess,
  postSessionWeekAccess,
  postWeekAccess,
  readLocalWeekAccess,
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
  /** Site session or MAX. A logged-out browser has no SBP checkout. */
  canSubscribe: boolean;
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
  canSubscribe,
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
        : await postSessionWeekAccess("open", inMax ? undefined : readLocalWeekAccess(), maxInitData);
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
    trackAnalytics("paywall", "");
  }, [active, inTelegram, initData, access?.status]);

  async function dismissIntro() {
    if (!access) return;
    const seen = inTelegram
      ? await postWeekAccess(initData, "seen")
      : await postSessionWeekAccess("seen", undefined, maxInitData);
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

  if (access.status === "locked" && (inTelegram || inMax)) {
    return (
      <SubscribeCheckout
        embed
        monthly={access.rubPrice}
        stars={inTelegram ? access.prices : null}
        onStarsPay={(plan) => void pay(plan)}
        starsBusy={payingPlan !== null}
        starsError={payError}
      />
    );
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
              {t("webWeekPaywall", { price: access.rubPrice })}
            </p>
            <div className="space-y-3">
              {canSubscribe ? (
                <a
                  href="/subscribe"
                  className={buttonVariants({
                    size: "lg",
                    className: "w-full bg-ink-foreground text-ink hover:bg-ink-foreground/90",
                  })}
                >
                  {t("sbpBuy")}
                </a>
              ) : null}
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
