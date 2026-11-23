"use client";

/* Full document navigation runs the journal's surface bootstrap. */

import { BrandLogo } from "./brand-logo";
import Image from "next/image";
import { MessagesSquare, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SchemeSwitch, useDemoMediaDirectory } from "./scheme-switch";
import { useI18n } from "./locale-provider";
import { trackSurvey } from "@/lib/survey-analytics";
import "./web-theme.css";
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
    "label": "Темы",
    "title": "На подумать.",
    "body": "На встрече вы согласились помочь. В переписке с другом снова ответили «да» быстрее, чем хотелось. ИИ объединяет такие записи в тему. Откройте её, чтобы увидеть эти моменты рядом.",
    "clip": "topics"
  },
  {
    "label": "Выводы",
    "title": "Сделайте выводы.",
    "body": "Что стало понятнее после разбора? Что оказалось важным, а что ещё хочется исследовать? Between поможет сформулировать и сохранить ваш вывод — или вопрос, с которым пока нет ясности. К нему можно вернуться самостоятельно или на терапии.",
    "clip": "insights"
  },
  {
    "label": "Изменения",
    "title": "Мои темы.",
    "body": "Когда поймёте, что хочется попробовать, нажмите галочку рядом с темой и запишите своё решение. Например: «В следующий раз скажу, что мне нужно подумать. Дам себе время понять, чего я хочу».",
    "clip": "changes"
  }
] as const;

const englishChapters = [
  { label: "Events", title: "What happened.", body: "A conversation you keep replaying. A good day you want to remember. A thought worth coming back to. Write it down in your own words. One line is enough." },
  { label: "Feelings", title: "How you feel.", body: "Check in with yourself throughout the day. Your weekly overview helps you see how mornings feel, what builds up by evening, and which feelings keep coming back." },
  { label: "Analysis", title: "What repeats.", body: "Work is over, but you're still replaying a conversation. One evening like that is easy to forget. Look back over the week to see how your mood shifted and which thoughts kept turning up in your notes." },
  { label: "Topics", title: "For reflection.", body: "You offered to help in a meeting. Later, you said yes to a friend before you had time to think. AI brings entries like these together under one topic. Open it to see those moments side by side." },
  { label: "Insights", title: "What stands out.", body: "What makes more sense now? What would you like to explore? Save a thought or a question while it's fresh. Come back to it on your own or at your next therapy session." },
  { label: "Changes", title: "My topics.", body: "When you know what you’d like to try, tap the checkmark beside the topic and write it down. “Next time, I’ll say I need a moment. I want to give myself time to work out what I want.”" },
] as const;

function ChapterHeading({ title, clip }: { title: string; clip: string }) {
  const [visible, setVisible] = useState(title);
  const current = useRef(title);

  useEffect(() => {
    if (current.current === title) return;
    const previous = current.current;
    let length = previous.length;
    let erasing = length > 0;
    let timer: number;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function advance() {
      if (motion.matches) {
        current.current = title;
      } else if (erasing) {
        length -= 1;
        current.current = previous.slice(0, length);
        erasing = length > 0;
      } else {
        length += 1;
        current.current = title.slice(0, length);
      }
      setVisible(current.current);
      if (current.current !== title) {
        timer = window.setTimeout(advance, erasing ? 22 : length === 0 ? 110 : 44);
      }
    }

    timer = window.setTimeout(advance, 0);
    return () => window.clearTimeout(timer);
  }, [title]);

  return (
    <h1 data-chapter={clip} className="chapter-heading" aria-label={title}>
      <span className="chapter-heading-size" aria-hidden>{title}</span>
      <span className="chapter-heading-text" aria-hidden data-typing={visible !== title}>{visible}</span>
    </h1>
  );
}

const mobileDemoQuery = "(max-width: 1024px), (pointer: coarse)";
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeDemoMode(notify: () => void) {
  const queries = [mobileDemoQuery, reducedMotionQuery].map(query => window.matchMedia(query));
  queries.forEach(query => query.addEventListener("change", notify));
  return () => queries.forEach(query => query.removeEventListener("change", notify));
}
function demoMode() {
  if (!window.matchMedia(mobileDemoQuery).matches) return "video";
  return window.matchMedia(reducedMotionQuery).matches ? "still" : "animation";
}
const initialDemoMode = () => "pending" as const;

