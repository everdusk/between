"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { LocaleProvider, useI18n } from "@/components/locale-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import "@/app/journal/theme.css";
import { journalAuthHeaders } from "@/lib/journal-api";
import { LEGAL_SURFACE_CSS } from "@/lib/landing";
import { markSplashReady } from "@/lib/splash";
import { clearStore, WEB_STORAGE_KEY } from "@/lib/storage";

export function DeleteJournal({
  initData = "",
  maxInitData = "",
  onErased,
}: {
  initData?: string;
  maxInitData?: string;
  onErased?: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<"ask" | "final" | "done">("ask");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function erase() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: journalAuthHeaders(initData, maxInitData, true),
        body: JSON.stringify({ confirm: "erase" }),
      });
      if (!res.ok) {
        setError(t("deleteFail"));
        return;
      }
      clearStore();
      clearStore(WEB_STORAGE_KEY);
      setStep("done");
      onErased?.();
    } catch {
      setError(t("deleteFail"));
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return <p className="text-sm leading-relaxed text-foreground">{t("deleteDone")}</p>;
  }

  return (
    <div className="space-y-3">
      {step === "ask" ? (
        <Button type="button" variant="destructive" className="w-full" onClick={() => setStep("final")}>
          {t("deleteAsk")}
        </Button>
      ) : (
        <Button type="button" variant="destructive" className="w-full" disabled={busy} onClick={() => void erase()}>
          {t("deleteFinal")}
        </Button>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DeletePage() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<"loading" | "out" | "in" | "gone" | "down">("loading");

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-between", "app");
    root.setAttribute("data-journal", "web");
    root.setAttribute("data-scheme", "night");
    root.removeAttribute("data-splash");
    const surface = document.getElementById("between-surface");
    if (surface) surface.textContent = LEGAL_SURFACE_CSS;
    markSplashReady();
    let cancelled = false;
    void fetch("/api/account", { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setPhase("down");
          return;
        }
        const data = (await res.json()) as { account?: unknown };
        setPhase(data.account ? "in" : "out");
      })
      .catch(() => {
        if (!cancelled) setPhase("down");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <article className="fixed inset-0 z-20 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-lg flex-col px-5 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-lg text-foreground">
            Between
          </Link>
          <LanguageSwitch />
        </header>
        <section className="glass mt-8 rounded-[22px] px-5 py-6 sm:px-6">
          <h1 className="font-display text-2xl leading-tight tracking-tight">{t("deleteTitle")}</h1>
          {phase === "loading" ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("loading")}</p>
          ) : phase === "down" ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {t("webServer")}
            </p>
          ) : phase === "out" ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("deleteSignedOut")}</p>
              <p className="mt-5 text-center text-sm">
                <Link href="/journal" className="text-muted-foreground underline-offset-4 hover:underline">
                  {t("webBackToEnter")}
                </Link>
              </p>
            </>
          ) : phase === "gone" ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{t("deleteDone")}</p>
              <p className="mt-5 text-center text-sm">
                <Link href="/" className={buttonVariants({ variant: "link" })}>
                  {t("deleteHome")}
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("deleteLead")}</p>
              <div className="mt-5">
                <DeleteJournal onErased={() => setPhase("gone")} />
              </div>
            </>
          )}
        </section>
      </div>
    </article>
  );
}

export function DeleteData() {
  return (
    <LocaleProvider telegramLanguage={null} initData="">
      <DeletePage />
    </LocaleProvider>
  );
}
