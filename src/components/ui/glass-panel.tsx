import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function GlassPanel({ as: Tag = "section", className, ...props }: ComponentProps<"section"> & { as?: "section" | "aside" }) {
  return <Tag {...props} data-slot="glass-panel" className={cn("glass rounded-3xl", className)} />;
}
