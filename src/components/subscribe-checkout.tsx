"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readMaxInitData } from "@/lib/max-webapp";
import { sbpCatalog, type SbpPlanId } from "@/lib/sbp-plans";
import { DEFAULT_RUB_PRICE } from "@/lib/week-access";

const PLANS: SbpPlanId[] = ["month", "quarter", "year"];

function rub(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function SbpMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
      <path d="M6 16 16 4l4 6-6 6 6 6-4 6Z" fill="#5B57A2" />
      <path d="M14 16 24 6l4 4-10 6 10 6-4 4Z" fill="#D90751" />
      <path d="M12 16 22 8l2 2-8 6 8 6-2 2Z" fill="#FAB718" />
      <path d="M16 16 26 10v12Z" fill="#1D1346" />
    </svg>
  );
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
      return;
    }
    setBusy(true);
    setError(null);
    const maxInit = readMaxInitData();
    const response = await fetch("/api/sbp", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(maxInit ? { "x-max-init-data": maxInit } : {}),
      },
      body: JSON.stringify({ plan, email: trimmed }),
    });
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
    if (!body?.ok || !body.paymentId || !body.url || !body.svg || typeof body.amount !== "number") {
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
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-lg tracking-tight">
            Between
          </Link>
          <a href="/journal" className="sub-login">
            Уже есть дневник? Войти
          </a>
        </header>

        <div className="mt-8 grid items-start gap-10 lg:mt-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <div className="hidden lg:block">
            <p className="sub-kicker">Дневник для тех, кто в терапии</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-tight">
              Оформление подписки.
              <br />
              <span className="sub-shift">Вы честно экономите.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#a9b4ae]">
              Between живёт в мессенджере: вечером бот сам спросит, как прошёл день, и к сессии соберёт из ответов готовую выкладку.
            </p>
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-[#d5ddd8]">
              <li>Запись за минуту: настроение в один тап, мысли парой строк</li>
              <li>Неделя складывается в картину: видны повторяющиеся темы</li>
              <li>Выкладка к сессии — о чём стоит рассказать терапевту</li>
              <li>Ничего устанавливать не нужно — дневник уже в Telegram или MAX</li>
            </ul>
            <div className="sub-note mt-8">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-[0.14em] text-[#8aa097] uppercase">Запись из дневника</p>
                <span className="sub-sample">Пример</span>
              </div>
              <p className="mt-3 font-display text-2xl">вс, 8 ноября</p>
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
              <h1 className="mt-3 font-display text-[2.05rem] leading-[1.05] tracking-tight">
                Оформление подписки.
                <br />
                <span className="sub-shift">Вы честно экономите.</span>
              </h1>
            </div>
            <h2 className="hidden font-display text-2xl tracking-tight lg:block">Выберите план</h2>
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
                      onChange={() => setPlan(id)}
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
              <p className="font-display text-3xl">{rub(chosen.rub)}</p>
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
              onChange={(event) => setEmail(event.target.value)}
              className="sub-email"
            />
            <p className="mt-3 text-xs leading-relaxed text-[#74827b]">
              Нажимая «Оплатить через СБП», вы соглашаетесь с{" "}
              <a href="/terms">публичной офертой</a> и даёте{" "}
              <a href="/privacy">согласие на обработку персональных данных</a>
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
              <SbpMark />
              {busy ? "Создаём платёж…" : "Оплатить через СБП"}
            </button>
          </section>
        </div>
      </div>

      {order ? (
        <div className="sub-modal" role="dialog" aria-modal="true" aria-labelledby="sbp-title">
          <div className="sub-sheet">
            <div className="flex items-start justify-between gap-4">
              <h2 id="sbp-title" className="font-display text-2xl">
                {paid ? "Оплата прошла" : "Оплата через СБП"}
              </h2>
              <button type="button" className="sub-x" aria-label="Закрыть" onClick={() => setOrder(null)}>
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
                <p className="sub-sbp-pill">
                  <SbpMark /> система быстрых платежей
                </p>
                <a href={order.url} className="mt-3 block text-center text-sm text-[#8FF0BC] underline underline-offset-4">
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
              <a href="/journal" className="sub-pay mt-4">
                Открыть дневник
              </a>
            ) : (
              <button type="button" className="sub-cancel" onClick={() => setOrder(null)}>
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
.subscribe-page{background:#07090d;color:#f3f6f4;color-scheme:only dark}
.subscribe-page a{color:inherit}
.sub-login{border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:.55rem .9rem;font-size:.84rem;color:#d5ddd8;text-decoration:none}
.sub-kicker{font-size:.72rem;font-weight:650;letter-spacing:.16em;text-transform:uppercase;color:#5ee7c5}
.sub-shift{background:linear-gradient(102deg,#5df0c6 0%,#7ee0d2 38%,#8eb6ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub-card{border:1px solid rgba(255,255,255,.1);border-radius:1.6rem;background:rgba(16,22,20,.92);padding:1.25rem;box-shadow:0 30px 80px -40px rgba(0,0,0,.8)}
.sub-plan{display:flex;align-items:center;gap:.8rem;border:1px solid rgba(255,255,255,.12);border-radius:1rem;padding:.85rem 1rem;cursor:pointer}
.sub-plan-on{border-color:#5ee7c5;box-shadow:inset 0 0 0 1px #5ee7c5}
.sub-plan input{accent-color:#5ee7c5;width:1.05rem;height:1.05rem}
.sub-badge{border-radius:999px;background:#14352c;color:#8FF0BC;font-size:.68rem;padding:.15rem .45rem}
.sub-off{border-radius:999px;background:#12382a;color:#8FF0BC;font-size:.68rem;padding:.15rem .4rem}
.sub-email{margin-top:.4rem;width:100%;height:3rem;border-radius:1rem;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#f3f6f4;padding:0 1rem}
.sub-pay{margin-top:.75rem;display:flex;width:100%;align-items:center;justify-content:center;gap:.55rem;height:3.2rem;border:0;border-radius:999px;background:#fff;color:#111;font-weight:650;font-size:1rem;text-decoration:none;cursor:pointer}
.sub-pay:disabled{opacity:.6}
.sub-note{border:1px solid rgba(94,231,197,.28);border-radius:1.2rem;padding:1rem 1.1rem;background:rgba(94,231,197,.04)}
.sub-sample{border-radius:999px;background:#14352c;color:#8FF0BC;font-size:.72rem;padding:.15rem .5rem}
.sub-chip{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:.4rem .7rem}
.sub-modal{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:1.25rem;background:rgba(0,0,0,.62)}
.sub-sheet{width:min(100%,26rem);border-radius:1.4rem;border:1px solid rgba(255,255,255,.12);background:#121816;padding:1.25rem 1.25rem 1.1rem}
.sub-x{border:0;background:transparent;color:#d5ddd8;font-size:1.6rem;line-height:1;cursor:pointer}
.sub-qr{margin:1rem auto 0;width:14rem;border-radius:1rem;background:#fff;padding:.6rem}
.sub-qr svg{display:block;width:100%;height:auto}
.sub-sbp-pill{margin:.9rem auto 0;display:flex;width:fit-content;align-items:center;gap:.4rem;border-radius:999px;background:#fff;color:#111;padding:.35rem .7rem;font-size:.78rem}
.sub-cancel{margin-top:1rem;width:100%;height:3rem;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#f3f6f4;cursor:pointer}
`;
