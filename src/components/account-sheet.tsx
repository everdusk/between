"use client";

import { useEffect, useId, useState } from "react";
import type { InvoiceStatuses } from "@twa-dev/types";
import { CircleUser, Star, X } from "lucide-react";
import { FeedbackForm } from "@/components/feedback-form";
import { LanguageSwitch } from "@/components/language-switch";
import { PasswordChange } from "@/components/password-change";
import { SchemeSwitch } from "@/components/scheme-switch";
import { WebAccountCard } from "@/components/web-account-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/locale-provider";
import type { WebAccount } from "@/hooks/use-web-account";
import { trackAnalytics } from "@/lib/analytics-client";
import { captureProduct } from "@/lib/product-analytics";
import { formatPremiumStatus } from "@/lib/messages";
import { passwordSettingsKind } from "@/lib/password-settings";
import type { NotifyPrefs } from "@/lib/types";
import {
  createWeekInvoice,
  fetchWeekAccess,
  localWeekView,
  readLocalWeekAccess,
} from "@/lib/week-access-client";
import { planPrice, type PremiumPlan, type WeekAccessView } from "@/lib/week-access";

const PLANS = ["month", "quarter", "year"] as const satisfies readonly PremiumPlan[];

export function AccountButton({
  pressed,
  onClick,
}: {
  pressed: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={t("accountOpen")}
      aria-expanded={pressed}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <CircleUser aria-hidden />
    </Button>
  );
}

