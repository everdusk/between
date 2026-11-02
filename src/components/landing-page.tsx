"use client";

import { LANDING_BOT_URL, LANDING_START_PARAM } from "@/lib/landing";
import { feelingFill } from "@/lib/spectrum";
import type { Feeling } from "@/lib/types";
import type { MouseEvent, ReactNode } from "react";

const NOTES: { text: string; feeling: Feeling }[] = [
  { text: "спокойно, выспалась", feeling: "спокойно" },
  { text: "устала после планёрки", feeling: "усталость" },
  { text: "мама опять про то, когда я устроюсь", feeling: "грусть" },
  { text: "вечером не лезла в рабочий чат — отпустило", feeling: "спокойно" },
  { text: "злюсь, что согласилась", feeling: "злость" },
  { text: "тихо и хорошо", feeling: "радость" },
  { text: "не спала, всё бесит", feeling: "злость" },
  { text: "написала и не отправила", feeling: "тревожно" },
];

const REASONS = [
  {
    title: "Не помнишь",
    body: "К сеансу от недели остаётся пара ярких вечеров. Остальное стёрлось.",
    icon: "memory",
  },
  {
    title: "Забывается",
    body: "Дневник в другом приложении. Туда надо зайти — и ещё вспомнить, что туда надо зайти.",
    icon: "clock",
  },
  {
    title: "«Я и так помню»",
    body: "Помнится дно. А утро было спокойным — этого в памяти уже нет.",
    icon: "spark",
  },
];

const STEPS = [
  {
    n: "01",
    kicker: "Три раза в день",
    title: "Настроение — кнопка",
    body: "Утром, днём и вечером бот пишет «Как вы?» и даёт кнопки. Нажали «тревожно» — отметка уже в дневнике. Печатать ничего не надо.",
    image: "/landing/mood.webp",
    alt: "Бот спрашивает «Вечер. Как вы?» и предлагает кнопки настроения",
  },
  {
    n: "02",
    kicker: "Когда есть что сказать",
    title: "Заметку пишете сами",
    body: "Любой текст боту становится записью на сегодня. Вечером он спросит про заметку сам — и только если за день ничего не написано.",
    image: "/landing/note.webp",
    alt: "Сообщение боту и ответ «Записал на сегодня.»",
  },
  {
    n: "03",
    kicker: "Без таблиц",
    title: "Неделя собирается сама",
    body: "Семь дней в одном спектре. Слева легче, справа тяжелее. Видно, после чего прилетают пики, не листая чат.",
    image: "/landing/spectrum.webp",
    alt: "Вкладка «Неделя» со спектром настроения",
  },
  {
    n: "04",
    kicker: "К разговору",
    title: "К сеансу есть о чём говорить",
    body: "Повторы собираются в «Что обсудить». Приходите не с пустой головой и не вспоминаете неделю с нуля.",
    image: "/landing/backlog.webp",
    alt: "Список «Что обсудить» с темами к сеансу",
  },
];

const VIDEO_HTML = `<video class="bl-video" autoplay muted loop playsinline preload="metadata" poster="/landing/poster.webp" aria-label="Нажатие «тревожно», затем заметка своими словами, затем спектр недели и темы к сеансу"><source src="/landing/screen-ru.webm" type="video/webm"><source src="/landing/screen-ru.mp4" type="video/mp4"></video>`;

