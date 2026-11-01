"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
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

type BotChatApi = {
  needed: boolean;
  sheet: boolean;
  busy: boolean;
  allow: () => void;
};

const BotChatContext = createContext<BotChatApi | null>(null);

export function BotChatPermission({
  ready,
  inTelegram,
  allowsWriteToPm,
  initData,
  children,
}: {
  ready: boolean;
  inTelegram: boolean;
  allowsWriteToPm: boolean;
  initData: string;
  children: ReactNode;
}) {
  const [granted, setGranted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  const needed = ready && shouldShowBotChat({ inTelegram, allowsWriteToPm }) && !granted;

  useEffect(() => {
    if (!ready || !inTelegram || !initData || !botIntroPending()) return;
    void deliverBotHello(initData);
  }, [ready, inTelegram, initData]);

  function allow() {
    if (busy) return;
    setBusy(true);
    telegramSelection();
    void (async () => {
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
            setDeclined(true);
            setBusy(false);
            return;
          }
          finish();
        });
      } catch {
        setBusy(false);
      }
    })();
  }

  return (
    <BotChatContext.Provider value={{ needed, sheet: needed && !declined, busy, allow }}>
      {children}
    </BotChatContext.Provider>
  );
}

function BotChatCopy({ tone, titleId }: { tone: "ink" | "glass"; titleId?: string }) {
  const { t } = useI18n();
  const api = useContext(BotChatContext);
  if (!api) return null;
  const ink = tone === "ink";
  const Title = ink ? "h2" : "h3";
  return (
    <>
      <Title
        id={titleId}
        className={
          ink
            ? "font-display text-[1.65rem] leading-tight tracking-tight text-ink-foreground"
            : "font-display text-xl tracking-tight text-foreground"
        }
      >
        {t("botChatTitle")}
      </Title>
      <p
        className={
          ink
            ? "mt-4 text-[0.9375rem] leading-relaxed text-ink-foreground/90"
            : "mt-3 text-sm leading-relaxed text-foreground/90"
        }
      >
        {t("botChatNote")}
      </p>
      <p
        className={
          ink
            ? "mt-3 text-[0.9375rem] leading-relaxed text-ink-muted"
            : "mt-2 text-sm leading-relaxed text-muted-foreground"
        }
      >
        {t("botChatAsk")}
      </p>
      <Button
        type="button"
        size="lg"
        className={
          ink
            ? "mt-6 w-full bg-ink-foreground text-ink hover:bg-ink-foreground/90"
            : "mt-5 w-full"
        }
        disabled={api.busy}
        onClick={api.allow}
      >
        {t("botChatAllow")}
      </Button>
    </>
  );
}

/** Full-screen ask. A refusal closes it and leaves the card under settings. */
export function BotChatSheet() {
  const api = useContext(BotChatContext);
  const titleId = useId();
  if (!api?.sheet) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/45 px-[max(1rem,var(--safe-left))] py-[max(1.25rem,var(--safe-bottom))] sm:items-center sm:px-[max(1.5rem,var(--safe-right))]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ink w-full max-w-lg rounded-3xl p-6 sm:p-7"
      >
        <BotChatCopy tone="ink" titleId={titleId} />
      </section>
    </div>
  );
}

/** Same words under the session settings, for anyone who has not allowed messages. */
export function BotChatSettings() {
  const api = useContext(BotChatContext);
  if (!api?.needed) return null;
  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <BotChatCopy tone="glass" />
    </section>
  );
}
