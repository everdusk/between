"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/locale-provider";
import type { WebAccount } from "@/hooks/use-web-account";

export function WebAccountCard({
  account,
  onRefresh,
  onLogout,
  plain = false,
}: {
  account: WebAccount;
  onRefresh: () => void;
  onLogout: () => void;
  plain?: boolean;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [maxUrl, setMaxUrl] = useState<string | null>(null);
  const [vpn, setVpn] = useState(false);
  const [maxOff, setMaxOff] = useState(false);
  const [busy, setBusy] = useState<"telegram" | "max" | "off" | null>(null);
  const linked = account.telegramLinked || account.maxLinked;

  async function connectTelegram() {
    setBusy("telegram");
    setVpn(false);
    try {
      const res = await fetch("/api/account/link", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string | null;
        linked?: boolean;
        vpn?: boolean;
      };
      if (data.linked) {
        onRefresh();
        return;
      }
      if (data.vpn) setVpn(true);
      if (data.url) setUrl(data.url);
    } finally {
      setBusy(null);
    }
  }

  async function connectMax() {
    setBusy("max");
    setMaxOff(false);
    try {
      const res = await fetch("/api/account/link/max", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string | null;
        linked?: boolean;
        error?: string;
      };
      if (data.linked) {
        onRefresh();
        return;
      }
      if (data.error === "max_off") {
        setMaxOff(true);
        return;
      }
      if (data.url) setMaxUrl(data.url);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(messenger: "telegram" | "max") {
    setBusy("off");
    try {
      const res = await fetch("/api/account/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messenger }),
      });
      if (res.ok) {
        setUrl(null);
        setMaxUrl(null);
        onRefresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    onLogout();
  }

  return (
    <section className={plain ? "" : "glass rounded-3xl p-4"}>
      {plain ? null : (
        <h2 className="font-display text-base tracking-tight text-foreground">{t("webAccount")}</h2>
      )}
      {account.email ? <p className="mt-1 truncate text-sm text-muted-foreground">{account.email}</p> : null}
      {account.providers?.length ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {account.providers
            .map((provider) => t(provider === "vk" ? "webVk" : provider === "yandex" ? "webYandex" : "webSber"))
            .join(" · ")}
        </p>
      ) : null}
      {linked ? null : (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-relaxed text-foreground">{t("webBotOffer")}</p>
          {vpn ? (
            <p className="text-sm leading-relaxed text-muted-foreground" role="status">
              {t("webBotVpn")}
            </p>
          ) : null}
          {maxOff ? (
            <p className="text-sm leading-relaxed text-muted-foreground" role="status">
              {t("webMaxOff")}
            </p>
          ) : null}
          <div className="grid gap-2">
            {url ? (
              <a
                href={url}
                className="inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
                onClick={() => {
                  window.setTimeout(onRefresh, 1500);
                }}
              >
                {t("webConnectBot")}
              </a>
            ) : (
              <Button type="button" className="w-full" disabled={busy !== null} onClick={() => void connectTelegram()}>
                {t("webConnectBot")}
              </Button>
            )}
            {maxUrl ? (
              <a
                href={maxUrl}
                className="inline-flex h-10 w-full items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-fill)] px-4 text-sm font-medium text-foreground"
                onClick={() => {
                  window.setTimeout(onRefresh, 1500);
                }}
              >
                {t("webConnectMax")}
              </a>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy !== null}
                onClick={() => void connectMax()}
              >
                {t("webConnectMax")}
              </Button>
            )}
          </div>
        </div>
      )}
      {account.telegramLinked ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-foreground">{t("webBotLinked")}</p>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={busy !== null}
            onClick={() => void disconnect("telegram")}
          >
            {t("webBotDisconnect")}
          </Button>
        </div>
      ) : null}
      {account.maxLinked ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-foreground">{t("webMaxLinked")}</p>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={busy !== null}
            onClick={() => void disconnect("max")}
          >
            {t("webBotDisconnect")}
          </Button>
        </div>
      ) : null}
      <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => void logout()}>
        {t("webLogout")}
      </Button>
    </section>
  );
}
