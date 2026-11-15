"use client";

import { useI18n } from "@/components/locale-provider";
import { feelingFill } from "@/lib/spectrum";
import { PICKER_FEELINGS, type Feeling } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeelingPickerProps {
  value: Feeling[];
  onChange: (value: Feeling[]) => void;
  disabled?: boolean;
}

export function FeelingPicker({ value, onChange, disabled }: FeelingPickerProps) {
  const { t, feeling: feelingLabel } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

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
      <Button ref={triggerRef} type="button" variant="secondary" size="sm" className="max-w-full" disabled={disabled}
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
        {value.slice(0, 3).map((feeling) => <span key={feeling} aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: feelingFill(feeling) }} />)}
        <span className="truncate">{value.length ? value.map(feelingLabel).join(", ") : t("howFeel")}</span>
        <ChevronDown aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </Button>
      {open && <div id={panelId} className="rounded-2xl bg-foreground/[0.04] p-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("feelingsGroup")}>
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
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-[background-color,color,border-color,transform] duration-200 select-none",
              "focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none active:scale-[0.97]",
              "disabled:opacity-50",
              active
                ? "border-transparent bg-foreground text-background shadow-[0_10px_24px_-14px_var(--foreground)]"
                : "border-[color:var(--glass-border)] bg-background/55 text-foreground hover:bg-background/85",
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
          </button>
        );
      })}
      </div>
      <div className="mt-2 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={closePicker}><Check aria-hidden />{t("feelingDone")}</Button>
      </div>
      </div>}
    </div>
  );
}
