"use client";

import { useEffect, useState } from "react";
import { JournalPanel } from "@/components/journal-panel";
import { SessionsPanel } from "@/components/sessions-panel";
import { WeeklyPanel } from "@/components/weekly-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTherapyStore } from "@/hooks/use-therapy-store";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "journal", label: "Дневник" },
  { id: "week", label: "Неделя" },
  { id: "sessions", label: "Сеансы" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function TherapyApp() {
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
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setHeroVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const disabled = status !== "ready";

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <header className="relative z-10 border-b border-border/40 bg-background/30 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <a
            href="#top"
            className="font-display text-lg tracking-tight text-foreground transition-opacity hover:opacity-80"
          >
            Between
          </a>
          <nav className="hidden gap-1 sm:flex" aria-label="Разделы">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSection(s.id);
                  document
                    .getElementById("workspace")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors duration-300",
                  section === s.id
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section
          id="top"
          className={cn(
            "mx-auto flex min-h-[min(92vh,52rem)] max-w-3xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-20",
            "transition-all duration-700 ease-out",
            heroVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-3 opacity-0",
          )}
        >
          <p className="font-display text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Between
          </p>
          <h1 className="mt-6 max-w-[18ch] text-xl font-medium leading-snug text-foreground/90 sm:text-2xl">
            Дневник к сеансу: ясность вместо хаоса в голове
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Каждый день — коротко о себе. Раз в неделю — картина для терапевта.
            После встречи — итоги и шаги дальше.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={() => {
                setSection("journal");
                document
                  .getElementById("workspace")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Открыть дневник
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setSection("week");
                document
                  .getElementById("workspace")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              К обзору недели
            </Button>
          </div>
        </section>

        <section
          id="workspace"
          className="mx-auto max-w-3xl px-4 pb-20 sm:px-6"
        >
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
              <Button className="mt-4" variant="secondary" onClick={resetCorrupted}>
                Начать заново на этом устройстве
              </Button>
            </div>
          )}

          {status === "ready" && (
            <Tabs
              value={section}
              onValueChange={(v) => setSection(v as SectionId)}
              className="gap-6"
            >
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-background/55 p-1.5 backdrop-blur-sm sm:w-auto">
                {SECTIONS.map((s) => (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    className="px-4 py-2 data-active:shadow-none"
                  >
                    {s.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div
                className={cn(
                  "rounded-2xl border border-border/50 bg-background/60 p-5 shadow-[0_24px_60px_-40px_oklch(0.35_0.04_175_/_0.45)] backdrop-blur-md sm:p-8",
                  "animate-in fade-in slide-in-from-bottom-2 duration-500",
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
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        Данные хранятся только в этом браузере · без аккаунта
      </footer>
    </div>
  );
}
