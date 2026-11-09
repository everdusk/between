"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { readMaxInitData } from "@/lib/max-webapp";
import { SbpLockup, SbpSign } from "@/components/sbp-logo";
import { trackAnalytics } from "@/lib/analytics-client";
import { sbpCatalog, type SbpPlanId } from "@/lib/sbp-plans";
import { captureSubscribe, subscribeFail } from "@/lib/subscribe-analytics";
import type { AnalyticsMessenger } from "@/lib/analytics-model";
import { DEFAULT_RUB_PRICE } from "@/lib/week-access";

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
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (readMaxInitData() || readTelegramInitData()) {
      setOpen(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/account", { credentials: "same-origin", cache: "no-store" });
        const body = (await response.json().catch(() => null)) as { account?: unknown } | null;
        if (cancelled) return;
        if (response.ok && body?.account) {
          setOpen(true);
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
  if (!open) return null;
  return <SubscribeCheckout monthly={monthly} />;
}

const PLANS: SbpPlanId[] = ["month", "quarter", "year"];

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

export function SubscribeCheckout({ monthly = DEFAULT_RUB_PRICE }: { monthly?: number }) {
  const [plan, setPlan] = useState<SbpPlanId>("quarter");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    captureSubscribe({ messenger: pageMessenger(), step: "open", plan: "quarter" });
    trackAnalytics("paywall", readTelegramInitData());
  }, []);

  useEffect(() => {
    if (!order) return;
    captureSubscribe({ messenger: pageMessenger(), step: "qr", plan: order.plan });
  }, [order]);

  useEffect(() => {
    if (!paid || !order) return;
    captureSubscribe({
      messenger: pageMessenger(),
      step: paid === "pending" ? "pending" : "paid",
      plan: order.plan,
    });
  }, [paid, order]);

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
    captureSubscribe({ messenger: pageMessenger(), step: "pay", plan });
    trackAnalytics("checkout", readTelegramInitData(), { plan });
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

  const plans = sbpCatalog(monthly);
  const chosen = plans[plan];

  return (
    <article className="subscribe-page fixed inset-0 z-30 overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        <header>
          <a href="/journal" className="sub-display text-lg" onClick={() => captureSubscribe({ messenger: pageMessenger(), step: "journal" })}>
            Between
          </a>
        </header>

        <div className="mt-8 grid items-start gap-10 lg:mt-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <div className="hidden lg:block">
            <p className="sub-kicker">Дневник для тех, кто в терапии</p>
            <h1 className="sub-display mt-4 text-5xl leading-[1.05]">
              Оформление подписки.
              <br />
              <span className="sub-shift">Вы честно экономите.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#a9b4ae]">
              Between живёт в мессенджере: вечером бот сам спросит, как прошёл день, и к сессии соберёт из ответов готовую выкладку.
            </p>
            <ul className="sub-points">
              <li><Check />Запись за минуту: настроение в один тап, мысли парой строк</li>
              <li><Check />Неделя складывается в картину: видны повторяющиеся темы</li>
              <li><Check />Выкладка к сессии — о чём стоит рассказать терапевту</li>
              <li><Check />Ничего устанавливать не нужно — дневник уже в Telegram</li>
            </ul>
            <div className="sub-note mt-8">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-[0.14em] text-[#8aa097] uppercase">Запись из дневника</p>
                <span className="sub-sample">Пример</span>
              </div>
              <p className="sub-display mt-3 text-2xl">вс, 8 ноября</p>
              <p className="mt-3 text-sm text-[#c5d0ca]">
                <span className="text-[#8FF0BC]">21:15</span>
                <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-[#14352c] px-2 py-0.5 text-[#8FF0BC]">
                  спокойно
                </span>
              </p>
              <p className="mt-2 text-sm">Вечером не лезла в рабочий чат. Отпустило.</p>
              <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs text-[#c5d0ca]">граница с работой</p>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2 text-xs text-[#c5d0ca]">
              <li className="sub-chip">1 минута в день</li>
              <li className="sub-chip">7 дней — готовая выкладка</li>
              <li className="sub-chip">0 установок</li>
            </ul>
          </div>

          <section className="sub-card">
            <div className="lg:hidden">
              <p className="sub-kicker">Подписка Between</p>
              <h1 className="sub-display mt-3 text-[2.05rem] leading-[1.05]">
                Оформление подписки.
                <br />
                <span className="sub-shift">Вы честно экономите.</span>
              </h1>
            </div>
            <h2 className="sub-display hidden text-2xl lg:block">Выберите план</h2>
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
                        {"popular" in item && item.popular ? <span className="sub-badge">Выбор пользователей</span> : null}
                        {"off" in item ? <span className="sub-off">−{item.off}%</span> : null}
                      </span>
                      <span className="mt-1 block text-sm text-[#8aa097]">
                        {id === "month" ? (
                          `${rub(item.perMonth)}/мес`
                        ) : (
                          <>
                            <s className="me-2">{rub(plans.month.perMonth)}</s>
                            <span className="text-[#8FF0BC]">{rub(item.perMonth)}/мес</span>
                          </>
                        )}
                      </span>
                    </span>
                    <b className="tabular ms-auto whitespace-nowrap">{rub(item.rub)}</b>
                  </label>
                );
              })}
            </fieldset>

            <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
              <div>
                <p className="text-sm text-[#a9b4ae]">Итого к оплате</p>
                <p className="text-xs text-[#74827b]">Разовый платёж · доступ {chosen.span}</p>
              </div>
              <p className="sub-display text-3xl">{rub(chosen.rub)}</p>
            </div>

            <label className="mt-5 block text-sm text-[#a9b4ae]" htmlFor="sbp-email">
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
            <p className="mt-3 text-xs leading-relaxed text-[#74827b]">
              Нажимая «Оплатить через СБП», вы соглашаетесь с{" "}
              <a href="/terms" onClick={() => captureSubscribe({ messenger: pageMessenger(), step: "terms", plan })}>публичной офертой</a> и даёте{" "}
              <a href="/privacy" onClick={() => captureSubscribe({ messenger: pageMessenger(), step: "privacy", plan })}>согласие на обработку персональных данных</a>
            </p>
            <p className="mt-2 text-xs text-[#74827b]">Платёж через ЮKassa · чек по 54-ФЗ на почту</p>
            {error ? (
              <p className="mt-3 text-sm text-[#ffb4b0]" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <p className="text-sm text-[#a9b4ae]">
                Подписка · {chosen.title.toLowerCase()}
              </p>
              <p className="text-sm">{rub(chosen.rub)}</p>
            </div>
            <button type="button" className="sub-pay" disabled={busy} onClick={() => void pay()}>
              <SbpSign />
              {busy ? "Создаём платёж…" : "Оплатить через СБП"}
            </button>
          </section>
        </div>
      </div>

      {order ? (
        <div className="sub-modal" role="dialog" aria-modal="true" aria-labelledby="sbp-title">
          <div className="sub-sheet">
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
              <p className="mt-4 text-sm leading-relaxed text-[#a9b4ae]">
                {paid === "pending"
                  ? "Оплата прошла. Войдите в дневник с этой почтой — премиум откроется там и сам не продлится."
                  : "Подписка активирована. Она не продлевается сама. Откройте дневник и зайдите на «Неделю»."}
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-relaxed text-[#a9b4ae]">
                  Отсканируйте QR-код камерой или в приложении банка и подтвердите платёж.
                </p>
                <div className="sub-qr" dangerouslySetInnerHTML={{ __html: order.svg }} />
                <div className="sub-sbp-pill">
                  <SbpLockup />
                </div>
                <a
                  href={order.url}
                  className="mt-3 block text-center text-sm text-[#8FF0BC] underline underline-offset-4"
                  onClick={() => captureSubscribe({ messenger: pageMessenger(), step: "bank", plan: order.plan })}
                >
                  Открыть в приложении банка
                </a>
              </>
            )}
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#8aa097]">К оплате</dt>
                <dd>{rub(order.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#8aa097]">Тариф</dt>
                <dd>Подписка {plans[order.plan].span}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#8aa097]">Чек придёт на</dt>
                <dd className="truncate">{order.email}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-[#a9b4ae]">
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

const CSS = `
.subscribe-page{background:#07090d;color:#f3f6f4;color-scheme:only dark;font-family:var(--font-sans),ui-sans-serif,system-ui,sans-serif;font-weight:500;-webkit-font-smoothing:antialiased}
.subscribe-page button,.subscribe-page input{font-family:inherit}
.sub-display{font-weight:650;letter-spacing:-.03em}
.subscribe-page a{color:inherit}
.sub-kicker{font-size:.72rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#5ee7c5}
.sub-points{margin-top:1.5rem;display:grid;gap:.85rem;list-style:none;padding:0}
.sub-points li{display:flex;align-items:flex-start;gap:.65rem;color:#e4ece8;font-size:.95rem;line-height:1.45}
.sub-points svg{flex:none;margin-top:.15rem;color:#5ee7c5}
.sub-shift{background:linear-gradient(102deg,#5df0c6 0%,#7ee0d2 38%,#8eb6ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub-card{border:1px solid rgba(255,255,255,.1);border-radius:1.6rem;background:rgba(16,22,20,.92);padding:1.25rem;box-shadow:0 30px 80px -40px rgba(0,0,0,.8)}
.sub-plan{display:flex;align-items:center;gap:.8rem;border:1px solid rgba(255,255,255,.12);border-radius:1rem;padding:.85rem 1rem;cursor:pointer}
.sub-plan-on{border-color:#5ee7c5;box-shadow:inset 0 0 0 1px #5ee7c5}
.sub-plan input{accent-color:#5ee7c5;width:1.05rem;height:1.05rem}
.sub-badge{border-radius:999px;background:#14352c;color:#8FF0BC;font-size:.68rem;padding:.15rem .45rem}
.sub-off{border-radius:999px;background:#12382a;color:#8FF0BC;font-size:.68rem;padding:.15rem .4rem}
.sub-email{margin-top:.4rem;width:100%;height:3rem;border-radius:1rem;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#f3f6f4;padding:0 1rem}
.sub-pay{margin-top:.75rem;display:flex;width:100%;align-items:center;justify-content:center;gap:.7rem;height:3.4rem;border:0;border-radius:999px;background:#fff;color:#111;font-weight:650;font-size:1rem;letter-spacing:-.02em;text-decoration:none;cursor:pointer}
.sub-pay:disabled{opacity:.6}
.sub-note{border:1px solid rgba(94,231,197,.28);border-radius:1.2rem;padding:1rem 1.1rem;background:rgba(94,231,197,.04)}
.sub-sample{border-radius:999px;background:#14352c;color:#8FF0BC;font-size:.72rem;padding:.15rem .5rem}
.sub-chip{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:.4rem .7rem}
.sub-modal{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:1.25rem;background:rgba(0,0,0,.62)}
.sub-sheet{width:min(100%,26rem);border-radius:1.4rem;border:1px solid rgba(255,255,255,.12);background:#121816;padding:1.25rem 1.25rem 1.1rem}
.sub-x{border:0;background:transparent;color:#d5ddd8;font-size:1.6rem;line-height:1;cursor:pointer}
.sub-qr{margin:1rem auto 0;width:14rem;border-radius:1rem;background:#fff;padding:.6rem}
.sub-qr svg{display:block;width:100%;height:auto}
.sub-sbp-pill{margin:.9rem auto 0;display:flex;width:fit-content;align-items:center;justify-content:center;border-radius:999px;background:#fff;padding:10px 14px}
.sub-cancel{margin-top:1rem;width:100%;height:3rem;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#f3f6f4;cursor:pointer}
`;
