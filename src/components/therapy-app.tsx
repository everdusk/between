"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, PenLine, Waves } from "lucide-react";
import { BotChatPermission, BotChatSheet } from "@/components/bot-chat-gate";
import { JournalPanel } from "@/components/journal-panel";
import { JournalSkeleton } from "@/components/journal-skeleton";
import { AccountButton, AccountSheet } from "@/components/account-sheet";
import { LanguageSwitch } from "@/components/language-switch";
import { LegalLinks } from "@/components/legal-links";
import { LocaleProvider, useI18n } from "@/components/locale-provider";
import { SchemeSwitch, paintPickedScheme, readScheme, schemeWasPicked } from "@/components/scheme-switch";
import { SessionsPanel } from "@/components/sessions-panel";
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
import { markSplashReady, SPLASH_READY_EVENT } from "@/lib/splash";
import { launchSection, type LaunchSection } from "@/lib/launch-section";
import { earlyMaxLogin, inMaxClient, readMaxInitData, signalMaxReady, waitForMaxInitData } from "@/lib/max-webapp";
import { clearStore, WEB_STORAGE_KEY } from "@/lib/storage";
import { DEV_DISPLAY_NAME, type TelegramSession } from "@/lib/telegram";
import { trackAnalytics } from "@/lib/analytics-client";
import { fetchWeekAccess, localWeekView, readLocalWeekAccess } from "@/lib/week-access-client";
import { useWeekPrices } from "@/components/week-prices";
import type { WeekAccessStatus, WeekAccessView } from "@/lib/week-access";

const SECTIONS = ["journal", "week", "sessions"] as const;

type SectionId = (typeof SECTIONS)[number];

function tabOf(value: LaunchSection | null): SectionId | null {
  if (value === "journal" || value === "week" || value === "sessions") return value;
  return null;
}

function readLaunch(): LaunchSection | null {
  return launchSection({
    search: window.location.search,
    hash: window.location.hash,
  });
}

function subscribeLaunch(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

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
  const inMax = useInMax();
  return (
    <LocaleProvider
      telegramLanguage={telegram.user?.language_code}
      initData={telegram.inTelegram ? telegram.initData : ""}
      lockLocale={null}
    >
      <TherapyShell telegram={telegram} inMax={inMax} />
    </LocaleProvider>
  );
}

