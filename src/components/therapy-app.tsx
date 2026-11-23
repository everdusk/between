"use client";

import { BrandLogo } from "./brand-logo";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BotConnectBanner } from "./bot-connect-banner";
import { BotChatPermission, BotChatSheet } from "@/components/bot-chat-gate";
import { JournalPanel } from "@/components/journal-panel";
import { JournalSkeleton } from "@/components/journal-skeleton";
import { AccountButton, AccountSheet } from "@/components/account-sheet";
import { LegalLinks } from "@/components/legal-links";
import { TelegramLocaleProvider, useI18n } from "@/components/locale-provider";
import { SchemeSwitch } from "@/components/scheme-switch";
import { useMaxScheme } from "@/hooks/use-max-scheme";
import { SessionsPanel } from "@/components/sessions-panel";
import { WebAccountGate } from "@/components/web-account-gate";
import { readIntroDraft, type IntroDraft, type LegacyIntroRecord } from "@/lib/intro-record";
import { IntroCard, IntroReflection, introDraftKey } from "./intro-reflection";
import { ThemeReflection } from "./weekly-review";
import { ReflectionPanel } from "@/components/journal-explore";
import { ProfileEditor } from "./journal-intro";
import { SessionBacklog } from "./session-backlog";
import { WebWorkspace, type SectionId } from "@/components/web-workspace";
import { WeekTab } from "@/components/week-tab";
import { WeeklyPanel } from "@/components/weekly-panel";
import { Button } from "@/components/ui/button";
import { useTelegram } from "@/hooks/use-telegram";
import { useTherapyStore } from "@/hooks/use-therapy-store";
import { useWebAccount } from "@/hooks/use-web-account";
import { ru } from "@/lib/messages/ru";
import { markSplashReady } from "@/lib/splash";
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
  useMaxScheme(inMax && !telegram.inTelegram);
  const pathname = usePathname();
  const webEntry = pathname === "/" || pathname === "/journal" || pathname.startsWith("/journal/");
  const web = useWebAccount(webEntry && telegram.ready && !telegram.inTelegram);
  const [erased, setErased] = useState(false);
  const [maxLaunch, setMaxLaunch] = useState<string | null>(null);
  const content = erased ? <ErasedJournal /> : (
    <TherapyShell
      maxLaunch={maxLaunch}
      setMaxLaunch={setMaxLaunch}
      web={web}
      webEntry={webEntry}
      onErased={() => setErased(true)}
      telegram={telegram}
      inMax={inMax}
      webFirst={webFirst && !telegram.inTelegram && !inMax}
    />
  );
  return telegram.inTelegram ? (
    <TelegramLocaleProvider key={telegram.user?.id} languageCode={telegram.user?.language_code} initData={telegram.initData}>
      {content}
    </TelegramLocaleProvider>
  ) : content;
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
      <h1 className="font-display text-2xl"><BrandLogo /></h1>
      <p className="mt-4">{t("deleteDone")}</p>
    </main>
  );
}

