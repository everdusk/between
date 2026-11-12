"use client";

import { MESSENGER_CSS, MessengerButtons, QrCard } from "@/components/landing-messengers";
import { LANDING_BOT_URL, LANDING_MAX_WEB_URL, LANDING_START_PARAM } from "@/lib/landing";
import { LEGAL_INN } from "@/lib/legal";
import { feelingFill } from "@/lib/spectrum";
import type { Feeling } from "@/lib/types";
import type { MouseEvent } from "react";

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
    title: "Напишите боту",
    body: "Строчка в очереди, голосовое по дороге, поток в полночь — как получилось. Between сохранит настроение и аккуратно разложит всё по дням.",
    image: "/landing/step-1.webp",
    alt: "Чат с ботом: заметка своими словами и ответ «Записал на сегодня.»",
  },
  {
    n: "02",
    title: "Картина собирается сама",
    body: "Вы ничего не сортируете. Эмоции, повторы и недосказанное Between складывает в наглядную картину: что происходило и как вы на это реагировали.",
    image: "/landing/step-2.webp",
    alt: "Спектр недели: спокойно, 22–28 октября",
  },
  {
    n: "03",
    title: "Приходите подготовленным",
    body: "Ко встрече с терапевтом уже ждёт выкладка: что обсудить, что повторялось, о чём спросить. Никаких «я хз, я норм».",
    image: "/landing/step-3.webp",
    alt: "Темы к сессии: граница с работой, звонок мамы",
  },
];

const VIDEO_HTML = `<video class="bl-video" autoplay muted loop playsinline preload="metadata" poster="/landing/poster.webp" aria-label="Нажатие «тревожно», заметка своими словами, спектр недели, темы к сессии, настройка даты сессии и заставка Between"><source src="/landing/screen-ru.webm" type="video/webm"><source src="/landing/screen-ru.mp4" type="video/mp4"></video>`;

