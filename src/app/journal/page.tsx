"use client";

import { useLayoutEffect } from "react";
import { TherapyApp } from "@/components/therapy-app";
import { holdAppSurface } from "@/lib/landing";
import "./theme.css";

export default function JournalPage() {
  useLayoutEffect(() => {
    holdAppSurface();
    document.documentElement.setAttribute("data-journal", "web");
    let scheme = "night";
    try {
      const saved = localStorage.getItem("between:scheme");
      if (saved === "day" || saved === "night") scheme = saved;
    } catch {
      /* private mode */
    }
    document.documentElement.setAttribute("data-scheme", scheme);
    return () => {
      document.documentElement.removeAttribute("data-journal");
      document.documentElement.removeAttribute("data-scheme");
    };
  }, []);
  return <TherapyApp />;
}
