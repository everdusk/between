"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bot, Check, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LegalAgree } from "@/components/legal-links";
import { useI18n } from "@/components/locale-provider";
import type { WebAccount } from "@/hooks/use-web-account";
import { formatDayLabel, formatTime, toDateKey } from "@/lib/dates";
import { feelingFill } from "@/lib/spectrum";
import type { Feeling } from "@/lib/types";
import { cn } from "cn";

const PROVIDERS = [
  { id: "vk", href: "/api/account/oauth/vk", label: "webVk" },
  { id: "yandex", href: "/api/account/oauth/yandex", label: "webYandex" },
  { id: "sber", href: "/api/account/oauth/sber", label: "webSber" },
] as const;

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

type GateMode = "register" | "login" | "forgot" | "code";

export function WebAccountGate({ onSignedIn }: { onSignedIn: (account: WebAccount) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<GateMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("oauth");
    if (code === "off") setError(t("webOAuthOff"));
    else if (code === "taken") setError(t("webOAuthTaken"));
    else if (code === "bad") setError(t("webOAuthBad"));
    if (code) {
      const url = new URL(window.location.href);
      url.searchParams.delete("oauth");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }, [t]);

  useEffect(() => {
    if (mode === "code") codeRef.current?.focus();
  }, [mode]);

  function formError(value: string | undefined): string {
    if (value === "bad_email") return t("webBadEmail");
    if (value === "mail_off") return t("webMailOff");
    if (value === "soon") return t("webMailSoon");
    if (value === "mail_fail") return t("webMailFail");
    if (value === "server_not_configured") return t("webServer");
    if (value === "taken") return t("webEmailTaken");
    if (value === "short_password") return t("webPasswordShort");
    if (value === "bad_login") return t("webBadLogin");
    return t("webCodeBad");
  }

  function passwordReady(): boolean {
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

  function openMode(next: GateMode) {
    setMode(next);
    setError(null);
    setNote(null);
    setCode("");
  }

  async function register(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!passwordReady()) return;
    setBusy(true);
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
    openMode("register");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }

  const title =
    mode === "login" ? t("webFormEnter") : mode === "forgot" ? t("webForgot") : mode === "code" ? t("webCode") : t("webFormCreate");
  const lead =
    mode === "login" ? t("webFormEnterLead") : mode === "forgot" ? t("webForgotLead") : mode === "code" ? null : t("webFormLead");

  return (
    <main className="journal-gate min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-3 pr-[max(1rem,var(--safe-right))] pb-10 pl-[max(1rem,var(--safe-left))] sm:pr-[max(1.25rem,var(--safe-right))] sm:pl-[max(1.25rem,var(--safe-left))]">
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

        {mode === "register" || mode === "login" ? (
          <>
            <div className="mt-5">
              <p className="mb-2 text-[0.6875rem] font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
                {t("webOAuth")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PROVIDERS.map((provider) => (
                  <a
                    key={provider.id}
                    href={provider.href}
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full px-2")}
                  >
                    {t(provider.label)}
                  </a>
                ))}
              </div>
            </div>
            <p className="my-4 text-center text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">
              {t("webOr")}
            </p>
          </>
        ) : null}

        {mode === "register" ? (
          <form className="space-y-4" onSubmit={register}>
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
            <div className="space-y-2">
              <Label htmlFor="web-password">{t("webPassword")}</Label>
              <Input
                id="web-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="web-password-again">{t("webPasswordAgain")}</Label>
              <Input
                id="web-password-again"
                type="password"
                autoComplete="new-password"
                value={passwordAgain}
                onChange={(event) => setPasswordAgain(event.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {t("webCreate")}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => openMode("login")}
            >
              {t("webSwitchEnter")}
            </button>
          </form>
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
            <div className="space-y-2">
              <Label htmlFor="web-password">{t("webPassword")}</Label>
              <Input
                id="web-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? (
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
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => openMode("register")}
            >
              {t("webSwitchCreate")}
            </button>
          </form>
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
              onClick={() => openMode("register")}
            >
              {t("webOtherEmail")}
            </button>
          </form>
        ) : null}
        <LegalAgree className="mt-5 text-center text-xs leading-relaxed text-muted-foreground" />
      </section>
    </main>
  );
}