const CSS = `
@layer components{
.between-landing{--bl-bg:#07090d;--bl-fg:#f3f6f4;--bl-muted:#a9b4ae;--bl-dim:#74827b;--bl-teal:#5ee7c5;--bl-line:rgba(255,255,255,.1);background:#07090d;color:var(--bl-fg);color-scheme:only dark;-webkit-font-smoothing:antialiased}
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
${MESSENGER_CSS}
.bl-qrcard{display:inline-flex;align-items:center;gap:.7rem;padding:.4rem .85rem .4rem .4rem;border-radius:1.1rem;border:1px solid rgba(94,231,197,.22);background:rgba(94,231,197,.06);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);color:#c9d4ce;font-size:.78rem;line-height:1.35;text-align:left;white-space:nowrap;text-decoration:none}
.bl-qrcard b{display:block;color:#5ee7c5;font-weight:600}
.bl-qr{display:block;width:5.15rem;height:5.15rem;flex:none;border-radius:.75rem;background:#c8f8c4;padding:.28rem}
.bl-qr svg{display:block;width:100%;height:100%}
.bl-ghost{display:inline-flex;align-items:center;justify-content:center;height:2.85rem;padding:0 1.15rem;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e7eeea;font-weight:500;font-size:.95rem;white-space:nowrap}
.bl-ghost:hover{background:rgba(255,255,255,.08)}
.bl-ghost:active{transform:scale(.98)}
.bl-ghost:focus-visible,.bl-bar a:focus-visible,.bl-qrcard:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(94,231,197,.28)}
.bl-meta{display:inline-flex;align-items:center;gap:.4rem;height:2.15rem;padding:0 .85rem;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#c9d4ce;font-size:.82rem}
.bl-meta b{color:var(--bl-teal);font-weight:600}
.bl-phone{position:relative;width:100%;aspect-ratio:642/1266;border-radius:2.15rem;padding:.42rem;background:linear-gradient(165deg,#3a4246,#14191c 40%,#0c1012);box-shadow:0 30px 60px -28px rgba(0,0,0,.85),0 0 0 1px rgba(255,255,255,.14)}
.bl-phone::before{content:"";position:absolute;top:.72rem;left:50%;z-index:2;width:4.4rem;height:1.05rem;margin-left:-2.2rem;border-radius:999px;background:#050708}
.bl-screen{position:relative;height:100%;overflow:hidden;border-radius:1.8rem;background:#0c0e10}
.bl-video,.bl-screen img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
.bl-reason{border-radius:1.35rem;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02));padding:1.35rem 1.25rem 1.45rem}
.bl-ico{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:.8rem;border:1px solid rgba(94,231,197,.28);background:rgba(94,231,197,.06);color:var(--bl-teal)}
.bl-quote{border-radius:1.25rem;border:1px solid rgba(94,231,197,.18);background:linear-gradient(90deg,rgba(40,120,96,.28),rgba(16,22,20,.4) 42%,rgba(16,22,20,.2));padding:1.15rem 1.4rem;color:#d5e0da;line-height:1.55}
.bl-quote b{color:#7af0d2;font-weight:600}
.bl-num{font-family:var(--font-sans),sans-serif;font-weight:700;font-size:clamp(4.2rem,7vw,5.6rem);line-height:.8;letter-spacing:-.05em;color:#6ff0cf;text-shadow:0 0 42px rgba(90,240,200,.35)}
.bl-shot{display:block;width:min(100%,18.5rem);height:auto;margin-inline:auto;border-radius:1.35rem}
@media (max-width:639px){
  .bl-bar{gap:.55rem;padding-left:.7rem}
  .bl-ghost{width:100%}
  .bl-qrcard{display:none}
  .bl-kicker{letter-spacing:.12em}
  .bl-close{padding-left:1.15rem;padding-right:1.15rem}
}
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

function StepShot({ step }: { step: (typeof STEPS)[number] }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="bl-shot" src={step.image} alt={step.alt} width={588} height={1280} />
  );
}

export function LandingPage({ qr }: { qr: string }) {
  return (
    <div className="between-landing fixed inset-0 z-40 hidden overflow-x-hidden overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="relative min-h-full">
        <div className="bl-wash" aria-hidden />

        <header className="relative z-20 px-4 pt-[max(0.25rem,env(safe-area-inset-top))]">
          <div className="bl-bar">
            <a href="#top" onClick={(event) => jump(event, "top")} className="bl-logo">
              <span className="bl-mark" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M8 1.4 14 8 8 14.6 2 8Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
              Between
            </a>
            <nav className="hidden items-center gap-4 sm:flex" aria-label="Разделы">
              <a href="#kak" onClick={(event) => jump(event, "kak")}>
                Как это работает
              </a>
            </nav>
            <MessengerButtons compact />
          </div>
        </header>

        <main id="top" className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
          <section className="grid items-center gap-10 pt-8 sm:gap-14 sm:pt-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-8 lg:pt-16">
            <div className="max-w-xl">
              <Kicker>Дневник для тех, кто в терапии</Kicker>
              <h1 className="mt-5 font-display text-[2.35rem] leading-[1.02] tracking-tight min-[380px]:text-[2.7rem] sm:text-6xl lg:text-[4.15rem]">
                Терапевт попросил вести дневник.
                <br />
                <span className="bl-shift">
                  Вы честно
                  <br />
                  пытались.
                </span>
              </h1>
              <p className="mt-6 max-w-md text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                Between — дневник в Telegram или MAX, который ведёт себя сам: сам спрашивает, как прошёл день, сам
                складывает записи в понятную картину. Вам — только отвечать. К следующей сессии всё, что стоит
                рассказать, уже собрано.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <MessengerButtons />
                <a href="#kak" onClick={(event) => jump(event, "kak")} className="bl-ghost">
                  Как это работает
                </a>
              </div>
              <div className="mt-5 hidden sm:block">
                <QrCard svg={qr} />
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

            <div className="relative mx-auto w-full max-w-[17.5rem] min-[380px]:max-w-[20rem] lg:max-w-[24rem]">
              <div className="bl-phone">
                <div className="bl-screen" dangerouslySetInnerHTML={{ __html: VIDEO_HTML }} />
              </div>
            </div>
          </section>

          <section className="bl-marquee mt-14 sm:mt-28" aria-label="Примеры записей">
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

          <section id="dnevnik" className="mt-16 sm:mt-28">
            <Kicker>Знакомо?</Kicker>
            <h2 className="mt-4 max-w-xl font-display text-[2.15rem] leading-[1.05] tracking-tight sm:text-5xl">
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

          <section id="kak" className="mt-16 sm:mt-32">
            <Kicker>Как это работает</Kicker>
            <h2 className="mt-4 max-w-2xl font-display text-[2.15rem] leading-[1.05] tracking-tight sm:text-5xl">
              Стартанули бота — и к сессии всё готово
            </h2>
            <p className="mt-4 max-w-md text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
              Три шага. Ваше участие — только в первом, остальное Between делает сам.
            </p>
            <ol className="mt-12 flex flex-col gap-14 sm:mt-20 sm:gap-28">
              {STEPS.map((step, index) => (
                <li key={step.n} className={`flex flex-col items-center gap-6 sm:gap-10 lg:flex-row lg:gap-16 ${index % 2 ? "lg:flex-row-reverse" : ""}`}>
                  <div className="w-full max-w-md flex-1">
                    <p className="bl-kicker">
                      <i className="!w-1.5 !h-1.5 !rounded-full !bg-[var(--bl-teal)]" />
                      Шаг {step.n}
                    </p>
                    <p className="bl-num mt-3">{step.n}</p>
                    <h3 className="mt-4 font-display text-[1.85rem] tracking-tight sm:text-4xl">{step.title}</h3>
                    <p className="mt-4 max-w-sm text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
                      {step.body}
                    </p>
                  </div>
                  <StepShot step={step} />
                </li>
              ))}
            </ol>
          </section>

          <section className="bl-close mt-16 px-6 py-12 text-center sm:mt-32 sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-3xl font-display text-[2.15rem] leading-[1.05] tracking-tight sm:text-6xl">
              Между сессиями <span className="bl-shift">всё и происходит</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[1.02rem] leading-relaxed" style={{ color: "var(--bl-muted)" }}>
              Именно там Between и живёт. Откройте бота и напишите первую запись — она займёт минуту. Дальше он сам.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5">
              <MessengerButtons />
              <QrCard svg={qr} />
            </div>
            <p className="mt-4 text-sm" style={{ color: "var(--bl-dim)" }}>
              Telegram и MAX: телефон, планшет, компьютер. MAX открывается без VPN.
            </p>
          </section>
        </main>

        <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-end sm:px-8">
          <div>
            <p className="text-sm" style={{ color: "var(--bl-dim)" }}>
              Between: дневник между сессиями терапии
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--bl-dim)" }}>
              <a href="/terms">Условия использования</a>
              {" · "}
              <a href="/privacy">Политика конфиденциальности</a>
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--bl-dim)" }}>
              ИНН {LEGAL_INN}
            </p>
          </div>
          <p className="text-sm" style={{ color: "var(--bl-muted)" }}>
            <a href={LANDING_BOT_URL} data-start={LANDING_START_PARAM}>
              @BetweenJournalBot
            </a>
            {" · "}
            <a href={LANDING_MAX_WEB_URL} data-start={LANDING_START_PARAM}>
              MAX
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