function TherapyShell({
  maxLaunch,
  setMaxLaunch,
  web,
  webEntry,
  telegram,
  inMax,
  webFirst,
  onErased,
}: {
  web: ReturnType<typeof useWebAccount>;
  maxLaunch: string | null;
  setMaxLaunch: (value: string) => void;
  webEntry: boolean;
  telegram: TelegramSession;
  inMax: boolean;
  webFirst: boolean;
  onErased: () => void;
}) {
  const { t, locale } = useI18n();
  const [composeRequest, setComposeRequest] = useState(0);
  // null while MAX may still hand over the launch string. "" means it never arrived.
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
  }, [waitingForMax, signIn, setMaxLaunch]);
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
    importIntroduction,
    startGuest,
    saveReflection,
    reviewPilot,
    saveReview,
    restoreTheme,
    judgeSkipped,
  } = useTherapyStore({
    initData: telegram.initData,
    inTelegram: telegram.inTelegram,
    guestStorage: webEntry && !inMax && !telegram.inTelegram,
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
  const [topicId,setTopicId] = useState("");
  const [hideBot, setHideBot] = useState(false);
  const signInLink = useSyncExternalStore(
    subscribeLaunch,
    () => new URLSearchParams(location.search).get("login") === "1",
    () => false,
  );
  const [draft, setIntro] = useState<IntroDraft | null>(() => {
    if (!webEntry || typeof window === "undefined") return null;
    try { return readIntroDraft(JSON.parse(sessionStorage.getItem(introDraftKey) ?? "null")); }
    catch { return null; }
  });
  const [guestAuth, setGuestAuth] = useState<"register" | "login" | null>(() => {
    try {
      const mode = sessionStorage.getItem(introDraftKey + ":guest");
      return mode === "register" || mode === "login" ? mode : null;
    } catch { return null; }
  });
  const guestRecord = !inMax && !telegram.inTelegram && !web.account && syncLabel === "local"
    ? store.introductions?.at(-1) : undefined;
  const intro = signInLink && !web.account ? null : draft;
  const [editingIntro, setEditingIntro] = useState<LegacyIntroRecord | null>(null);
  const editorKey = "between:intro:open-editor";
  function finishIntroEditor() {
    try { sessionStorage.removeItem(editorKey); } catch { /* private browsing */ }
    setEditingIntro(null);
  }
  useEffect(() => {
    if (!webFirst || !web.account || intro || editingIntro || status !== "ready" || syncLabel !== "cloud") return;
    let attempt: string | null;
    try { attempt = sessionStorage.getItem(editorKey); } catch { return; }
    const saved = store.introductions?.find(r => r.attempt === attempt);
    if (!saved || saved.kind === "checkin" || store.entries.some(e => e.id === "intro-answer-"+attempt)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the editor only in the authenticated owner's journal
    setEditingIntro(saved);
    setPicked("journal");
    setComposeRequest(n => n+1);
  }, [webFirst,web.account,intro,editingIntro,status,syncLabel,store.introductions,store.entries]);
  const [handoffError,setHandoffError] = useState(false);
  const [handoffRetry,setHandoffRetry] = useState(0);
  const [savedIntroDate, setSavedIntroDate] = useState("");
  function enterGuest(record: IntroDraft) {
    if (!startGuest(record)) return false;
    setPicked("week");
    return true;
  }
  const openGuestAuth = useCallback((mode: "register" | "login") => {
    if (!guestRecord) return;
    try {
      sessionStorage.setItem(introDraftKey + ":guest", mode);
      sessionStorage.setItem(introDraftKey, JSON.stringify(guestRecord));
      sessionStorage.removeItem(introDraftKey + ":owner");
    } catch { /* The in-memory draft still works for in-page sign-in. */ }
    setIntro(guestRecord);
    setGuestAuth(mode);
  }, [guestRecord]);
  useEffect(() => {
    if (showGate && signInLink && guestRecord && !guestAuth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preserve the guest transfer across external sign-in redirects
      openGuestAuth("login");
    }
  }, [showGate, signInLink, guestRecord, guestAuth, openGuestAuth]);
  function returnToGuest() {
    try {
      sessionStorage.removeItem(introDraftKey);
      sessionStorage.removeItem(introDraftKey + ":owner");
      sessionStorage.removeItem(introDraftKey + ":guest");
      sessionStorage.removeItem("between:messenger-login");
    } catch { /* Private browsing. */ }
    const url = new URL(location.href);
    url.searchParams.delete("login");
    url.searchParams.delete("yandex");
    url.searchParams.set("start", "1");
    history.replaceState(history.state, "", url);
    window.dispatchEvent(new Event("popstate"));
    setIntro(null);
    setGuestAuth(null);
  }
  useEffect(() => {
    if (!webEntry || inMax || telegram.inTelegram || !intro || !web.account || status !== "ready" || syncLabel !== "cloud" || !accessStatus || locked) return;
    try {
      const boundOwner = sessionStorage.getItem(introDraftKey+":owner");
      if (boundOwner && boundOwner !== web.account.email) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- a pending handoff belongs to the previously authenticated account
        setIntro(null);
        return;
      }
      sessionStorage.setItem(introDraftKey+":owner", web.account.email);
    } catch { /* in-memory handoff */ }
    let active = true;
    void importIntroduction(intro, Boolean(guestAuth)).then(saved => {
      if (!active) return;
      if (!saved) { setHandoffError(true); return; }
      setHandoffError(false);
      try {
        if (intro.kind === "checkin" || intro.note) sessionStorage.removeItem(editorKey);
        else sessionStorage.setItem(editorKey,intro.attempt);
        sessionStorage.removeItem(introDraftKey);
        sessionStorage.removeItem(introDraftKey+":owner");
        sessionStorage.removeItem(introDraftKey+":guest");
      } catch { /* private browsing */ }
      if (intro.kind === "checkin" || intro.note) {
        setSavedIntroDate(guestAuth ? "" : intro.note?.date ?? intro.date);
        setGuestAuth(null);
        trackAnalytics("note", "");
      } else {
        setEditingIntro(intro);
        setComposeRequest(n => n+1);
      }
      setIntro(null);
      setPicked("journal");
    });
    return () => { active = false; };
  }, [webEntry,inMax,telegram.inTelegram,intro,web.account,status,syncLabel,accessStatus,locked,importIntroduction,guestAuth,handoffRetry]);
  const resumingMessenger = useSyncExternalStore(
    subscribeLaunch,
    () => {
      try { return Boolean(sessionStorage.getItem("between:messenger-login")); }
      catch { return false; }
    },
    () => false,
  );
  const guest = Boolean(showGate && guestRecord && !intro && !guestAuth && !signInLink && !resumingMessenger);
  const guestForm = Boolean(guestRecord && !guest);
  const guestLogin = signInLink || guestAuth === "login";
  const personal = store.profile?.therapy === false;
  const linked =
    telegram.inTelegram ||
    inMax ||
    Boolean(web.account?.telegramLinked || web.account?.maxLinked);
  function reflect(id: string) {
    if (guest) { openGuestAuth("register"); return; }
    setEntryId(id);
    selectSection("reflection");
  }
  const signedOutWeb = !inMax && !telegram.inTelegram && !web.account;
  const accountButton = guest ? (
    <AccountButton solid pressed={false} onClick={() => openGuestAuth("login")} />
  ) : signedOutWeb ? (
    <SchemeSwitch />
  ) : (
    <AccountButton
      solid={!telegram.inTelegram}
      pressed={showAccount}
      onClick={() => setAccountOpen(true)}
    />
  );
  const footer = (
    <footer className="text-center text-xs text-muted-foreground">
      {syncLabel === "offline-cloud" && <p role="status">{t("syncOffline")}</p>}
      {!(locked && inMax) && (
        <LegalLinks telegram={telegram.inTelegram} className="desk-legal-links" />
      )}
    </footer>
  );
  const accessProps = {
    ready: telegram.ready,
    inTelegram: telegram.inTelegram,
    inMax,
    initData: telegram.initData,
    maxInitData: inMax ? (maxLaunch ?? "") : "",
    reloadToken: accessNonce,
    onAccess: onWeekAccess,
  };
  const gate =
    showGate && !guest &&
    (webFirst && !signInLink && !resumingMessenger && !intro && !guestForm ? (
      <IntroReflection onFinish={enterGuest} />
    ) : (
      <div className="space-y-4">
      {guestForm && <Button variant="ghost" onClick={returnToGuest}>← В гостевой дневник</Button>}
      <WebAccountGate
        key={guestLogin ? "sign-in" : "onboarding"}
        surveyAttempt={guestForm ? guestRecord?.attempt : signInLink ? undefined : intro?.attempt}
        entryPreview={!guestForm && intro && !guestLogin && <div className="intro-screen space-y-4">
          {intro.kind === "checkin" && <h1 className="font-display text-2xl">{locale === "en" ? "Your first entry" : "Ваша первая запись"}</h1>}
          <IntroCard record={intro}/>
        </div>}
        compact
        yandexLogin={webFirst && web.yandexLogin}
        initialLogin={guestLogin}
        onSignedIn={web.setAccount}
      /></div>
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
    (webEntry && !inMax && !telegram.inTelegram && intro && web.account && accessStatus && !locked ? (
      <section className="glass space-y-3 rounded-3xl p-5" role="status">
        <IntroCard record={intro}/>
        {handoffError || syncLabel==="offline-cloud" ? <><p>{locale==="en"?"Your answers are here. Try saving them again.":"Ответы остались здесь. Попробуйте сохранить их ещё раз."}</p><Button onClick={()=>{setHandoffError(false);setHandoffRetry(n=>n+1);void retryCloud()}}>{t("accessRetry")}</Button></> :
          <p>{locale==="en"?"Saving your answers…":"Сохраняем ваши ответы…"}</p>}
      </section>
    ) : null) ||
    (!guest && (locked || !accessStatus) ? (
      <WeekTab active {...accessProps}>
        {null}
      </WeekTab>
    ) : null)
  );
  const hint = web.account && !linked && !hideBot && (
    <BotConnectBanner onRefresh={web.refresh} onDismiss={()=>setHideBot(true)}/>
  );
  function compose() {
    selectSection("journal");
    setComposeRequest((n) => n + 1);
  }
  const overview = (
    <WeeklyPanel review={!guest && reviewPilot ? saveReview : undefined} guest={guest} inMessenger={inMax || telegram.inTelegram}
      entries={store.entries} sessions={store.sessionPlan && !personal ? store.sessions : []}
      plan={personal ? null : store.sessionPlan} weekPreps={store.weekPreps} themes={store.themes}
      themeLinks={store.themeLinks} judgeSettled={store.judgeSettled} judgeSkipped={judgeSkipped}
      onSavePattern={savePattern} onSaveThemes={saveThemes} maxInitData={accessProps.maxInitData}
      initData={telegram.initData} cloud={Boolean(web.account)} disabled={disabled} />
  );
  return (
    <BotChatPermission
      ready={telegram.ready}
      inTelegram={telegram.inTelegram}
      allowsWriteToPm={telegram.allowsWriteToPm}
      initData={telegram.initData}
    >
      <WebWorkspace
        homeHref={telegram.ready && !telegram.inTelegram && !inMax ? `/?lang=${locale}` : undefined}
        section={guest && section !== "journal" ? "week" : personal && section === "sessions" ? "topics" : section}
        onSection={next=>{
          if (guest && next !== "week" && next !== "journal") { openGuestAuth("register"); return; }
          if(reviewPilot && next==="reflection") setEntryId("");
          selectSection(next);
        }}
        guestBanner={guest && <aside className="glass mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-3xl px-4 py-3">
          <div><strong className="text-sm">Гостевой доступ</strong>
            <p className="text-xs text-muted-foreground">Записи хранятся только в этом браузере.</p></div>
          <Button size="sm" onClick={() => openGuestAuth("register")}>Зарегистрироваться</Button>
        </aside>}
        tools={accountButton}
        footer={footer}
        blocked={blocked}
        onCompose={compose}
        personal={personal}
        pages={{
          week: guest ? overview : (
            <WeekTab active={section === "week"} {...accessProps}>
              {section === "week" && hint}
              {overview}
            </WeekTab>
          ),
          journal: (
            <JournalPanel
              guest={guest}
              initialDate={savedIntroDate}
              entries={store.entries}
              onSave={upsertEntry}
              onDelete={deleteEntry}
              initData={telegram.initData}
              disabled={disabled}
              introductions={webFirst ? store.introductions : undefined}
              firstRecord={editingIntro}
              onFirstSaved={finishIntroEditor}
              composeRequest={composeRequest}
              hint={section === "journal" && hint}
              pilotTopics={reviewPilot ? {themes:store.themes,links:store.themeLinks,open:id=>{
                setTopicId(id);setEntryId("");selectSection("reflection");
              }} : undefined}
              onReflect={reflect}
            />
          ),
          reflection: reviewPilot && !entryId && store.themes.length ? (
            <ThemeReflection themes={store.themes} entries={store.entries} links={store.themeLinks}
              save={saveReview} selected={topicId} onSelect={setTopicId}/>
          ) : (
            <ReflectionPanel
              selected={entryId}
              store={store}
              onSelect={setEntryId}
              onSave={saveReflection}
            />
          ),
          topics: (
            <SessionBacklog
              themes={store.themes}
              entries={store.entries}
              links={store.themeLinks}
              disabled={disabled}
              personal={personal}
              reviewPilot={reviewPilot}
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
              onSave={upsertSession}
              onDelete={deleteSession}
              onSavePlan={saveSessionPlan}
              disabled={disabled}
            />
          ),
        }}
      />
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
          finishIntroEditor();
          try { sessionStorage.removeItem(introDraftKey); sessionStorage.removeItem(introDraftKey+":owner"); sessionStorage.removeItem(introDraftKey+":guest"); } catch { /* private browsing */ }
          closeAccount();
          window.location.reload();
        }}
      />
      <BotChatSheet />
    </BotChatPermission>
  );
}
