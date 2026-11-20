"use client";

import { BrandLogo } from "./brand-logo";
import { useRef, type ReactNode } from "react";
import {
  CalendarDays,
  Network,
  NotebookPen,
  PenLine,
  Plus,
  Waves,
  Bookmark,
} from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "./locale-provider";
import "./web-workspace.css";

export const sections = {
  week: [Waves, "deskOverview"],
  journal: [PenLine, "deskEntries"],
  reflection: [NotebookPen, "deskReflection"],
  connections: [Network, "deskConnections"],
  topics: [Bookmark, "deskTherapy"],
  sessions: [CalendarDays, "tabSessions"],
} as const;
export type SectionId = keyof typeof sections;

export function WebWorkspace({
  section,
  onSection,
  pages,
  tools,
  blocked,
  footer,
  onCompose,
  personal,
  name,
}: {
  section: SectionId;
  onSection: (id: SectionId) => void;
  pages: Record<SectionId, ReactNode>;
  tools: ReactNode;
  blocked: ReactNode;
  footer: ReactNode;
  onCompose: () => void;
  personal: boolean;
  name: string;
}) {
  const { t } = useI18n();
  const main = useRef<HTMLElement>(null);
  const label = (id: SectionId) =>
    t(id === "topics" && personal ? "deskPersonal" : sections[id][1]);
  const ids = (Object.keys(sections) as SectionId[]).filter(
    (id) => id !== "sessions" || !personal,
  );
  function navigate(id: SectionId) {
    onSection(id);
    main.current?.scrollTo({ top: 0 });
  }
  return (
    <div className="desk-frame">
      <header className="desk-header">
        <span className="font-display text-xl font-semibold"><BrandLogo /></span>
        <div className="flex items-center gap-2">
          {!blocked && (
            <Button onClick={onCompose} aria-label={t("newEntry")}>
              <Plus />
              <span className="hidden sm:inline">{t("newEntry")}</span>
            </Button>
          )}
          {tools}
        </div>
      </header>
      {!blocked && (
        <nav className="desk-nav" aria-label={t("sections")}>
          {ids.map((id) => {
            const Icon = sections[id][0];
            return (
              <button
                key={id}
                aria-current={section === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon aria-hidden />
                {label(id)}
              </button>
            );
          })}
          {name && <span className="desk-name">{name}</span>}
        </nav>
      )}
      <main ref={main} className="desk-main" key={blocked ? "gate" : "diary"}>
        <div className="desk-page">
          {blocked || (
            <>
              <h1 className="mb-5 font-display text-2xl sm:text-3xl">
                {label(section)}
              </h1>
              {ids.map((id) => (
                <div key={id} hidden={id !== section}>
                  {(section === id ||
                    id === "journal" ||
                    id === "reflection" ||
                    id === "topics") &&
                    pages[id]}
                </div>
              ))}
            </>
          )}
          {footer}
        </div>
      </main>
    </div>
  );
}
