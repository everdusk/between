"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, PenLine, Waves } from "lucide-react";
import { BotChatPermission, BotChatSheet } from "@/components/bot-chat-gate";
import { JournalPanel } from "@/components/journal-panel";
import { LanguageSwitch } from "@/components/language-switch";
import { LegalLinks } from "@/components/legal-links";
import { LocaleProvider, useI18n } from "@/components/locale-provider";
import { SchemeSwitch } from "@/components/scheme-switch";
import { SessionsPanel } from "@/components/sessions-panel";
import { WebAccountCard } from "@/components/web-account-card";
import { WebAccountGate } from "@/components/web-account-gate";
import { WeekTab } from "@/components/week-tab";
import { WeeklyPanel } from "@/components/weekly-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTelegram } from "@/hooks/use-telegram";
import { useTherapyStore } from "@/hooks/use-therapy-store";
import { useWebAccount } from "@/hooks/use-web-account";
import { translate } from "@/lib/messages";
import { ru } from "@/lib/messages/ru";
import { markSplashReady } from "@/lib/splash";
import { clearStore, WEB_STORAGE_KEY } from "@/lib/storage";
import { DEV_DISPLAY_NAME, type TelegramSession } from "@/lib/telegram";
import { trackAnalytics } from "@/lib/analytics-client";
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
  const { t, locale, greetingLocale } = useI18n();
  const pathname = usePathname();
  const webEntry = pathname === "/journal" || pathname.startsWith("/journal/");
  const web = useWebAccount(webEntry && telegram.ready && !telegram.inTelegram);
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
    judgeSkipped,
  } = useTherapyStore({
    initData: telegram.initData,
    inTelegram: telegram.inTelegram,
    locale,
    web: Boolean(web.account),
  });

  const [section, setSection] = useState<SectionId>("journal");
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    if (!telegram.ready || !telegram.inTelegram || !telegram.initData) return;
    trackAnalytics("visit", telegram.initData);
  }, [telegram.ready, telegram.inTelegram, telegram.initData]);
  useEffect(() => {
    if (!telegram.ready || telegram.inTelegram || !webEntry) return;
    trackAnalytics("visit", "");
  }, [telegram.ready, telegram.inTelegram, webEntry]);
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

  const showGate =
    webEntry &&
    telegram.ready &&
    !telegram.inTelegram &&
    !web.account &&
    (web.status === "ready" || web.status === "unavailable");
  const accountPending =
    webEntry && !telegram.inTelegram && (web.status === "idle" || web.status === "loading");
  const shellReady = telegram.ready && !accountPending && (showGate || status !== "loading");
  useEffect(() => {
    if (shellReady) markSplashReady();
  }, [shellReady]);

  const name = shownName(telegram.displayName, translate(greetingLocale, "guest"));
  const greeting = !telegram.ready
    ? translate(greetingLocale, "loading")
    : translate(greetingLocale, telegram.inTelegram ? "hello" : "helloDev", { name });

  const webSurface = webEntry && !telegram.inTelegram;
  const accountCard = () =>
    web.account ? (
      <WebAccountCard
        account={web.account}
        onRefresh={() => void web.refresh()}
        onLogout={() => {
          clearStore(WEB_STORAGE_KEY);
          web.setAccount(null);
        }}
      />
    ) : null;
  const botLinked = Boolean(web.account?.telegramLinked || web.account?.maxLinked);

  const footer = (
    <footer className="py-8 text-center text-[0.6875rem] leading-relaxed tracking-wide text-muted-foreground/80">
      Between
      {syncLabel === "cloud"
        ? ` · ${t("syncCloud")}`
        : syncLabel === "offline-cloud"
          ? ` · ${t("syncOffline")}`
          : ` · ${t("syncDevice")}`}
      {!telegram.inTelegram && telegram.ready ? ` · ${t("outsideTelegram")}` : null}
      <LegalLinks className="mt-2" />
    </footer>
  );

  return (
    <BotChatPermission
      ready={telegram.ready}
      inTelegram={telegram.inTelegram}
      allowsWriteToPm={telegram.allowsWriteToPm}
      initData={telegram.initData}
    >
    <div
      className="journal-shell journal-frame fixed inset-x-0 flex flex-col overflow-hidden"
      style={{
        top: "var(--vv-top, 0px)",
        height: "var(--vv-height, var(--tg-viewport-height, 100dvh))",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      {webSurface ? (
        <aside className="journal-side relative z-30">
          <div className="journal-side-top relative z-20 grid gap-4">
            <div>
              <p className="font-display text-[1.65rem] leading-none text-foreground">Between</p>
              {webSurface ? null : <p className="mt-2 truncate text-xs text-subtitle">{greeting}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LanguageSwitch />
              <SchemeSwitch />
            </div>
          </div>
          <div className="journal-side-scroll">
            {!showGate && status === "ready" ? (
              <nav className="grid gap-1" aria-label={t("sections")}>
                {SECTIONS.map((id) => {
                  const Icon = SECTION_ICON[id];
                  const on = section === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-current={on ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-full px-3 py-2.5 text-start text-sm font-extrabold ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-foreground/[0.06]"}`}
                      onClick={() => setSection(id)}
                    >
                      <Icon aria-hidden className="size-4" />
                      <span>{t(SECTION_KEY[id])}</span>
                    </button>
                  );
                })}
              </nav>
            ) : null}
            {accountCard() && !botLinked ? <div className="journal-side-account">{accountCard()}</div> : null}
          </div>
        </aside>
      ) : null}

      <div className="journal-stage relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="relative z-30">
        <div className="journal-column mx-auto flex w-full max-w-lg items-center justify-between gap-3 pt-[max(1.25rem,var(--safe-top))] pr-[max(1.25rem,var(--safe-right))] pb-2 pl-[max(1.25rem,var(--safe-left))] sm:pr-[max(1.5rem,var(--safe-right))] sm:pl-[max(1.5rem,var(--safe-left))]">
          <div className="journal-phone-brand min-w-0">
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
            {webSurface ? null : <p className="mt-1.5 truncate text-xs text-subtitle">{greeting}</p>}
          </div>
          <div className={`flex shrink-0 items-center gap-2 ${webSurface ? "journal-mobile-tools" : ""}`}>
            {!telegram.inTelegram && telegram.ready && !webEntry && (
              <span className="eyebrow hidden rounded-full border border-[color:var(--glass-border)] bg-background/50 px-2.5 py-2 text-muted-foreground sm:inline-flex">
                localhost
              </span>
            )}
            <LanguageSwitch />
            {webSurface ? <SchemeSwitch /> : null}
          </div>
        </div>
      </header>

      <div className="journal-column relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
        {showGate ? (
          <WebAccountGate onSignedIn={web.setAccount} />
        ) : status !== "ready" && (
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] pt-3 sm:pl-[max(1.25rem,var(--safe-left))] sm:pr-[max(1.25rem,var(--safe-right))]">
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
            {footer}
          </main>
        )}

        {!showGate && status === "ready" && (
          <Tabs
            value={section}
            onValueChange={(v) => setSection(v as SectionId)}
            className="flex min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-3 pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] sm:pr-[max(1.25rem,var(--safe-right))] sm:pl-[max(1.25rem,var(--safe-left))]">
            {accountCard() && !botLinked ? (
              <div className="journal-account-inline mb-4">{accountCard()}</div>
            ) : null}
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
                  initData={telegram.inTelegram ? telegram.initData : ""}
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
                    judgeSkipped={judgeSkipped}
                    onDiscussTheme={setThemeDiscussed}
                    onDismissTheme={dismissSessionTheme}
                    onAddTheme={addSessionTheme}
                    onSavePattern={savePattern}
                    onSaveThemes={saveThemes}
                    initData={telegram.inTelegram ? telegram.initData : ""}
                    cloud={Boolean(web.account)}
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
            {footer}
            {section === "sessions" && botLinked ? (
              <div className="pb-6">{accountCard()}</div>
            ) : null}
            </div>

            <div className="journal-dock z-30 flex shrink-0 justify-center pt-2 pr-[max(1rem,var(--safe-right))] pb-[max(1.25rem,var(--safe-bottom))] pl-[max(1rem,var(--safe-left))]">
              <TabsList
                variant="dock"
                aria-label={t("sections")}
                className="w-full max-w-sm justify-stretch"
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
      </div>
      </div>
      <BotChatSheet />
    </div>
    </BotChatPermission>
  );
}