// Playback lengths of the six GIFs, in chapter order.
const gifDurations = {
  ru: [5010, 6870, 6010, 7120, 9120, 11620],
  en: [5120, 6870, 6010, 7120, 9510, 11510],
};

export function LandingPage() {
  const { locale } = useI18n();
  const en = locale === "en";
  const [chapter, setChapter] = useState(0);
  const copy = en ? englishChapters : chapters;
  const { label, title, body } = copy[chapter];
  const { clip } = chapters[chapter];
  const journalDemo = chapter < 2;
  const feelingsAt = en ? 62 / 12 : 5;
  const videoRef = useRef<HTMLVideoElement>(null);
  const figureRef = useRef<HTMLElement>(null);
  const mode = useSyncExternalStore(subscribeDemoMode, demoMode, initialDemoMode);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [displayedFrame, setDisplayedFrame] = useState<{src: string; alt: string} | null>(null);
  const [failedGif, setFailedGif] = useState<string | null>(null);
  const directory = useDemoMediaDirectory();
  const folder = directory && `${directory}/chapters/${en ? "en/" : ""}`;
  const media = folder && folder + (journalDemo ? "events" : clip);
  const mediaVersion = 8;
  const animate = mode === "animation" && inView && !paused;
  const poster = folder && `${folder}${clip}.webp?v=${mediaVersion}`;
  const gif = folder && `${folder}${clip}.gif?v=${mediaVersion}`;
  const imageSrc = animate && gif !== failedGif ? gif : poster;
  const alt = `${en ? "Between web journal" : "Веб-дневник Between"} · ${label}`;
  const visibleFrame = displayedFrame ?? (poster ? {src: poster, alt} : null);
  const frames = visibleFrame ? [visibleFrame] : [];
  if (imageSrc && imageSrc !== visibleFrame?.src) frames.push({src: imageSrc, alt});
  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || mode !== "animation") return;
    let intersecting = false;
    const sync = () => setInView(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; sync(); });
    observer.observe(figure);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [mode]);
  useEffect(() => {
    if (!animate || !imageSrc || displayedFrame?.src !== imageSrc) return;
    const timer = window.setTimeout(() => setChapter((chapter + 1) % chapters.length), gifDurations[en ? "en" : "ru"][chapter]);
    return () => window.clearTimeout(timer);
  }, [animate, chapter, en, imageSrc, displayedFrame]);
  function selectChapter(index: number) {
    if (journalDemo && index < 2 && videoRef.current?.readyState) {
      videoRef.current.currentTime = index === 1 ? feelingsAt : 0;
    }
    setChapter(index);
  }
  const start = en ? "Get started" : "Начать знакомство";
  return (
    <main className="between-landing chapter-page">
      <div className="chapter-wrap">
        <header>
          <b><BrandLogo /></b>
          <div className="flex items-center gap-2">
            <SchemeSwitch />
            <a className="glass-chrome preference-control" href={`/?login=1&lang=${locale}`}>{en ? "Sign in" : "Войти"}</a>
          </div>
        </header>
        <div className="chapter-hero">
          <section className="chapter-story">
            <div className="chapter-copy">
              <ChapterHeading title={title} clip={clip} />
              <p key={clip}>{body}</p>
            </div>
            <a className="chapter-cta" onClick={() => trackSurvey({event: "web_landing_start", placement: "hero"}, locale)} href={`/?start=1&lang=${locale}`}>{start}</a>
            <nav aria-label={en ? "Chapters" : "Главы"}>
              <small>{en ? "Chapters" : "Главы"}</small>
              {copy.map((item, i) => (
                <button key={chapters[i].clip} aria-pressed={chapter === i} onClick={() => selectChapter(i)}>
                  <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>{item.label}
                </button>
              ))}
            </nav>
          </section>
          <figure className="chapter-screen" ref={figureRef}>
            {mode === "video" ? <video className="chapter-media" key={media} ref={videoRef} muted playsInline controls preload="metadata"
              onLoadedMetadata={event => {
                const video = event.currentTarget;
                if (chapter === 1) video.currentTime = feelingsAt;
                if (video.getClientRects().length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                  void video.play().catch(() => {});
                }
              }}
              onTimeUpdate={event => {
                if (journalDemo) setChapter(event.currentTarget.currentTime >= feelingsAt ? 1 : 0);
              }}
              onEnded={() => {
                if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                  setChapter(journalDemo ? 2 : (chapter + 1) % chapters.length);
                }
              }}
              poster={poster ?? undefined}
              src={media ? `${media}.mp4?v=${mediaVersion}` : undefined}
              aria-label={alt} />
              : <div className="chapter-frames">
                  {frames.map(frame => <Image key={frame.src} className="chapter-media" src={frame.src}
                    unoptimized loading="eager" width={540} height={750} alt={frame.alt}
                    style={{visibility: frame.src === visibleFrame?.src ? "visible" : "hidden"}}
                    onLoad={() => {
                      // Next Image calls onLoad after decode. Keep that same DOM node on screen.
                      if (frame.src === imageSrc) setDisplayedFrame(frame);
                    }}
                    onError={() => { if (frame.src === gif && frame.src === imageSrc) setFailedGif(gif); }} />)}
                </div>}
            {mode === "animation" && <button type="button" className="chapter-playback" onClick={() => setPaused(!paused)}>
              {paused ? (en ? "Resume animation" : "Продолжить анимацию") : (en ? "Pause animation" : "Приостановить анимацию")}
            </button>}
          </figure>
        </div>
        <section id="audience" className="chapter-audience">
          <h2>{en ? <>A mood journal for reflection<br />and therapy.</> : <>Дневник настроения для себя<br />и для терапии.</>}</h2>
          <p className="chapter-audience-intro">{en ? "AI helps you spot what keeps coming up in your entries and brings related moments together under one topic." : "ИИ поможет заметить, что повторяется в ваших записях, и объединит похожие моменты в одну тему."}</p>
          <article>
            <h3><NotebookPen aria-hidden />{en ? "For personal reflection" : "Для самостоятельной рефлексии"}</h3>
            <p>{en ? "Group your notes by theme and explore how events and feelings show up together. Keep your insights and choose what you'd like to try next." : "Собирайте записи по темам, замечайте повторения и исследуйте возможные связи между событиями и чувствами. Сохраняйте выводы и выбирайте, что попробовать дальше."}</p>
          </article>
          <article>
            <h3><MessagesSquare aria-hidden />{en ? "If you're in therapy" : "Для тех, кто в терапии"}</h3>
            <p>{en ? "Keep track of what matters between sessions. Add your session schedule and revisit your notes and questions before your next appointment." : "Сохраните важное между встречами. Добавьте расписание сеансов — и возвращайтесь к записям и вопросам перед следующей встречей."}</p>
          </article>
          <details id="first-entry" className="chapter-example">
            <summary>{en ? "How do I start an emotion journal?" : "Как начать вести дневник эмоций?"}</summary>
            {en ? <>
              <p>Pick one moment from today. Write down what happened, then mark how you felt. One line is enough.</p>
              <p>For example, “I closed my laptop after work and checked my email twice during dinner.” Feeling: anxious.</p>
              <p>When you look back over the week, find another evening when you felt anxious. What was similar? What was different?</p>
            </> : <>
              <p>Вспомните один момент за день. Запишите, что произошло, и отметьте, что вы чувствовали. Для первой записи хватит одной строки.</p>
              <p>Например, «После работы закрыла ноутбук, а за ужином ещё дважды проверила почту». Отметка настроения — «тревожно».</p>
              <p>Когда будете смотреть обзор недели, найдите другой вечер с такой же отметкой. Что было похожего? А что в тот вечер было иначе?</p>
            </>}
          </details>
        </section>
        <footer>
          <a className="chapter-cta" onClick={() => trackSurvey({event: "web_landing_start", placement: "footer"}, locale)} href={`/?start=1&lang=${locale}`}>
            {start}
          </a>
          <p>{en ? "7 days free. No card or automatic charges." : "7 дней бесплатно. Без карты и автосписаний."}</p>
          {!en && <nav aria-label="Статьи о дневнике" className="chapter-guide-links">
            <a href="/guides/dnevnik-emotsiy">Как вести дневник эмоций</a>
            <a href="/guides/mezhdu-sessiyami">Что записывать между сессиями</a>
            <a href="/guides/trevoga-pered-snom">Тревога перед сном</a>
            <a href="/guides/pochemu-sryvayus-na-blizkih">Почему я срываюсь на близких</a>
          </nav>}
          <div>
            <a href="/privacy">{en ? "Privacy policy" : "Политика конфиденциальности"}</a> ·{" "}
            <a href="/terms">{en ? "Terms of use" : "Условия использования"}</a> ·{" "}
            <a href="/personal-data">{en ? "Personal data processing" : "Обработка персональных данных"}</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
