"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/locale-provider";
import type { WebAccount } from "@/hooks/use-web-account";

export function WebAccountCard({
  account,
  onRefresh,
  onLogout,
}: {
  account: WebAccount;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [maxUrl, setMaxUrl] = useState<string | null>(null);
  const [vpn, setVpn] = useState(false);
  const [maxOff, setMaxOff] = useState(false);
  const [busy, setBusy] = useState<"telegram" | "max" | null>(null);

  async function connectTelegram() {
    setBusy("telegram");
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

  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    onLogout();
  }

  return (
    <section className="glass mb-4 rounded-3xl p-5 sm:p-6">
      <h2 className="font-display text-xl tracking-tight text-foreground">{t("webAccount")}</h2>
      {account.email ? <p className="mt-2 truncate text-sm text-muted-foreground">{account.email}</p> : null}
      {account.providers?.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {account.providers
            .map((provider) => t(provider === "vk" ? "webVk" : provider === "yandex" ? "webYandex" : "webSber"))
            .join(" · ")}
        </p>
      ) : null}
      {account.telegramLinked ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground">{t("webBotLinked")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-foreground">{t("webBotHint")}</p>
          {vpn ? (
            <p
              className="rounded-2xl border border-[color:var(--glass-border)] bg-foreground/[0.06] px-3 py-2.5 text-sm leading-relaxed text-foreground"
              role="status"
            >
              {t("webBotVpn")}
            </p>
          ) : null}
          {url ? (
            <a
              href={url}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
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
        </div>
      )}
      {account.maxLinked ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground">{t("webMaxLinked")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-foreground">{t("webMaxHint")}</p>
          {maxOff ? (
            <p className="text-sm leading-relaxed text-muted-foreground" role="status">
              {t("webMaxOff")}
            </p>
          ) : maxUrl ? (
            <a
              href={maxUrl}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={() => {
                window.setTimeout(onRefresh, 1500);
              }}
            >
              {t("webConnectMax")}
            </a>
          ) : (
            <Button type="button" className="w-full" disabled={busy !== null} onClick={() => void connectMax()}>
              {t("webConnectMax")}
            </Button>
          )}
        </div>
      )}
      <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => void logout()}>
        {t("webLogout")}
      </Button>
    </section>
  );
}
