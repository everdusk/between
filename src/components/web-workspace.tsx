"use client";

import { BrandLogo } from "./brand-logo";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  CalendarDays,
  NotebookPen,
  PenLine,
  Plus,
  Waves,
  LockKeyhole,
  Bookmark,
} from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "./locale-provider";
import "./web-workspace.css";

export const sections = {
  week: [Waves, "deskOverview"],
  journal: [PenLine, "deskEntries"],
  reflection: [NotebookPen, "deskReflection"],
  topics: [Bookmark, "deskTherapy"],
  sessions: [CalendarDays, "tabSessions"],
} as const;
export type SectionId = keyof typeof sections;

export function WebWorkspace({
  inMessenger,
  homeHref,
  section,
  onSection,
  pages,
  tools,
  blocked,
  footer,
  onCompose,
  personal,
  hideReflection,
  guestBanner,
}: {
  inMessenger: boolean;
  guestBanner?: ReactNode;
  homeHref?: string;
  section: SectionId;
  onSection: (id: SectionId) => void;
  pages: Record<SectionId, ReactNode>;
  tools: ReactNode;
  blocked: ReactNode;
  footer: ReactNode;
  onCompose: () => void;
  personal: boolean;
  hideReflection?: boolean;
}) {
  const { t } = useI18n();
  const main = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const gated = Boolean(blocked);
  useLayoutEffect(() => {
    const root = frame.current;
    if (!root) return;
    const nav = root.querySelector<HTMLElement>(".desk-nav");
    const bottom = root.querySelector<HTMLElement>(".desk-content > footer");
    const measure = () => {
      root.style.setProperty("--desk-nav-height", (nav?.offsetHeight ?? 0) + "px");
      root.style.setProperty("--desk-footer-height", (bottom?.offsetHeight ?? 0) + "px");
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (nav) observer.observe(nav);
    if (bottom) observer.observe(bottom);
    return () => observer.disconnect();
  }, [gated]);
  const label = (id: SectionId) =>
    t(id === "topics" && personal ? "deskPersonal" : sections[id][1]);
  const ids = (Object.keys(sections) as SectionId[]).filter(
    (id) => id !== "sessions" || !personal,
  );
  const navIds = ids.filter(id => !(hideReflection && id === "reflection"));
  function navigate(id: SectionId) {
    onSection(id);
    main.current?.scrollTo({ top: 0 });
    content.current?.scrollTo({ top: 0 });
  }
  return (
    <div ref={frame} className="desk-frame" data-diary={blocked ? undefined : ""}>
      <header className="desk-header">
        <span className="font-display text-xl font-semibold">
          {homeHref ? (
            <a href={homeHref} aria-label={`Between — ${t("deleteHome")}`}><BrandLogo /></a>
          ) : <BrandLogo />}
        </span>
        <div className="flex items-center gap-2">
          {!blocked && (
            <Button data-confirm="" size="icon" className="desk-compose sm:w-auto sm:px-4" onClick={onCompose} aria-label={t("newEntry")}>
              <Plus aria-hidden className="sm:hidden" />
              <span className="hidden sm:inline">{t("newEntry")}</span>
            </Button>
          )}
          {tools}
        </div>
      </header>
      {!blocked && (
        <nav className="desk-nav" aria-label={t("sections")}>
          {navIds.map((id) => {
            const restricted = guestBanner && id !== "week" && id !== "journal";
            const Icon = restricted ? LockKeyhole : sections[id][0];
            return (
              <button
                key={id}
                aria-label={restricted ? label(id) + " — после регистрации" : undefined}
                aria-current={section === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon aria-hidden />
                {label(id)}
              </button>
            );
          })}
        </nav>
      )}
      <div ref={content} className="desk-content" key={blocked ? "gate" : "diary"}>
      <main ref={main} className="desk-main">
        <div className="desk-page">
          {blocked || (
            <>
              {guestBanner}
              {ids.filter(id => !guestBanner || id === "week" || id === "journal").map((id) => (
                <div key={id} className="desk-section" hidden={id !== section}>
                  {section === id && id !== "journal" && <h1 className={inMessenger && navIds.includes(id) ? "sr-only" : "mb-5 font-display text-2xl sm:text-3xl"}>
                    {label(id)}
                  </h1>}
                  {(section === id ||
                    id === "journal" ||
                    id === "reflection" ||
                    id === "topics") &&
                    pages[id]}
                </div>
              ))}
            </>
          )}
        </div>
      </main>
      {footer}
      </div>
    </div>
  );
}
