"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { registrationReason, type AuthOperation } from "@/lib/registration-errors";
import { trackSurvey, type RegistrationMethod, type RegistrationStep } from "@/lib/survey-analytics";
import { Bot, Check, LoaderCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LegalAgree } from "@/components/legal-links";
import { PasswordField } from "@/components/password-field";
import { useI18n } from "@/components/locale-provider";
import type { WebAccount } from "@/hooks/use-web-account";
import { formatDayLabel, formatTime, toDateKey } from "@/lib/dates";
import { readMaxInitData } from "@/lib/max-webapp";
import { feelingFill } from "@/lib/spectrum";
import type { Feeling } from "@/lib/types";

const SAMPLE_NOTES: {
  hour: number;
  minute: number;
  feelings: Feeling[];
  body: "webSampleNote1" | "webSampleNote2";
  tag: "webSampleTag1" | "webSampleTag2";
  bot?: boolean;
}[] = [
  { hour: 8, minute: 40, feelings: ["тревожно"], body: "webSampleNote1", tag: "webSampleTag1" },
  { hour: 21, minute: 15, feelings: ["спокойно"], body: "webSampleNote2", tag: "webSampleTag2", bot: true },
];

function sampleStamp(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** The real journal cards with example text, so the screen shows what a week turns into. */
function JournalPreview() {
  const { t, locale, feeling } = useI18n();
  const today = useMemo(() => toDateKey(), []);
  return (
    <div className="journal-preview mt-8 grid gap-4" aria-label={t("webSample")}>
      <section className="glass-strong relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow text-section-header">{t("todayTitle")}</p>
          <Badge variant="outline" className="font-normal">
            {t("webSample")}
          </Badge>
        </div>
        <h3 className="mt-3 font-display text-[1.75rem] leading-[1.05] tracking-tight text-foreground sm:text-[2rem]">
          {formatDayLabel(today, locale)}
        </h3>
        <ul className="mt-5 space-y-3">
          {SAMPLE_NOTES.map((note) => (
            <li key={note.body} className="glass relative overflow-hidden rounded-3xl p-4 ps-5">
              <span
                aria-hidden
                className="absolute inset-y-4 start-0 w-1 rounded-e-full"
                style={{ background: feelingFill(note.feelings[0]) }}
              />
              <div className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatTime(sampleStamp(note.hour, note.minute), locale)}
                </span>
                {note.bot ? (
                  <span className="inline-flex items-center gap-1">
                    <Bot aria-hidden className="size-3" />
                    {t("fromBot")}
                  </span>
                ) : null}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {note.feelings.map((item) => (
                  <Badge key={item} variant="secondary" className="font-normal">
                    <span aria-hidden className="size-1.5 rounded-full" style={{ background: feelingFill(item) }} />
                    {feeling(item)}
                  </Badge>
                ))}
              </div>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-foreground/90">{t(note.body)}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="font-normal">
                  {t(note.tag)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="ink rounded-3xl p-5 sm:p-6">
        <p className="eyebrow text-[color:var(--ink-muted)]">{t("tabWeek")}</p>
        <h3 className="mt-2 font-display text-xl tracking-tight">{t("backlogTitle")}</h3>
        <ul className="mt-4 space-y-3">
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-current opacity-80" />
            <div className="min-w-0">
              <p className="text-[0.9375rem] leading-snug">{t("backlogAgain", { tag: t("webSampleTag1") })}</p>
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">{t("backlogHigh")}</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-current opacity-50" />
            <div className="min-w-0">
              <p className="text-[0.9375rem] leading-snug">{t("webSampleTheme")}</p>
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">{t("backlogMid")}</p>
            </div>
          </li>
        </ul>
      </section>

      <p className="flex items-start gap-2 px-1 text-sm leading-relaxed text-muted-foreground">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t("webSampleLock")}
      </p>
    </div>
  );
}

type GateMode = "login" | "forgot" | "code";

export function WebAccountGate({ onSignedIn, compact = false, initialLogin = false, surveyAttempt }: { onSignedIn: (account: WebAccount) => void; compact?: boolean; initialLogin?: boolean; surveyAttempt?: string }) {
  const { t, locale } = useI18n();
  const registration = useRef<{ attempt: string; source: "survey" | "direct" } | null>(null);
  const logged = useRef(new Set<string>());
  const record = useCallback((stage: RegistrationStep, method: RegistrationMethod, operation?: AuthOperation, reason?: string) => {
    if (!registration.current) registration.current = { attempt: surveyAttempt ?? crypto.randomUUID(), source: surveyAttempt ? "survey" : "direct" };
    if (stage === "form_view" || stage === "email_started") {
      if (logged.current.has(stage)) return;
      logged.current.add(stage);
    }
    trackSurvey({event: "web_registration_step", ...registration.current, stage, method, operation, reason}, locale);
  }, [locale, surveyAttempt]);
  const [mode, setMode] = useState<GateMode>("login");
  const [creating, setCreating] = useState(() => {
    if (!compact) return false;
    if (surveyAttempt) return true;
    try {
      const saved = JSON.parse(sessionStorage.getItem("between:messenger-login") ?? "null");
      if (saved?.token && typeof saved.creating === "boolean") return saved.creating;
    } catch {
      // A fresh visit uses the requested entry point.
    }
    return !initialLogin;
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messengerUrl, setMessengerUrl] = useState<string | null>(null);
  const [telegramVpn, setTelegramVpn] = useState(false);
  const [errorScope, setErrorScope] = useState<"login" | "register" | "messenger" | "other">("other");
  const [waitingFor, setWaitingFor] = useState<"max" | "telegram" | null>(null);
  const startingMessenger = useRef(false);
  const formRef = useRef<HTMLElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const maxTried = useRef(false);
  const maxPoll = useRef(0);

  useEffect(() => {
    if (mode === "login" && creating) record("form_view", "form");
  }, [mode, creating, record]);

  useEffect(() => {
    if (mode === "code") codeRef.current?.focus();
  }, [mode]);

  useEffect(() => () => {
    maxPoll.current += 1;
  }, []);

  useEffect(() => {
    if (maxTried.current) return;
    let stopped = false;
    async function enter(initData: string) {
      if (stopped || maxTried.current) return;
      maxTried.current = true;
      setBusy(true);
      try {
        const res = await fetch("/api/account/max", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const data = (await res.json().catch(() => ({}))) as { account?: WebAccount; error?: string };
        if (stopped) return;
        if (res.ok && data.account) onSignedIn(data.account);
        else record("error", "max", "max_auto_login", registrationReason(data.error, res.status));
      } catch {
        if (!stopped) record("error", "max", "max_auto_login", "network_error");
      } finally {
        if (!stopped) setBusy(false);
      }
    }
    const first = readMaxInitData();
    if (first) {
      void enter(first);
      return () => {
        stopped = true;
      };
    }
    const timer = window.setTimeout(() => {
      const later = readMaxInitData();
      if (later) void enter(later);
    }, 400);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [onSignedIn, record]);

  function formError(value: string | undefined): string {
    if (value === "bad_email") return t("webBadEmail");
    if (value === "mail_off") return t("webMailOff");
    if (value === "soon") return t("webMailSoon");
    if (value === "mail_fail") return t("webMailFail");
    if (value === "server_not_configured") return t("webServer");
    if (value === "taken") return t("webEmailTaken");
    if (value === "short_password") return t("webPasswordShort");
    if (value === "bad_login") return t("webBadLogin");
    if (value === "limited") return t("webLoginLimited");
    return t("webCodeBad");
  }

  function passwordReady(): boolean {
    setErrorScope("register");
    if (password !== passwordAgain) {
      record("error", "email", "register", "password_mismatch");
      setError(t("webPasswordMismatch"));
      return false;
    }
    if (password.length < 8 || password.length > 200) {
      record("error", "email", "register", "short_password");
      setError(t("webPasswordShort"));
      return false;
    }
    return true;
  }

  function rememberLogin(kind: "max" | "telegram", token: string, expiresAt: number, url: string, vpn: boolean) {
    try {
      sessionStorage.setItem("between:messenger-login", JSON.stringify({ kind, token, expiresAt, url, vpn, creating, registration: registration.current }));
    } catch {
      // The open tab still polls when storage is blocked.
    }
  }

  function forgetLogin() {
    try {
      sessionStorage.removeItem("between:messenger-login");
    } catch {
      // Nothing to clear.
    }
  }

  async function pollMessenger(kind: "max" | "telegram", token: string, mine: number, expiresAt: number) {
    const waitUrl = kind === "max" ? "/api/account/max/wait" : "/api/account/telegram/wait";
    let reason = "confirmation_timeout";
    while (Date.now() < expiresAt) {
      if (mine !== maxPoll.current) return;
      try {
        const wait = await fetch(waitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = (await wait.json().catch(() => ({}))) as { pending?: boolean; error?: string; account?: WebAccount };
        if (mine !== maxPoll.current) return;
        reason = wait.ok && body.pending ? "confirmation_timeout" : registrationReason(body.error, wait.status);
        if (wait.status === 403 || wait.status === 400) break;
        if (wait.ok && body.account && !body.pending) {
          forgetLogin();
          record("signed_in", kind);
          onSignedIn(body.account);
          return;
        }
      } catch {
        reason = "network_error";
      }
      await new Promise<void>((resolve) => {
        const wake = () => {
          window.clearTimeout(timer);
          window.removeEventListener("focus", wake);
          document.removeEventListener("visibilitychange", wake);
          resolve();
        };
        const timer = window.setTimeout(wake, 1500);
        window.addEventListener("focus", wake);
        document.addEventListener("visibilitychange", wake);
      });
    }
    if (mine !== maxPoll.current) return;
    forgetLogin();
    record("error", kind, "messenger_wait", reason);
    setWaitingFor(null);
    setMessengerUrl(null);
    setNote(null);
    setErrorScope("messenger");
    setError(t(kind === "max" ? "webMaxLoginFail" : "webTgLoginFail"));
  }

  async function loginWithMessenger(kind: "max" | "telegram") {
    if (startingMessenger.current) return;
    record("messenger_started", kind);
    startingMessenger.current = true;
    const popup = window.open("about:blank", "_blank");
    const mine = ++maxPoll.current;
    setError(null);
    setErrorScope("messenger");
    setWaitingFor(kind);
    setNote(null);
    setMessengerUrl(null);
    setTelegramVpn(false);
    try {
      const res = await fetch(kind === "max" ? "/api/account/max/start" : "/api/account/telegram/start", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        url?: string;
        error?: string;
        vpn?: boolean;
      };
      if (mine !== maxPoll.current) {
        popup?.close();
        return;
      }
      if (!res.ok || !data.token || !data.url) {
        record("error", kind, "messenger_start", registrationReason(data.error, res.status));
        popup?.close();
        setError(data.error === "max_off" ? t("webMaxOff") : t("webServer"));
        return;
      }
      if (data.vpn) setTelegramVpn(true);
      const expiresAt = Date.now() + 10 * 60_000;
      rememberLogin(kind, data.token, expiresAt, data.url, Boolean(data.vpn));
      setMessengerUrl(data.url);
      if (popup && !popup.closed) popup.location.replace(data.url);
      setNote(t(kind === "max" ? "webMaxLoginWait" : "webTgLoginWait"));
      startingMessenger.current = false;
      await pollMessenger(kind, data.token, mine, expiresAt);
    } catch {
      popup?.close();
      if (mine === maxPoll.current) { record("error", kind, "messenger_start", "network_error"); setError(t("webServer")); }
    } finally {
      if (mine === maxPoll.current) {
        startingMessenger.current = false;
        setWaitingFor(null);
      }
    }
  }

  useEffect(() => {
    let pending: { kind?: unknown; token?: unknown; expiresAt?: unknown; url?: unknown; vpn?: unknown; registration?: {attempt?: unknown; source?: unknown} } | null = null;
    try {
      const raw = sessionStorage.getItem("between:messenger-login");
      pending = raw ? (JSON.parse(raw) as { kind?: unknown; token?: unknown }) : null;
    } catch {
      pending = null;
    }
    if (!pending || (pending.kind !== "max" && pending.kind !== "telegram") || typeof pending.token !== "string") return;
    const kind = pending.kind;
    const context = pending.registration;
    if (typeof context?.attempt === "string" && (context.source === "survey" || context.source === "direct")) {
      registration.current = {attempt: context.attempt, source: context.source};
    }
    const mine = ++maxPoll.current;
    // A reload continues the login this tab already started.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote(t(kind === "max" ? "webMaxLoginWait" : "webTgLoginWait"));
    setWaitingFor(kind);
    if (typeof pending.url === "string" && /^https:\/\//i.test(pending.url)) setMessengerUrl(pending.url);
    setTelegramVpn(kind === "telegram" && pending.vpn === true);
    void pollMessenger(kind, pending.token, mine, typeof pending.expiresAt === "number" ? pending.expiresAt : Date.now() + 10 * 60_000);
    return () => {
      maxPoll.current += 1;
    };
    // pollMessenger closes over the latest poll and already ignores a stale run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSignedIn, t]);

  function openMode(next: GateMode) {
    setMode(next);
    setError(null);
    setErrorScope("other");
    setNote(null);
    setCode("");
  }

  function chooseAnotherMethod() {
    maxPoll.current += 1;
    startingMessenger.current = false;
    forgetLogin();
    setWaitingFor(null);
    setMessengerUrl(null);
    setTelegramVpn(false);
    setNote(null);
    setError(null);
  }

  async function register(event: { preventDefault: () => void }) {
    event.preventDefault();
    record("email_submitted", "email");
    if (!passwordReady()) return;
    setBusy(true);
    setErrorScope("register");
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        record("error", "email", "register", registrationReason(data.error, res.status));
        setError(formError(data.error));
        return;
      }
      record("code_requested", "email");
      setMode("code");
      setNote(t("webCodeSent", { email }));
    } catch {
      record("error", "email", "register", "network_error");
      setError(t("webServer"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    record("code_submitted", "email");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json().catch(() => ({}))) as { account?: WebAccount; error?: string };
      if (!res.ok || !data.account) {
        record("error", "email", "verify_code", registrationReason(data.error, res.status));
        setError(formError(data.error));
        return;
      }
      record("email_registered", "email");
      onSignedIn(data.account);
    } catch {
      record("error", "email", "verify_code", "network_error");
      setError(t("webServer"));
    } finally {
      setBusy(false);
    }
  }

  async function passwordLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorScope("login");
    setError(null);
    try {
      const res = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { account?: WebAccount; error?: string };
      if (!res.ok || !data.account) {
        record("error", "password", "password_login", registrationReason(data.error, res.status));
        setError(formError(data.error));
        return;
      }
      record("signed_in", "password");
      onSignedIn(data.account);
    } catch {
      record("error", "password", "password_login", "network_error");
      setError(t("webServer"));
    } finally {
      setBusy(false);
    }
  }

  async function forgot(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/account/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        record("error", "email", "forgot_password", registrationReason(data.error, res.status));
        setError(formError(data.error));
        return;
      }
      setNote(t("webForgotSent", { email }));
    } catch {
      record("error", "email", "forgot_password", "network_error");
      setError(t("webServer"));
    } finally {
      setBusy(false);
    }
  }

  function jumpToForm() {
    openMode("login");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }

  const title = mode === "forgot" ? t("webForgot") : mode === "code" ? t("webCode") : t("webFormEnter");
  const lead = mode === "forgot" ? t("webForgotLead") : mode === "login" ? t("webFormEnterLead") : null;

  return (
    <div className={compact ? undefined : "journal-scroll"}>
      <div className={compact ? "journal-gate w-full min-w-0" : "journal-gate px-4 pt-3 pb-10 sm:px-5"}>
      {!compact && <section className="journal-gate-pitch">
        <p className="eyebrow text-[color:var(--accent-text)]">{t("webKicker")}</p>
        <h1 className="mt-3 font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          {t("webHeadline")}{" "}
          <span className="brand-words block">{t("webHeadlineAccent")}</span>
        </h1>
        <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-muted-foreground">{t("webLead")}</p>
        <ul className="mt-5 grid gap-2.5">
          {(["webWhy1", "webWhy2", "webWhy3"] as const).map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-foreground">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-[color:var(--accent-text)]" />
              {t(key)}
            </li>
          ))}
        </ul>
        <Button type="button" size="lg" className="journal-gate-jump mt-6 w-full" onClick={jumpToForm}>
          {t("webCreate")}
        </Button>
        <JournalPreview />
      </section>}

      <section ref={formRef} className="journal-gate-form glass mt-6 scroll-mt-4 rounded-[22px] px-5 py-6 sm:px-6">
        {waitingFor ? (
          <div className="grid gap-4">
            <h2 className="font-display text-2xl leading-tight">{t(waitingFor === "max" ? "webMaxLogin" : "webTgLogin")}</h2>
            <p role="status" className="leading-relaxed">{t(waitingFor === "max" ? "webMaxLoginWait" : "webTgLoginWait")}</p>
            {telegramVpn && <p className="text-sm text-muted-foreground">{t("webBotVpn")}</p>}
            {messengerUrl ? (
              <a href={messengerUrl} target="_blank" rel="noreferrer" className={`auth-provider auth-${waitingFor} flex min-h-12 items-center justify-center rounded-full px-5 font-semibold`}>
                {t("webOpenTab", { messenger: waitingFor === "max" ? "MAX" : "Telegram" })}
              </a>
            ) : <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" />}
            <Button type="button" variant="outline" onClick={chooseAnotherMethod}>{t("webChooseMethod")}</Button>
          </div>
        ) : <>
        <h2 className="font-display text-2xl leading-tight tracking-tight text-foreground">{compact && mode === "login" && creating ? t("webCreate") : title}</h2>
        {surveyAttempt && mode === "login" && (
          <div className="mt-4 space-y-2 border-s-2 border-primary/60 ps-4 text-base leading-relaxed text-foreground">
            <p>{locale === "en"
              ? "Create a journal to save your reflections."
              : "Чтобы сохранить свои размышления, создайте дневник."}</p>
            <p>{locale === "en"
              ? "After you sign in, we’ll automatically save what you wrote."
              : "После входа всё, что вы написали, сохранится автоматически."}</p>
          </div>
        )}
        {compact && !surveyAttempt && mode === "login" && <div className="mt-4 flex gap-2" role="group">
          <Button type="button" size="sm" variant={creating ? "secondary" : "ghost"} aria-pressed={creating} onClick={() => { setCreating(true); setError(null); }}>{t("webCreate")}</Button>
          <Button type="button" size="sm" variant={!creating ? "secondary" : "ghost"} aria-pressed={!creating} onClick={() => { setCreating(false); setError(null); }}>{t("webEnter")}</Button>
        </div>}
        {lead && mode !== "login" ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{lead}</p> : null}

        {mode === "login" ? (
          <>
            <div className="mt-5">
              {!creating && <p className="mb-2 text-[0.6875rem] font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
                {t("webOAuth")}
              </p>}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="lg" className="auth-provider auth-telegram w-full"
                  disabled={busy}
                  onClick={() => void loginWithMessenger("telegram")}>
                  {t("webTgLogin")}
                </Button>
                <Button type="button" variant="outline" size="lg" className="auth-provider auth-max w-full"
                  disabled={busy}
                  onClick={() => void loginWithMessenger("max")}>
                  {t("webMaxLogin")}
                </Button>
              </div>
              {error && errorScope === "messenger" && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
            </div>
            <p className="my-4 text-center text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">
              {t("webOr")}
            </p>
          </>
        ) : null}

        {mode === "login" && (!compact || !creating) ? (
          <form className="space-y-4" onSubmit={passwordLogin}>
            <div className="space-y-2">
              <Label htmlFor="web-email">{t("webEmail")}</Label>
              <Input
                id="web-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <PasswordField
              id="web-password"
              label={t("webPassword")}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && errorScope === "login" ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {t("webEnter")}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => openMode("forgot")}
            >
              {t("webForgot")}
            </button>
          </form>
        ) : null}

        {mode === "login" && (!compact || creating) ? (
          <details open={compact || undefined} className={compact ? undefined : "mt-5 border-t border-[color:var(--glass-border)] pt-4"}>
            <summary hidden={compact} className="cursor-pointer text-sm text-muted-foreground">{t("webRegisterFold")}</summary>
            <form className="mt-4 space-y-4" onInput={() => record("email_started", "email")} onSubmit={register}>
              <div className="space-y-2">
                <Label htmlFor="web-register-email">{t("webEmail")}</Label>
                <Input
                  id="web-register-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <PasswordField
                id="web-register-password"
                label={t("webPassword")}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                showRules
                reveal
              />
              <PasswordField
                id="web-register-password-again"
                label={t("webPasswordAgain")}
                value={passwordAgain}
                onChange={setPasswordAgain}
                autoComplete="new-password"
                reveal
              />
              {passwordAgain.length > 0 && passwordAgain !== password ? (
                <p className="text-sm text-destructive" role="status">
                  {t("webPasswordMismatch")}
                </p>
              ) : null}
              {error && errorScope === "register" ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {t("webCreate")}
              </Button>
              <LegalAgree className="legal-agreement text-[0.8125rem] leading-normal text-muted-foreground" />
            </form>
          </details>
        ) : null}

        {mode === "forgot" ? (
          <form className="mt-5 space-y-4" onSubmit={forgot}>
            <div className="space-y-2">
              <Label htmlFor="web-email">{t("webEmail")}</Label>
              <Input
                id="web-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            {note ? <p className="text-sm leading-relaxed text-foreground">{note}</p> : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {t("webSendLink")}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => openMode("login")}
            >
              {t("webBackToEnter")}
            </button>
          </form>
        ) : null}

        {mode === "code" ? (
          <form className="mt-5 space-y-4" onSubmit={verifyCode}>
            {note ? <p className="text-sm leading-relaxed text-foreground">{note}</p> : null}
            <p className="text-sm leading-relaxed text-muted-foreground">{t("webCodeCopy")}</p>
            <div className="space-y-2">
              <Label htmlFor="web-code">{t("webCode")}</Label>
              <Input
                ref={codeRef}
                id="web-code"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={12}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center font-mono text-2xl tracking-[0.28em] md:text-2xl"
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" size="lg" disabled={busy || code.length !== 6}>
              {t("webOpenJournal")}
            </Button>
            <button type="button" className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={register}>
              {t("webResendCode")}
            </button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => openMode("login")}
            >
              {t("webOtherEmail")}
            </button>
          </form>
        ) : null}
        </>}
      </section>
      </div>
    </div>
  );
}
