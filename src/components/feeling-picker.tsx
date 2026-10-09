"use client";

import { PICKER_FEELINGS, type Feeling } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FeelingPickerProps {
  value: Feeling[];
  onChange: (value: Feeling[]) => void;
  disabled?: boolean;
}

export function FeelingPicker({ value, onChange, disabled }: FeelingPickerProps) {
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
    <div className="flex flex-wrap gap-2" role="group" aria-label="Самочувствие">
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
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
              "disabled:opacity-50",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/80 bg-background/70 text-foreground hover:bg-accent/60",
            )}
          >
            {feeling}
          </button>
        );
      })}
    </div>
  );
}
