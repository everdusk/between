"use client";

import { useEffect, useState, type FormEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/locale-provider";
import type { WebAccount } from "@/hooks/use-web-account";
import { cn } from "cn";

const PROVIDERS = [
  { id: "vk", href: "/api/account/oauth/vk", label: "webVk" },
  { id: "yandex", href: "/api/account/oauth/yandex", label: "webYandex" },
  { id: "sber", href: "/api/account/oauth/sber", label: "webSber" },
] as const;

export function WebAccountGate({ onSignedIn }: { onSignedIn: (account: WebAccount) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"create" | "enter">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-3 pr-[max(1rem,var(--safe-right))] pb-8 pl-[max(1rem,var(--safe-left))] sm:pr-[max(1.25rem,var(--safe-right))] sm:pl-[max(1.25rem,var(--safe-left))]">
      <section className="glass rounded-[22px] px-5 py-6 sm:px-6">
        <p className="eyebrow text-[#8FF0BC]">Between</p>
        <h1 className="mt-3 font-display text-[2rem] leading-[1.05] text-foreground">
          <span className="brand-words">{t("webMark")}</span>
        </h1>
        <p className="mt-3 text-[0.9375rem] font-medium leading-relaxed text-muted-foreground">{t("webNote")}</p>
      </section>

      <div className="mt-4">
        <p className="mb-2 text-center text-[0.6875rem] font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
          {t("webOAuth")}
        </p>
        <div className="grid gap-2">
          {PROVIDERS.map((provider) => (
            <a
              key={provider.id}
              href={provider.href}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
            >
              {t(provider.label)}
            </a>
          ))}
        </div>
      </div>

      <p className="my-4 text-center text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{t("webOr")}</p>

      <form className="glass space-y-4 rounded-[22px] px-5 py-6 sm:px-6" onSubmit={submit}>
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
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
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
