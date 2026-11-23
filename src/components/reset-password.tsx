"use client";

import { newPasswordProblem } from "@/lib/account-validation";

import { BrandLogo } from "./brand-logo";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LockKeyhole } from "lucide-react";
import { LanguageSwitch } from "@/components/language-switch";
import { LocaleProvider, useI18n } from "@/components/locale-provider";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import "@/app/journal/theme.css";
import { LEGAL_SURFACE_CSS } from "@/lib/landing";
import { markSplashReady } from "@/lib/splash";

function ResetForm() {
  const { t } = useI18n();
  const router = useRouter();
  const token = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("token")?.trim() ?? "",
    () => "",
  );
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-between", "app");
    root.setAttribute("data-journal", "web");
    root.setAttribute("data-scheme", "night");
    root.removeAttribute("data-splash");
    const surface = document.getElementById("between-surface");
    if (surface) surface.textContent = LEGAL_SURFACE_CSS;
    markSplashReady();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (password !== passwordAgain) {
      setError(t("webPasswordMismatch"));
      return;
    }
    if (newPasswordProblem(password)) {
      setError(t("webPasswordRule"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (data.error === "weak_password") setError(t("webPasswordRule"));
        else if (data.error === "short_password") setError(t("webPasswordShort"));
        else if (data.error === "server_not_configured") setError(t("webServer"));
        else setError(t("webResetBad"));
        return;
      }
      router.push("/journal");
    } catch {
      setError(t("webServer"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="fixed inset-0 z-20 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-lg flex-col px-5 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-4">
          {/* This standalone screen sets its own root theme; a full navigation restores the landing shell. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="font-display text-lg text-foreground">
            <BrandLogo />
          </a>
          <LanguageSwitch />
        </header>
        <section className="glass mt-8 rounded-[22px] px-5 py-6 sm:px-6">
          <h1 className="font-display text-2xl leading-tight tracking-tight">{t("webResetTitle")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("webResetLead")}</p>
          {!ready ? null : !token ? (
            <p className="mt-5 text-sm text-destructive" role="alert">
              {t("webResetMissing")}
            </p>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={save}>
              <PasswordField
                id="reset-password"
                inlineIcon={KeyRound}
                reveal
                label={t("webPassword")}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                showRules
              />
              <PasswordField
                id="reset-password-again"
                inlineIcon={LockKeyhole}
                reveal
                label={t("webPasswordAgain")}
                value={passwordAgain}
                onChange={setPasswordAgain}
                autoComplete="new-password"
              />
              {passwordAgain.length > 0 && passwordAgain !== password ? (
                <p className="text-sm text-destructive" role="status">
                  {t("webPasswordMismatch")}
                </p>
              ) : null}
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {t("webResetSave")}
              </Button>
            </form>
          )}
          <p className="mt-5 text-center text-sm">
            <a href="/journal" className="text-muted-foreground underline-offset-4 hover:underline">
              {t("webBackToEnter")}
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}

export function ResetPassword() {
  return (
    <LocaleProvider telegramLanguage={null} initData="">
      <ResetForm />
    </LocaleProvider>
  );
}
