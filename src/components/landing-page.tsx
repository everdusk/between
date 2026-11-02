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
    title: "Неудобно",
    body: "Отдельное приложение, заметки или бумажка у кровати. Каждая запись — это ещё одна задача, а задач и так хватает.",
    icon: "box",
  },
  {
    title: "Забывается",
    body: "Обещаете себе написать вечером — вечер пролетает. А через пару дней не вспомнить даже, что именно задевало.",
    icon: "clock",
  },
  {
    title: "«Я хз, я норм»",
    body: "На сессии кажется, рассказать нечего. А по дороге домой вспоминается всё сразу — но уже поздно.",
    icon: "chat",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Стартанули бота",
    body: "Кнопка Start — и вы уже внутри. Без регистрации, паролей и анкет: Between открывается прямо в Telegram и просто ждёт ваше первое сообщение.",
    frameTitle: "Просто напиши боту",
    frameNote: "Пришла мысль в чат — Between сохранит её вместе с настроением. Без форм и лишних шагов.",
    chip: "первая запись — просто сообщение боту",
    image: "/landing/mood.webp",
    alt: "Чат с ботом: «Вечер. Как вы?» и кнопки настроения",
  },
  {
    n: "02",
    title: "Начали писать",
    body: "Строчка в очереди, голосовое по дороге, поток в полночь — как получилось. Between сохранит настроение и аккуратно разложит всё по дням.",
    frameTitle: "Каждый день — в цвете",
    frameNote: "Отметьте эмоцию, добавьте пару строк — и день уже в дневнике.",
    chip: "настроение и эмоции — в два касания",
    image: "/landing/note.webp",
    alt: "Заметка боту и ответ «Записал на сегодня.»",
  },
  {
    n: "03",
    title: "Картина собирается сама",
    body: "Вы ничего не сортируете. Эмоции, повторы и недосказанное Between складывает в наглядную картину: что происходило и как вы на это реагировали.",
    frameTitle: "Дневник между сессиями",
    frameNote: "Between собирает твои дни, эмоции и заметки к терапии в одном спокойном месте.",
    chip: "вы ничего не делали — а оно собралось",
    image: "/landing/spectrum.webp",
    alt: "Спектр недели",
  },
  {
    n: "04",
    title: "Приходите подготовленным",
    body: "Ко встрече с терапевтом уже ждёт выкладка: что обсудить, что повторялось, о чём спросить. Никаких «я хз, я норм».",
    frameTitle: "Приходи подготовленным",
    frameNote: "Всё, что стоит обсудить, само собирается в список к следующей сессии.",
    chip: "темы к сессии — без вашего участия",
    image: "/landing/backlog.webp",
    alt: "Темы к сеансу",
  },
];

const DOTS: Feeling[] = ["радость", "спокойно", "усталость", "грусть", "тревожно", "злость"];

const VIDEO_HTML = `<video class="bl-video" autoplay muted loop playsinline preload="metadata" poster="/landing/poster.webp" aria-label="Нажатие «тревожно», затем заметка своими словами, затем спектр недели и темы к сеансу"><source src="/landing/screen-ru.webm" type="video/webm"><source src="/landing/screen-ru.mp4" type="video/mp4"></video>`;

