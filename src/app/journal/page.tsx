"use client";

import { useLayoutEffect } from "react";
import { TherapyApp } from "@/components/therapy-app";
import { holdAppSurface } from "@/lib/landing";

export default function JournalPage() {
  useLayoutEffect(() => {
    holdAppSurface();
  }, []);
  return <TherapyApp />;
}
