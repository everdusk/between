"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { sheetShouldDismiss } from "@/lib/sheet";
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
  max: string;
  /** Date key → first feeling that day, or null when the note has no feeling. */
  marks: Map<string, Feeling | null>;
  disabled?: boolean;
  onChange: (value: string) => void;
}

type DragState = {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  offset: number;
  active: boolean;
};

const IDLE_DRAG: DragState = {
  pointerId: -1,
  startY: 0,
  lastY: 0,
  lastTime: 0,
  velocity: 0,
  offset: 0,
  active: false,
};

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
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLButtonElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState>(IDLE_DRAG);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(value);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTelegramVerticalSwipes(false);
    const frame = requestAnimationFrame(() => {
      (selectedRef.current ?? dialogRef.current)?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onTouchMove(event: TouchEvent) {
      if (event.cancelable) event.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("touchmove", onTouchMove);
      setTelegramVerticalSwipes(true);
      trigger?.focus();
    };
  }, [open]);

  function resetSheetPosition() {
    const sheet = dialogRef.current;
    const overlay = overlayRef.current;
    if (sheet) {
      sheet.style.transition = "transform 200ms ease-out";
      sheet.style.transform = "translateY(0)";
    }
    if (overlay) {
      overlay.style.transition = "opacity 200ms ease-out";
      overlay.style.opacity = "1";
    }
  }

  function onSheetPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      offset: 0,
      active: true,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onSheetPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    const offset = Math.max(0, event.clientY - drag.startY);
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    drag.offset = offset;
    const sheet = dialogRef.current;
    if (sheet) {
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${offset}px)`;
    }
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.style.transition = "none";
      overlay.style.opacity = String(Math.max(0.12, 1 - offset / 420));
    }
  }

  function onSheetPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    drag.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (sheetShouldDismiss(drag.offset, drag.velocity)) {
      setOpen(false);
      return;
    }
    resetSheetPosition();
  }

  const cells = monthCells(visible);
  const canNext = visible.slice(0, 7) < max.slice(0, 7);

  const sheet =
    open &&
    createPortal(
      <div className="fixed inset-0 z-40 overscroll-none">
        <button
          ref={overlayRef}
          type="button"
          aria-label={t("cancel")}
          className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <div
            ref={dialogRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="w-full max-w-lg touch-none outline-none animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out"
            onPointerDown={onSheetPointerDown}
            onPointerMove={onSheetPointerMove}
            onPointerUp={onSheetPointerEnd}
            onPointerCancel={onSheetPointerEnd}
          >
            <div className="glass-strong rounded-t-3xl ps-[max(1rem,var(--safe-left))] pe-[max(1rem,var(--safe-right))] pt-1 pb-[max(1.25rem,var(--safe-bottom))]">
              <div className="flex cursor-grab justify-center py-3 active:cursor-grabbing">
                <div aria-hidden className="h-1 w-10 rounded-full bg-foreground/20" />
              </div>
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
                  const isFuture = day > max;
                  const mark = marks.get(day);
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
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-2xl py-1 text-sm",
                        "focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none",
                        "active:scale-[0.97] disabled:pointer-events-none",
                        !selected && !isFuture && "hover:bg-foreground/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "tabular flex size-10 items-center justify-center rounded-full leading-none",
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
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
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
      {sheet}
    </div>
  );
}
