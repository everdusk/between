"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Languages, PenLine, Waves } from "lucide-react";
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
import { fetchWeekAccess, localWeekView, readLocalWeekAccess } from "@/lib/week-access-client";
import type { WeekAccessView } from "@/lib/week-access";

const SECTIONS = ["journal", "week", "sessions"] as const;

type SectionId = (typeof SECTIONS)[number];

const SECTION_KEY = {
  journal: "tabJournal",
  week: "tabWeek",
  sessions: "tabSessions",
} as const;

const SECTION_ICON = {
  journal: PenLine,
  week: Waves,
  sessions: CalendarDays,
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
    saveThemes,
    saveSessionPlan,
    saveNotify,
    upsertSession,
    deleteSession,
    setThemeDiscussed,
    dismissSessionTheme,
    addSessionTheme,
    savePattern,
  } = useTherapyStore({
    initData: telegram.initData,
    inTelegram: telegram.inTelegram,
    locale,
  });

  const [section, setSection] = useState<SectionId>("journal");
  const [premium, setPremium] = useState(false);
  const tabOwnsAccess = useRef(false);
  const disabled = status !== "ready";
  useEffect(() => {
    if (!telegram.ready) return;
    if (!telegram.inTelegram) {
      if (tabOwnsAccess.current) return;
      setPremium(localWeekView(readLocalWeekAccess()).status === "paid");
      return;
    }
    if (!telegram.initData) return;
    let cancelled = false;
    void fetchWeekAccess(telegram.initData).then((view) => {
      if (cancelled || tabOwnsAccess.current || !view) return;
      setPremium(view.status === "paid");
    });
    return () => {
      cancelled = true;
    };
  }, [telegram.ready, telegram.inTelegram, telegram.initData]);

  function onWeekAccess(view: WeekAccessView) {
    tabOwnsAccess.current = true;
    setPremium(view.status === "paid");
  }

  const name = shownName(telegram.displayName, translate(greetingLocale, "guest"));
  const greeting = !telegram.ready
    ? translate(greetingLocale, "loading")
    : translate(greetingLocale, telegram.inTelegram ? "hello" : "helloDev", { name });
  const localeLabel = LOCALES.find((item) => item.id === locale)?.label ?? locale;

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

      <header className="relative z-10">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 pl-[max(1.25rem,var(--safe-left))] pr-[max(1.25rem,var(--safe-right))] pt-[max(1.25rem,var(--safe-top))] pb-2 sm:pl-[max(1.5rem,var(--safe-left))] sm:pr-[max(1.5rem,var(--safe-right))]">
          <div className="min-w-0">
            <p className="font-display text-[1.375rem] leading-none tracking-tight text-foreground">
              Between
              {premium ? (
                <span
                  className="relative -top-[3px] ms-1.5 inline-block text-[0.82em] leading-none"
                  role="img"
                  aria-label={t("premiumMark")}
                >
                  ⭐
                </span>
              ) : null}
            </p>
            <p className="mt-1.5 truncate text-xs text-subtitle">{greeting}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!telegram.inTelegram && telegram.ready && (
              <span className="eyebrow hidden rounded-full border border-[color:var(--glass-border)] bg-background/50 px-2.5 py-2 text-muted-foreground sm:inline-flex">
                localhost
              </span>
            )}
            <span className="glass relative inline-flex h-9 items-center gap-1.5 rounded-full pr-2.5 pl-3 text-xs font-medium text-foreground has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/25">
              <Languages aria-hidden className="size-3.5 opacity-70" />
              <span className="max-w-24 truncate">{localeLabel}</span>
              <ChevronDown aria-hidden className="size-3 opacity-50" />
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
                className="native-overlay"
              >
                {LOCALES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-lg flex-1 pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] pt-3 pb-4 sm:pl-[max(1.25rem,var(--safe-left))] sm:pr-[max(1.25rem,var(--safe-right))]">
        {status === "loading" && (
          <div
            className="glass rounded-3xl px-6 py-14 text-center"
            role="status"
          >
            <div className="mx-auto mb-4 h-1 w-28 overflow-hidden rounded-full bg-foreground/[0.08]">
              <div className="loading-bar h-full w-1/2 rounded-full bg-primary/70" />
            </div>
            <p className="text-sm text-muted-foreground">{t("loadingEntries")}</p>
          </div>
        )}

        {status === "error" && (
          <div
            className="glass rounded-3xl border-destructive/20 px-6 py-7"
            role="alert"
          >
            <p className="font-display text-xl text-foreground">{t("dataError")}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {localizeStorageError(error, t)}
            </p>
            <Button className="mt-5" variant="secondary" onClick={resetCorrupted}>
              {t("startOver")}
            </Button>
          </div>
        )}

        {status === "ready" && (
          <Tabs
            value={section}
            onValueChange={(v) => setSection(v as SectionId)}
            className="gap-0"
          >
            <div
              key={section}
              className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out"
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
                  onAccess={onWeekAccess}
                >
                  <WeeklyPanel
                    entries={store.entries}
                    sessions={store.sessions}
                    plan={store.sessionPlan}
                    weekPreps={store.weekPreps}
                    themes={store.themes ?? []}
                    themeLinks={store.themeLinks ?? []}
                    judgeSettled={store.judgeSettled ?? []}
                    onDiscussTheme={setThemeDiscussed}
                    onDismissTheme={dismissSessionTheme}
                    onAddTheme={addSessionTheme}
                    onSavePattern={savePattern}
                    onSaveThemes={saveThemes}
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

            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] pb-[max(1.25rem,var(--safe-bottom))]">
              <TabsList
                variant="dock"
                aria-label={t("sections")}
                className="pointer-events-auto w-full max-w-sm justify-stretch"
              >
                {SECTIONS.map((id) => {
                  const Icon = SECTION_ICON[id];
                  return (
                    <TabsTrigger key={id} value={id} className="flex-1 px-3">
                      <Icon aria-hidden />
                      <span>{t(SECTION_KEY[id])}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
          </Tabs>
        )}
      </main>

      <footer className="relative z-10 pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] pb-[calc(7rem+var(--safe-bottom))] text-center text-[0.6875rem] leading-relaxed tracking-wide text-muted-foreground/80">
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
