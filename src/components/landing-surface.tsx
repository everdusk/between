"use client";

import { useLayoutEffect } from "react";
import { holdAppSurface, surfaceFromLocation } from "@/lib/landing";

/** Catches a Telegram hash that arrives after the first paint. */
export function LandingSurface() {
  useLayoutEffect(() => {
    const apply = () => {
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem("__telegram__initParams");
      } catch {
        stored = null;
      }
      if (surfaceFromLocation(location.hash, location.search, stored) === "app") {
        holdAppSurface();
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  return null;
}
