"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { LOCALES } from "@/lib/i18n";
import { formatLongDate, formatTime } from "@/lib/dates";
import type { JournalEntry } from "@/lib/types";

const BOT_URL = "https://t.me/BetweenJournalBot";

type TelegramWidgetUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

type NotesState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "unavailable" }
  | { kind: "notes"; name: string; entries: JournalEntry[] };

declare global {
  interface Window {
    onBetweenTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

function botUsername(): string {
  const raw = process.env.NEXT_PUBLIC_BOT_USERNAME?.trim();
  if (raw && /^[A-Za-z0-9_]{5,32}$/.test(raw)) return raw;
  return "BetweenJournalBot";
}

function groupByDate(entries: JournalEntry[]): { date: string; entries: JournalEntry[] }[] {
  const groups: { date: string; entries: JournalEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (!last || last.date !== entry.date) groups.push({ date: entry.date, entries: [entry] });
    else last.entries.push(entry);
  }
  return groups;
}

function TelegramLogin({ onUser }: { onUser: (user: TelegramWidgetUser) => void }) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.onBetweenTelegramAuth = (user) => onUser(user);
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername());
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", "onBetweenTelegramAuth(user)");
    holder.current?.appendChild(script);
    return () => {
      delete window.onBetweenTelegramAuth;
      script.remove();
    };
  }, [onUser]);

  return <div ref={holder} className="min-h-10" />;
}

export function WebJournal() {
  const { t, locale, setLocale, feeling: feelingLabel, slot } = useI18n();
  const [status, setStatus] = useState<NotesState>({ kind: "loading" });
  const [loginError, setLoginError] = useState(false);

  const loadNotes = useCallback(async () => {
    const res = await fetch("/api/web/journal");
    if (res.status === 401) {
      setStatus({ kind: "guest" });
      return;
    }
    if (!res.ok) {
      setStatus({ kind: "unavailable" });
      return;
    }
    const data = (await res.json()) as { name?: string; entries?: JournalEntry[] };
    setStatus({
      kind: "notes",
      name: data.name ?? "",
      entries: Array.isArray(data.entries) ? data.entries : [],
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function open() {
      const params = new URLSearchParams(window.location.search);
      const login = params.get("login");
      if (login) {
        const url = new URL(window.location.href);
        url.searchParams.delete("login");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        const res = await fetch("/api/web/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login }),
        });
        if (cancelled) return;
        if (!res.ok) setLoginError(true);
      }
      if (!cancelled) await loadNotes();
    }
    void open();
    return () => {
      cancelled = true;
    };
  }, [loadNotes]);

  const onWidgetUser = useCallback(async (user: TelegramWidgetUser) => {
    setLoginError(false);
    const res = await fetch("/api/web/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widget: user }),
    });
    if (!res.ok) {
      setLoginError(true);
      setStatus({ kind: "guest" });
      return;
    }
    await loadNotes();
  }, [loadNotes]);

  async function logout() {
    await fetch("/api/web/session", { method: "DELETE" });
    setLoginError(false);
    setStatus({ kind: "guest" });
  }

  const groups = status.kind === "notes" ? groupByDate(status.entries) : [];

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <header className="relative z-10 border-b border-border/40 bg-background/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p className="font-display text-xl tracking-tight text-foreground">Between</p>
          <label className="sr-only" htmlFor="app-language">
            {t("language")}
          </label>
          <select
            id="app-language"
            aria-label={t("language")}
            value={locale}
            onChange={(event) => {
              const next = LOCALES.find((item) => item.id === event.target.value);
              if (next) setLocale(next.id);
            }}
            className="max-w-36 rounded-md border border-border/70 bg-background/70 px-2 py-1 text-xs text-foreground"
          >
            {LOCALES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-lg flex-1 space-y-6 px-4 py-6 sm:px-5">
        <section className="space-y-4 rounded-2xl border border-border/60 bg-background/55 px-5 py-5 backdrop-blur-sm">
          <div className="space-y-2">
            <h1 className="font-display text-2xl tracking-tight text-foreground">
              {t("webReadTitle")}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("webLead")}</p>
          </div>
          <a
            href={BOT_URL}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t("webWrite")}
          </a>
        </section>

        {status.kind === "loading" && (
          <p className="text-sm text-muted-foreground" role="status">
            {t("loadingEntries")}
          </p>
        )}

        {status.kind === "unavailable" && (
          <p className="rounded-lg border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
            {t("webUnavailable")}
          </p>
        )}

        {status.kind === "guest" && (
          <section className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("webLoginHint")}</p>
            {loginError && (
              <p className="text-sm text-destructive" role="alert">
                {t("webLoginFail")}
              </p>
            )}
            <TelegramLogin onUser={onWidgetUser} />
          </section>
        )}

        {status.kind === "notes" && (
          <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0 space-y-1">
                {status.name && (
                  <p className="truncate text-sm text-foreground">
                    {t("hello", { name: status.name })}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{t("webReadLead")}</p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                {t("webLogout")}
              </button>
            </div>

            {groups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                {t("webEmpty")}
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.date} className="space-y-3">
                  <h2 className="font-display text-lg text-foreground">
                    {formatLongDate(group.date, locale)}
                  </h2>
                  <ul className="space-y-3">
                    {group.entries.map((entry) => (
                      <li
                        key={entry.id}
                        className="space-y-2 rounded-xl border border-border/60 bg-background/50 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatTime(entry.createdAt, locale)}</span>
                          {entry.slot && <span>{slot(entry.slot)}</span>}
                          {entry.source === "bot" && <span>{t("fromBot")}</span>}
                          {entry.source === "checkin" && <span>{t("checkinMark")}</span>}
                        </div>
                        {entry.feelings.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.feelings.map((feeling) => (
                              <Badge key={feeling} variant="secondary" className="font-normal">
                                {feelingLabel(feeling)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {entry.body.trim() && (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                            {entry.body}
                          </p>
                        )}
                        {entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="font-normal">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}