const CSS = `
@layer components{
.between-landing{--bl-bg:#070908;--bl-fg:#f4f7f5;--bl-muted:#a7b5ae;--bl-dim:#6d7f77;--bl-teal:#3ee0c5;--bl-teal-ink:#06211c;--bl-line:rgba(255,255,255,.08);--bl-glass:rgba(255,255,255,.035);background:var(--bl-bg);color:var(--bl-fg);color-scheme:dark;-webkit-font-smoothing:antialiased}
.between-landing ::selection{background:rgba(62,224,197,.28)}
.bl-field{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bl-glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.8;animation:bl-drift 28s ease-in-out infinite alternate}
.bl-glow-a{width:42rem;height:42rem;top:-16rem;right:-6rem;background:radial-gradient(closest-side,rgba(24,92,78,.7),transparent)}
.bl-glow-b{width:28rem;height:28rem;top:18rem;left:-10rem;background:radial-gradient(closest-side,rgba(62,224,197,.14),transparent);animation-duration:36s}
.bl-grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:soft-light;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:180px}
.bl-nav{position:sticky;top:0;z-index:30;background:rgba(7,9,8,.72);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}
.bl-nav a{color:var(--bl-muted);font-size:.9rem}
.bl-nav a:hover{color:var(--bl-fg)}
.bl-kicker{font-size:.72rem;line-height:1;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--bl-teal)}
.bl-accent{color:var(--bl-teal)}
.bl-cta{display:inline-flex;align-items:center;justify-content:center;height:3rem;padding:0 1.35rem;border-radius:999px;background:var(--bl-teal);color:var(--bl-teal-ink);font-weight:600;font-size:.95rem;white-space:nowrap;box-shadow:0 14px 36px -16px rgba(62,224,197,.7),inset 0 1px 0 rgba(255,255,255,.4)}
.bl-cta:hover{box-shadow:0 18px 40px -14px rgba(62,224,197,.85),inset 0 1px 0 rgba(255,255,255,.4)}
.bl-cta:active,.bl-ghost:active{transform:scale(.98)}
.bl-ghost{display:inline-flex;align-items:center;justify-content:center;height:3rem;padding:0 1.25rem;border-radius:999px;border:1px solid var(--bl-line);background:rgba(255,255,255,.03);color:var(--bl-fg);font-weight:500;font-size:.95rem;white-space:nowrap}
.bl-ghost:hover{background:rgba(255,255,255,.06)}
.bl-cta:focus-visible,.bl-ghost:focus-visible,.bl-nav a:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(62,224,197,.28)}
.bl-pill{display:inline-flex;align-items:center;gap:.45rem;color:var(--bl-dim);font-size:.84rem}
.bl-pill i{width:.4rem;height:.4rem;border-radius:50%;background:var(--bl-teal);box-shadow:0 0 10px var(--bl-teal)}
.bl-phone{position:relative;width:100%;aspect-ratio:642/1266;border-radius:2.6rem;padding:.55rem;background:linear-gradient(160deg,#2a3134,#12171a 42%,#0c1012);box-shadow:0 50px 100px -36px rgba(0,0,0,.85),0 0 0 1px rgba(255,255,255,.12),inset 0 0 0 1px rgba(0,0,0,.55)}
.bl-phone::before{content:"";position:absolute;top:1.05rem;left:50%;width:5.2rem;height:1.35rem;margin-left:-2.6rem;border-radius:999px;background:#050708;z-index:2}
.bl-screen{position:relative;height:100%;border-radius:2.15rem;overflow:hidden;background:#0c0e10}
.bl-video,.bl-screen img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.bl-chip{position:absolute;left:-1.5rem;top:46%;display:flex;align-items:center;gap:.65rem;padding:.8rem 1rem;border-radius:1.1rem;background:rgba(16,22,20,.72);border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 40px -24px rgba(0,0,0,.8);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);font-size:.92rem;line-height:1.25}
.bl-chip b{display:block;font-weight:600}
.bl-chip small{display:block;margin-top:.15rem;color:var(--bl-dim);font-size:.72rem;font-weight:500}
.bl-chip i{width:.55rem;height:.55rem;border-radius:50%;flex:none;box-shadow:0 0 12px currentColor}
.bl-reason{border-radius:1.4rem;border:1px solid var(--bl-line);background:rgba(255,255,255,.03);padding:1.4rem 1.35rem 1.5rem}
.bl-reason svg{color:var(--bl-teal)}
.bl-step-n{font-size:.95rem;font-weight:600;letter-spacing:.14em;color:var(--bl-teal)}
.bl-phone-wrap{position:relative;width:min(100%,17.5rem)}
.bl-phone-wrap::before{content:"";position:absolute;inset:12% -8%;border-radius:50%;background:radial-gradient(closest-side,rgba(62,224,197,.22),transparent 72%);filter:blur(18px);z-index:0}
.bl-close{position:relative;overflow:hidden;border-radius:2rem;text-align:center;background:radial-gradient(90% 80% at 50% 120%,rgba(62,224,197,.2),transparent 60%),#0c1211;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.bl-ticker{position:relative;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.bl-ticker-track{display:flex;gap:.7rem;width:max-content;animation:bl-ticker 46s linear infinite}
.bl-ticker:hover .bl-ticker-track{animation-play-state:paused}
.bl-note{display:inline-flex;align-items:center;gap:.55rem;height:2.7rem;padding:0 1rem 0 .85rem;border-radius:999px;border:1px solid var(--bl-line);background:rgba(255,255,255,.035);font-size:.92rem;color:#d5e0db;white-space:nowrap}
.bl-note i{width:.45rem;height:.45rem;border-radius:50%;box-shadow:0 0 10px currentColor;flex:none}
@keyframes bl-drift{from{transform:translate3d(0,0,0)}to{transform:translate3d(-4%,5%,0)}}
@keyframes bl-ticker{to{transform:translateX(-50%)}}
@media (max-width:640px){.bl-chip{display:none}}
@media (prefers-reduced-motion:reduce){.bl-glow,.bl-ticker-track{animation:none}}
}
`;

