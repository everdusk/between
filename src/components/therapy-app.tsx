"use client";

import { useState } from "react";
import { JournalPanel } from "@/components/journal-panel";
import { LocaleProvider, useI18n } from "@/components/locale-provider";
import { SessionsPanel } from "@/components/sessions-panel";
import { WeekTab } from "@/components/week-tab";
import { WeeklyPanel } from "@/components/weekly-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTelegram } from "@/hooks/use-telegram";
import { useTherapyStore } from "@/hooks/use-therapy-store";
import { LOCALES } from "@/lib/i18n";
import { translate } from "@/lib/messages";
import { ru } from "@/lib/messages/ru";
import { DEV_DISPLAY_NAME, type TelegramSession } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const SECTIONS = ["journal", "week", "sessions"] as const;

type SectionId = (typeof SECTIONS)[number];

const SECTION_KEY = {
  journal: "tabJournal",
  week: "tabWeek",
  sessions: "tabSessions",
} as const;

export function TherapyApp() {
  const telegram = useTelegram();
  return (
    <LocaleProvider
      telegramLanguage={telegram.user?.language_code}
      initData={telegram.inTelegram ? telegram.initData : ""}
    >
      <TherapyShell telegram={telegram} />
    </LocaleProvider>
  );
}

function shownName(displayName: string, guest: string): string {
  return displayName === DEV_DISPLAY_NAME ? guest : displayName;
}

function localizeStorageError(
  error: string | null,
  t: (key: "storageCorrupt" | "storageRead" | "storageWrite" | "storageClear") => string,
): string {
  if (error === ru.storageCorrupt) return t("storageCorrupt");
  if (error === ru.storageRead) return t("storageRead");
  if (error === ru.storageWrite) return t("storageWrite");
  if (error === ru.storageClear) return t("storageClear");
  return error ?? "";
}

function TherapyShell({ telegram }: { telegram: TelegramSession }) {
  const { t, locale, greetingLocale, setLocale } = useI18n();
  const {
    store,
    status,
    error,
    syncLabel,
    resetCorrupted,
    upsertEntry,
    deleteEntry,
    saveWeekPrep,
    saveBrief,
    saveSessionPlan,
    saveNotify,
    upsertSession,
    deleteSession,
  } = useTherapyStore({
    initData: telegram.initData,
    inTelegram: telegram.inTelegram,
  });

  const [section, setSection] = useState<SectionId>("journal");
  const disabled = status !== "ready";
  const name = shownName(telegram.displayName, translate(greetingLocale, "guest"));
  const greeting = !telegram.ready
    ? translate(greetingLocale, "loading")
    : translate(greetingLocale, telegram.inTelegram ? "hello" : "helloDev", { name });

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col"
      style={
        telegram.viewportStableHeight
          ? { minHeight: telegram.viewportStableHeight }
          : undefined
      }
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <header className="relative z-10 border-b border-border/40 bg-background/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="font-display text-xl tracking-tight text-foreground">
              Between
            </p>
            <p className="truncate text-xs text-muted-foreground">{greeting}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="sr-only" htmlFor="app-language">
              {t("language")}
            </label>
            <select
              id="app-language"
              aria-label={t("language")}
              value={locale}
              onChange={(event) => {
                const next = LOCALES.find((item) => item.id === event.target.value);
                if (next) setLocale(next.id);
              }}
              className="max-w-36 rounded-md border border-border/70 bg-background/70 px-2 py-1 text-xs text-foreground"
            >
              {LOCALES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {!telegram.inTelegram && telegram.ready && (
              <span className="shrink-0 rounded-md border border-border/70 bg-background/70 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                localhost
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-lg flex-1 px-4 py-4 sm:px-5 sm:py-6">
        {status === "loading" && (
          <div
            className="rounded-2xl border border-border/60 bg-background/55 px-5 py-10 text-center backdrop-blur-sm"
            role="status"
          >
            <div className="mx-auto mb-3 h-1.5 w-24 overflow-hidden rounded-full bg-primary/15">
              <div className="loading-bar h-full w-1/2 rounded-full bg-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground">{t("loadingEntries")}</p>
          </div>
        )}

        {status === "error" && (
          <div
            className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-6"
            role="alert"
          >
            <p className="font-medium text-foreground">{t("dataError")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {localizeStorageError(error, t)}
            </p>
            <Button className="mt-4" variant="secondary" onClick={resetCorrupted}>
              {t("startOver")}
            </Button>
          </div>
        )}

        {status === "ready" && (
          <Tabs
            value={section}
            onValueChange={(v) => setSection(v as SectionId)}
            className="gap-4"
          >
            <TabsList className="h-auto w-full justify-stretch gap-1 bg-background/55 p-1.5 backdrop-blur-sm">
              {SECTIONS.map((id) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="flex-1 px-3 py-2 data-active:shadow-none"
                >
                  {t(SECTION_KEY[id])}
                </TabsTrigger>
              ))}
            </TabsList>

            <div
              className={cn(
                "rounded-2xl border border-border/50 bg-background/65 p-4 shadow-[0_24px_60px_-40px_oklch(0.35_0.04_175_/_0.45)] backdrop-blur-md sm:p-6",
                "animate-in fade-in slide-in-from-bottom-1 duration-400",
              )}
            >
              <TabsContent value="journal" className="mt-0 outline-none">
                <JournalPanel
                  entries={store.entries}
                  onSave={upsertEntry}
                  onDelete={deleteEntry}
                  disabled={disabled}
                />
              </TabsContent>
              <TabsContent value="week" className="mt-0 outline-none">
                <WeekTab
                  active={section === "week"}
                  ready={telegram.ready}
                  inTelegram={telegram.inTelegram}
                  initData={telegram.initData}
                >
                  <WeeklyPanel
                    entries={store.entries}
                    sessions={store.sessions}
                    weekPreps={store.weekPreps}
                    onSavePrep={saveWeekPrep}
                    onSaveBrief={saveBrief}
                    initData={telegram.inTelegram ? telegram.initData : ""}
                    disabled={disabled}
                  />
                </WeekTab>
              </TabsContent>
              <TabsContent value="sessions" className="mt-0 outline-none">
                <SessionsPanel
                  sessions={store.sessions}
                  plan={store.sessionPlan}
                  notify={store.notify}
                  onSave={upsertSession}
                  onDelete={deleteSession}
                  onSavePlan={saveSessionPlan}
                  onSaveNotify={saveNotify}
                  disabled={disabled}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </main>

      <footer className="relative z-10 px-4 py-4 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
        Between
        {syncLabel === "cloud"
          ? ` · ${t("syncCloud")}`
          : syncLabel === "offline-cloud"
            ? ` · ${t("syncOffline")}`
            : ` · ${t("syncDevice")}`}
        {!telegram.inTelegram && telegram.ready ? ` · ${t("outsideTelegram")}` : null}
      </footer>
    </div>
  );
}