const CSS = `
@layer components{
.between-landing{--bl-bg:#07090d;--bl-fg:#f3f6f4;--bl-muted:#a9b4ae;--bl-dim:#74827b;--bl-teal:#5ee7c5;--bl-line:rgba(255,255,255,.1);background:#07090d;color:var(--bl-fg);color-scheme:dark;-webkit-font-smoothing:antialiased}
.between-landing ::selection{background:rgba(94,231,197,.28)}
.bl-wash{position:absolute;inset:0 0 auto 0;height:58rem;pointer-events:none;background:
  radial-gradient(38rem 30rem at 78% 22%,rgba(36,150,112,.55),transparent 62%),
  radial-gradient(26rem 24rem at 96% 30%,rgba(128,96,210,.42),transparent 64%),
  radial-gradient(22rem 18rem at 12% 18%,rgba(20,70,60,.35),transparent 70%)}
.bl-bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;width:min(100%,40rem);margin:1.1rem auto 0;padding:.35rem .4rem .35rem .9rem;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(10,14,13,.72);box-shadow:0 10px 40px -24px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.05);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}
.bl-logo{display:inline-flex;align-items:center;gap:.55rem;font-weight:600;letter-spacing:-.02em;color:var(--bl-fg)!important}
.bl-mark{display:grid;place-items:center;width:1.7rem;height:1.7rem;border-radius:.55rem;border:1px solid rgba(94,231,197,.35);background:rgba(94,231,197,.08);color:var(--bl-teal)}
.bl-bar nav a{color:#c5cfca;font-size:.92rem}
.bl-bar nav a:hover{color:#fff}
.bl-kicker{display:flex;align-items:center;gap:.65rem;font-size:.72rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--bl-teal)}
.bl-kicker i{width:1.15rem;height:1px;background:currentColor;display:block}
.bl-shift{background:linear-gradient(102deg,#5df0c6 0%,#7ee0d2 32%,#8eb6ff 70%,#c9b4ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.bl-cta{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;height:2.85rem;padding:0 1.15rem;border-radius:999px;background:linear-gradient(100deg,#c8f8c4 0%,#5ee7c5 42%,#7eb6f0 100%);color:#062018;font-weight:600;font-size:.95rem;white-space:nowrap;box-shadow:0 10px 28px -12px rgba(90,200,190,.8),inset 0 1px 0 rgba(255,255,255,.7)}
.bl-cta:hover{filter:saturate(1.08) brightness(1.04)}
.bl-cta:active,.bl-ghost:active{transform:scale(.98)}
.bl-cta-sm{height:2.3rem;padding:0 .95rem;font-size:.84rem}
.bl-ghost{display:inline-flex;align-items:center;justify-content:center;height:2.85rem;padding:0 1.15rem;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e7eeea;font-weight:500;font-size:.95rem;white-space:nowrap}
.bl-ghost:hover{background:rgba(255,255,255,.08)}
.bl-cta:focus-visible,.bl-ghost:focus-visible,.bl-bar a:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(94,231,197,.28)}
.bl-meta{display:inline-flex;align-items:center;gap:.4rem;height:2.15rem;padding:0 .85rem;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#c9d4ce;font-size:.82rem}
.bl-meta b{color:var(--bl-teal);font-weight:600}
.bl-stage{position:relative;border-radius:2.6rem;padding:1.35rem 1.15rem 1.5rem;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.1);box-shadow:0 40px 90px -36px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.08)}
.bl-stage::before{content:"";position:absolute;inset:-12% -18% auto;height:70%;background:radial-gradient(closest-side,rgba(70,220,160,.28),transparent 70%);filter:blur(12px);z-index:-1}
.bl-phone{position:relative;width:100%;aspect-ratio:642/1266;border-radius:2.15rem;padding:.42rem;background:linear-gradient(165deg,#3a4246,#14191c 40%,#0c1012);box-shadow:0 30px 60px -28px rgba(0,0,0,.85),0 0 0 1px rgba(255,255,255,.14)}
.bl-phone::before{content:"";position:absolute;top:.72rem;left:50%;z-index:2;width:4.4rem;height:1.05rem;margin-left:-2.2rem;border-radius:999px;background:#050708}
.bl-screen{position:relative;height:100%;overflow:hidden;border-radius:1.8rem;background:#0c0e10}
.bl-video,.bl-screen img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
.bl-float{display:inline-flex;align-items:center;gap:.45rem;padding:.45rem .7rem;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(12,16,15,.78);font-size:.78rem;color:#e7eeea;white-space:nowrap;box-shadow:0 12px 30px -18px #000;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.bl-float i{width:.45rem;height:.45rem;border-radius:50%;background:#5ee7c5;box-shadow:0 0 10px #5ee7c5}
.bl-float-a{position:absolute;left:0;top:38%;transform:translateX(-18%)}
.bl-float-b{position:absolute;right:0;top:58%;transform:translateX(18%)}
.bl-float-c{position:absolute;bottom:1.4rem;left:1.2rem}
@media (max-width:1023px){.bl-float-a,.bl-float-b,.bl-float-c{position:static;transform:none;margin:.4rem .4rem 0 0}}
.bl-reason{border-radius:1.35rem;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02));padding:1.35rem 1.25rem 1.45rem}
.bl-ico{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:.8rem;border:1px solid rgba(94,231,197,.28);background:rgba(94,231,197,.06);color:var(--bl-teal)}
.bl-quote{border-radius:1.25rem;border:1px solid rgba(94,231,197,.18);background:linear-gradient(90deg,rgba(40,120,96,.28),rgba(16,22,20,.4) 42%,rgba(16,22,20,.2));padding:1.15rem 1.4rem;color:#d5e0da;line-height:1.55}
.bl-quote b{color:#7af0d2;font-weight:600}
.bl-num{font-family:var(--font-sans),sans-serif;font-weight:700;font-size:clamp(4.2rem,7vw,5.6rem);line-height:.8;letter-spacing:-.05em;color:#6ff0cf;text-shadow:0 0 42px rgba(90,240,200,.35)}
.bl-frame{position:relative;width:min(100%,22rem);border-radius:2rem;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));padding:1.35rem 1.15rem 1.15rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.bl-frame::before{content:"";position:absolute;inset:8% -12%;z-index:-1;background:radial-gradient(closest-side,rgba(80,220,170,.22),transparent 72%);filter:blur(16px)}
.bl-frame .bl-phone{width:78%;margin:1rem auto 0}
.bl-tag{display:inline-flex;align-items:center;gap:.4rem;margin-top:.85rem;padding:.4rem .7rem;border-radius:999px;border:1px solid rgba(94,231,197,.25);background:rgba(8,14,12,.8);color:#cfe7df;font-size:.75rem}
.bl-tag i{color:var(--bl-teal)}
.bl-close{position:relative;overflow:hidden;border-radius:1.75rem;border:1px solid rgba(255,255,255,.08);background:
  radial-gradient(70% 80% at 70% 0%,rgba(90,80,180,.28),transparent 55%),
  radial-gradient(60% 80% at 20% 100%,rgba(40,140,110,.35),transparent 60%),
  #0c1214;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.bl-marquee{width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
.bl-ticker{position:relative;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.bl-ticker-track{display:flex;gap:.75rem;width:max-content;padding:.15rem 0;animation:bl-ticker 42s linear infinite}
.bl-ticker:hover .bl-ticker-track{animation-play-state:paused}
.bl-note{display:inline-flex;align-items:center;gap:.6rem;height:2.85rem;padding:0 1.1rem 0 .95rem;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.045);color:#e4ece8;font-size:.98rem;white-space:nowrap}
.bl-note i{width:.5rem;height:.5rem;border-radius:50%;box-shadow:0 0 12px currentColor;flex:none}
@keyframes bl-ticker{to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.bl-ticker-track{animation:none}}
}
`;

