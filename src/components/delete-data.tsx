"use client";

import { useLayoutEffect, useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { LocaleProvider, useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import "@/app/journal/theme.css";
import { LEGAL_SURFACE_CSS } from "@/lib/landing";
import { markSplashReady } from "@/lib/splash";
import { clearStore, WEB_STORAGE_KEY } from "@/lib/storage";
import { STORAGE_KEY } from "@/lib/types";

type Phase = "loading" | "signed-out" | "ready" | "confirm" | "done" | "error";

function telegramInitData(): string {
  try {
    const tg = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram;
    return tg?.WebApp?.initData || "";
  } catch {
    return "";
  }
}

function clearLocalJournal() {
  clearStore(WEB_STORAGE_KEY);
  clearStore(STORAGE_KEY);
  try {
    localStorage.removeItem("between:week-access");
  } catch {
    /* private mode */
  }
}

function DeleteScreen() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("loading");

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-between", "app");
    root.setAttribute("data-journal", "web");
    root.setAttribute("data-scheme", "night");
    root.removeAttribute("data-splash");
    const surface = document.getElementById("between-surface");
    if (surface) surface.textContent = LEGAL_SURFACE_CSS;
    markSplashReady();
    const initData = telegramInitData();
    if (initData) {
      setPhase("ready");
      return;
    }
    void fetch("/api/account", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          setPhase("signed-out");
          return;
        }
        const data = (await res.json()) as { account?: unknown };
        setPhase(data.account ? "ready" : "signed-out");
      })
      .catch(() => setPhase("signed-out"));
  }, []);

  async function erase() {
    const initData = telegramInitData();
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: initData ? { "X-Telegram-Init-Data": initData } : undefined,
    });
    if (res.status === 401) {
      setPhase("signed-out");
      return;
    }
    if (!res.ok) {
      setPhase("error");
      return;
    }
    clearLocalJournal();
    setPhase("done");
  }

  return (
    <article className="fixed inset-0 z-20 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-5 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="font-display text-lg text-foreground">
            Between
          </a>
          <LanguageSwitch />
        </header>
        <h1 className="mt-8 font-display text-3xl leading-tight tracking-tight">{t("deleteTitle")}</h1>
        {phase === "loading" ? <p className="mt-4 text-sm text-muted-foreground">{t("loading")}</p> : null}
        {phase === "signed-out" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-foreground/90">{t("deleteSignIn")}</p>
            <a
              href="/journal"
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              {t("deleteEnter")}
            </a>
          </div>
        ) : null}
        {phase === "ready" || phase === "confirm" || phase === "error" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-foreground/90">{t("deleteLead")}</p>
            {phase === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                {t("deleteFail")}
              </p>
            ) : null}
            {phase === "confirm" ? (
              <Button type="button" variant="destructive" onClick={() => void erase()}>
                {t("deleteYes")}
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setPhase("confirm")}>
                {t("deleteGo")}
              </Button>
            )}
          </div>
        ) : null}
        {phase === "done" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-foreground/90">{t("deleteDone")}</p>
            <a href="/" className="text-sm underline underline-offset-4">
              {t("deleteHome")}
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function DeleteData() {
  return (
    <LocaleProvider telegramLanguage={null} initData="">
      <DeleteScreen />
    </LocaleProvider>
  );
}