function useInMax(): boolean {
  const inside = useSyncExternalStore(
    () => () => {},
    () => inMaxClient(),
    () => false,
  );
  useEffect(() => {
    if (inside) signalMaxReady();
  }, [inside]);
  return inside;
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

function TherapyShell({ telegram, inMax }: { telegram: TelegramSession; inMax: boolean }) {
  const { t, locale, greetingLocale } = useI18n();
  const prices = useWeekPrices();
  const pathname = usePathname();
  const webEntry = pathname === "/journal" || pathname.startsWith("/journal/");
  const web = useWebAccount(webEntry && telegram.ready && !telegram.inTelegram);
  // null while MAX may still hand over the launch string. "" means it never arrived.
  const [maxLaunch, setMaxLaunch] = useState<string | null>(null);
  const waitingForMax = inMax && webEntry && !telegram.inTelegram;
  const maxReady = !waitingForMax || maxLaunch !== null;
  const signIn = web.setAccount;
  useEffect(() => {
    if (!waitingForMax) return;
    let cancelled = false;
    void (async () => {
      const early = earlyMaxLogin();
      // MAX writes the launch string after the page is up. The cookie from the
      // site is a different journal, so the notes stay hidden until this arrives.
      const initData = readMaxInitData() ?? (await waitForMaxInitData(8_000));
      if (cancelled) return;
      setMaxLaunch(initData ?? "");
      let account = early
        ? ((await early.catch(() => null))?.account as Parameters<typeof signIn>[0] | undefined)
        : undefined;
      if (!account && initData && !early) {
        try {
          const res = await fetch("/api/account/max", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }),
          });
          const data = (await res.json().catch(() => ({}))) as { account?: Parameters<typeof signIn>[0] };
          if (res.ok) account = data.account;
        } catch {
          // The launch string still names the journal on the next read.
        }
      }
      if (cancelled) return;
      if (account) signIn(account);
    })();
    return () => {
      cancelled = true;
    };
  }, [waitingForMax, signIn]);
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
    maxInitData: inMax && maxLaunch ? maxLaunch : "",
    // A site cookie is another person's journal until MAX says who opened the app.
    web: Boolean(web.account) && (!inMax || maxLaunch === ""),
  });

  const requested = useSyncExternalStore(subscribeLaunch, readLaunch, () => null);
  const fromMax = launchSection({ initData: maxLaunch });
  const [picked, setPicked] = useState<SectionId | null>(null);
  const section: SectionId = picked ?? tabOf(requested) ?? tabOf(fromMax) ?? "journal";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollTops = useRef<Partial<Record<SectionId, number>>>({});

  function selectSection(next: string) {
    const id = next as SectionId;
    if (id === section) return;
    const el = scrollerRef.current;
    if (el) scrollTops.current[section] = el.scrollTop;
    setPicked(id);
  }

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = scrollTops.current[section] ?? 0;
  }, [section]);
  const [premium, setPremium] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accessStatus, setAccessStatus] = useState<WeekAccessStatus | null>(null);
  const locked = accessStatus === "locked";
  const wantsSubscribe = requested === "subscribe" || fromMax === "subscribe";
  useEffect(() => {
    if (accessStatus === "locked") {
      if (wantsSubscribe) setAccountOpen(false);
      return;
    }
    if (wantsSubscribe) setAccountOpen(true);
  }, [wantsSubscribe, accessStatus]);
  const [passwordSeen, setPasswordSeen] = useState(false);
  const passwordHash = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("hashchange", onStoreChange);
      return () => window.removeEventListener("hashchange", onStoreChange);
    },
    () => window.location.hash === "#password",
    () => false,
  );
  const showAccount = accountOpen || (passwordHash && Boolean(web.account) && !passwordSeen);
  function closeAccount() {
    setAccountOpen(false);
    setPasswordSeen(true);
  }
  const [accessNonce, setAccessNonce] = useState(0);

  useEffect(() => {
    if (!telegram.inTelegram) return;
    const apply = () => {
      if (!schemeWasPicked()) return;
      paintPickedScheme(readScheme());
    };
    apply();
    window.addEventListener("between-scheme", apply);
    window.addEventListener(SPLASH_READY_EVENT, apply);
    return () => {
      window.removeEventListener("between-scheme", apply);
      window.removeEventListener(SPLASH_READY_EVENT, apply);
    };
  }, [telegram.inTelegram, telegram.ready, telegram.colorScheme]);

  useEffect(() => {
    if (!telegram.ready || !telegram.inTelegram || !telegram.initData) return;
    trackAnalytics("visit", telegram.initData);
  }, [telegram.ready, telegram.inTelegram, telegram.initData]);
  useEffect(() => {
    if (!telegram.ready || telegram.inTelegram || !webEntry) return;
    if (inMax && maxLaunch === null) return;
    trackAnalytics("visit", "");
  }, [telegram.ready, telegram.inTelegram, webEntry, inMax, maxLaunch]);
  const tabOwnsAccess = useRef(false);
  const disabled = status !== "ready";
  useEffect(() => {
    if (!telegram.ready) return;
    if (!telegram.inTelegram) {
      if (tabOwnsAccess.current) return;
      const local = localWeekView(readLocalWeekAccess(), new Date(), prices);
      setPremium(local.status === "paid");
      setAccessStatus(local.status);
      return;
    }
    if (!telegram.initData) return;
    let cancelled = false;
    void fetchWeekAccess(telegram.initData).then((view) => {
      if (cancelled || tabOwnsAccess.current || !view) return;
      setPremium(view.status === "paid");
      setAccessStatus(view.status);
    });
    return () => {
      cancelled = true;
    };
  }, [telegram.ready, telegram.inTelegram, telegram.initData, prices]);

  function onWeekAccess(view: WeekAccessView) {
    tabOwnsAccess.current = true;
    setPremium(view.status === "paid");
    setAccessStatus(view.status);
  }

  const maxPending = inMax && webEntry && !telegram.inTelegram && maxLaunch === null;
  const authSettled =
    !webEntry || telegram.inTelegram || web.status === "ready" || web.status === "unavailable";
  const showGate =
    webEntry &&
    telegram.ready &&
    !telegram.inTelegram &&
    authSettled &&
    maxReady &&
    !maxLaunch &&
    !web.account;
  const accountPending =
    maxPending || (webEntry && !telegram.inTelegram && !maxLaunch && !authSettled);
  const shellReady = telegram.ready;
  useEffect(() => {
    if (shellReady) markSplashReady();
  }, [shellReady]);

  const name = shownName(telegram.displayName, translate(greetingLocale, "guest"));
  const greeting = !telegram.ready
    ? translate(greetingLocale, "loading")
    : translate(greetingLocale, telegram.inTelegram ? "hello" : "helloDev", { name });

  const webSurface = webEntry && !telegram.inTelegram;
  const signedOutWeb = webSurface && !inMax && !web.account && web.status !== "loading" && web.status !== "idle";
  const corner = signedOutWeb ? (
    <>
      <SchemeSwitch />
      <LanguageSwitch />
    </>
  ) : webSurface && !inMax && !web.account ? null : (
    <AccountButton solid={webSurface} pressed={showAccount} onClick={() => setAccountOpen(true)} />
  );

  const footer = (
    <footer className="py-8 text-center text-[0.6875rem] leading-relaxed tracking-wide text-muted-foreground/80">
      Between
      {syncLabel === "cloud"
        ? ` · ${t("syncCloud")}`
        : syncLabel === "offline-cloud"
          ? ` · ${t("syncOffline")}`
          : ` · ${t("syncDevice")}`}
      {!telegram.inTelegram && telegram.ready ? ` · ${t("outsideTelegram")}` : null}
      {telegram.inTelegram ? null : <LegalLinks className="mt-2" />}
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
            <div className="flex flex-wrap items-center gap-2">{corner}</div>
          </div>
          <div className="journal-side-scroll">
            {!showGate && status === "ready" && !locked ? (
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
                      onClick={() => selectSection(id)}
                    >
                      <Icon aria-hidden className="size-4" />
                      <span>{t(SECTION_KEY[id])}</span>
                    </button>
                  );
                })}
              </nav>
            ) : null}
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
            {corner}
          </div>
        </div>
      </header>

      <div className="journal-column relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
        {showGate ? (
          <WebAccountGate onSignedIn={web.setAccount} />
        ) : locked ? (
          <div className="journal-scroll pt-3 pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] sm:pr-[max(1.25rem,var(--safe-right))] sm:pl-[max(1.25rem,var(--safe-left))]">
            <div className="journal-scroll-inner">
              {accountPending || status === "loading" ? (
                <JournalSkeleton />
              ) : (
                <WeekTab
                  active
                  ready={telegram.ready}
                  inTelegram={telegram.inTelegram}
                  inMax={inMax}
                  initData={telegram.initData}
                  canSubscribe={Boolean(web.account) || inMax}
                  reloadToken={accessNonce}
                  onAccess={onWeekAccess}
                >
                  {null}
                </WeekTab>
              )}
              {status === "ready" && !accountPending ? footer : null}
            </div>
          </div>
        ) : (
          <Tabs
            value={section}
            onValueChange={selectSection}
            className="flex min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden"
          >
            <div
              ref={scrollerRef}
              className="journal-scroll pt-3 pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] sm:pr-[max(1.25rem,var(--safe-right))] sm:pl-[max(1.25rem,var(--safe-left))]"
            >
            <div className="journal-scroll-inner">
            {accountPending || status === "loading" ? (
              <JournalSkeleton />
            ) : status === "error" ? (
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
            ) : (
            <div>
              <TabsContent keepMounted value="journal" className="mt-0 outline-none">
                <JournalPanel
                  entries={store.entries}
                  onSave={upsertEntry}
                  onDelete={deleteEntry}
                  disabled={disabled}
                  initData={telegram.inTelegram ? telegram.initData : ""}
                />
              </TabsContent>
              <TabsContent keepMounted value="week" className="mt-0 outline-none">
                <WeekTab
                  active={section === "week"}
                  ready={telegram.ready}
                  inTelegram={telegram.inTelegram}
                  inMax={inMax}
                  initData={telegram.initData}
                  canSubscribe={Boolean(web.account) || inMax}
                  reloadToken={accessNonce}
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
              <TabsContent keepMounted value="sessions" className="mt-0 outline-none">
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
            )}
            {status === "ready" && !accountPending ? footer : null}
            </div>
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
      <AccountSheet
        open={showAccount}
        onClose={closeAccount}
        inTelegram={telegram.inTelegram}
        inMax={inMax}
        initData={telegram.initData}
        maxInitData={inMax && maxLaunch ? maxLaunch : ""}
        notify={store.notify}
        onSaveNotify={saveNotify}
        disabled={disabled}
        account={web.account}
        onRefreshAccount={() => void web.refresh()}
        onLogout={() => {
          clearStore(WEB_STORAGE_KEY);
          web.setAccount(null);
          closeAccount();
        }}
        onPremium={() => setAccessNonce((value) => value + 1)}
      />
      <BotChatSheet />
    </div>
    </BotChatPermission>
  );
}
