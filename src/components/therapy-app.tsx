"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Smile, X } from "lucide-react";
import { BotChatPermission, BotChatSheet } from "@/components/bot-chat-gate";
import { JournalPanel, MoodDialog } from "@/components/journal-panel";
import { JournalSkeleton } from "@/components/journal-skeleton";
import { AccountButton, AccountSheet } from "@/components/account-sheet";
import { LanguageSwitch } from "@/components/language-switch";
import { LegalLinks } from "@/components/legal-links";
import { LocaleProvider, useI18n } from "@/components/locale-provider";
import {
  SchemeSwitch,
  paintPickedScheme,
  readScheme,
  schemeWasPicked,
} from "@/components/scheme-switch";
import { SessionsPanel } from "@/components/sessions-panel";
import { WebAccountGate } from "@/components/web-account-gate";
import { toDateKey } from "@/lib/dates";
import { Connections, ReflectionPanel } from "@/components/journal-explore";
import {
  JournalIntro,
  IntroResult,
  ProfileEditor,
  type IntroAnswers,
} from "./journal-intro";
import { SessionBacklog } from "./session-backlog";
import { WebWorkspace, type SectionId } from "@/components/web-workspace";
import { WeekTab } from "@/components/week-tab";
import { WeeklyPanel } from "@/components/weekly-panel";
import { Button } from "@/components/ui/button";
import { useTelegram } from "@/hooks/use-telegram";
import { useTherapyStore } from "@/hooks/use-therapy-store";
import { useWebAccount } from "@/hooks/use-web-account";
import { ru } from "@/lib/messages/ru";
import { markSplashReady, SPLASH_READY_EVENT } from "@/lib/splash";
import { launchSection, type LaunchSection } from "@/lib/launch-section";
import {
  earlyMaxLogin,
  inMaxClient,
  readMaxInitData,
  signalMaxReady,
  waitForMaxInitData,
} from "@/lib/max-webapp";
import { clearStore, WEB_STORAGE_KEY } from "@/lib/storage";
import { type TelegramSession } from "@/lib/telegram";
import { trackAnalytics } from "@/lib/analytics-client";
import type { WeekAccessStatus, WeekAccessView } from "@/lib/week-access";

const SECTIONS = ["week", "journal", "sessions"] as const;

