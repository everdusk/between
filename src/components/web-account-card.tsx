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
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      const res = await fetch("/api/account/link", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string | null; linked?: boolean };
      if (data.linked) {
        onRefresh();
        return;
      }
      if (data.url) setUrl(data.url);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    onLogout();
  }

  return (
    <section className="glass mb-4 rounded-3xl p-5 sm:p-6">
      <h2 className="font-display text-xl tracking-tight text-foreground">{t("webAccount")}</h2>
      <p className="mt-2 truncate text-sm text-muted-foreground">{account.email}</p>
      {account.telegramLinked ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground">{t("webBotLinked")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">{t("webBotHint")}</p>
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
            <Button type="button" className="w-full" disabled={busy} onClick={() => void connect()}>
              {t("webConnectBot")}
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
