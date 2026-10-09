"use client";

import { formatDayLabel, weekdayShort } from "@/lib/dates";
import {
  UNMARKED_FILL,
  buildWeekSpectrum,
  feelingFill,
  spectrumHeadline,
  type DaySlice,
} from "@/lib/spectrum";
import type { JournalEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WeekSpectrumProps {
  dayKeys: string[];
  entries: JournalEntry[];
  todayKey: string;
  selectedKey: string;
  onSelect: (dayKey: string) => void;
}

function spectrumTitle(spectrum: ReturnType<typeof buildWeekSpectrum>): string {
  if (spectrum.feelingTotal === 0) return "Пока тихо";
  if (spectrum.top.length === 1) return spectrum.top[0];
  if (spectrum.top.length === 2) return `${spectrum.top[0]} и ${spectrum.top[1]}`;
  return "Несколько состояний";
}

function sliceLabel(slice: DaySlice): string {
  return slice.feelings.length > 0 ? slice.feelings.join(", ") : "без отметки";
}

export function WeekSpectrum({
  dayKeys,
  entries,
  todayKey,
  selectedKey,
  onSelect,
}: WeekSpectrumProps) {
  const spectrum = buildWeekSpectrum(dayKeys, entries);
  const noteCount = spectrum.days.reduce((sum, day) => sum + day.slices.length, 0);
  const headline = spectrumHeadline(spectrum, noteCount);
  const title = spectrumTitle(spectrum);
  const selected = spectrum.days.find((day) => day.key === selectedKey) ?? spectrum.days[0];
  const lead = spectrum.top[0];

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-4 shadow-[0_18px_50px_-36px_oklch(0.35_0.04_175_/_0.55)] sm:p-5"
      aria-labelledby="week-spectrum-title"
    >
      {lead && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-10 size-48 rounded-full blur-3xl"
          style={{ background: feelingFill(lead), opacity: 0.28 }}
        />
      )}

      <div className="relative space-y-4">
        <div className="space-y-1">
          <p
            id="week-spectrum-title"
            className="text-[0.68rem] font-medium tracking-[0.16em] text-muted-foreground uppercase"
          >
            Спектр недели
          </p>
          <p className="font-display text-3xl tracking-tight text-foreground">{title}</p>
          {title !== headline && (
            <p className="text-sm text-muted-foreground">{headline}</p>
          )}
        </div>

        {spectrum.shares.length > 0 && (
          <div className="space-y-2.5">
            <div
              className="flex h-3 gap-1"
              role="img"
              aria-label={spectrum.shares
                .map((share) => `${share.feeling} ${share.count}`)
                .join(", ")}
            >
              {spectrum.shares.map((share) => (
                <div
                  key={share.feeling}
                  className="h-full min-w-2 rounded-full"
                  style={{
                    flexGrow: share.count,
                    flexBasis: 0,
                    background: feelingFill(share.feeling),
                  }}
                />
              ))}
            </div>
            {spectrum.shares.length > 1 && (
              <p className="text-[0.7rem] text-muted-foreground">Слева легче, справа тяжелее</p>
            )}
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
              {spectrum.shares.map((share) => (
                <li key={share.feeling} className="flex items-center gap-1.5 text-xs text-foreground">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: feelingFill(share.feeling) }}
                  />
                  <span>{share.feeling}</span>
                  <span className="text-muted-foreground">{share.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {spectrum.days.map((day) => {
            const selectedDay = day.key === selectedKey;
            const isToday = day.key === todayKey;
            const isFuture = day.key > todayKey;
            const names = day.slices.map(sliceLabel);
            const label = `${formatDayLabel(day.key)}${
              names.length > 0 ? `: ${names.join("; ")}` : ": записей нет"
            }`;
            return (
              <button
                key={day.key}
                type="button"
                aria-pressed={selectedDay}
                aria-label={label}
                onClick={() => onSelect(day.key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl p-1 transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selectedDay && "bg-background/80",
                  isFuture && day.slices.length === 0 && "opacity-45",
                )}
              >
                <span
                  className={cn(
                    "flex h-24 w-full flex-col gap-0.5 overflow-hidden rounded-2xl p-1 sm:h-28",
                    day.slices.length === 0
                      ? "border border-dashed border-border/80 bg-background/35"
                      : "bg-background/55",
                    selectedDay && "ring-2 ring-primary/45",
                    isToday && !selectedDay && "ring-1 ring-primary/25",
                  )}
                >
                  {day.slices.map((slice) => (
                    <span key={slice.id} className="flex min-h-1.5 flex-1 overflow-hidden rounded-md">
                      {slice.feelings.length === 0 ? (
                        <span className="flex-1" style={{ background: UNMARKED_FILL }} />
                      ) : (
                        slice.feelings.map((feeling) => (
                          <span
                            key={feeling}
                            className="flex-1"
                            style={{ background: feelingFill(feeling) }}
                          />
                        ))
                      )}
                    </span>
                  ))}
                </span>
                <span className="flex flex-col items-center leading-none">
                  <span
                    className={cn(
                      "text-[0.65rem] tracking-wide",
                      isToday ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {weekdayShort(day.key)}
                  </span>
                  <span className="mt-0.5 text-[0.65rem] text-muted-foreground">
                    {Number(day.key.slice(8))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <DayReading
            dayKey={selected.key}
            slices={selected.slices}
            entries={entries.filter((entry) => entry.date === selected.key)}
          />
        )}
      </div>
    </section>
  );
}

function DayReading({
  dayKey,
  slices,
  entries,
}: {
  dayKey: string;
  slices: DaySlice[];
  entries: JournalEntry[];
}) {
  const feelings = [...new Set(slices.flatMap((slice) => slice.feelings))];
  const withText = entries
    .filter((entry) => entry.body.trim())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const preview = withText.slice(0, 2);

  return (
    <div className="rounded-2xl bg-background/55 px-3 py-3">
      <p className="font-display text-lg tracking-tight text-foreground">
        {formatDayLabel(dayKey)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {slices.length === 0
          ? "В этот день записей нет."
          : feelings.length > 0
            ? feelings.join(", ")
            : "Запись без отметки самочувствия."}
        {slices.length > 1 ? ` · ${slices.length} ${notesLabel(slices.length)}` : ""}
      </p>
      {preview.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {preview.map((entry) => (
            <li key={entry.id} className="text-sm leading-relaxed text-foreground/90">
              {excerpt(entry.body)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function notesLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "записи";
  return "записей";
}

function excerpt(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= 140) return clean;
  return `${clean.slice(0, 137).trimEnd()}…`;
}
