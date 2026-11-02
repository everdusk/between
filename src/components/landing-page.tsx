import { LANDING_BOT_URL, LANDING_START_PARAM } from "@/lib/landing";
import { feelingFill } from "@/lib/spectrum";
import type { Feeling } from "@/lib/types";

const DOTS: Feeling[] = ["радость", "спокойно", "усталость", "грусть", "тревожно", "злость"];

/** The three mood polls: 9:00, 14:00, 18:00. A tap, not a message. */
const DAY_POINTS: { x: number; y: number; time: string; feeling: Feeling }[] = [
  { x: 110, y: 74, time: "9:00", feeling: "спокойно" },
  { x: 400, y: 148, time: "14:00", feeling: "усталость" },
  { x: 690, y: 252, time: "18:00", feeling: "тревожно" },
];

/** The buttons the bot actually sends, in picker order. */
const BUTTONS: Feeling[] = [
  "тревожно",
  "спокойно",
  "злость",
  "грусть",
  "радость",
  "усталость",
  "стыд",
  "пусто",
  "напряжение",
];

const FEATURES = [
  {
    index: "01",
    title: "Бот спросит сам",
    body: "Утром, днём и вечером. Не текст — кнопки: нажали «тревожно», и день отмечен.",
    image: "/landing/chat.webp",
    alt: "Бот спрашивает «Вечер. Как вы?» и даёт кнопки настроения",
  },
  {
    index: "02",
    title: "Неделя складывается",
    body: "Семь дней в одном спектре. Слева легче, справа тяжелее — видно сразу.",
    image: "/landing/spectrum.webp",
    alt: "Вкладка «Неделя» со спектром настроения по дням",
  },
  {
    index: "03",
    title: "Видно, что повторяется",
    body: "Темы собираются к сеансу. Есть с чем прийти, не вспоминая с нуля.",
    image: "/landing/backlog.webp",
    alt: "Список «Что обсудить» с темами к сеансу",
  },
];

const STEPS = [
  { n: "1", title: "Спросит", body: "В 9:00, 14:00 и 18:00 бот пишет «Как вы?» с кнопками. Самому заходить не нужно." },
  { n: "2", title: "Нажмёте", body: "Одна кнопка: «тревожно», «спокойно», «усталость». Печатать ничего не надо." },
  { n: "3", title: "Сложится", body: "Дни и настроение собираются в неделю сами, без таблиц." },
  { n: "4", title: "Увидите", body: "Через пару недель понятно, после чего прилетают пики." },
];

const VIDEO_HTML = `<video class="bl-video" autoplay muted loop playsinline preload="metadata" poster="/landing/poster.webp" aria-label="Запись экрана: бот спрашивает настроение кнопками, нажатие «тревожно», затем неделя и темы к сеансу"><source src="/landing/screen-ru.webm" type="video/webm"><source src="/landing/screen-ru.mp4" type="video/mp4"></video>`;

