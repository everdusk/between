"use client";

import { useI18n } from "@/components/locale-provider";
import { formatDayLabel, weekdayShort } from "@/lib/dates";
import {
  UNMARKED_FILL,
  buildWeekSpectrum,
  feelingFill,
  type DaySlice,
} from "@/lib/spectrum";
import type { Feeling, JournalEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/messages";

interface WeekSpectrumProps {
  dayKeys: string[];
  entries: JournalEntry[];
  todayKey: string;
  selectedKey: string;
  onSelect: (dayKey: string) => void;
}

function spectrumTitle(
  spectrum: ReturnType<typeof buildWeekSpectrum>,
  t: (key: MessageKey, vars?: Record<string, string | number | undefined>) => string,
  feeling: (value: Feeling) => string,
): string {
  if (spectrum.feelingTotal === 0) return t("spectrumQuiet");
  if (spectrum.top.length === 1) return feeling(spectrum.top[0]);
  if (spectrum.top.length === 2) {
    return t("spectrumPair", { a: feeling(spectrum.top[0]), b: feeling(spectrum.top[1]) });
  }
  return t("spectrumSeveral");
}

function spectrumLead(
  spectrum: ReturnType<typeof buildWeekSpectrum>,
  noteCount: number,
  t: (key: MessageKey, vars?: Record<string, string | number | undefined>) => string,
  feeling: (value: Feeling) => string,
): string {
  if (spectrum.feelingTotal === 0 && noteCount === 0) return t("spectrumEmpty");
  if (spectrum.feelingTotal === 0) return t("spectrumNoFeelings");
  if (spectrum.top.length === 1) return t("spectrumTopOne", { feeling: feeling(spectrum.top[0]) });
  if (spectrum.top.length === 2) {
    return t("spectrumTopTwo", { a: feeling(spectrum.top[0]), b: feeling(spectrum.top[1]) });
  }
  return t("spectrumTopMany");
}

export function WeekSpectrum({
  dayKeys,
  entries,
  todayKey,
  selectedKey,
  onSelect,
}: WeekSpectrumProps) {
  const { t, locale, feeling, count } = useI18n();
  const spectrum = buildWeekSpectrum(dayKeys, entries);
  const noteCount = spectrum.days.reduce((sum, day) => sum + day.slices.length, 0);
  const headline = spectrumLead(spectrum, noteCount, t, feeling);
  const title = spectrumTitle(spectrum, t, feeling);
  const selected = spectrum.days.find((day) => day.key === selectedKey) ?? spectrum.days[0];
  const lead = spectrum.top[0];

  return (
    <section
      className="glass-strong relative overflow-hidden rounded-3xl p-5 sm:p-6"
      aria-labelledby="week-spectrum-title"
    >
      {lead && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -end-16 size-64 rounded-full blur-3xl"
          style={{ background: feelingFill(lead), opacity: 0.22 }}
        />
      )}

      <div className="relative space-y-6">
        <div className="space-y-2">
          <p id="week-spectrum-title" className="eyebrow text-muted-foreground">
            {t("spectrumLabel")}
          </p>
          <p className="font-display text-[2.125rem] leading-[1.05] tracking-tight text-foreground sm:text-[2.5rem]">
            {title}
          </p>
          {title !== headline && (
            <p className="text-sm leading-relaxed text-muted-foreground">{headline}</p>
          )}
        </div>

        {spectrum.shares.length > 0 && (
          <div className="space-y-3">
            <div
              className="flex h-2.5 gap-1"
              role="img"
              aria-label={spectrum.shares
                .map((share) => `${feeling(share.feeling)} ${share.count}`)
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
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
                {spectrum.shares.map((share) => (
                  <li
                    key={share.feeling}
                    className="flex items-center gap-1.5 text-xs text-foreground"
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: feelingFill(share.feeling) }}
                    />
                    <span>{feeling(share.feeling)}</span>
                    <span className="tabular text-muted-foreground">{share.count}</span>
                  </li>
                ))}
              </ul>
              {spectrum.shares.length > 1 && (
                <p className="text-[0.6875rem] text-muted-foreground/80">{t("spectrumAxis")}</p>
              )}
            </div>
          </div>
        )}

        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:gap-1.5">
          {spectrum.days.map((day) => {
            const selectedDay = day.key === selectedKey;
            const isToday = day.key === todayKey;
            const isFuture = day.key > todayKey;
            const names = day.slices.map((slice) =>
              slice.feelings.length > 0
                ? slice.feelings.map((item) => feeling(item)).join(", ")
                : t("unmarked"),
            );
            const label = `${formatDayLabel(day.key, locale)}${
              names.length > 0 ? `: ${names.join("; ")}` : `: ${t("noEntry")}`
            }`;
            return (
              <button
                key={day.key}
                type="button"
                aria-pressed={selectedDay}
                aria-label={label}
                onClick={() => onSelect(day.key)}
                className={cn(
                  "flex min-w-11 flex-1 basis-0 flex-col items-center gap-2 rounded-2xl p-1 transition-[background-color,transform] duration-200 active:scale-[0.97]",
                  "focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none",
                  selectedDay && "bg-foreground/[0.05]",
                  isFuture && day.slices.length === 0 && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex h-24 w-full flex-col gap-0.5 overflow-hidden rounded-xl p-1 transition-shadow sm:h-28",
                    day.slices.length === 0
                      ? "border border-dashed border-[color:var(--glass-border)] bg-background/30"
                      : "bg-background/55",
                    selectedDay && "ring-2 ring-foreground/60",
                    isToday && !selectedDay && "ring-1 ring-primary/35",
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
                    {weekdayShort(day.key, locale)}
                  </span>
                  <span className="tabular mt-1 text-[0.65rem] text-muted-foreground">
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
            locale={locale}
            feeling={feeling}
            count={count}
            emptyDay={t("noNotesDay")}
            noFeeling={t("noteNoFeeling")}
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
  locale,
  feeling,
  count,
  emptyDay,
  noFeeling,
}: {
  dayKey: string;
  slices: DaySlice[];
  entries: JournalEntry[];
  locale: string;
  feeling: (value: Feeling) => string;
  count: (amount: number, stem: "note") => string;
  emptyDay: string;
  noFeeling: string;
}) {
  const feelings = [...new Set(slices.flatMap((slice) => slice.feelings))];
  const withText = entries
    .filter((entry) => entry.body.trim())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const preview = withText.slice(0, 2);

  return (
    <div className="rounded-2xl bg-foreground/[0.04] px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg tracking-tight text-foreground">
          {formatDayLabel(dayKey, locale)}
        </p>
        {slices.length > 1 && (
          <p className="text-xs text-muted-foreground">{count(slices.length, "note")}</p>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
        {slices.length === 0 ? (
          <span>{emptyDay}</span>
        ) : feelings.length > 0 ? (
          feelings.map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ background: feelingFill(item) }}
              />
              {feeling(item)}
            </span>
          ))
        ) : (
          <span>{noFeeling}</span>
        )}
      </div>
      {preview.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-[color:var(--glass-border)] pt-3">
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

function excerpt(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= 140) return clean;
  return `${clean.slice(0, 137).trimEnd()}…`;
}
