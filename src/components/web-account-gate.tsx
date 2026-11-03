"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/locale-provider";
import type { WebAccount } from "@/hooks/use-web-account";

export function WebAccountGate({ onSignedIn }: { onSignedIn: (account: WebAccount) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"create" | "enter">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "create" ? "/api/account/register" : "/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        account?: WebAccount;
        error?: string;
      };
      if (!res.ok || !data.account) {
        const code = data.error;
        setError(
          t(
            code === "taken"
              ? "webEmailTaken"
              : code === "bad_email"
                ? "webBadEmail"
                : code === "short_password"
                  ? "webPasswordShort"
                  : code === "server_not_configured"
                    ? "webServer"
                    : "webBadLogin",
          ),
        );
        return;
      }
      onSignedIn(data.account);
    } catch {
      setError(t("webServer"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] pt-3 pb-8 sm:pl-[max(1.25rem,var(--safe-left))] sm:pr-[max(1.25rem,var(--safe-right))]">
      <section className="ink rounded-3xl p-5 sm:p-6">
        <h1 className="font-display text-2xl tracking-tight text-ink-foreground">{t("webTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("webNote")}</p>
      </section>
      <form className="glass mt-4 space-y-4 rounded-3xl p-5 sm:p-6" onSubmit={submit}>
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
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "create" ? t("webCreate") : t("webEnter")}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "create" ? "enter" : "create");
            setError(null);
          }}
        >
          {mode === "create" ? t("webSwitchEnter") : t("webSwitchCreate")}
        </button>
      </form>
    </main>
  );
}
