import { LANDING_BOT_URL, LANDING_START_PARAM } from "@/lib/landing";
import { feelingFill } from "@/lib/spectrum";
import type { Feeling } from "@/lib/types";

const DOTS: Feeling[] = ["радость", "спокойно", "усталость", "грусть", "тревожно", "злость"];

const STEPS = [
  {
    index: "01",
    title: "Пишу боту",
    body: "Боту достаточно пары слов. Любой текст в чате становится заметкой на сегодня.",
  },
  {
    index: "02",
    title: "Неделя собралась",
    body: "Дни, настроение и то, что повторялось, складываются сами.",
  },
  {
    index: "03",
    title: "Есть что сказать",
    body: "К сеансу уже есть о чём говорить. После него можно записать, что обсудили и что дальше.",
  },
];

function OpenLink({
  children,
  className,
}: {
  children: string;
  className: string;
}) {
  return (
    <a
      href={LANDING_BOT_URL}
      data-start={LANDING_START_PARAM}
      className={className}
    >
      {children}
    </a>
  );
}

const openClass =
  "inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-[0.9375rem] font-medium text-primary-foreground shadow-[0_12px_24px_-14px_var(--primary)] transition active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-ring/25";

export function LandingPage() {
  return (
    <div className="between-landing fixed inset-0 z-40 hidden overflow-x-hidden overflow-y-auto bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <p className="font-display text-[1.375rem] leading-none tracking-tight">Between</p>
        <OpenLink className="inline-flex h-10 items-center rounded-full bg-foreground/[0.06] px-4 text-sm font-medium text-foreground transition active:scale-[0.98]">
          Открыть
        </OpenLink>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8">
        <section className="mx-auto max-w-2xl pt-16 text-center sm:pt-24">
          <p className="eyebrow text-section-header">мини-приложение Telegram</p>
          <h1 className="mt-5 font-display text-[2.75rem] leading-[1.02] tracking-tight text-balance sm:text-6xl">
            Дневник к сеансу
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-balance">
            Между сеансами легко всё забыть. Напишите боту пару слов — неделя соберётся сама, и к
            разговору уже будет о чём говорить.
          </p>
          <div className="mt-8 flex justify-center" aria-hidden>
            <div className="flex gap-2">
              {DOTS.map((feeling) => (
                <span
                  key={feeling}
                  className="size-2.5 rounded-full"
                  style={{ background: feelingFill(feeling) }}
                />
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center gap-3">
            <OpenLink className={openClass}>Открыть в Telegram</OpenLink>
            <p className="text-sm text-muted-foreground">
              Дневник бесплатный. Вкладка «Неделя» открыта первые 7 дней.
            </p>
          </div>
        </section>

        <section className="mt-20 sm:mt-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-section-header">как это устроено</p>
            <h2 className="mt-4 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              От сообщения в чате до сеанса
            </h2>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.index} className="glass rounded-3xl p-6">
                <p className="eyebrow text-accent-text">{step.index}</p>
                <h3 className="mt-4 font-display text-2xl leading-tight tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="ink mt-10 rounded-3xl px-6 py-10 text-center sm:px-12 sm:py-14">
          <h2 className="font-display text-3xl leading-tight tracking-tight text-ink-foreground sm:text-4xl">
            Чтобы не начинать сначала
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-ink-muted">
            Between — место для коротких заметок: как вы, что повторялось за неделю и о чём хотите
            сказать в следующий раз.
          </p>
          <div className="mt-8">
            <OpenLink className="inline-flex h-12 items-center justify-center rounded-full bg-ink-foreground px-6 text-[0.9375rem] font-medium text-ink transition active:scale-[0.98]">
              Открыть в Telegram
            </OpenLink>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-[0.6875rem] tracking-wide text-muted-foreground sm:px-8">
        Between · мини-приложение Telegram
      </footer>
    </div>
  );
}