/* Unlayered rules would beat Tailwind's responsive utilities (hidden, sm:flex), so everything sits in @layer components. */
const CSS = `
@layer components{
.between-landing{--bl-bg:#0c1412;--bl-fg:#f4f7f5;--bl-muted:#a9bdb4;--bl-dim:#6f847c;--bl-teal:#46e7cc;--bl-teal-ink:#07201b;--bl-line:rgba(255,255,255,.09);--bl-glass:rgba(255,255,255,.035);--bl-glass-strong:rgba(255,255,255,.06);background:var(--bl-bg);color:var(--bl-fg);color-scheme:dark;-webkit-font-smoothing:antialiased}
.between-landing ::selection{background:rgba(70,231,204,.3)}
.bl-field{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bl-glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.75;animation:bl-drift 28s ease-in-out infinite alternate}
.bl-glow-a{width:46rem;height:46rem;top:-18rem;left:50%;margin-left:-6rem;background:radial-gradient(closest-side,rgba(28,88,78,.75),transparent)}
.bl-glow-b{width:32rem;height:32rem;top:14rem;right:-10rem;background:radial-gradient(closest-side,rgba(110,48,56,.5),transparent);animation-duration:34s;animation-delay:-11s}
.bl-glow-c{width:30rem;height:30rem;top:30rem;left:-12rem;background:radial-gradient(closest-side,rgba(70,231,204,.18),transparent);animation-duration:40s;animation-delay:-20s}
.bl-grain{position:absolute;inset:0;opacity:.07;mix-blend-mode:soft-light;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:180px}
.bl-glass{background:var(--bl-glass);border:1px solid var(--bl-line);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 30px 80px -40px rgba(0,0,0,.8);-webkit-backdrop-filter:blur(24px) saturate(1.3);backdrop-filter:blur(24px) saturate(1.3)}
.bl-glass-strong{background:var(--bl-glass-strong)}
.bl-kicker{font-size:.6875rem;line-height:1;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--bl-teal)}
.bl-pill{display:inline-flex;align-items:center;gap:.5rem;height:2.25rem;padding:0 .9rem;border-radius:999px;border:1px solid rgba(226,232,228,.22);background:rgba(8,12,11,.35);font-size:.8125rem;font-weight:500;color:#c9d4ce;white-space:nowrap}
.bl-pill b{font-weight:700;color:var(--bl-fg)}
.bl-cta{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;height:3.25rem;padding:0 1.6rem;border-radius:999px;background:var(--bl-teal);color:var(--bl-teal-ink);font-weight:600;font-size:.9375rem;white-space:nowrap;box-shadow:0 18px 40px -16px rgba(70,231,204,.55),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .2s,box-shadow .2s}
.bl-cta:hover{box-shadow:0 22px 48px -16px rgba(70,231,204,.7),inset 0 1px 0 rgba(255,255,255,.35)}
.bl-cta:active{transform:scale(.98)}
.bl-cta-ghost{display:inline-flex;align-items:center;height:2.5rem;padding:0 1.1rem;border-radius:999px;border:1px solid var(--bl-line);background:var(--bl-glass);color:var(--bl-fg);font-size:.875rem;font-weight:500;white-space:nowrap;transition:background .2s,transform .2s}
.bl-cta-ghost:hover{background:var(--bl-glass-strong)}
.bl-cta-ghost:active{transform:scale(.98)}
.bl-cta:focus-visible,.bl-cta-ghost:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(70,231,204,.3)}
.bl-phone{position:relative;width:100%;aspect-ratio:642/1266;border-radius:3rem;padding:.6rem;background:linear-gradient(160deg,#2b3236 0%,#141a1d 40%,#0f1417 100%);box-shadow:0 60px 120px -40px rgba(0,0,0,.85),0 0 0 1px rgba(255,255,255,.14),inset 0 0 0 1px rgba(0,0,0,.6)}
.bl-phone::before{content:"";position:absolute;top:1.15rem;left:50%;width:5.5rem;height:1.5rem;margin-left:-2.75rem;border-radius:999px;background:#060809;z-index:2}
.bl-screen{position:relative;height:100%;border-radius:2.45rem;overflow:hidden;background:#0c0e10}
.bl-video,.bl-screen img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.bl-float{position:absolute;display:flex;align-items:center;gap:.6rem;padding:.75rem 1rem;border-radius:1.25rem;font-size:.875rem;line-height:1.3;color:var(--bl-fg);animation:bl-hover 7s ease-in-out infinite}
.bl-float small{display:block;font-size:.6875rem;color:var(--bl-dim);margin-top:.15rem}
.bl-float i{width:.6rem;height:.6rem;border-radius:50%;flex:none;box-shadow:0 0 14px currentColor}
.bl-card{position:relative;display:flex;flex-direction:column;border-radius:1.75rem;overflow:hidden}
@media (min-width:768px){.bl-card{min-height:31rem}}
.bl-card-shot{position:relative;margin-top:auto;height:19rem;overflow:hidden}
.bl-card-shot .bl-phone{position:absolute;left:50%;top:1.25rem;width:17rem;transform:translateX(-50%);border-radius:2.4rem;padding:.45rem}
.bl-card-shot .bl-phone::before{top:.85rem;width:4rem;height:1.1rem;margin-left:-2rem}
.bl-card-shot .bl-screen{border-radius:2rem}
.bl-card-shot::after{content:"";position:absolute;inset:auto 0 0 0;height:7rem;background:linear-gradient(to bottom,transparent,rgba(12,20,18,.92));pointer-events:none}
.bl-step{position:relative;text-align:center}
.bl-step-n{display:inline-flex;align-items:center;justify-content:center;width:3rem;height:3rem;border-radius:50%;border:1px solid rgba(70,231,204,.35);background:radial-gradient(circle at 30% 30%,rgba(70,231,204,.3),rgba(70,231,204,.06));color:var(--bl-teal);font-weight:600;box-shadow:0 0 30px -6px rgba(70,231,204,.5)}
.bl-rail{position:absolute;top:1.5rem;left:12.5%;right:12.5%;height:1px;background:linear-gradient(90deg,transparent,rgba(70,231,204,.35) 15%,rgba(70,231,204,.35) 85%,transparent)}
.bl-chart{display:block;width:100%;height:auto;overflow:visible}
.bl-mirror{position:relative;overflow:hidden;border-radius:2.5rem;background:radial-gradient(120% 90% at 50% 110%,rgba(70,231,204,.28),transparent 60%),radial-gradient(80% 60% at 10% 0%,rgba(110,48,56,.4),transparent 60%),#0f1a18}
.bl-mirror::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),inset 0 1px 0 rgba(255,255,255,.12);pointer-events:none}
.bl-dots i{display:block;width:.75rem;height:.75rem;border-radius:50%;box-shadow:0 0 16px -2px currentColor}
@keyframes bl-drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(4%,6%,0) scale(1.08)}}
@keyframes bl-hover{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes bl-dash{to{stroke-dashoffset:0}}
.bl-line-draw{stroke-dasharray:1200;stroke-dashoffset:1200;animation:bl-dash 2.4s cubic-bezier(.4,0,.2,1) .3s forwards}
.bl-ticker{position:relative;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.bl-ticker-track{display:flex;gap:.75rem;width:max-content;animation:bl-ticker 48s linear infinite}
.bl-ticker:hover .bl-ticker-track{animation-play-state:paused}
.bl-chip{display:inline-flex;align-items:center;gap:.6rem;height:2.75rem;padding:0 1.1rem 0 .9rem;border-radius:999px;border:1px solid var(--bl-line);background:var(--bl-glass);font-size:.9375rem;color:#d6e0db;white-space:nowrap}
.bl-chip i{width:.5rem;height:.5rem;border-radius:50%;flex:none;box-shadow:0 0 12px currentColor}
.bl-chip small{font-size:.75rem;color:var(--bl-dim)}
@keyframes bl-ticker{to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.bl-glow,.bl-float,.bl-ticker-track{animation:none}.bl-line-draw{stroke-dashoffset:0;animation:none}}
}
`;