function OpenLink({ children, className }: { children: ReactNode; className: string }) {
  return (
    <a href={LANDING_BOT_URL} data-start={LANDING_START_PARAM} className={className}>
      {children}
      <span aria-hidden>→</span>
    </a>
  );
}

function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const root = event.currentTarget.closest(".between-landing");
  const target = document.getElementById(id);
  if (!root || !target) return;
  event.preventDefault();
  const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 24;
  root.scrollTo({ top, behavior: "smooth" });
}

function Kicker({ children }: { children: string }) {
  return (
    <p className="bl-kicker">
      <i />
      {children}
    </p>
  );
}

function MoodDots() {
  return (
    <span className="mt-3 flex justify-center gap-1.5" aria-hidden>
      {DOTS.map((feeling) => (
        <i key={feeling} className="block h-1.5 w-1.5 rounded-full" style={{ background: feelingFill(feeling) }} />
      ))}
    </span>
  );
}

function Icon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <span className="bl-ico">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        {name === "box" && (
          <>
            <rect {...common} x="4" y="4" width="16" height="16" rx="3" />
            <path {...common} d="M8 12h8M8 8.5h5" />
          </>
        )}
        {name === "clock" && (
          <>
            <circle {...common} cx="12" cy="12" r="7.5" />
            <path {...common} d="M12 8.2V12l2.5 1.6" />
          </>
        )}
        {name === "chat" && <path {...common} d="M6 16.5 4.5 20l4-1.6A8 8 0 1 0 6 16.5z" />}
      </svg>
    </span>
  );
}

