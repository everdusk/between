"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<React.ComponentProps<"input">, "type" | "role"> & {
  label: React.ReactNode;
  description?: React.ReactNode;
};

/** Native checkbox under a switch track, so forms and screen readers keep working. */
export function Switch({ label, description, className, disabled, ...props }: SwitchProps) {
  return (
    <label
      className={cn(
        "group/switch flex cursor-pointer items-center gap-4 py-1",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          role="switch"
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden
          className={cn(
            "block h-7 w-12 rounded-full border border-[color:var(--glass-border)] bg-foreground/[0.08] transition-colors duration-300",
            "peer-checked:border-transparent peer-checked:bg-primary",
            "peer-focus-visible:ring-4 peer-focus-visible:ring-ring/25",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute start-1 size-5 rounded-full bg-card shadow-[0_2px_6px_-1px_oklch(0_0_0_/_0.25)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5",
          )}
        />
      </span>
    </label>
  );
}
