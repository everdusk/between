"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useI18n } from "./locale-provider";
import { Button, buttonVariants } from "./ui/button";
import { GlassPanel } from "./ui/glass-panel";

export function BotConnectBanner({ onRefresh, onDismiss, reminders = false }: {
  onRefresh: () => void;
  onDismiss?: () => void;
  reminders?: boolean;
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  async function connect(provider: "telegram" | "max") {
    setBusy(true);
    setMessage("");
    setTelegramUrl("");
    try {
      const res = await fetch(provider === "telegram" ? "/api/account/link" : "/api/account/link/max", {method:"POST"});
      const data = await res.json();
      if (data.linked || data.error === "one_bot") { onRefresh(); return; }
      if (!res.ok || !data.url) {
        setMessage(t(data.error === "max_off" ? "webMaxOff" : "webServer"));
        return;
      }
      if (provider === "telegram" && data.vpn) {
        setMessage(t("webBotVpn"));
        setTelegramUrl(data.url);
      } else {
        window.location.assign(data.url);
      }
    } catch { setMessage(t("webServer")); }
    finally { setBusy(false); }
  }
  return <GlassPanel as="aside" className="bot-connect-banner relative space-y-3 p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <h3 className="font-display text-lg font-medium leading-snug">{t("webBotOffer")}</h3>
      {onDismiss && <Button size="icon-sm" variant="ghost" aria-label={t("accountClose")} onClick={onDismiss}><X/></Button>}
    </div>
    <p className="text-sm text-muted-foreground">{reminders
      ? (locale === "ru" ? "Подключите бота, чтобы включить напоминания и выбрать частоту опросов." : "Connect a bot to enable reminders and choose your check-in frequency.")
      : (locale === "ru" ? "Подключите бота к дневнику и получайте напоминания в удобном мессенджере." : "Connect your journal to get reminders in the messenger you use.")}</p>
    <div className="grid grid-cols-2 gap-2">
      {(["telegram", "max"] as const).map(provider => {
        const label = <>
          <Image src={`/${provider}-mark.svg`} alt="" width={18} height={18} className="shrink-0" />
          {provider === "telegram" ? "Telegram" : "MAX"}
        </>;
        const className = `auth-provider auth-${provider} w-full min-w-0 px-1.5`;
        return provider === "telegram" && telegramUrl
          ? <a key={provider} className={buttonVariants({variant: "outline", size: "lg", className})} href={telegramUrl}>{label}</a>
          : <Button key={provider} type="button" variant="outline" size="lg" className={className} disabled={busy} onClick={() => void connect(provider)}>{label}</Button>;
      })}
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </GlassPanel>;
}