function StepFrame({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div className="bl-frame text-center">
      <p className="text-[0.62rem] font-semibold tracking-[0.22em] text-[var(--bl-teal)]">BETWEEN</p>
      <h3 className="mt-3 font-display text-[1.65rem] leading-tight tracking-tight">{step.frameTitle}</h3>
      <MoodDots />
      <p className="mx-auto mt-3 max-w-[16rem] text-[0.8rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
        {step.frameNote}
      </p>
      <div className="bl-phone">
        <div className="bl-screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={step.image} alt={step.alt} width={642} height={1266} />
        </div>
      </div>
      <p className="bl-tag">
        <i>▸</i>
        {step.chip}
      </p>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="between-landing fixed inset-0 z-40 hidden overflow-x-hidden overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="relative min-h-full">
        <div className="bl-wash" aria-hidden />

        <header className="relative z-20 px-4">
          <div className="bl-bar">
            <a href="#top" onClick={(event) => jump(event, "top")} className="bl-logo">
              <span className="bl-mark" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M8 1.4 14 8 8 14.6 2 8Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
              Between
            </a>
            <nav className="hidden sm:block" aria-label="Разделы">
              <a href="#kak" onClick={(event) => jump(event, "kak")}>
                Как это работает
              </a>
            </nav>
            <OpenLink className="bl-cta bl-cta-sm">Открыть в Telegram</OpenLink>
          </div>
        </header>

        <main id="top" className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
          <section className="grid items-center gap-14 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-8 lg:pt-16">
            <div className="max-w-xl">
              <Kicker>Дневник для тех, кто в терапии</Kicker>
              <h1 className="mt-5 font-display text-[2.7rem] leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.15rem]">
                Терапевт попросил вести дневник.
                <br />
                <span className="bl-shift">
                  Вы честно
                  <br />
                  пытались.
                </span>
              </h1>
              <p className="mt-6 max-w-md text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                Between — дневник в Telegram, который ведёт себя сам: сам спрашивает, как прошёл день, сам складывает
                записи в понятную картину. Вам — только отвечать. К следующей сессии всё, что стоит рассказать, уже
                собрано.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <OpenLink className="bl-cta">Открыть Between</OpenLink>
                <a href="#kak" onClick={(event) => jump(event, "kak")} className="bl-ghost">
                  Как это работает
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-2">
                {["Без установки приложений", "Старт за минуту", "Записи — только ваши"].map((item) => (
                  <li key={item} className="bl-meta">
                    <b>+</b>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-[24rem]">
              <div className="bl-stage">
                <p className="text-center font-display text-[1.7rem] leading-tight tracking-tight">
                  Приходи
                  <br />
                  подготовленным
                </p>
                <MoodDots />
                <p className="mx-auto mt-3 max-w-[16rem] text-center text-[0.8rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                  Всё, что стоит обсудить, само собирается в список к следующей сессии.
                </p>
                <div className="relative mx-auto mt-4 w-[78%]">
                  <div className="bl-phone">
                    <div className="bl-screen" dangerouslySetInnerHTML={{ __html: VIDEO_HTML }} />
                  </div>
                </div>
              </div>
              <span className="bl-float bl-float-a">
                <i />
                Запись сохранена
              </span>
              <span className="bl-float bl-float-b">как день? · 21:00</span>
              <span className="bl-float bl-float-c">
                <i />
                +2 темы к сессии
              </span>
            </div>
          </section>

          <section className="bl-marquee mt-20 sm:mt-28" aria-label="Примеры записей">
            <div className="flex justify-center">
              <Kicker>Например, так</Kicker>
            </div>
            <div className="bl-ticker mt-6">
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

          <section id="dnevnik" className="mt-24 sm:mt-28">
            <Kicker>Знакомо?</Kicker>
            <h2 className="mt-4 max-w-xl font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              Почему «просто вести дневник» не работает
            </h2>
            <p className="mt-4 max-w-xl text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
              Терапевты почти всегда просят записи между сессиями — это правда помогает. Вот только мешают три вещи:
            </p>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {REASONS.map((reason) => (
                <li key={reason.title} className="bl-reason">
                  <Icon name={reason.icon} />
                  <h3 className="mt-4 text-[1.05rem] font-semibold tracking-tight">{reason.title}</h3>
                  <p className="mt-2 text-[0.92rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                    {reason.body}
                  </p>
                </li>
              ))}
            </ul>
            <p className="bl-quote mt-5 text-[0.98rem]">
              Дело не в силе воли. Обычный дневник — это работа, за которую никто не берётся ещё и вечером.{" "}
              <b>Between</b> встраивается в переписку и берёт рутину на себя.
            </p>
          </section>

          <section id="kak" className="mt-24 sm:mt-32">
            <Kicker>Как это работает</Kicker>
            <h2 className="mt-4 max-w-2xl font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              Стартанули бота — и к сессии всё готово
            </h2>
            <p className="mt-4 max-w-md text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
              Четыре шага. Ваше участие — только в первых двух, остальное Between делает сам.
            </p>
            <ol className="mt-16 flex flex-col gap-20 sm:mt-20 sm:gap-28">
              {STEPS.map((step, index) => (
                <li key={step.n} className={`flex flex-col items-center gap-10 lg:flex-row lg:gap-16 ${index % 2 ? "lg:flex-row-reverse" : ""}`}>
                  <div className="w-full max-w-md flex-1">
                    <p className="bl-kicker">
                      <i className="!w-1.5 !h-1.5 !rounded-full !bg-[var(--bl-teal)]" />
                      Шаг {step.n}
                    </p>
                    <p className="bl-num mt-3">{step.n}</p>
                    <h3 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">{step.title}</h3>
                    <p className="mt-4 max-w-sm text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                      {step.body}
                    </p>
                  </div>
                  <StepFrame step={step} />
                </li>
              ))}
            </ol>
          </section>

          <section className="bl-close mt-24 px-6 py-16 text-center sm:mt-32 sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              Между сессиями <span className="bl-shift">всё и происходит</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
              Именно там Between и живёт. Откройте бота и напишите первую запись — она займёт минуту. Дальше он сам.
            </p>
            <div className="mt-8">
              <OpenLink className="bl-cta">Открыть в Telegram</OpenLink>
            </div>
            <p className="mt-4 text-sm" style={{ color: "var(--bl-dim)" }}>
              Работает везде, где есть Telegram: телефон, планшет, компьютер.
            </p>
          </section>
        </main>

        <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:px-8">
          <p className="text-sm" style={{ color: "var(--bl-dim)" }}>
            Between — дневник между сессиями терапии
          </p>
          <a href={LANDING_BOT_URL} data-start={LANDING_START_PARAM} className="text-sm" style={{ color: "var(--bl-muted)" }}>
            @BetweenJournalBot
          </a>
        </footer>
      </div>
    </div>
  );
}
