"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bot, Check, Lock } from "lucide-react";
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

export function WebAccountGate({ onSignedIn }: { onSignedIn: (account: WebAccount) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<GateMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messengerUrl, setMessengerUrl] = useState<string | null>(null);
  const [telegramVpn, setTelegramVpn] = useState(false);
  const [errorScope, setErrorScope] = useState<"login" | "register" | "other">("other");
  const formRef = useRef<HTMLElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const maxTried = useRef(false);
  const maxPoll = useRef(0);

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
        const data = (await res.json().catch(() => ({}))) as { account?: WebAccount };
        if (!stopped && res.ok && data.account) onSignedIn(data.account);
      } catch {
        // The form stays. MAX did not confirm this launch.
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
  }, [onSignedIn]);

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
      setError(t("webPasswordMismatch"));
      return false;
    }
    if (password.length < 8 || password.length > 200) {
      setError(t("webPasswordShort"));
      return false;
    }
    return true;
  }

  function rememberLogin(kind: "max" | "telegram", token: string) {
    try {
      sessionStorage.setItem("between:messenger-login", JSON.stringify({ kind, token }));
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

  async function pollMessenger(kind: "max" | "telegram", token: string, mine: number) {
    const waitUrl = kind === "max" ? "/api/account/max/wait" : "/api/account/telegram/wait";
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (mine !== maxPoll.current) return;
      try {
        const wait = await fetch(waitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = (await wait.json().catch(() => ({}))) as { pending?: boolean; account?: WebAccount };
        if (mine !== maxPoll.current) return;
        if (wait.status === 403) {
          forgetLogin();
          setNote(null);
          setError(t(kind === "max" ? "webMaxLoginFail" : "webTgLoginFail"));
          return;
        }
        if (wait.ok && body.account && !body.pending) {
          forgetLogin();
          onSignedIn(body.account);
          return;
        }
      } catch {
        // The next attempt asks again.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    if (mine !== maxPoll.current) return;
    forgetLogin();
    setNote(null);
    setError(t(kind === "max" ? "webMaxLoginFail" : "webTgLoginFail"));
  }

  async function loginWithMessenger(kind: "max" | "telegram") {
    const popup = window.open("about:blank", "_blank");
    const mine = ++maxPoll.current;
    setError(null);
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
        popup?.close();
        setError(data.error === "max_off" ? t("webMaxOff") : t("webServer"));
        return;
      }
      if (data.vpn) setTelegramVpn(true);
      if (popup && !popup.closed) popup.location.replace(data.url);
      else {
        popup?.close();
        setMessengerUrl(data.url);
      }
      rememberLogin(kind, data.token);
      setNote(t(kind === "max" ? "webMaxLoginWait" : "webTgLoginWait"));
      await pollMessenger(kind, data.token, mine);
    } catch {
      popup?.close();
      if (mine === maxPoll.current) setError(t("webServer"));
    }
  }

  useEffect(() => {
    let pending: { kind?: unknown; token?: unknown } | null = null;
    try {
      const raw = sessionStorage.getItem("between:messenger-login");
      pending = raw ? (JSON.parse(raw) as { kind?: unknown; token?: unknown }) : null;
    } catch {
      pending = null;
    }
    if (!pending || (pending.kind !== "max" && pending.kind !== "telegram") || typeof pending.token !== "string") return;
    const kind = pending.kind;
    const mine = ++maxPoll.current;
    // A reload continues the login this tab already started.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote(t(kind === "max" ? "webMaxLoginWait" : "webTgLoginWait"));
    void pollMessenger(kind, pending.token, mine);
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

  async function register(event: { preventDefault: () => void }) {
    event.preventDefault();
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
        setError(formError(data.error));
        return;
      }
      setMode("code");
      setNote(t("webCodeSent", { email }));
    } catch {
      setError(t("webServer"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
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
        setError(formError(data.error));
        return;
      }
      onSignedIn(data.account);
    } catch {
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
        setError(formError(data.error));
        return;
      }
      onSignedIn(data.account);
    } catch {
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
        setError(formError(data.error));
        return;
      }
      setNote(t("webForgotSent", { email }));
    } catch {
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
    <main className="journal-scroll">
      <div className="journal-gate pt-3 pr-[max(1rem,var(--safe-right))] pb-10 pl-[max(1rem,var(--safe-left))] sm:pr-[max(1.25rem,var(--safe-right))] sm:pl-[max(1.25rem,var(--safe-left))]">
      <section className="journal-gate-pitch">
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
      </section>

      <section ref={formRef} className="journal-gate-form glass mt-6 scroll-mt-4 rounded-[22px] px-5 py-6 sm:px-6">
        <h2 className="font-display text-2xl leading-tight tracking-tight text-foreground">{title}</h2>
        {lead ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{lead}</p> : null}

        {mode === "login" ? (
          <>
            <div className="mt-5">
              <p className="mb-2 text-[0.6875rem] font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
                {t("webOAuth")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={() => void loginWithMessenger("telegram")}
              >
                {t("webTgLogin")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-2 w-full"
                disabled={busy}
                onClick={() => void loginWithMessenger("max")}
              >
                {t("webMaxLogin")}
              </Button>
              {telegramVpn ? (
                <p className="text-sm leading-relaxed text-muted-foreground" role="status">
                  {t("webBotVpn")}
                </p>
              ) : null}
              {note ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{note}</p> : null}
              {messengerUrl ? (
                <a
                  href={messengerUrl}
                  className="mt-2 block text-center text-sm text-foreground underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("webOpenTab")}
                </a>
              ) : null}
            </div>
            <p className="my-4 text-center text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">
              {t("webOr")}
            </p>
          </>
        ) : null}

        {mode === "login" ? (
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

        {mode === "login" ? (
          <details className="mt-5 border-t border-[color:var(--glass-border)] pt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground">{t("webRegisterFold")}</summary>
            <form className="mt-4 space-y-4" onSubmit={register}>
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
        <LegalAgree className="mt-5 text-center text-xs leading-relaxed text-muted-foreground" />
      </section>
      </div>
    </main>
  );
}
