"use client";

import { trackSurvey } from "@/lib/survey-analytics";
import type { guides } from "@/lib/guides";

export function GuideStart({ placement }: { placement: `guide_${keyof typeof guides}` }) {
  return <a className="guide-start" href="/?start=1&lang=ru"
    onClick={() => trackSurvey({ event: "web_landing_start", placement }, "ru")}>
    Начать знакомство с Between
  </a>;
}
