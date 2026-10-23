import { Calendar, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** System date glyphs are only black or white. This one uses the theme text color. */
export function ThemeDateInput({
  className,
  type = "date",
  ...props
}: React.ComponentProps<typeof Input>) {
  const Icon = type === "time" ? Clock : Calendar;
  return (
    <div className="theme-date-input relative inline-flex">
      <Input
        type={type}
        className={cn(
          "w-auto pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0",
          className,
        )}
        {...props}
      />
      <Icon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-foreground"
      />
    </div>
  );
}
