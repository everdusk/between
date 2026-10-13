"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { InvoiceStatuses } from "@twa-dev/types";
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
      <p className="py-10 text-center text-sm text-muted-foreground" role="status">
        {t("opening")}
      </p>
    );
  }

  if (access.status === "locked") {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
            {t("weekTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("paywallBody", { price: access.starPrice })}
          </p>
        </div>
        <Button
          type="button"
          disabled={!inTelegram || paying}
          onClick={() => void pay()}
        >
          {paying
            ? t("paying")
            : inTelegram
              ? t("payStars", { price: access.starPrice })
              : t("payInTelegram")}
        </Button>
        {payError && (
          <p className="text-sm text-muted-foreground" role="alert">
            {payError}
          </p>
        )}
      </section>
    );
  }

  const showIntro = !access.introSeen && (access.status === "trial" || access.status === "new");

  return (
    <div className="space-y-6">
      {showIntro && (
        <section className="space-y-4 rounded-3xl border border-border/60 bg-card/70 p-4 sm:p-5">
          <p className="text-sm leading-relaxed text-foreground/90 sm:text-base">
            {t("intro", { price: access.starPrice })}
          </p>
          <Button type="button" onClick={() => void dismissIntro()}>
            {t("introOk")}
          </Button>
        </section>
      )}
      {access.status === "trial" && access.introSeen && (
        <p className="text-sm text-muted-foreground">
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
