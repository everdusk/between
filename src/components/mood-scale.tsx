"use client";

import { cn } from "@/lib/utils";
import { MOOD_LABELS, type MoodLevel } from "@/lib/types";

const LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

interface MoodScaleProps {
  value: MoodLevel;
  onChange: (value: MoodLevel) => void;
  disabled?: boolean;
}

export function MoodScale({ value, onChange, disabled }: MoodScaleProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-1.5 sm:gap-2">
        {LEVELS.map((level) => {
          const active = value === level;
          const height = 28 + level * 8;
          return (
            <button
              key={level}
              type="button"
              disabled={disabled}
              aria-label={MOOD_LABELS[level]}
              aria-pressed={active}
              onClick={() => onChange(level)}
              className={cn(
                "group flex flex-1 flex-col items-center gap-2 rounded-md outline-none transition-transform duration-300 ease-out",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:opacity-50",
                active && "scale-[1.03]",
              )}
            >
              <span
                className={cn(
                  "w-full max-w-[3.25rem] rounded-t-md rounded-b-sm transition-all duration-300 ease-out",
                  active
                    ? "bg-primary shadow-[0_8px_20px_-12px_oklch(0.42_0.07_175_/_0.55)]"
                    : "bg-primary/15 group-hover:bg-primary/30",
                )}
                style={{ height }}
              />
              <span
                className={cn(
                  "text-[0.65rem] font-medium tracking-wide sm:text-xs",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {level}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Сейчас: <span className="text-foreground">{MOOD_LABELS[value]}</span>
      </p>
    </div>
  );
}
