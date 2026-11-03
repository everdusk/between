"use client";

import { useLayoutEffect } from "react";
import { TherapyApp } from "@/components/therapy-app";
import { holdAppSurface } from "@/lib/landing";
import "./theme.css";

export default function JournalPage() {
  useLayoutEffect(() => {
    holdAppSurface();
    document.documentElement.setAttribute("data-journal", "web");
    return () => document.documentElement.removeAttribute("data-journal");
  }, []);
  return <TherapyApp />;
}
