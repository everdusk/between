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
      aria-label={label} disabled={disabled} onClick={(event) => {
        const button = event.currentTarget;
        if (matchMedia("(prefers-reduced-motion: no-preference)").matches &&
            document.documentElement.dataset.performance !== "low") {
          const scale = getComputedStyle(button).scale;
          button.getAnimations().find((animation) => animation.id === "back-release")?.cancel();
          button.animate([
            { scale: scale === "none" ? "1" : scale },
            { scale: "1.16", offset: 0.25 },
            { scale: "1" },
          ], { id: "back-release", duration: 235, easing: "ease-out" });
        }
        onClick();
      }}>
      <ChevronLeft aria-hidden className="rtl:scale-x-[-1]" />
    </Button>
  );
}
