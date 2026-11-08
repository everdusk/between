"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { keptAccount } from "@/lib/account-refresh";

export type WebAccount = {
  email: string;
  telegramLinked: boolean;
  maxLinked?: boolean;
  providers?: ("vk" | "yandex" | "sber")[];
};

type Status = "idle" | "loading" | "ready" | "unavailable";

export function useWebAccount(active: boolean) {
  const [status, setStatus] = useState<Status>(active ? "loading" : "idle");
  const [account, setAccountState] = useState<WebAccount | null>(null);
  const epoch = useRef(0);
  const refreshId = useRef(0);

  const setAccount = useCallback((next: WebAccount | null) => {
    epoch.current += 1;
    setAccountState(next);
    if (next) setStatus("ready");
  }, []);

  const refresh = useCallback(async () => {
    if (!active) return;
    const seenEpoch = epoch.current;
    const id = ++refreshId.current;
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      if (seenEpoch !== epoch.current) return;
      if (!res.ok) {
        if (id !== refreshId.current) return;
        setStatus((current) => (current === "ready" ? current : "unavailable"));
        return;
      }
      const data = (await res.json()) as { account?: WebAccount | null };
      const incoming = data.account ?? null;
      const fresh = id === refreshId.current;
      if (!incoming && !fresh) return;
      setAccountState((current) => keptAccount(current, incoming, fresh));
      setStatus("ready");
    } catch {
      if (seenEpoch !== epoch.current || id !== refreshId.current) return;
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
