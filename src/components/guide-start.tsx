"use client";

import { trackSurvey } from "@/lib/survey-analytics";

export function GuideStart({ placement }: { placement: "guide_emotions" | "guide_therapy" }) {
  return <a className="guide-start" href="/?start=1&lang=ru"
    onClick={() => trackSurvey({ event: "web_landing_start", placement }, "ru")}>
    Начать знакомство с Between
  </a>;
}
