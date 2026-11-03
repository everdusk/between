"use client";

import { useCallback, useEffect, useState } from "react";

export type WebAccount = {
  email: string;
  telegramLinked: boolean;
  providers?: ("vk" | "yandex" | "sber")[];
};

type Status = "idle" | "loading" | "ready" | "unavailable";

export function useWebAccount(active: boolean) {
  const [status, setStatus] = useState<Status>(active ? "loading" : "idle");
  const [account, setAccount] = useState<WebAccount | null>(null);

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      if (!res.ok) {
        setStatus((current) => (current === "ready" ? current : "unavailable"));
        return;
      }
      const data = (await res.json()) as { account?: WebAccount | null };
      setAccount(data.account ?? null);
      setStatus("ready");
    } catch {
      setStatus((current) => (current === "ready" ? current : "unavailable"));
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      setStatus("idle");
      setAccount(null);
      return;
    }
    setStatus("loading");
    void refresh();
  }, [active, refresh]);

  useEffect(() => {
    if (!active) return;
    function onVisible() {
      if (document.visibilityState === "hidden") return;
      void refresh();
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, refresh]);

  return { status, account, refresh, setAccount };
}
