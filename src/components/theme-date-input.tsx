"use client";

import { CalendarDays, ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeDateInputProps = React.ComponentProps<"input"> & {
  /** Human text shown on the trigger. The native picker sits on top, invisible. */
  display: string;
  tone?: "default" | "ink";
};

/**
 * System date and time pickers render in black or white with a US-only layout.
 * The visible pill carries the localized text; the native input keeps the picker.
 */
export function ThemeDateInput({
  className,
  type = "date",
  display,
  tone = "default",
  disabled,
  ...props
}: ThemeDateInputProps) {
  const Icon = type === "time" ? Clock : CalendarDays;
  return (
    <span
      className={cn(
        "relative inline-flex h-11 items-center gap-2.5 rounded-full border pr-3.5 pl-4 text-sm transition-[box-shadow,background-color] duration-200",
        tone === "ink"
          ? "border-ink-foreground/15 bg-ink-foreground/[0.08] text-ink-foreground has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink-foreground/20"
          : "border-[color:var(--glass-border)] bg-background/55 text-foreground has-[:focus-visible]:border-primary/40 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/12",
        disabled && "opacity-50",
        className,
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0 opacity-70" />
      <span className="tabular font-medium whitespace-nowrap">{display}</span>
      <ChevronDown aria-hidden className="size-3.5 shrink-0 opacity-50" />
      <input
        type={type}
        disabled={disabled}
        className="native-overlay disabled:cursor-not-allowed"
        {...props}
      />
    </span>
  );
}
