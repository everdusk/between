"use client";

import { useLayoutEffect } from "react";
import { TherapyApp } from "@/components/therapy-app";
import { WeekPriceProvider } from "@/components/week-prices";
import { holdAppSurface } from "@/lib/landing";
import "./web-theme.css";
import "./web-workspace.css";

/** A separate browser entry. The messenger entry at /journal keeps its UI. */
export function WebApp({ starPrice, rubPrice }: { starPrice: number; rubPrice: number }) {
  useLayoutEffect(() => {
    holdAppSurface();
    document.documentElement.setAttribute("data-journal", "web");
    let scheme = "night";
    try {
      const saved = localStorage.getItem("between:scheme");
      if (saved === "day" || saved === "night") scheme = saved;
    } catch { /* private mode */ }
    document.documentElement.setAttribute("data-scheme", scheme);
    return () => {
      document.documentElement.removeAttribute("data-journal");
      document.documentElement.removeAttribute("data-scheme");
    };
  }, []);
  return <WeekPriceProvider starPrice={starPrice} rubPrice={rubPrice}><TherapyApp webFirst /></WeekPriceProvider>;
}