export function AccountSheet({
  open,
  onClose,
  inTelegram,
  inMax,
  initData,
  maxInitData,
  notify,
  onSaveNotify,
  disabled,
  account,
  onRefreshAccount,
  onLogout,
  onPremium,
}: {
  open: boolean;
  onClose: () => void;
  inTelegram: boolean;
  inMax: boolean;
  initData: string;
  maxInitData: string;
  notify: NotifyPrefs;
  onSaveNotify: (prefs: Pick<NotifyPrefs, "moodPolls" | "eveningNudge">) => boolean;
  disabled?: boolean;
  account: WebAccount | null;
  onRefreshAccount: () => void;
  onLogout: () => void;
  onPremium: () => void;
}) {
  const { t, locale } = useI18n();
  const titleId = useId();
  const [access, setAccess] = useState<WeekAccessView | null>(null);
  const [payingPlan, setPayingPlan] = useState<PremiumPlan | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const view =
        inTelegram && initData
          ? await fetchWeekAccess(initData)
          : await fetchSessionAccess();
      if (!cancelled) setAccess(view);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, inTelegram, initData]);

  async function refreshAfterPay() {
    const first = await fetchWeekAccess(initData);
    if (first && first.status !== "locked") {
      setAccess(first);
      setPayingPlan(null);
      onPremium();
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    const second = await fetchWeekAccess(initData);
    if (second) setAccess(second);
    setPayingPlan(null);
    onPremium();
    if (!second || second.status === "locked") setPayError(t("payPending"));
  }

  async function pay(plan: PremiumPlan) {
    if (!inTelegram || !initData || payingPlan) return;
    setPayingPlan(plan);
    setPayError(null);
    const url = await createWeekInvoice(initData, plan);
    if (!url) {
      setPayingPlan(null);
      setPayError(t("payFail"));
      return;
    }
    trackAnalytics("checkout", initData, { plan });
    const webApp = (await import("@twa-dev/sdk")).default;
    webApp.openInvoice(url, (status: InvoiceStatuses) => {
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

  if (!open) return null;

  const premiumText = access ? formatPremiumStatus(locale, access) : t("loading");

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-black/45 px-[max(1rem,var(--safe-left))] py-[max(1.25rem,var(--safe-bottom))] sm:items-center sm:px-[max(1.5rem,var(--safe-right))]"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-strong max-h-[min(40rem,calc(var(--vv-height,100dvh)-2.5rem))] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl p-5 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl tracking-tight text-foreground">
            {t("webAccount")}
          </h2>
          <Button type="button" variant="ghost" size="icon" aria-label={t("accountClose")} onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>

        <div className="mt-5 space-y-6">
          <section>
            <p className="eyebrow text-section-header">{t("webScheme")}</p>
            <SchemeSwitch className="mt-2 w-full" />
          </section>

          <section>
            <p className="eyebrow text-section-header">{t("language")}</p>
            <div className="mt-2">
              <LanguageSwitch inline />
            </div>
          </section>

          <section>
            <h3 className="font-display text-lg tracking-tight text-foreground">{t("botReminders")}</h3>
            <div className="mt-1 divide-y divide-[color:var(--glass-border)]">
              <Switch
                className="py-3.5"
                label={t("pollToggle")}
                checked={notify.moodPolls}
                disabled={disabled}
                onChange={(event) =>
                  onSaveNotify({
                    moodPolls: event.target.checked,
                    eveningNudge: notify.eveningNudge,
                  })
                }
              />
              <Switch
                className="py-3.5"
                label={t("nudgeToggle")}
                checked={notify.eveningNudge}
                disabled={disabled}
                onChange={(event) =>
                  onSaveNotify({
                    moodPolls: notify.moodPolls,
                    eveningNudge: event.target.checked,
                  })
                }
              />
            </div>
          </section>

          <section className="space-y-3">
            {account ? (
              <WebAccountCard
                plain
                account={account}
                onRefresh={onRefreshAccount}
                onLogout={onLogout}
              />
            ) : (
              <p className="text-sm text-foreground">
                {inMax ? t("webMaxLinked") : inTelegram ? t("webBotLinked") : null}
              </p>
            )}
          </section>

          <PasswordSettings
            inTelegram={inTelegram}
            inMax={inMax}
            account={account}
          />

          <section className="space-y-3">
            <h3 className="font-display text-lg tracking-tight text-foreground">{t("feedbackTitle")}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("feedbackLead")}</p>
            <FeedbackForm initData={initData} maxInitData={maxInitData} />
          </section>

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
                        onClick={() => void pay(plan)}
                      >
                        <Star aria-hidden />
                        {planLabel(plan, access.prices[plan])}
                      </Button>
                    ))
                  : PLANS.map((plan) => (
                      <p
                        key={plan}
                        className="rounded-full bg-foreground/[0.06] px-4 py-3 text-center text-sm font-medium text-foreground"
                      >
                        {rubLabel(plan, access.rubPrice)}
                      </p>
                    ))}
                {payError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {payError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}

function PasswordSettings({
  inTelegram,
  inMax,
  account,
}: {
  inTelegram: boolean;
  inMax: boolean;
  account: WebAccount | null;
}) {
  const { t } = useI18n();
  const kind = passwordSettingsKind({
    inTelegram,
    inMax,
    signedIn: account != null,
    hasPassword: account?.hasPassword === true,
    telegramLinked: account?.telegramLinked === true,
    maxLinked: account?.maxLinked === true,
  });
  useEffect(() => {
    if (window.location.hash !== "#password") return;
    document.getElementById("password")?.scrollIntoView({ block: "center" });
  }, []);

  if (kind === "hidden") return null;
  const note =
    kind === "telegram"
      ? t("webSignedInTelegram")
      : kind === "max"
        ? t("webSignedInMax")
        : kind === "messenger"
          ? t("webSignedInMessenger")
          : kind === "none"
            ? t("webNoPassword")
            : null;
  return (
    <section id="password" className="space-y-3">
      <h3 className="font-display text-lg tracking-tight text-foreground">{t("webPasswordSection")}</h3>
      {kind === "form" ? <PasswordChange /> : <p className="text-sm leading-relaxed text-foreground">{note}</p>}
    </section>
  );
}

async function fetchSessionAccess(): Promise<WeekAccessView> {
  try {
    const res = await fetch("/api/week-access", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; access?: WeekAccessView };
      if (data.ok && data.access && typeof data.access.status === "string") return data.access;
    }
  } catch {
    /* The local stamp still describes the trial. */
  }
  return localWeekView(readLocalWeekAccess());
}
