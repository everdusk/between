"use client";

/* Full document navigation runs the journal's surface bootstrap. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { useState } from "react";
import { LanguageSwitch } from "./language-switch";
import { LocaleProvider, useI18n } from "./locale-provider";
import { LEGAL_INN } from "@/lib/legal";
import "./landing-chapters.css";

const chapters = [
  {
    "label": "События",
    "title": "Что произошло.",
    "body": "Разговор, который не выходит из головы. Хороший день, который хочется запомнить. Мысль, к которой важно вернуться. Сохраните своими словами — достаточно одной строки.",
    "clip": "events"
  },
  {
    "label": "Чувства",
    "title": "Что вы чувствуете.",
    "body": "Отмечайте чувства в течение дня. Between покажет, как меняется ваше состояние: что чаще сопровождает утро, накапливается к вечеру или возвращается изо дня в день.",
    "clip": "feelings"
  },
  {
    "label": "Анализ",
    "title": "Что повторяется.",
    "body": "Рабочий день закончился, а разговор всё ещё крутится в голове. Один такой вечер легко забыть. В обзоре недели вы увидите, как менялось настроение по дням и какие мысли возвращались в ваших записях.",
    "clip": "overview"
  },
  {
    "label": "Выводы",
    "title": "Сделайте выводы.",
    "body": "Что стало понятнее после разбора? Что оказалось важным, а что ещё хочется исследовать? Between поможет сформулировать и сохранить ваш вывод — или вопрос, с которым пока нет ясности. К нему можно вернуться самостоятельно или на терапии.",
    "clip": "insights"
  },
  {
    "label": "Изменения",
    "title": "Меняйтесь.",
    "body": "Выберите небольшой шаг, который хочется попробовать. Дать себе паузу, иначе ответить на просьбу или чаще делать то, что поддерживает. Возвращайтесь к записям, чтобы посмотреть, что изменилось и что подходит именно вам.",
    "clip": "changes"
  }
] as const;

const englishChapters = [
  { label: "Events", title: "What happened.", body: "A conversation you keep replaying. A good day you want to remember. A thought worth coming back to. Write it down in your own words. One line is enough." },
  { label: "Feelings", title: "How you feel.", body: "Check in with yourself throughout the day. Your weekly overview helps you see how mornings feel, what builds up by evening, and which feelings keep coming back." },
  { label: "Analysis", title: "What repeats.", body: "Work is over, but you're still replaying a conversation. One evening like that is easy to forget. Look back over the week to see how your mood shifted and which thoughts kept turning up in your notes." },
  { label: "Insights", title: "What stands out.", body: "What makes more sense now? What would you like to explore? Save a thought or a question while it's fresh. Come back to it on your own or at your next therapy session." },
  { label: "Changes", title: "What to try.", body: "Pick one small thing you'd like to try. Pause before saying yes, take a different route home, or make time for something that helps. Look back at your notes to see how it felt." },
] as const;

export function LandingPage() {
  return <LocaleProvider publicLanguages landing><LandingContent /></LocaleProvider>;
}

function LandingContent() {
  const { locale } = useI18n();
  const en = locale === "en";
  const [chapter, setChapter] = useState(0);
  const copy = en ? englishChapters : chapters;
  const { label, title, body } = copy[chapter];
  const { clip } = chapters[chapter];
  const media = `/landing/chapters/${en ? "en/" : ""}${clip}`;
  const start = en ? "Get started" : "Начать знакомство";
  return (
    <main className="between-landing chapter-page">
      <div className="chapter-wrap">
        <header>
          <b>Between</b>
          <div className="flex items-center gap-2"><LanguageSwitch /><a href={`/?login=1&lang=${locale}`}>{en ? "Sign in" : "Войти"}</a></div>
        </header>
        <div className="chapter-hero">
          <section className="chapter-story">
            <div key={clip} className="chapter-copy">
              <h1 data-chapter={clip}>{title}</h1>
              <p>{body}</p>
            </div>
            <a className="chapter-cta" href={`/?start=1&lang=${locale}`}>{start}</a>
            <nav aria-label={en ? "Chapters" : "Главы"}>
              <small>{en ? "Chapters" : "Главы"}</small>
              {copy.map((item, i) => (
                <button key={chapters[i].clip} aria-pressed={chapter === i} onClick={() => setChapter(i)}>
                  <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>{item.label}
                </button>
              ))}
            </nav>
          </section>
          <figure className="chapter-screen">
            <video key={media} muted playsInline controls preload="metadata"
              ref={video => {
                if (video?.getClientRects().length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                  void video.play().catch(() => {});
                }
              }}
              onEnded={() => {
                if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                  setChapter((chapter + 1) % chapters.length);
                }
              }}
              poster={`${media}.webp`}
              src={`${media}.mp4`}
              aria-label={`${en ? "Between web journal" : "Веб-дневник Between"} · ${label}`} />
            <figcaption>{en ? "Your notes. Your pace." : "Ваши записи. Ваш темп."}</figcaption>
          </figure>
        </div>
        <section className="chapter-audience">
          {en ? <>
            <h2>For yourself.<br />Or with your therapist.</h2>
            <article><h3>For personal reflection</h3><p>Group your notes by theme and explore how events and feelings show up together. Keep your insights and choose what you'd like to try next.</p></article>
            <article><h3>If you're in therapy</h3><p>Keep track of what matters between sessions. Add your session schedule and revisit your notes and questions before your next appointment.</p></article>
          </> : <>
          <h2>Для себя.<br />Или вместе с терапевтом.</h2>
          <article><h3>Для самостоятельной рефлексии</h3><p>Собирайте записи по темам, замечайте повторения и исследуйте возможные связи между событиями и чувствами. Сохраняйте выводы и выбирайте, что попробовать дальше.</p></article>
          <article><h3>Для тех, кто в терапии</h3><p>Сохраните важное между встречами. Добавьте расписание сеансов — и возвращайтесь к записям и вопросам перед следующей встречей.</p></article>
          </>}
        </section>
        <footer>
          <a className="chapter-cta" href={`/?start=1&lang=${locale}`}>
            {start}
          </a>
          <p>{en ? "7 days free. No card or automatic charges." : "7 дней бесплатно. Без карты и автосписаний."}</p>
          <div>
            <a href="/privacy">{en ? "Privacy policy" : "Политика конфиденциальности"}</a> ·{" "}
            <a href="/terms">{en ? "Terms of use" : "Условия использования"}</a> · {en ? "Tax ID" : "ИНН"} {LEGAL_INN}
          </div>
        </footer>
      </div>
    </main>
  );
}