function OpenLink({ children, className }: { children: ReactNode; className: string }) {
  return (
    <a href={LANDING_BOT_URL} data-start={LANDING_START_PARAM} className={className}>
      {children}
    </a>
  );
}

function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const root = event.currentTarget.closest(".between-landing");
  const target = document.getElementById(id);
  if (!root || !target) return;
  event.preventDefault();
  const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 76;
  root.scrollTo({ top, behavior: "smooth" });
}

function Icon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      {name === "memory" && (
        <>
          <path {...common} d="M7 4.5h7.2L18 8.2V19.5H7z" />
          <path {...common} d="M14 4.6V8.3H18M9.4 12.2h5M9.4 15.2h3.2" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle {...common} cx="12" cy="12" r="7.5" />
          <path {...common} d="M12 8.5V12l2.4 1.6" />
        </>
      )}
      {name === "spark" && <path {...common} d="M12 3.5 13.6 9H19l-4.3 3.2 1.6 5.3L12 14.6 7.7 17.5l1.6-5.3L5 9h5.4L12 3.5z" />}
    </svg>
  );
}

function PhoneShot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="bl-phone-wrap">
      <div className="bl-phone relative z-10">
        <div className="bl-screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} width={642} height={1266} />
        </div>
      </div>
    </div>
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
          <div className="bl-grain" />
        </div>

        <header className="bl-nav">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 sm:grid-cols-[1fr_auto_1fr] sm:px-8">
            <a href="#top" onClick={(event) => jump(event, "top")} className="justify-self-start font-display text-[1.35rem] leading-none tracking-tight !text-[var(--bl-fg)]">
              Between
            </a>
            <nav className="hidden items-center gap-8 sm:flex sm:justify-self-center" aria-label="Разделы">
              <a href="#dnevnik" onClick={(event) => jump(event, "dnevnik")}>Дневник</a>
              <a href="#kak" onClick={(event) => jump(event, "kak")}>Как устроен</a>
            </nav>
            <div className="justify-self-end">
              <OpenLink className="bl-cta !h-10 !px-4 !text-sm">Открыть бота</OpenLink>
            </div>
          </div>
        </header>

        <main id="top" className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <section className="grid items-center gap-14 pt-12 sm:pt-16 lg:grid-cols-[1.15fr_.85fr] lg:gap-6 lg:pt-20">
            <div className="max-w-xl">
              <h1 className="font-display text-[2.7rem] leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-[4.15rem]">
                Терапевт попросил вести дневник.
                <br className="hidden lg:block" /> <span className="bl-accent">Вы честно пытались.</span>
              </h1>
              <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                Между сеансами неделя стирается. Between живёт в Telegram: настроение — одна кнопка, заметка —
                когда есть что сказать. К сеансу уже собрано, о чём говорить.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <OpenLink className="bl-cta">Открыть бота</OpenLink>
                <a href="#kak" onClick={(event) => jump(event, "kak")} className="bl-ghost">
                  Как это работает
                </a>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
                {["Без установки", "В Telegram", "Одно нажатие"].map((item) => (
                  <li key={item} className="bl-pill">
                    <i />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-[19.5rem] lg:mx-0 lg:justify-self-end">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: "radial-gradient(closest-side, rgba(62,224,197,.22), transparent 70%)", filter: "blur(8px)" }}
                aria-hidden
              />
              <div className="bl-phone">
                <div className="bl-screen" dangerouslySetInnerHTML={{ __html: VIDEO_HTML }} />
              </div>
              <div className="bl-chip" aria-hidden>
                <i style={{ background: feelingFill("тревожно"), color: feelingFill("тревожно") }} />
                <span>
                  <b>Записал: тревожно.</b>
                  <small>18:01 · одно нажатие</small>
                </span>
              </div>
            </div>
          </section>

          <section className="mt-16 sm:mt-20" aria-label="Примеры записей">
            <p className="bl-kicker text-center">Например, так</p>
            <div className="bl-ticker mt-5">
              <div className="bl-ticker-track">
                {[...NOTES, ...NOTES].map((note, index) => (
                  <span key={`${note.text}-${index}`} className="bl-note" aria-hidden={index >= NOTES.length}>
                    <i style={{ background: feelingFill(note.feeling), color: feelingFill(note.feeling) }} />
                    {note.text}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section id="dnevnik" className="mt-24 scroll-mt-24 sm:mt-32">
            <div className="mx-auto max-w-2xl text-center">
              <p className="bl-kicker">Дневник, который не открывают</p>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
                Почему «просто вести дневник» не работает
              </h2>
            </div>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {REASONS.map((reason) => (
                <li key={reason.title} className="bl-reason">
                  <Icon name={reason.icon} />
                  <h3 className="mt-4 font-display text-[1.45rem] tracking-tight">{reason.title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                    {reason.body}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-8 max-w-xl text-center text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
              Дно наступает не «вообще». Оно приходит в конкретный вечер.
            </p>
          </section>

          <section id="kak" className="mt-24 scroll-mt-24 sm:mt-32">
            <div className="mx-auto max-w-2xl text-center">
              <p className="bl-kicker">Как это работает</p>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
                Стартанули бота — и к сессии всё готово
              </h2>
            </div>
            <ol className="mt-16 flex flex-col gap-20 sm:mt-20 sm:gap-28">
              {STEPS.map((step, index) => (
                <li key={step.n} className={`flex flex-col items-center gap-10 lg:flex-row lg:gap-20 ${index % 2 ? "lg:flex-row-reverse" : ""}`}>
                  <div className="w-full max-w-md flex-1">
                    <p className="bl-step-n">{step.n}</p>
                    <p className="mt-3 text-sm" style={{ color: "var(--bl-dim)" }}>{step.kicker}</p>
                    <h3 className="mt-2 font-display text-3xl leading-tight tracking-tight sm:text-4xl">{step.title}</h3>
                    <p className="mt-4 max-w-sm text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                      {step.body}
                    </p>
                  </div>
                  <PhoneShot src={step.image} alt={step.alt} />
                </li>
              ))}
            </ol>
          </section>

          <section className="bl-close mt-24 px-6 py-16 sm:mt-32 sm:px-12 sm:py-24">
            <h2 className="mx-auto max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
              Между сессиями всё и происходит
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[1.05rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
              Бот спрашивает настроение сам. Заметку пишете, когда она есть. Дневник при этом ведётся.
            </p>
            <div className="mt-8">
              <OpenLink className="bl-cta">Открыть бота</OpenLink>
            </div>
            <p className="mt-4 text-sm" style={{ color: "var(--bl-dim)" }}>
              Дневник и сеансы бесплатно. «Неделя» — первые 7 дней бесплатно.
            </p>
          </section>
        </main>

        <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:flex-row sm:px-8">
          <p className="font-display text-lg tracking-tight">Between</p>
          <p className="text-xs tracking-wide" style={{ color: "var(--bl-dim)" }}>
            Дневник настроения · мини-приложение Telegram
          </p>
          <a href={LANDING_BOT_URL} data-start={LANDING_START_PARAM} className="text-sm font-medium" style={{ color: "var(--bl-teal)" }}>
            @BetweenJournalBot
          </a>
        </footer>
      </div>
    </div>
  );
}
