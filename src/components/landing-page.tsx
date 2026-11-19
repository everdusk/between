"use client";

/* Full document navigation runs the journal's surface bootstrap. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { useState } from "react";
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

export function LandingPage() {
  const [chapter, setChapter] = useState(0);
  const { label, title, body, clip } = chapters[chapter];
  return (
    <main className="between-landing chapter-page">
      <div className="chapter-wrap">
        <header>
          <b>Between</b>
          <a href="/?login=1">Войти</a>
        </header>
        <div className="chapter-hero">
          <section className="chapter-story">
            <div key={clip} className="chapter-copy">
              <h1 data-chapter={clip}>{title}</h1>
              <p>{body}</p>
            </div>
            <a className="chapter-cta" href="/?start=1">Начать знакомство</a>
            <nav aria-label="Главы">
              <small>Главы</small>
              {chapters.map((item, i) => (
                <button key={item.clip} aria-pressed={chapter === i} onClick={() => setChapter(i)}>
                  <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>{item.label}
                </button>
              ))}
            </nav>
          </section>
          <figure className="chapter-screen">
            <video key={clip} muted playsInline controls preload="metadata"
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
              poster={`/landing/chapters/${clip}.webp`}
              src={`/landing/chapters/${clip}.mp4`}
              aria-label={`Веб-дневник Between · ${label}`} />
            <figcaption>Ваши записи. Ваш темп.</figcaption>
          </figure>
        </div>
        <section className="chapter-audience">
          <h2>Для себя.<br />Или вместе с терапевтом.</h2>
          <article><h3>Для самостоятельной рефлексии</h3><p>Собирайте записи по темам, замечайте повторения и исследуйте возможные связи между событиями и чувствами. Сохраняйте выводы и выбирайте, что попробовать дальше.</p></article>
          <article><h3>Для тех, кто в терапии</h3><p>Сохраните важное между встречами. Добавьте расписание сеансов — и возвращайтесь к записям и вопросам перед следующей встречей.</p></article>
        </section>
        <footer>
          <a className="chapter-cta" href="/?start=1">
            Начать знакомство
          </a>
          <p>7 дней бесплатно. Без карты и автосписаний.</p>
          <div>
            <a href="/privacy">Политика конфиденциальности</a> ·{" "}
            <a href="/terms">Условия использования</a> · ИНН {LEGAL_INN}
          </div>
        </footer>
      </div>
    </main>
  );
}
