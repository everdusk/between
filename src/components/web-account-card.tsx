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
  const [busy, setBusy] = useState(false);

  async function disconnect(messenger: "telegram" | "max") {
    setBusy(true);
    try {
      const res = await fetch("/api/account/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messenger }),
      });
      if (res.ok) {
        onRefresh();
      }
    } finally {
      setBusy(false);
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
      {account.telegramLinked ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-foreground">{t("webBotLinked")}</p>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={busy}
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
            disabled={busy}
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
