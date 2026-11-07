"use client";

import { useState, type KeyboardEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/locale-provider";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  showRules = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  showRules?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const short = showRules && value.length > 0 && value.length < 8;
  const long = showRules && value.length > 200;

  function watchCaps(event: KeyboardEvent<HTMLInputElement>) {
    setCaps(event.getModifierState("CapsLock"));
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={watchCaps}
          onKeyUp={watchCaps}
          aria-invalid={short || long || undefined}
          className="pe-12"
          required
        />
        <button
          type="button"
          className="absolute end-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          aria-label={visible ? t("webPasswordHide") : t("webPasswordShow")}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      {caps ? (
        <p className="text-sm text-foreground" role="status">
          {t("webCapsLock")}
        </p>
      ) : null}
      {showRules ? (
        <div className="text-sm leading-relaxed text-muted-foreground" aria-live="polite">
          <p>{t("webPasswordRule")}</p>
          {short ? <p className="text-destructive">{t("webPasswordShortNow", { n: value.length })}</p> : null}
          {long ? <p className="text-destructive">{t("webPasswordLongNow", { n: value.length })}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
