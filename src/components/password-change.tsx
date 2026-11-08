"use client";

import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/locale-provider";

export function PasswordChange() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const mismatch = again.length > 0 && again !== next;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (mismatch || busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        if (data?.error === "short_password") setError(t("webPasswordShort"));
        else if (data?.error === "server_not_configured") setError(t("webServer"));
        else setError(t("webPasswordWrong"));
        return;
      }
      setCurrent("");
      setNext("");
      setAgain("");
      setDone(true);
    } catch {
      setError(t("webServer"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="change-password" className="space-y-4" onSubmit={save}>
      <PasswordField
        id="current-password"
        name="current-password"
        label={t("webPasswordCurrent")}
        value={current}
        onChange={(value) => {
          setDone(false);
          setCurrent(value);
        }}
        autoComplete="new-password"
        blockSavedPassword
      />
      <PasswordField
        id="new-password"
        name="new-password"
        label={t("webPasswordNew")}
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        showRules
      />
      <PasswordField
        id="confirm-new-password"
        name="confirm-new-password"
        label={t("webPasswordNewAgain")}
        value={again}
        onChange={setAgain}
        autoComplete="new-password"
      />
      {mismatch ? (
        <p className="text-sm text-destructive" role="status">
          {t("webPasswordMismatch")}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm text-foreground" role="status">
          {t("webPasswordChanged")}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy || mismatch}>
        {t("webPasswordChange")}
      </Button>
    </form>
  );
}
