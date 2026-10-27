"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { InvoiceStatuses } from "@twa-dev/types";
import { Lock, Star } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  createWeekInvoice,
  fetchWeekAccess,
  localWeekView,
  postWeekAccess,
  readLocalWeekAccess,
  writeLocalWeekAccess,
} from "@/lib/week-access-client";
import {
  markWeekIntroSeen,
  openWeekAccess,
  type WeekAccessView,
} from "@/lib/week-access";

interface WeekTabProps {
  active: boolean;
  ready: boolean;
  inTelegram: boolean;
  initData: string;
  children: ReactNode;
}

export function WeekTab({
  active,
  ready,
  inTelegram,
  initData,
  children,
}: WeekTabProps) {
  const { t, count } = useI18n();
  const [access, setAccess] = useState<WeekAccessView | null>(null);
  const [failedOpen, setFailedOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!active || !ready) return;
    if (inTelegram) return;
    const next = openWeekAccess(readLocalWeekAccess(), new Date());
    writeLocalWeekAccess(next);
    // Local preview has no server round-trip; apply it before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage once the week tab is open
    setAccess(localWeekView(next));
    setFailedOpen(false);
  }, [active, ready, inTelegram]);

  useEffect(() => {
    if (!active || !ready || !inTelegram) return;
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
      setAccess(opened);
      setFailedOpen(false);
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [active, ready, inTelegram, initData]);

  async function dismissIntro() {
    if (!access) return;
    if (!inTelegram) {
      const next = markWeekIntroSeen(readLocalWeekAccess());
      writeLocalWeekAccess(next);
      setAccess(localWeekView(next));
      return;
    }
    const seen = await postWeekAccess(initData, "seen");
    if (!alive.current) return;
    setAccess(seen ?? { ...access, introSeen: true });
  }

  async function refreshAfterPay() {
    const first = await fetchWeekAccess(initData);
    if (!alive.current) return;
    if (first && first.status !== "locked") {
      setAccess(first);
      setPaying(false);
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    const second = await fetchWeekAccess(initData);
    if (!alive.current) return;
    if (second) setAccess(second);
    setPaying(false);
    if (!second || second.status === "locked") {
      setPayError(t("payPending"));
    }
  }

  async function pay() {
    if (!inTelegram || !initData || paying) return;
    setPaying(true);
    setPayError(null);
    const url = await createWeekInvoice(initData);
    if (!alive.current) return;
    if (!url) {
      setPaying(false);
      setPayError(t("payFail"));
      return;
    }
    const webApp = (await import("@twa-dev/sdk")).default;
    webApp.openInvoice(url, (status: InvoiceStatuses) => {
      if (!alive.current) return;
      if (status === "paid") {
        void refreshAfterPay();
        return;
      }
      setPaying(false);
      if (status === "failed") setPayError(t("payFail"));
    });
  }

  if (!access) {
    if (failedOpen) return <>{children}</>;
    return (
      <div className="glass rounded-3xl px-6 py-14 text-center" role="status">
        <div className="mx-auto mb-4 h-1 w-28 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div className="loading-bar h-full w-1/2 rounded-full bg-primary/70" />
        </div>
        <p className="text-sm text-muted-foreground">{t("opening")}</p>
      </div>
    );
  }

  if (access.status === "locked") {
    return (
      <div className="space-y-4">
        <div className="space-y-2 px-2 pt-1 pb-1">
          <p className="eyebrow text-muted-foreground">{t("weekTitle")}</p>
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
              {t("paywallBody", { price: access.starPrice })}
            </p>
            <div className="space-y-3">
              <Button
                type="button"
                size="lg"
                className="w-full bg-ink-foreground text-ink hover:bg-ink-foreground/90"
                disabled={!inTelegram || paying}
                onClick={() => void pay()}
              >
                <Star aria-hidden />
                {paying
                  ? t("paying")
                  : inTelegram
                    ? t("payStars", { price: access.starPrice })
                    : t("payInTelegram")}
              </Button>
              {payError && (
                <p className="text-sm text-ink-muted" role="alert">
                  {payError}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const showIntro = !access.introSeen && (access.status === "trial" || access.status === "new");

  return (
    <div className="space-y-4">
      {showIntro && (
        <section className="glass flex flex-col gap-5 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-sm leading-relaxed text-foreground/90 sm:text-base">
            {t("intro", { price: access.starPrice })}
          </p>
          <Button type="button" variant="ink" className="shrink-0" onClick={() => void dismissIntro()}>
            {t("introOk")}
          </Button>
        </section>
      )}
      {access.status === "trial" && access.introSeen && (
        <p className="px-2 text-xs text-muted-foreground">
          {t("trialLine", {
            days: count(access.daysLeft, "day"),
            price: access.starPrice,
          })}
        </p>
      )}
      {children}
    </div>
  );
}
