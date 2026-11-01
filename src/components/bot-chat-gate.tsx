"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  botIntroPending,
  clearBotIntroPending,
  markBotIntroPending,
  shouldShowBotChat,
} from "@/lib/bot-chat";
import { telegramSelection } from "@/lib/telegram";

const BOT_CHAT_URL = "https://t.me/BetweenJournalBot?start=app";

async function deliverBotHello(initData: string): Promise<boolean> {
  if (!initData) return false;
  try {
    const res = await fetch("/api/telegram/introduce", {
      method: "POST",
      headers: { "X-Telegram-Init-Data": initData },
      keepalive: true,
    });
    if (!res.ok) return false;
    clearBotIntroPending();
    return true;
  } catch {
    return false;
  }
}

export function BotChatGate({
  ready,
  inTelegram,
  allowsWriteToPm,
  initData,
}: {
  ready: boolean;
  inTelegram: boolean;
  allowsWriteToPm: boolean;
  initData: string;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const [granted, setGranted] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = ready && shouldShowBotChat({ inTelegram, allowsWriteToPm }) && !granted;

  useEffect(() => {
    if (!ready || !inTelegram || !initData || !botIntroPending()) return;
    void deliverBotHello(initData);
  }, [ready, inTelegram, initData]);

  async function allow() {
    if (busy) return;
    setBusy(true);
    telegramSelection();
    try {
      const webApp = (await import("@twa-dev/sdk")).default;
      const finish = () => {
        markBotIntroPending();
        setGranted(true);
        void deliverBotHello(initData).finally(() => setBusy(false));
      };
      if (!webApp.isVersionAtLeast("6.9")) {
        webApp.openTelegramLink(BOT_CHAT_URL);
        setBusy(false);
        return;
      }
      const timer = window.setTimeout(() => setBusy(false), 8000);
      webApp.requestWriteAccess((ok) => {
        window.clearTimeout(timer);
        if (!ok) {
          setBusy(false);
          return;
        }
        finish();
      });
    } catch {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/45 px-[max(1rem,var(--safe-left))] py-[max(1.25rem,var(--safe-bottom))] sm:items-center sm:px-[max(1.5rem,var(--safe-right))]"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ink w-full max-w-lg rounded-3xl p-6 sm:p-7"
      >
        <h2
          id={titleId}
          className="font-display text-[1.65rem] leading-tight tracking-tight text-ink-foreground"
        >
          {t("botChatTitle")}
        </h2>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-foreground/90">{t("botChatNote")}</p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">{t("botChatAsk")}</p>
        <Button
          type="button"
          size="lg"
          className="mt-6 w-full bg-ink-foreground text-ink hover:bg-ink-foreground/90"
          disabled={busy}
          onClick={() => void allow()}
        >
          {t("botChatAllow")}
        </Button>
      </section>
    </div>
  );
}
