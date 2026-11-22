import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";

type DateStep = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function DateNavigation({ previous, next, children, action, range = false }: {
  previous: DateStep;
  next: DateStep;
  children: ReactNode;
  action: ReactNode;
  range?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[minmax(2.5rem,1fr)_auto_minmax(0,var(--date-width))_auto_minmax(2.5rem,1fr)] items-center gap-x-1 px-4 text-center sm:gap-x-3 ${range ? "[--date-width:15rem]" : "[--date-width:10rem] sm:[--date-width:12rem]"}`}>
      <BackButton className="col-start-2" {...previous} />
      <div className="tabular min-w-0 text-xl leading-tight text-foreground sm:text-2xl">{children}</div>
      <Button type="button" variant="ghost" size="icon" aria-label={next.label} disabled={next.disabled} onClick={next.onClick}>
        <ChevronRight aria-hidden className="rtl:scale-x-[-1]" />
      </Button>
      <div className="justify-self-end">{action}</div>
    </div>
  );
}
