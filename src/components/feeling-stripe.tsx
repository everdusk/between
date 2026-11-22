import { feelingGradient } from "@/lib/spectrum";
import type { Feeling } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FeelingStripe({ feeling, className }: { feeling: Feeling; className?: string }) {
  return <span aria-hidden className={cn("feeling-fill pointer-events-none absolute start-0 w-1 rounded-e-full bg-current", className)}
    style={feelingGradient(feeling)} />;
}
