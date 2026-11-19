"use client";

/* Full document navigation runs the journal's surface bootstrap. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { useState } from "react";
import { LEGAL_INN } from "@/lib/legal";
import "./landing-chapters.css";

const chapters = [
  [
    "События",
    "Что произошло.",
    "Разговор, который не выходит из головы. Хороший день, который хочется запомнить. Мысль, к которой важно вернуться. Сохраните своими словами — достаточно одной строки.",
  ],
  [
    "Чувства",
    "Что вы чувствуете.",
    "Отмечайте чувства в течение дня. В обзоре можно увидеть, что чаще сопровождает утро, накапливается к вечеру или возвращается изо дня в день.",
  ],
  [
    "Анализ",
    "Проанализируйте.",
    "Отдыхаете, а тревога не отпускает? Between соберёт похожие эпизоды рядом. Сравните свои записи и посмотрите, что у них общего.",
  ],
  [
    "Выводы",
    "Сделайте выводы.",
    "Что стало понятнее после разбора? Сохраните свой вывод или вопрос, к которому хочется вернуться самостоятельно или на терапии.",
  ],
  [
    "Изменения",
    "Меняйтесь.",
    "Выберите небольшой шаг, который хочется попробовать. Дать себе паузу, иначе ответить на просьбу или чаще делать то, что поддерживает.",
  ],
] as const;

export function LandingPage() {
  const [chapter, setChapter] = useState(0);
  const [, title, body] = chapters[chapter];
  return (
    <main className="between-landing chapter-page">
      <div className="chapter-wrap">
        <header>
          <div>
            <b>Between</b>
            <span> — дневник для рефлексии</span>
          </div>
          <a href="/?login=1">Войти</a>
        </header>
        <div className="chapter-hero">
          <section className="chapter-story">
            <nav aria-label="Главы">
              {chapters.map(([label], i) => (
                <button
                  key={label}
                  aria-pressed={chapter === i}
                  onClick={() => setChapter(i)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div aria-live="polite">
              <h1>{title}</h1>
              <p>{body}</p>
              <a className="chapter-cta" href="/">
                Начать знакомство
              </a>
            </div>
          </section>
          <div className="chapter-screen">
            <video
              muted
              playsInline
              controls
              preload="metadata"
              poster="/landing/poster.webp"
              aria-label="Демонстрация дневника Between"
            >
              <source src="/landing/screen-ru.webm" type="video/webm" />
              <source src="/landing/screen-ru.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
        <section className="chapter-audience">
          <article>
            <h2>Для себя.</h2>
            <p>
              Собирайте записи по темам, замечайте повторения и выбирайте, что
              попробовать дальше.
            </p>
          </article>
          <article>
            <h2>Вместе с терапевтом.</h2>
            <p>
              Сохраняйте важное между встречами. Укажите расписание сеансов,
              чтобы возвращаться к своим записям и вопросам перед встречей.
            </p>
          </article>
        </section>
        <footer>
          <a className="chapter-cta" href="/">
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
