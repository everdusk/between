"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  formatDayLabel,
  formatLongDate,
  formatMonthTitle,
  monthCells,
  shiftMonth,
  weekdayShort,
} from "@/lib/dates";
import { feelingFill } from "@/lib/spectrum";
import type { Feeling } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAY_KEYS = [
  "2026-01-05",
  "2026-01-06",
  "2026-01-07",
  "2026-01-08",
  "2026-01-09",
  "2026-01-10",
  "2026-01-11",
];

interface EntryCalendarProps {
  id?: string;
  value: string;
  max: string;
  /** Date key → first feeling that day, or null when the note has no feeling. */
  marks: Map<string, Feeling | null>;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function EntryCalendar({
  id,
  value,
  max,
  marks,
  disabled,
  onChange,
}: EntryCalendarProps) {
  const { t, locale } = useI18n();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(value);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = monthCells(visible);
  const canNext = visible.slice(0, 7) < max.slice(0, 7);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("date")}
        onClick={() => {
          setVisible(value);
          setOpen((current) => !current);
        }}
        className={cn(
          "inline-flex h-11 items-center gap-2.5 rounded-full border border-[color:var(--glass-border)] bg-background/55 pr-3.5 pl-4 text-sm text-foreground transition-[box-shadow,background-color] duration-200",
          "focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/12 focus-visible:outline-none",
          "disabled:opacity-50",
          open && "border-primary/40 bg-background/80",
        )}
      >
        <CalendarDays aria-hidden className="size-4 shrink-0 opacity-70" />
        <span className="tabular font-medium whitespace-nowrap">{formatLongDate(value, locale)}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 shrink-0 opacity-50 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="glass-strong mt-3 rounded-3xl p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("calendarPrev")}
              onClick={() => setVisible((current) => shiftMonth(current, -1))}
            >
              <ChevronLeft aria-hidden className="rtl:scale-x-[-1]" />
            </Button>
            <p className="font-display text-lg tracking-tight text-foreground capitalize">
              {formatMonthTitle(visible, locale)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("calendarNext")}
              disabled={!canNext}
              onClick={() => setVisible((current) => shiftMonth(current, 1))}
            >
              <ChevronRight aria-hidden className="rtl:scale-x-[-1]" />
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1">
            {WEEKDAY_KEYS.map((key) => (
              <div
                key={key}
                className="pb-1 text-center text-[0.65rem] tracking-wide text-muted-foreground capitalize"
              >
                {weekdayShort(key, locale)}
              </div>
            ))}
            {cells.map((day, index) => {
              if (!day) return <span key={`pad-${index}`} />;
              const selected = day === value;
              const isFuture = day > max;
              const mark = marks.get(day);
              const hasEntry = mark !== undefined;
              const label = hasEntry
                ? `${formatDayLabel(day, locale)}. ${t("calendarMarked")}`
                : formatDayLabel(day, locale);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled || isFuture}
                  aria-pressed={selected}
                  aria-label={label}
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-sm transition-[background-color,color,transform] duration-200",
                    "focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none",
                    "active:scale-[0.96] disabled:pointer-events-none disabled:opacity-30",
                    selected
                      ? "bg-foreground text-background"
                      : hasEntry
                        ? "font-medium text-foreground hover:bg-foreground/[0.05]"
                        : "text-muted-foreground hover:bg-foreground/[0.04]",
                    !selected && day === max && "ring-1 ring-primary/35",
                  )}
                >
                  <span className="tabular leading-none">{Number(day.slice(8))}</span>
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", !hasEntry && "opacity-0")}
                    style={{
                      background: !hasEntry
                        ? "transparent"
                        : selected
                          ? "var(--background)"
                          : mark
                            ? feelingFill(mark)
                            : "var(--foreground)",
                    }}
                  />
                </button>
              );
            })}
          </div>

          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
            {t("calendarMarked")}
          </p>
        </div>
      )}
    </div>
  );
}
