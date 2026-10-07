"use client";

import { useState } from "react";
import { JournalPanel } from "@/components/journal-panel";
import { SessionsPanel } from "@/components/sessions-panel";
import { WeeklyPanel } from "@/components/weekly-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTelegram } from "@/hooks/use-telegram";
import { useTherapyStore } from "@/hooks/use-therapy-store";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "journal", label: "Дневник" },
  { id: "week", label: "Неделя" },
  { id: "sessions", label: "Сеансы" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function TherapyApp() {
  const telegram = useTelegram();
  const {
    store,
    status,
    error,
    resetCorrupted,
    upsertEntry,
    deleteEntry,
    saveWeekPrep,
    upsertSession,
    deleteSession,
  } = useTherapyStore();

  const [section, setSection] = useState<SectionId>("journal");
  const disabled = status !== "ready";

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col"
      style={
        telegram.viewportStableHeight
          ? { minHeight: telegram.viewportStableHeight }
          : undefined
      }
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <header className="relative z-10 border-b border-border/40 bg-background/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="font-display text-xl tracking-tight text-foreground">
              Between
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {telegram.ready
                ? telegram.inTelegram
                  ? `Привет, ${telegram.displayName}`
                  : telegram.isLocalHost
                    ? `Привет, ${telegram.displayName} · режим разработки`
                    : `Привет, ${telegram.displayName}`
                : "Загрузка…"}
            </p>
          </div>
          {!telegram.inTelegram && telegram.ready && telegram.isLocalHost && (
            <span className="shrink-0 rounded-md border border-border/70 bg-background/70 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              localhost
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-lg flex-1 px-4 py-4 sm:px-5 sm:py-6">
        {status === "loading" && (
          <div
            className="rounded-2xl border border-border/60 bg-background/55 px-5 py-10 text-center backdrop-blur-sm"
            role="status"
          >
            <div className="mx-auto mb-3 h-1.5 w-24 overflow-hidden rounded-full bg-primary/15">
              <div className="loading-bar h-full w-1/2 rounded-full bg-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground">
              Загружаем ваши записи…
            </p>
          </div>
        )}

        {status === "error" && (
          <div
            className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-6"
            role="alert"
          >
            <p className="font-medium text-foreground">
              Не удалось работать с данными
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={resetCorrupted}
            >
              Начать заново на этом устройстве
            </Button>
          </div>
        )}

        {status === "ready" && (
          <Tabs
            value={section}
            onValueChange={(v) => setSection(v as SectionId)}
            className="gap-4"
          >
            <TabsList className="h-auto w-full justify-stretch gap-1 bg-background/55 p-1.5 backdrop-blur-sm">
              {SECTIONS.map((s) => (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className="flex-1 px-3 py-2 data-active:shadow-none"
                >
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div
              className={cn(
                "rounded-2xl border border-border/50 bg-background/65 p-4 shadow-[0_24px_60px_-40px_oklch(0.35_0.04_175_/_0.45)] backdrop-blur-md sm:p-6",
                "animate-in fade-in slide-in-from-bottom-1 duration-400",
              )}
            >
              <TabsContent value="journal" className="mt-0 outline-none">
                <JournalPanel
                  entries={store.entries}
                  onSave={upsertEntry}
                  onDelete={deleteEntry}
                  disabled={disabled}
                />
              </TabsContent>
              <TabsContent value="week" className="mt-0 outline-none">
                <WeeklyPanel
                  entries={store.entries}
                  weekPreps={store.weekPreps}
                  onSavePrep={saveWeekPrep}
                  disabled={disabled}
                />
              </TabsContent>
              <TabsContent value="sessions" className="mt-0 outline-none">
                <SessionsPanel
                  sessions={store.sessions}
                  onSave={upsertSession}
                  onDelete={deleteSession}
                  disabled={disabled}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </main>

      <footer className="relative z-10 px-4 py-4 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
        Between · данные только на этом устройстве
        {!telegram.inTelegram && telegram.ready
          ? " · вне Telegram — локальный режим"
          : null}
      </footer>
    </div>
  );
}
