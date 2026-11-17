"use client";

/* Re-enter the root document so its surface boot script also runs. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { useState, type ReactNode } from "react";
import { CalendarDays, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/locale-provider";

export function WebWorkspace({ tools, gate, pending, journal, week, sessions, footer, onCompose, initialSessions = false, canCompose }: {
  tools: ReactNode; gate?: ReactNode; pending?: ReactNode; journal: ReactNode; week: ReactNode;
  sessions: ReactNode; footer: ReactNode; onCompose: () => void; initialSessions?: boolean; canCompose: boolean;
}) {
  const { t } = useI18n();
  const [pickedSettings, setSettings] = useState<boolean | null>(null);
  const settings = pickedSettings ?? initialSessions;
  function compose() { setSettings(false); onCompose(); }
  return (
    <div className="web-workspace fixed inset-x-0 flex flex-col bg-background text-foreground" style={{ top: "var(--vv-top, 0px)", height: "var(--vv-height, 100dvh)" }}>
      <header className="web-header shrink-0 border-b border-border">
        <div className="web-header-inner mx-auto flex items-center justify-between gap-3">
          <a href="/" className="font-display text-xl font-semibold tracking-tight">Between</a>
          <div className="flex items-center gap-1 sm:gap-2">
            {!gate && !pending && <Button type="button" disabled={!canCompose} aria-label={t("newEntry")} className="size-10 shrink-0 p-0 sm:w-auto sm:px-4" onClick={compose}><Plus aria-hidden /><span className="hidden sm:inline">{t("newEntry")}</span></Button>}
            {!gate && !pending && <Button type="button" variant="ghost" size="icon" aria-label={settings ? t("tabJournal") : t("tabSessions")} aria-pressed={settings} onClick={() => setSettings(!settings)}>{settings ? <ArrowLeft /> : <CalendarDays />}</Button>}
            {tools}
          </div>
        </div>
      </header>
      <main className="web-main min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {gate ? <div className="web-auth mx-auto">{gate}</div> : pending ? <div className="mx-auto max-w-2xl px-4 py-8">{pending}</div> : <>
          <div className="web-content mx-auto px-4 py-6 sm:px-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{settings ? t("tabSessions") : t("webWorkspaceTitle")}</h1>
            </div>
            <div hidden={settings} className="web-dashboard">
              <section className="min-w-0" aria-label={t("tabJournal")}>{journal}</section>
              <section className="web-review min-w-0" aria-label={t("tabWeek")}>{week}</section>
            </div>
            <div hidden={!settings} className="mx-auto max-w-2xl">{sessions}</div>
            {footer}
          </div>
        </>}
      </main>
    </div>
  );
}