function tabOf(value: LaunchSection | null): SectionId | null {
  if (value === "journal" || value === "week" || value === "sessions")
    return value;
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

export function TherapyApp({ webFirst = false }: { webFirst?: boolean }) {
  const telegram = useTelegram();
  const inMax = useInMax();
  const pathname = usePathname();
  const webEntry = pathname === "/" || pathname === "/journal" || pathname.startsWith("/journal/");
  const web = useWebAccount(webEntry && telegram.ready && !telegram.inTelegram);
  const [erased, setErased] = useState(false);
  return (
    <LocaleProvider
      telegramLanguage={telegram.user?.language_code}
      initData={telegram.inTelegram ? telegram.initData : ""}
      lockLocale={null}
      publicLanguages={webFirst && !inMax && !telegram.inTelegram && !web.account}
    >
      {erased ? (
        <ErasedJournal />
      ) : (
        <TherapyShell
          web={web}
          webEntry={webEntry}
          onErased={() => setErased(true)}
          telegram={telegram}
          inMax={inMax}
          webFirst={webFirst && !telegram.inTelegram && !inMax}
        />
      )}
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

function localizeStorageError(
  error: string | null,
  t: (
    key: "storageCorrupt" | "storageRead" | "storageWrite" | "storageClear",
  ) => string,
): string {
  if (error === ru.storageCorrupt) return t("storageCorrupt");
  if (error === ru.storageRead) return t("storageRead");
  if (error === ru.storageWrite) return t("storageWrite");
  if (error === ru.storageClear) return t("storageClear");
  return error ?? "";
}

function ErasedJournal() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-md p-6" role="status">
      <h1 className="font-display text-2xl">Between</h1>
      <p className="mt-4">{t("deleteDone")}</p>
    </main>
  );
}

function TherapyShell({
  web,
  webEntry,
  telegram,
  inMax,
  webFirst,
  onErased,
}: {
  web: ReturnType<typeof useWebAccount>;
  webEntry: boolean;
  telegram: TelegramSession;
  inMax: boolean;
  webFirst: boolean;
  onErased: () => void;
}) {
  const { t, locale } = useI18n();
  const [composeRequest, setComposeRequest] = useState(0);
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
        ? ((await early.catch(() => null))?.account as
            | Parameters<typeof signIn>[0]
            | undefined)
        : undefined;
      if (!account && initData && !early) {
        try {
          const res = await fetch("/api/account/max", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            account?: Parameters<typeof signIn>[0];
          };
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
    retryCloud,
    clearCache,
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
    saveProfile,
    saveReflection,
    restoreTheme,
    setObservation,
    judgeSkipped,
  } = useTherapyStore({
    initData: telegram.initData,
    inTelegram: telegram.inTelegram,
    locale,
    maxInitData: inMax && maxLaunch ? maxLaunch : "",
    // A site cookie is another person's journal until MAX says who opened the app.
    web: Boolean(web.account) && (!inMax || maxLaunch === ""),
  });

  const requested = useSyncExternalStore(
    subscribeLaunch,
    readLaunch,
    () => null,
  );
  const fromMax = launchSection({ initData: maxLaunch });
  const [picked, setPicked] = useState<SectionId | null>(null);
  const section: SectionId =
    picked ?? tabOf(requested) ?? tabOf(fromMax) ?? SECTIONS[0];
  const selectSection = setPicked;
  const [accountOpen, setAccountOpen] = useState(false);
  const [accessStatus, setAccessStatus] = useState<WeekAccessStatus | null>(
    null,
  );
  const locked = accessStatus === "locked";
  const wantsSubscribe = requested === "subscribe" || fromMax === "subscribe";
  /* eslint-disable react-hooks/set-state-in-effect -- reconcile an incoming subscription deep link with server access */
  useEffect(() => {
    if (accessStatus === "locked") {
      if (wantsSubscribe) setAccountOpen(false);
      return;
    }
    if (wantsSubscribe) setAccountOpen(true);
  }, [wantsSubscribe, accessStatus]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [passwordSeen, setPasswordSeen] = useState(false);
  const passwordHash = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("hashchange", onStoreChange);
      return () => window.removeEventListener("hashchange", onStoreChange);
    },
    () => window.location.hash === "#password",
    () => false,
  );
  const showAccount =
    accountOpen || (passwordHash && Boolean(web.account) && !passwordSeen);
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
  const disabled = status !== "ready";
  function onWeekAccess(view: WeekAccessView) {
    setAccessStatus(view.status);
  }

  const maxPending =
    inMax && webEntry && !telegram.inTelegram && maxLaunch === null;
  const authSettled =
    !webEntry ||
    telegram.inTelegram ||
    web.status === "ready" ||
    web.status === "unavailable";
  const showGate =
    webEntry &&
    telegram.ready &&
    !telegram.inTelegram &&
    authSettled &&
    maxReady &&
    !maxLaunch &&
    !web.account;
  const accountPending =
    maxPending ||
    (webEntry && !telegram.inTelegram && !maxLaunch && !authSettled);
  const shellReady = telegram.ready;
  useEffect(() => {
    if (shellReady) markSplashReady();
  }, [shellReady]);

  const [entryId, setEntryId] = useState("");
  const [topic, setTopic] = useState({ id: "", visit: 0 });
  const [hideBot, setHideBot] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodSaved, setMoodSaved] = useState("");
  const [intro, setIntro] = useState<IntroAnswers | null>(null);
  useEffect(() => {
    if (intro && web.account && status === "ready" && !store.profile) {
      saveProfile(intro.name, intro.therapy);
    }
  }, [intro, web.account, status, store.profile, saveProfile]);
  const [login, setLogin] = useState(false);
  const loginRequested = useSyncExternalStore(
    subscribeLaunch,
    () => new URLSearchParams(location.search).has("login"),
    () => false,
  );
  const personal = store.profile?.therapy === false;
  const linked =
    telegram.inTelegram ||
    inMax ||
    Boolean(web.account?.telegramLinked || web.account?.maxLinked);
  function reflect(id: string) {
    setEntryId(id);
    selectSection("reflection");
  }
  const signedOutWeb = !inMax && !telegram.inTelegram && !web.account;
  const accountButton = signedOutWeb ? (
    <>
      <SchemeSwitch />
      <LanguageSwitch />
    </>
  ) : (
    <AccountButton
      solid={!telegram.inTelegram}
      pressed={showAccount}
      onClick={() => setAccountOpen(true)}
    />
  );
  const footer = (
    <footer className="mt-8 text-center text-xs text-muted-foreground">
      {syncLabel === "offline-cloud" && <p role="status">{t("syncOffline")}</p>}
      <LegalLinks telegram={telegram.inTelegram} className="mt-2" />
    </footer>
  );
  const accessProps = {
    ready: telegram.ready,
    inTelegram: telegram.inTelegram,
    inMax,
    initData: telegram.initData,
    maxInitData: inMax ? (maxLaunch ?? "") : "",
    canSubscribe: Boolean(web.account) || inMax,
    reloadToken: accessNonce,
    onAccess: onWeekAccess,
  };
  const gate =
    showGate &&
    (webFirst && !login && !loginRequested && !intro ? (
      <JournalIntro onFinish={setIntro} onLogin={() => setLogin(true)} />
    ) : (
      <WebAccountGate
        compact
        initialLogin={login || loginRequested}
        onSignedIn={web.setAccount}
      />
    ));
  const pending = !telegram.ready || accountPending || status === "loading";
  const problem = status === "error" && (
    <div role="alert">
      {error === "cloud_unavailable"
        ? t("webServer")
        : localizeStorageError(error, t)}{" "}
      <Button
        onClick={
          error === "cloud_unavailable"
            ? () => void retryCloud()
            : resetCorrupted
        }
      >
        {t(error === "cloud_unavailable" ? "accessRetry" : "startOver")}
      </Button>
    </div>
  );
  const blocked = pending ? (
    <JournalSkeleton />
  ) : (
    gate ||
    problem ||
    (locked || !accessStatus ? (
      <WeekTab active {...accessProps}>
        {null}
      </WeekTab>
    ) : null)
  );
  const hint = !linked && !hideBot && (
    <aside className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
      <button
        type="button"
        className="flex-1 text-start text-sm font-semibold"
        onClick={() => setAccountOpen(true)}
      >
        {t("webBotOffer")} · Telegram / MAX ↗
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("accountClose")}
        onClick={() => setHideBot(true)}
      >
        <X />
      </Button>
    </aside>
  );
  function compose() {
    selectSection("journal");
    setComposeRequest((n) => n + 1);
  }
  return (
    <BotChatPermission
      ready={telegram.ready}
      inTelegram={telegram.inTelegram}
      allowsWriteToPm={telegram.allowsWriteToPm}
      initData={telegram.initData}
    >
      <WebWorkspace
        section={personal && section === "sessions" ? "topics" : section}
        onSection={selectSection}
        tools={
          <>
            {!blocked && (
              <Button
                variant="outline"
                size="icon"
                aria-label={t("howFeel")}
                onClick={() => {
                  setMoodSaved("");
                  setMoodOpen(true);
                }}
              >
                <Smile />
              </Button>
            )}
            {accountButton}
          </>
        }
        footer={footer}
        blocked={blocked}
        onCompose={compose}
        personal={personal}
        name={store.profile?.name ?? ""}
        pages={{
          week: (
            <>
              {intro && (
                <IntroResult
                  answers={intro}
                  noteSaved={store.entries.some(entry => entry.id === intro.id)}
                  onSaveNote={() => upsertEntry({id: intro.id, date: toDateKey(), body: intro.thought, feelings: [], tags: []})}
                  onSchedule={() => {
                    if (store.profile || saveProfile(intro.name, intro.therapy)) {
                      selectSection("sessions");
                    }
                  }}
                  onDone={() => {
                    if (store.profile || saveProfile(intro.name, intro.therapy))
                      setIntro(null);
                  }}
                />
              )}
              <WeekTab active={section === "week"} {...accessProps}>
                <WeeklyPanel
                  entries={store.entries}
                  sessions={
                    store.sessionPlan && !personal ? store.sessions : []
                  }
                  plan={personal ? null : store.sessionPlan}
                  weekPreps={store.weekPreps}
                  themes={store.themes}
                  themeLinks={store.themeLinks}
                  judgeSettled={store.judgeSettled}
                  judgeSkipped={judgeSkipped}
                  onSavePattern={savePattern}
                  onSaveThemes={saveThemes}
                  maxInitData={inMax ? (maxLaunch ?? "") : ""}
                  initData={telegram.initData}
                  cloud={Boolean(web.account)}
                  disabled={disabled}
                />
              </WeekTab>
            </>
          ),
          journal: (
            <JournalPanel
              entries={store.entries}
              onSave={upsertEntry}
              onDelete={deleteEntry}
              initData={telegram.initData}
              disabled={disabled}
              composeRequest={composeRequest}
              hint={hint}
              onReflect={reflect}
            />
          ),
          reflection: (
            <ReflectionPanel
              selected={entryId}
              store={store}
              onSelect={setEntryId}
              onSave={saveReflection}
            />
          ),
          connections: (
            <Connections
              store={store}
              onReflect={reflect}
              onFeedback={setObservation}
              onTopic={(id) => {
                setTopic((prev) => ({ id, visit: prev.visit + 1 }));
                selectSection("topics");
              }}
            />
          ),
          topics: (
            <SessionBacklog
              key={topic.visit}
              initialTheme={topic.id}
              themes={store.themes}
              entries={store.entries}
              links={store.themeLinks}
              disabled={disabled}
              personal={personal}
              onRestore={restoreTheme}
              onDiscuss={setThemeDiscussed}
              onDismiss={dismissSessionTheme}
              onAdd={addSessionTheme}
            />
          ),
          sessions: (
            <SessionsPanel
              sessions={store.sessions}
              plan={store.sessionPlan}
              notify={store.notify}
              onSave={upsertSession}
              onDelete={deleteSession}
              onSavePlan={saveSessionPlan}
              onSaveNotify={saveNotify}
              disabled={disabled}
              notificationsDisabled={!linked}
            />
          ),
        }}
      />
      {!blocked && moodOpen && (
        <MoodDialog
          onClose={() => setMoodOpen(false)}
          onSave={(input) => {
            const ok = upsertEntry(input);
            if (ok) {
              trackAnalytics("note", telegram.initData);
              setMoodSaved(t("saved"));
              window.setTimeout(() => setMoodSaved(""), 1800);
            }
            return ok;
          }}
        />
      )}
      {moodSaved && (
        <div
          role="status"
          className="fixed bottom-8 inset-x-0 z-30 mx-auto w-fit rounded-full bg-primary px-4 py-2 text-primary-foreground"
        >
          {moodSaved}
        </div>
      )}
      <AccountSheet
        onErased={onErased}
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
        onPremium={() => setAccessNonce((n) => n + 1)}
        profileEditor={
          !blocked && (
            <ProfileEditor
              profile={store.profile}
              onSave={saveProfile}
            />
          )
        }
        onLogout={() => {
          clearCache();
          clearStore(WEB_STORAGE_KEY);
          web.setAccount(null);
          setIntro(null);
          closeAccount();
          window.location.reload();
        }}
      />
      <BotChatSheet />
    </BotChatPermission>
  );
}
