"use client";

import { useI18n } from "@/components/locale-provider";
import { feelingFill } from "@/lib/spectrum";
import { PICKER_FEELINGS, type Feeling } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FeelingPickerProps {
  value: Feeling[];
  onChange: (value: Feeling[]) => void;
  disabled?: boolean;
}

export function FeelingPicker({ value, onChange, disabled }: FeelingPickerProps) {
  const { t, feeling: feelingLabel } = useI18n();
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
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("feelingsGroup")}>
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
              "inline-flex h-10 items-center gap-2 rounded-full border pr-4 pl-3 text-sm transition-[background-color,color,border-color,transform] duration-200 select-none",
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
  );
}
