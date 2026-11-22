import { ChevronLeft } from "lucide-react";
import { Button } from "./button";

export function BackButton({ label, onClick, disabled, className }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button data-back-button="" type="button" variant="ghost" size="icon" className={className}
      aria-label={label} onClick={onClick} disabled={disabled}>
      <ChevronLeft aria-hidden className="rtl:scale-x-[-1]" />
    </Button>
  );
}
