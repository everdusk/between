"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/locale-provider";
import { journalAuthHeaders } from "@/lib/journal-api";

export function FeedbackForm({
  initData,
  maxInitData,
}: {
  initData: string;
  maxInitData: string;
}) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: journalAuthHeaders(initData, maxInitData, true),
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !data?.ok) {
        setError(t("feedbackFail"));
        return;
      }
      setMessage("");
      setSent(true);
    } catch {
      setError(t("feedbackFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <Textarea
        value={message}
        onChange={(event) => {
          setSent(false);
          setMessage(event.target.value);
        }}
        placeholder={t("feedbackPlaceholder")}
        maxLength={2000}
        required
        aria-label={t("feedbackTitle")}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {sent ? (
        <p className="text-sm text-foreground" role="status">
          {t("feedbackSent")}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy || message.trim().length < 2}>
        {t("feedbackSend")}
      </Button>
    </form>
  );
}
