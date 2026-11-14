"use client";

import { useEffect, useState, type AnchorHTMLAttributes } from "react";
import { acquisitionRef, messengerStartUrl, type AcquisitionMessenger } from "@/lib/acquisition";
import { YANDEX_METRIKA_ID } from "@/lib/landing";

type Prepared = { ref: string | null; qr?: string | null };
let prepared: Promise<Prepared> | null = null;

function clientId(): Promise<string | null> {
  return new Promise((resolve) => {
    const cookie = () => /(?:^|;\s*)_ym_uid=(\d{1,32})(?:;|$)/.exec(document.cookie)?.[1] ?? null;
    const timer = window.setTimeout(() => resolve(cookie()), 1200);
    const ym = (window as unknown as { ym?: (id: number, command: string, done: (id: string) => void) => void }).ym;
    if (!ym) { window.clearTimeout(timer); resolve(cookie()); return; }
    ym(YANDEX_METRIKA_ID, "getClientID", (id) => { window.clearTimeout(timer); resolve(id || cookie()); });
  });
}

function prepare(): Promise<Prepared> {
  if (!prepared) prepared = (async () => {
    const params = new URLSearchParams(window.location.search);
    const response = await fetch("/api/acquisition", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: await clientId(), yclid: params.get("yclid"), ref: acquisitionRef(params.get("ref")) }),
    });
    if (!response.ok) return { ref: null };
    const body = await response.json() as Prepared;
    return { ref: acquisitionRef(body.ref), qr: typeof body.qr === "string" ? body.qr : null };
  })().catch(() => ({ ref: null }));
  return prepared;
}

export function useAcquisition(): Prepared {
  const [value, setValue] = useState<Prepared>({ ref: null });
  useEffect(() => {
    let active = true;
    // The parallel landing slot can remain mounted behind a private journal.
    if (document.documentElement.getAttribute("data-between") === "app" || window.location.pathname.startsWith("/journal")) return;
    void prepare().then((result) => { if (active) setValue(result); });
    return () => { active = false; };
  }, []);
  return value;
}

export function AcquisitionLink({ messenger, children, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { messenger: AcquisitionMessenger }) {
  const { ref } = useAcquisition();
  return <a {...props} href={ref ? messengerStartUrl(messenger, ref) : `/go/${messenger}`}>{children}</a>;
}
