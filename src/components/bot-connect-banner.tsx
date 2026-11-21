"use client";

import { useState } from "react";
import { ArrowUpRight, MessageCircle, X } from "lucide-react";
import { useI18n } from "./locale-provider";
import { Button, buttonVariants } from "./ui/button";

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
  return <aside className="bot-connect-banner glass relative space-y-3 rounded-3xl p-5 sm:p-6">
    <h3 className="flex items-start gap-2 pe-6 font-display text-base leading-snug"><MessageCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-primary"/>{t("webBotOffer")}</h3>
    <p className="text-sm text-muted-foreground">{reminders
      ? (locale === "ru" ? "Подключите бота, чтобы включить напоминания и выбрать частоту опросов." : "Connect a bot to enable reminders and choose your check-in frequency.")
      : (locale === "ru" ? "Подключите бота к дневнику и получайте напоминания в удобном мессенджере." : "Connect your journal to get reminders in the messenger you use.")}</p>
    {onDismiss && <Button className="absolute end-2 top-2" size="icon-sm" variant="ghost" aria-label={t("accountClose")} onClick={onDismiss}><X/></Button>}
    <div className="flex flex-wrap gap-2">
      {telegramUrl ? <a className={buttonVariants({variant:"outline", className:"auth-telegram"})} href={telegramUrl}>Telegram <ArrowUpRight aria-hidden/></a> :
        <Button variant="outline" className="auth-telegram" disabled={busy} onClick={()=>void connect("telegram")}>Telegram <ArrowUpRight aria-hidden/></Button>}
      <Button variant="outline" className="auth-max" disabled={busy} onClick={()=>void connect("max")}>MAX <ArrowUpRight aria-hidden/></Button>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </aside>;
}
