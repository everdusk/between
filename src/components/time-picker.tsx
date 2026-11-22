"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown, Clock } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";
import { useI18n } from "./locale-provider";
import { Button } from "./ui/button";

function TimeColumn({ label, count, value, onChange }: {
  label: string;
  count: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const column = list.current;
    const selected = column?.querySelector("input:checked")?.parentElement;
    if (column && selected) column.scrollTop = selected.offsetTop - (column.clientHeight - selected.offsetHeight) / 2;
  }, []);

  return (
    <div className="min-w-0 text-center">
      <span id={id} className="mb-2 block text-xs text-muted-foreground first-letter:uppercase">{label}</span>
      <div ref={list} role="radiogroup" aria-labelledby={id} className="relative h-40 overflow-y-auto overscroll-contain rounded-xl [scrollbar-width:thin]">
        {Array.from({ length: count }, (_, index) => {
          const digits = String(index).padStart(2, "0");
          return (
            <label key={digits} className="time-option relative mx-1 grid h-10 cursor-pointer place-items-center rounded-full tabular-nums">
              <input type="radio" name={id} value={digits} checked={value === digits} onChange={() => onChange(digits)} className="sr-only" />
              {digits}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function TimePicker({ id, label, value, disabled, onChange }: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { t, locale } = useI18n();
  const names = new Intl.DisplayNames(locale, { type: "dateTimeField" });
  const [hour, minute] = value.split(":");
  return (
    <Popover.Root>
      <Popover.Trigger id={id} disabled={disabled} aria-label={`${label}, ${value}`}
        render={<Button type="button" variant="outline" className="gap-2 rounded-full px-4" />}>
        <Clock aria-hidden className="opacity-70" /><span className="tabular-nums" dir="ltr">{value}</span><ChevronDown aria-hidden className="size-3 opacity-60" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={8} collisionPadding={8} className="z-50">
          <Popover.Popup aria-label={label} className="calendar-panel glass-strong max-h-[var(--available-height)] w-[min(13rem,var(--available-width))] overflow-auto rounded-3xl p-3 text-foreground">
            <div className="grid grid-cols-2 divide-x divide-[var(--glass-border)]" dir="ltr">
              <TimeColumn label={names.of("hour")!} count={24} value={hour} onChange={next => onChange(next + ":" + minute)} />
              <TimeColumn label={names.of("minute")!} count={60} value={minute} onChange={next => onChange(hour + ":" + next)} />
            </div>
            <Popover.Close render={<Button type="button" variant="outline" size="sm" className="mt-3 w-full rounded-full" />}>{t("feelingDone")}</Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
