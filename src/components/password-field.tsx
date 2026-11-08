"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/locale-provider";

export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete,
  showRules = false,
  reveal = false,
  blockSavedPassword = false,
}: {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  showRules?: boolean;
  /** Eye only while the person is creating the journal. A saved password stays masked. */
  reveal?: boolean;
  /**
   * MDN: autocomplete="new-password" is the hint that stops a stored password
   * from being filled. readonly until focus blocks the leftover heuristic that
   * still fills the first password field on the site.
   */
  blockSavedPassword?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(blockSavedPassword);
  const [caps, setCaps] = useState(false);
  useEffect(() => {
    if (!blockSavedPassword) return;
    const node = document.getElementById(id);
    if (!(node instanceof HTMLInputElement)) return;
    const input = node;
    // Field.Control keeps its own onFocus, so the release listens on the element.
    function release() {
      input.readOnly = false;
      setHeld(false);
    }
    input.addEventListener("focus", release);
    input.addEventListener("pointerdown", release);
    return () => {
      input.removeEventListener("focus", release);
      input.removeEventListener("pointerdown", release);
    };
  }, [blockSavedPassword, id]);
  const short = showRules && value.length > 0 && value.length < 8;
  const long = showRules && value.length > 200;
  const shown = reveal && visible;

  function watchCaps(event: KeyboardEvent<HTMLInputElement>) {
    setCaps(event.getModifierState("CapsLock"));
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name ?? id}
          type={shown ? "text" : "password"}
          autoComplete={blockSavedPassword ? "new-password" : autoComplete}
          readOnly={held || undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={watchCaps}
          onKeyUp={watchCaps}
          aria-invalid={short || long || undefined}
          className={reveal ? "pe-12" : undefined}
          required
        />
        {reveal ? (
          <button
            type="button"
            className="absolute end-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label={visible ? t("webPasswordHide") : t("webPasswordShow")}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        ) : null}
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
