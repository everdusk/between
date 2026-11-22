"use client";

import { useI18n } from "@/components/locale-provider";
import { feelingFill } from "@/lib/spectrum";
import { PICKER_FEELINGS, type Feeling } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeelingPickerProps {
  children: ReactNode;
  value: Feeling[];
  onChange: (value: Feeling[]) => void;
  disabled?: boolean;
}

export function FeelingPicker({ value, onChange, disabled, children }: FeelingPickerProps) {
  const { t, feeling: feelingLabel } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      const button = event.target instanceof Element && event.target.closest("button");
      if (!button || (button !== triggerRef.current && !document.getElementById(panelId)?.contains(button))) setOpen(false);
    };
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  }, [open, panelId]);

  function closePicker() {
    setOpen(false);
    triggerRef.current?.focus();
  }
  const extras = value.filter(
    (feeling) => !PICKER_FEELINGS.includes(feeling as (typeof PICKER_FEELINGS)[number]),
  );
  const options: Feeling[] = [...PICKER_FEELINGS, ...extras];

  function toggle(feeling: Feeling) {
    if (value.includes(feeling)) {
      onChange(value.filter((item) => item !== feeling));
      return;
    }
    onChange([...value, feeling]);
  }

  return (
    <div className="space-y-3" onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); closePicker(); } }}>
      <div className="flex items-center gap-2 has-[>textarea]:items-start">
        <Button ref={triggerRef} type="button" variant="outline" size="icon" className="relative" disabled={disabled}
          aria-label={[t("feelingsGroup"), ...value.map(feelingLabel)].join(", ")}
          aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
          <Smile aria-hidden />
          {value.length > 0 && (
            <span aria-hidden className="absolute bottom-1 flex gap-0.5">
              {value.slice(0, 3).map(f => <span key={f} className="size-1 rounded-full" style={{ background: feelingFill(f) }} />)}
            </span>
          )}
        </Button>
        {children}
      </div>
      {open && <div id={panelId} className="feeling-choice-panel rounded-2xl p-2">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3" role="group" aria-label={t("feelingsGroup")}>
      {options.map((feeling) => {
        const active = value.includes(feeling);
        return (
          <button
            key={feeling}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => toggle(feeling)}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-xl border px-2.5 py-2 text-start text-sm transition-colors select-none",
              "focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none active:scale-[0.97]",
              "disabled:opacity-50",
              active
                ? "border-transparent bg-foreground text-background shadow-[0_10px_24px_-14px_var(--foreground)]"
                : "border-[color:var(--glass-border)] bg-background/55 text-foreground hover:border-primary hover:bg-primary/15",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2.5 shrink-0 rounded-full ring-2 transition-shadow",
                active ? "ring-background/30" : "ring-transparent",
              )}
              style={{ background: feelingFill(feeling) }}
            />
            {feelingLabel(feeling)}
            {active && <Check aria-hidden className="ms-auto size-4 shrink-0" />}
          </button>
        );
      })}
      </div>
      </div>}
    </div>
  );
}
