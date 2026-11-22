import type { ReactNode } from "react";
import { BackButton } from "./ui/back-button";

export function IntroStepHeader({ backLabel, onBack, children }: {
  backLabel: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="intro-step-header flex items-center gap-3">
      {onBack && <BackButton label={backLabel} onClick={onBack} />}
      <small>{children}</small>
    </div>
  );
}
