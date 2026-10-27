import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-2xl border border-[color:var(--glass-border)] bg-background/55 px-4 py-3 text-base leading-relaxed text-foreground transition-[border-color,box-shadow,background-color] duration-200 outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary/40 focus-visible:bg-background/80 focus-visible:ring-4 focus-visible:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
