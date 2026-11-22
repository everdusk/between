"use client";

import { useMaxScheme } from "@/hooks/use-max-scheme";
import { GlassPanel } from "./ui/glass-panel";
import "./subscribe-checkout.css";
import { BrandLogo } from "./brand-logo";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { readMaxInitData } from "@/lib/max-webapp";
import { SbpLockup, SbpSign } from "@/components/sbp-logo";
import { trackAnalytics } from "@/lib/analytics-client";
import { sbpCatalog, type SbpPlanId } from "@/lib/sbp-plans";
import { captureSubscribe, subscribeFail } from "@/lib/subscribe-analytics";
import type { AnalyticsMessenger } from "@/lib/analytics-model";
import { DEFAULT_RUB_PRICE } from "@/lib/week-access";
import { LEGAL_INN } from "@/lib/legal";

function pageMessenger(): AnalyticsMessenger {
  if (readMaxInitData()) return "max";
  if (readTelegramInitData()) return "telegram";
  return "web";
}

function readTelegramInitData(): string {
  if (typeof window === "undefined") return "";
  const match = /(?:^|#|&)tgWebAppData=([^&]*)/.exec(window.location.hash);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  const init = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    ?.initData;
  return init?.trim() ?? "";
}

/**
 * The page itself is static, so it cannot decide from a cookie at the edge.
 * Messenger launch strings open the form immediately. Everyone else asks
 * `/api/account` and leaves for the journal when there is no session.
 */
export function SubscribeGate({ monthly }: { monthly?: number }) {
  const [surface, setSurface] = useState<"web" | "max" | null>(null);
  useMaxScheme(surface === "max");
  useLayoutEffect(() => {
    if (readTelegramInitData()) {
      window.location.replace("/?tab=subscribe" + window.location.hash);
      return;
    }
    if (readMaxInitData()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show the signed messenger checkout before paint
      setSurface("max");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/account", { credentials: "same-origin", cache: "no-store" });
        const body = (await response.json().catch(() => null)) as { account?: unknown } | null;
        if (cancelled) return;
        if (response.ok && body?.account) {
          setSurface("web");
          return;
        }
      } catch {
        /* no session */
      }
      if (!cancelled) {
        captureSubscribe({ messenger: "web", step: "signed_out" });
        window.location.replace("/journal");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (!surface) return null;
  return <SubscribeCheckout monthly={monthly} surface={surface} />;
}

const PLANS: SbpPlanId[] = ["month", "quarter", "year"];

function SubscriptionIntro({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <p className="paywall-heading sub-kicker">Подписка Between</p>
      <h1 className={compact ? "sub-display mt-3 text-[2.05rem] leading-[1.05]" : "sub-display mt-4 text-5xl leading-[1.05]"}>
        Замечайте, что <span className="sub-shift">повторяется.</span>
      </h1>
      <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
        Записывайте, что произошло, и отмечайте, как вы себя чувствуете.
        В обзоре можно увидеть, в какое время меняется настроение и какие темы возвращаются в записях.
      </p>
    </>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3.2 8.3 6.4 11.4 12.8 4.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function rub(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function starAmount(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} Stars`;
}

function StarMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 1.35 9.74 5.55l4.56.4-3.48 3.02.99 4.5L8 11.35 4.19 13.47l.99-4.5L1.7 5.95l4.56-.4L8 1.35Z"
      />
    </svg>
  );
}

function starCatalog(prices: { month: number; quarter: number; year: number }) {
  return {
    month: { rub: prices.month, perMonth: prices.month, title: "Месяц", span: "на месяц" },
    quarter: {
      rub: prices.quarter,
      perMonth: Math.round(prices.quarter / 3),
      title: "3 месяца",
      span: "на 3 месяца",
      popular: true as const,
    },
    year: {
      rub: prices.year,
      perMonth: Math.round(prices.year / 12),
      title: "Год",
      span: "на год",
      off: 50,
    },
  };
}

export function SubscribeCheckout({
  monthly = DEFAULT_RUB_PRICE,
  surface,
  embed = false,
  stars = null,
  onStarsPay,
  starsBusy = false,
  starsError = null,
}: {
  monthly?: number;
  surface: "web" | "max";
  /** Phone card only. Telegram and MAX never get the wide marketing column. */
  embed?: boolean;
  /** Stars prices. Omits the ruble receipt, the email, and YooKassa. */
  stars?: { month: number; quarter: number; year: number } | null;
  onStarsPay?: (plan: SbpPlanId) => void;
  starsBusy?: boolean;
  starsError?: string | null;
}) {
  const [plan, setPlan] = useState<SbpPlanId>("quarter");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoutState, setLogoutState] = useState<"idle" | "pending" | "error">("idle");

  async function logout() {
    setLogoutState("pending");
    try {
      const res = await fetch("/api/account/logout", { method: "POST" });
      if (res.ok) {
        window.location.replace("/");
        return;
      }
    } catch {
      // A failed request leaves the session and checkout available for retry.
    }
    setLogoutState("error");
  }
  const [order, setOrder] = useState<{
    paymentId: string;
    amount: number;
    plan: SbpPlanId;
    email: string;
    url: string;
    svg: string;
  } | null>(null);
  const [paid, setPaid] = useState<"granted" | "pending" | null>(null);
  const emailSeen = useRef(false);

  useEffect(() => {
    if (!embed) trackAnalytics("paywall", readTelegramInitData());
  }, [embed]);

  useEffect(() => {
    if (!order) return;
    captureSubscribe({ messenger: pageMessenger(), step: "qr", plan: order.plan });
  }, [order]);

  useEffect(() => {
    if (!order || paid) return;
    let stopped = false;
    const tick = async () => {
      const response = await fetch(`/api/sbp?id=${encodeURIComponent(order.paymentId)}`, { credentials: "same-origin" });
      const body = (await response.json().catch(() => null)) as { status?: string } | null;
      if (stopped) return;
      if (body?.status === "pending") setPaid("pending");
      else if (body?.status === "granted" || body?.status === "again") setPaid("granted");
    };
    const timer = window.setInterval(() => void tick(), 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [order, paid]);

  async function pay() {
    if (busy) return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Нужна почта, чтобы прислать чек.");
      captureSubscribe({ messenger: pageMessenger(), step: "email_bad", plan });
      return;
    }
    setBusy(true);
    setError(null);
    trackAnalytics("checkout", readTelegramInitData(), { plan });
    captureSubscribe({ messenger: pageMessenger(), step: "pay", plan });
    const maxInit = readMaxInitData();
    const telegramInit = readTelegramInitData();
    let response: Response;
    try {
      response = await fetch("/api/sbp", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(maxInit ? { "x-max-init-data": maxInit } : {}),
          ...(telegramInit ? { "x-telegram-init-data": telegramInit } : {}),
        },
        body: JSON.stringify({ plan, email: trimmed }),
      });
    } catch {
      setBusy(false);
      setError("Платёж не создался. Попробуйте ещё раз.");
      captureSubscribe({ messenger: pageMessenger(), step: "pay_fail", plan, fail: "network" });
      return;
    }
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      detail?: string;
      paymentId?: string;
      amount?: number;
      url?: string;
      svg?: string;
    } | null;
    setBusy(false);
    if (body?.error === "auth") {
      captureSubscribe({ messenger: pageMessenger(), step: "pay_fail", plan, fail: "auth" });
      window.location.replace("/journal");
      return;
    }
    if (!body?.ok || !body.paymentId || !body.url || !body.svg || typeof body.amount !== "number") {
      captureSubscribe({ messenger: pageMessenger(), step: "pay_fail", plan, fail: subscribeFail(body?.error) });
      setError(
        body?.error === "not_configured"
          ? "Оплата ещё не включена: в кабинете ЮKassa не заданы магазин и ключ."
          : body?.detail || "Платёж не создался. Попробуйте ещё раз.",
      );
      return;
    }
    setPaid(null);
    setOrder({ paymentId: body.paymentId, amount: body.amount, plan, email: trimmed, url: body.url, svg: body.svg });
  }

  const plans = stars ? starCatalog(stars) : sbpCatalog(monthly);
  const chosen = plans[plan];
  const price = (value: number) => (stars ? starAmount(value) : rub(value));

  return (
    <article className={embed ? "subscribe-page" : "subscribe-page fixed inset-0 z-30 overflow-y-auto"}>
      <div className={embed ? "" : `mx-auto w-full ${surface === "web" ? "max-w-6xl" : "max-w-xl"} px-5 py-6 sm:px-8 sm:py-10`}>
        {embed ? null : (
        <header className="flex items-center justify-between gap-4">
          <a href="/journal" className="sub-display text-lg" onClick={() => captureSubscribe({ messenger: pageMessenger(), step: "journal" })}>
            <BrandLogo />
          </a>
          {surface === "web" && (
            <button type="button" className="min-h-11 rounded-full border border-border px-5 text-sm hover:bg-secondary disabled:opacity-60"
              disabled={logoutState === "pending" || busy} onClick={logout}>
              {logoutState === "pending" ? "Выходим…" : "Выйти"}
            </button>
          )}
        </header>
        )}
        {logoutState === "error" && <p role="alert" className="mt-2 text-end text-sm">Не удалось выйти. Попробуйте ещё раз.</p>}

        <div className={embed ? "" : surface === "max" ? "mt-8" : "mt-8 grid items-start gap-10 lg:mt-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-16"}>
          {embed || surface === "max" ? null : (
          <div className="hidden lg:block">
            <SubscriptionIntro />
            <ul className="sub-points">
              <li><Check />Вернитесь к конкретной записи и разберите, что вас задело.</li>
              <li><Check />Сохраните свой вывод в списке «На подумать».</li>
              <li><Check />Если вы в терапии, соберите записи и вопросы к следующему сеансу.</li>
            </ul>
            <div className="sub-note mt-8">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Из обзора недели</p>
                <span className="sub-sample">Пример</span>
              </div>
              <p className="sub-display mt-3 text-2xl">Работа после работы</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">В двух вечерних записях вы возвращались к разговору с коллегой. В оба вечера вы отметили тревогу.</p>
            </div>
          </div>
          )}

          <GlassPanel className="sub-card">
            <div className={embed || surface === "max" ? "" : "lg:hidden"}>
              {surface === "web" ? <SubscriptionIntro compact /> : (
                <>
                  <p className="paywall-heading sub-kicker">Подписка Between</p>
                  <h1 className="sub-display mt-3 text-[2.05rem] leading-[1.05]">Выберите срок подписки</h1>
                  <p className="mt-4 leading-relaxed text-muted-foreground">Between живёт в мессенджере: вечером бот сам спросит, как прошёл день, и к сессии соберёт из ответов готовую выкладку.</p>
                </>
              )}
            </div>
            <h2 className={embed || surface === "max" ? "hidden" : "paywall-heading sub-display hidden text-2xl lg:flex"}>Выберите план</h2>
            <fieldset className="mt-5 space-y-3">
              <legend className="sr-only">Срок подписки</legend>
              {PLANS.map((id) => {
                const item = plans[id];
                const selected = plan === id;
                return (
                  <label key={id} className={selected ? "sub-plan sub-plan-on" : "sub-plan"}>
                    <input
                      type="radio"
                      name="plan"
                      value={id}
                      checked={selected}
                      onChange={() => {
                        setPlan(id);
                        captureSubscribe({ messenger: pageMessenger(), step: "plan", plan: id });
                      }}
                    />
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.title}</span>
                        {"off" in item ? <span className="sub-off">−{item.off}%</span> : null}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {id === "month" ? (
                          `${price(item.perMonth)}/мес`
                        ) : (
                          <>
                            <s className="me-2">{price(plans.month.perMonth)}</s>
                            <span className="text-foreground">{price(item.perMonth)}/мес</span>
                          </>
                        )}
                      </span>
                    </span>
                    <b className="tabular ms-auto whitespace-nowrap">{price(item.rub)}</b>
                  </label>
                );
              })}
            </fieldset>

            <div className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-4">
              <div>
                <p className="text-sm text-muted-foreground">Итого к оплате</p>
                <p className="text-xs text-muted-foreground">Доступ {chosen.span} · разовый платёж без автопродления</p>
              </div>
              {stars ? (
                <p className="sub-display text-3xl leading-none whitespace-nowrap">
                  {new Intl.NumberFormat("ru-RU").format(chosen.rub)}
                  <span className="ms-1.5 align-baseline text-xl">Stars</span>
                </p>
              ) : (
                <p className="sub-display shrink-0 whitespace-nowrap text-3xl">{rub(chosen.rub)}</p>
              )}
            </div>

            {stars ? null : (
              <>
                <label className="mt-5 block text-sm text-muted-foreground" htmlFor="sbp-email">
                  Email для чека
                </label>
                <input
                  id="sbp-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="masha@example.ru"
                  value={email}
                  onChange={(event) => {
                    const next = event.target.value;
                    setEmail(next);
                    if (!emailSeen.current && next.trim()) {
                      emailSeen.current = true;
                      captureSubscribe({ messenger: pageMessenger(), step: "email", plan });
                    }
                  }}
                  className="sub-email"
                />
              </>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              <a href="/terms" onClick={() => captureSubscribe({ messenger: pageMessenger(), step: "terms", plan })}>Публичная оферта</a> ·{" "}
              {!stars && <><a href="/privacy" onClick={() => captureSubscribe({ messenger: pageMessenger(), step: "privacy", plan })}>Политика конфиденциальности</a> · </>}ИНН {LEGAL_INN}
            </p>
            {stars ? null : (
            <p className="mt-2 text-xs text-muted-foreground">Платёж через ЮKassa · чек по 54-ФЗ на почту</p>
            )}
            {stars ? (
              starsError ? (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {starsError}
                </p>
              ) : null
            ) : error ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Подписка · {chosen.title.toLowerCase()}
              </p>
              <p className="text-sm">{price(chosen.rub)}</p>
            </div>
            {stars ? (
              <button
                type="button"
                className="sub-pay"
                disabled={starsBusy || !onStarsPay}
                onClick={() => onStarsPay?.(plan)}
              >
                <StarMark />
                {starsBusy ? "Открываю оплату…" : "Оплатить"}
              </button>
            ) : (
            <button type="button" className="sub-pay" disabled={busy} onClick={() => void pay()}>
              <SbpSign />
              {busy ? "Создаём платёж…" : "Оплатить через СБП"}
            </button>
            )}
          </GlassPanel>
        </div>
      </div>

      {order ? (
        <div className="sub-modal" role="dialog" aria-modal="true" aria-labelledby="sbp-title">
          <div className="sub-sheet glass-strong">
            <div className="flex items-start justify-between gap-4">
              <h2 id="sbp-title" className="sub-display text-2xl">
                {paid ? "Оплата прошла" : "Оплата через СБП"}
              </h2>
              <button
                type="button"
                className="sub-x"
                aria-label="Закрыть"
                onClick={() => {
                  captureSubscribe({ messenger: pageMessenger(), step: "close", plan: order.plan });
                  setOrder(null);
                }}
              >
                ×
              </button>
            </div>
            {paid ? (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {paid === "pending"
                  ? "Оплата прошла. Войдите в дневник с этой почтой — премиум откроется там и сам не продлится."
                  : "Подписка активирована. Она не продлевается сама. Откройте дневник и зайдите на «Неделю»."}
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Отсканируйте QR-код камерой или в приложении банка и подтвердите платёж.
                </p>
                <div className="sub-qr" dangerouslySetInnerHTML={{ __html: order.svg }} />
                <div className="sub-sbp-pill">
                  <SbpLockup />
                </div>
                <a
                  href={order.url}
                  className="mt-3 block text-center text-sm text-foreground underline underline-offset-4"
                  onClick={() => captureSubscribe({ messenger: pageMessenger(), step: "bank", plan: order.plan })}
                >
                  Открыть в приложении банка
                </a>
              </>
            )}
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">К оплате</dt>
                <dd>{rub(order.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Тариф</dt>
                <dd>Подписка {plans[order.plan].span}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Чек придёт на</dt>
                <dd className="truncate">{order.email}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Подписка активируется сразу после оплаты и не продлевается автоматически.
            </p>
            {paid ? (
              <a
                href="/journal"
                className="sub-pay mt-4"
                onClick={() => captureSubscribe({ messenger: pageMessenger(), step: "journal", plan: order.plan })}
              >
                Открыть дневник
              </a>
            ) : (
              <button
                type="button"
                className="sub-cancel"
                onClick={() => {
                  captureSubscribe({ messenger: pageMessenger(), step: "cancel", plan: order.plan });
                  setOrder(null);
                }}
              >
                Отменить и вернуться
              </button>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
