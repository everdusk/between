"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
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
import { setTelegramVerticalSwipes, telegramSelection } from "@/lib/telegram";
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
  max?: string;
  label?: string;
  showDate?: boolean;
  /** Date key → first feeling that day, or null when the note has no feeling. */
  marks?: Map<string, Feeling | null>;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function EntryCalendar({
  id,
  value,
  max,
  label,
  showDate = false,
  marks,
  disabled,
  onChange,
}: EntryCalendarProps) {
  const { t, locale } = useI18n();
  const titleId = useId();
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [dismissedWithEscape, setDismissedWithEscape] = useState(false);
  const [visible, setVisible] = useState(value);

  useEffect(() => {
    if (!open) return;
    setTelegramVerticalSwipes(false);
    return () => { setTelegramVerticalSwipes(true); };
  }, [open]);

  const cells = monthCells(visible);
  const canNext = !max || visible.slice(0, 7) < max.slice(0, 7);
  const formattedDate = formatLongDate(value, locale);

  return (
    <Popover.Root modal open={open} onOpenChange={(next, details) => {
      setDismissedWithEscape(!next && details.reason === "escape-key");
      if (next) setVisible(value);
      setOpen(next);
    }}>
      <Popover.Trigger id={id} disabled={disabled} aria-label={`${label ?? t("date")}: ${formattedDate}`}
        data-escape-dismissed={dismissedWithEscape || undefined}
        onBlur={() => setDismissedWithEscape(false)}
        onPointerMove={() => { if (dismissedWithEscape) setDismissedWithEscape(false); }}
        render={<Button type="button" size={showDate ? "default" : "icon"} variant={showDate ? "outline" : "ghost"} className="journal-date-trigger shrink-0" />}>
        <CalendarDays aria-hidden />
        {showDate && <><span className="tabular">{formattedDate}</span><ChevronDown aria-hidden className="size-3 opacity-60" /></>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Backdrop data-calendar-backdrop="" className="fixed inset-0 z-40 bg-black/35" />
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={8} className="z-50">
          <Popover.Popup aria-labelledby={titleId} initialFocus={selectedRef}
            className="calendar-panel glass-strong max-h-[var(--available-height)] w-[min(21rem,var(--available-width))] overflow-y-auto overscroll-contain rounded-3xl p-3 outline-none">
            <Popover.Close aria-label={t("cancel")} className="sr-only focus:not-sr-only">{t("cancel")}</Popover.Close>
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
              <p
                id={titleId}
                className="font-display text-lg tracking-tight text-foreground capitalize"
              >
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

            <div className="mt-4 grid grid-cols-7">
              {WEEKDAY_KEYS.map((key) => (
                <div
                  key={key}
                  className="pb-2 text-center text-[0.6875rem] tracking-wide text-muted-foreground capitalize"
                >
                  {weekdayShort(key, locale)}
                </div>
              ))}
              {cells.map((day, index) => {
                if (!day) return <span key={`pad-${index}`} aria-hidden />;
                const selected = day === value;
                const isFuture = !!max && day > max;
                const mark = marks?.get(day);
                const hasEntry = mark !== undefined;
                const label = hasEntry
                  ? `${formatDayLabel(day, locale)}. ${t("calendarMarked")}`
                  : formatDayLabel(day, locale);
                return (
                  <button
                    key={day}
                    ref={selected ? selectedRef : undefined}
                    type="button"
                    disabled={disabled || isFuture}
                    aria-pressed={selected}
                    aria-label={label}
                    onClick={() => {
                      telegramSelection();
                      onChange(day);
                      setOpen(false);
                    }}
                    className="calendar-day group flex flex-col items-center gap-1 py-1 text-sm focus-visible:outline-none active:scale-[0.97] disabled:pointer-events-none"
                  >
                    <span
                      className={cn(
                        "calendar-day-number tabular flex size-10 items-center justify-center rounded-full leading-none group-focus-visible:outline-2 group-focus-visible:outline-ring",
                        selected && "bg-foreground font-medium text-background",
                        !selected && isFuture && "text-muted-foreground/45",
                        !selected && !isFuture && hasEntry && "font-medium text-foreground",
                        !selected && !isFuture && !hasEntry && "text-muted-foreground",
                        !selected && day === max && "ring-1 ring-primary/55",
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <span
                      aria-hidden
                      className={cn("size-2 rounded-full", !hasEntry && "invisible")}
                      style={{
                        background: !hasEntry
                          ? undefined
                          : mark
                            ? feelingFill(mark)
                            : "var(--foreground)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