function OpenLink({ children, className }: { children: string; className: string }) {
  return (
    <a href={LANDING_BOT_URL} data-start={LANDING_START_PARAM} className={className}>
      {children}
    </a>
  );
}

function Dots({ className = "" }: { className?: string }) {
  return (
    <div className={`bl-dots flex gap-2.5 ${className}`} aria-hidden>
      {DOTS.map((feeling) => (
        <i key={feeling} style={{ background: feelingFill(feeling), color: feelingFill(feeling) }} />
      ))}
    </div>
  );
}

function DayChart({ compact = false }: { compact?: boolean }) {
  // The phone gets half the width; labels keep their size so the curve stays readable.
  const k = compact ? 0.5 : 1;
  const width = 800 * k;
  const points = DAY_POINTS.map((point) => ({ ...point, x: point.x * k }));
  const [a, b, c] = points;
  const path = `M ${a.x} ${a.y} C ${220 * k} ${a.y - 10}, ${300 * k} ${b.y - 16}, ${b.x} ${b.y} C ${520 * k} ${b.y + 30}, ${580 * k} ${c.y - 20}, ${c.x} ${c.y}`;
  const id = compact ? "bl-c" : "bl";
  return (
    <svg
      className={`bl-chart ${compact ? "sm:hidden" : "hidden sm:block"}`}
      viewBox={`0 0 ${width} 330`}
      role="img"
      aria-label="Линия одного дня: спокойно в 9:00, усталость в 14:00, тревожно в 18:00"
    >
      <defs>
        <linearGradient id={`${id}-stroke`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={feelingFill("спокойно")} />
          <stop offset="0.4" stopColor={feelingFill("усталость")} />
          <stop offset="1" stopColor={feelingFill("тревожно")} />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(70,231,204,.24)" />
          <stop offset="1" stopColor="rgba(70,231,204,0)" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation={compact ? 9 : 14} />
        </filter>
      </defs>
      {[70, 134, 198, 262].map((y) => (
        <line key={y} x1={20 * k + 20} x2={width - 20 * k - 20} y1={y} y2={y} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
      ))}
      <path d={`${path} L ${c.x} 300 L ${a.x} 300 Z`} fill={`url(#${id}-fill)`} />
      <path d={path} fill="none" stroke={`url(#${id}-stroke)`} strokeWidth={compact ? 12 : 16} strokeLinecap="round" opacity=".7" filter={`url(#${id}-blur)`} />
      <path d={path} className="bl-line-draw" fill="none" stroke={`url(#${id}-stroke)`} strokeWidth="3.5" strokeLinecap="round" />
      {points.map((point, index) => {
        const anchor = compact && index === 0 ? "start" : compact && index === points.length - 1 ? "end" : "middle";
        const nudge = anchor === "start" ? -12 : anchor === "end" ? 12 : 0;
        return (
          <g key={point.time}>
            <circle cx={point.x} cy={point.y} r="18" fill={feelingFill(point.feeling)} opacity=".22" />
            <circle cx={point.x} cy={point.y} r="7" fill={feelingFill(point.feeling)} stroke="#0c1412" strokeWidth="3" />
            <text x={point.x + nudge} y="320" textAnchor={anchor} fill="#6f847c" fontSize="15" fontFamily="var(--font-sans), sans-serif">
              {point.time}
            </text>
            <text x={point.x + nudge} y={point.y - 30} textAnchor={anchor} fill="#e6ede9" fontSize="17" fontFamily="var(--font-sans), sans-serif">
              {point.feeling}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className="between-landing fixed inset-0 z-40 hidden overflow-x-hidden overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="relative min-h-full">
        <div className="bl-field" aria-hidden>
          <div className="bl-glow bl-glow-a" />
          <div className="bl-glow bl-glow-b" />
          <div className="bl-glow bl-glow-c" />
          <div className="bl-grain" />
        </div>

        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
          <div className="flex items-center gap-3">
            <p className="font-display text-[1.5rem] leading-none tracking-tight">Between</p>
            <span className="bl-pill hidden sm:inline-flex">
              <span>·</span>
              <span>мини-приложение Telegram</span>
            </span>
          </div>
          <OpenLink className="bl-cta-ghost">Открыть в Telegram</OpenLink>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
          <section className="grid items-center gap-12 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_.9fr] lg:gap-8 lg:pt-24">
            <div className="max-w-xl">
              <p className="bl-kicker">Дневник настроения в Telegram</p>
              <h1 className="mt-6 font-display text-[2.75rem] leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-[4.25rem]">
                Утром «я в порядке», <span style={{ color: "var(--bl-teal)" }}>к вечеру — дно.</span>
              </h1>
              <p className="mt-4 font-display text-2xl leading-snug tracking-tight sm:text-3xl" style={{ color: "var(--bl-muted)" }}>
                И вроде ничего не случилось.
              </p>
              <p className="mt-7 max-w-lg text-[1.0625rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                Настроение — не прямая линия. Без записей его качели не разглядеть: кажется, что «всё плохо
                всегда», хотя пики прилетают после недосыпа и переписок с конкретными людьми.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
                <OpenLink className="bl-cta">Открыть в Telegram</OpenLink>
                <p className="text-sm" style={{ color: "var(--bl-dim)" }}>
                  Бесплатно. Ничего ставить не надо.
                </p>
              </div>
              <Dots className="mt-10" />
            </div>

            <div className="relative mx-auto w-full max-w-[20rem] pt-6 lg:max-w-[20.5rem]">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(70,231,204,.26), rgba(70,231,204,.05) 55%, transparent 72%)",
                  filter: "blur(30px)",
                }}
                aria-hidden
              />
              <div className="bl-phone">
                <div className="bl-screen" dangerouslySetInnerHTML={{ __html: VIDEO_HTML }} />
              </div>
              <div className="bl-float bl-glass -left-8 top-[24%] hidden sm:flex lg:-left-28" aria-hidden>
                <i style={{ background: feelingFill("спокойно"), color: feelingFill("спокойно") }} />
                <span>
                  Вечер. Как вы?
                  <small>бот · 18:00</small>
                </span>
              </div>
              <div
                className="bl-float bl-glass -right-6 bottom-[20%] hidden sm:flex lg:-right-24"
                style={{ animationDelay: "-3.5s" }}
                aria-hidden
              >
                <i style={{ background: feelingFill("тревожно"), color: feelingFill("тревожно") }} />
                <span>
                  Записал: тревожно.
                  <small>одно нажатие</small>
                </span>
              </div>
            </div>
          </section>

          <section className="mt-20 sm:mt-28" aria-label="Кнопки настроения, которые присылает бот">
            <p className="bl-kicker text-center">Настроение — это кнопка</p>
            <div className="bl-ticker mt-6">
              <div className="bl-ticker-track">
                {[...BUTTONS, ...BUTTONS].map((feeling, index) => (
                  <span key={`${feeling}-${index}`} className="bl-chip" aria-hidden={index >= BUTTONS.length}>
                    <i style={{ background: feelingFill(feeling), color: feelingFill(feeling) }} />
                    {feeling}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="bl-glass mt-24 rounded-[2.5rem] p-6 sm:mt-32 sm:p-10 lg:p-14">
            <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
              <div>
                <p className="bl-kicker">Один день</p>
                <h2 className="mt-5 font-display text-3xl leading-tight tracking-tight sm:text-5xl">
                  Не прямая линия
                </h2>
              </div>
              <p className="max-w-xl text-[1rem] leading-relaxed lg:justify-self-end lg:text-right" style={{ color: "var(--bl-muted)" }}>
                В 9:00, 14:00 и 18:00 бот спрашивает настроение, и ответом служит одно нажатие. Три отметки — и видно,
                что «дно» наступило не вообще, а к вечеру.
              </p>
            </div>
            <div className="mt-8 rounded-3xl p-3 sm:mt-10 sm:p-6" style={{ background: "rgba(0,0,0,.25)", border: "1px solid var(--bl-line)" }}>
              <DayChart />
              <DayChart compact />
            </div>
          </section>

          <section className="mt-24 sm:mt-32">
            <div className="mx-auto max-w-2xl text-center">
              <p className="bl-kicker">Ничего ставить не надо</p>
              <h2 className="mt-5 font-display text-3xl leading-tight tracking-tight text-balance sm:text-5xl">
                Не надо помнить, что куда-то надо зайти
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[1.0625rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                Утром, днём и вечером бот присылает кнопки. Нажимаете «тревожно» — отметка уже в дневнике. Заметку
                вечером он спросит, только если за день ничего не написано.
              </p>
            </div>
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.index} className="bl-card bl-glass">
                  <div className="p-7">
                    <p className="bl-kicker">{feature.index}</p>
                    <h3 className="mt-4 font-display text-2xl leading-tight tracking-tight">{feature.title}</h3>
                    <p className="mt-3 text-[0.9375rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                      {feature.body}
                    </p>
                  </div>
                  <div className="bl-card-shot">
                    <div className="bl-phone">
                      <div className="bl-screen">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={feature.image} alt={feature.alt} loading="lazy" width={642} height={1266} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-24 sm:mt-32">
            <div className="mx-auto max-w-2xl text-center">
              <p className="bl-kicker">Как это работает</p>
              <h2 className="mt-5 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
                Четыре шага, из которых ваш — один
              </h2>
            </div>
            <div className="relative mt-14">
              <div className="bl-rail hidden md:block" aria-hidden />
              <ol className="grid gap-10 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
                {STEPS.map((step) => (
                  <li key={step.n} className="bl-step">
                    <span className="bl-step-n">{step.n}</span>
                    <h3 className="mt-5 font-display text-2xl tracking-tight">{step.title}</h3>
                    <p className="mx-auto mt-3 max-w-[16rem] text-[0.9375rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                      {step.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="mt-24 sm:mt-32">
            <div className="bl-mirror px-6 py-16 text-center sm:px-12 sm:py-24">
              <Dots className="mx-auto justify-center" />
              <h2 className="mx-auto mt-8 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
                Не диагноз и не марафон продуктивности. Просто зеркало.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-[1.0625rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                Через пару недель смотрите на свою неделю и видите закономерности. А к сеансу уже есть, о чём
                говорить.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4">
                <OpenLink className="bl-cta">Открыть в Telegram</OpenLink>
                <p className="text-sm" style={{ color: "var(--bl-dim)" }}>
                  Дневник и сеансы бесплатно. «Неделя» — первые 7 дней бесплатно.
                </p>
              </div>
            </div>
          </section>
        </main>

        <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:px-8">
          <p className="font-display text-lg tracking-tight">Between</p>
          <p className="text-[0.75rem] tracking-wide" style={{ color: "var(--bl-dim)" }}>
            Дневник настроения · мини-приложение Telegram
          </p>
          <a
            href={LANDING_BOT_URL}
            data-start={LANDING_START_PARAM}
            className="text-[0.8125rem] font-medium"
            style={{ color: "var(--bl-teal)" }}
          >
            @BetweenJournalBot
          </a>
        </footer>
      </div>
    </div>
  );
}
