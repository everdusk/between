import { analyticsStaysQuiet, deviceToken } from "./analytics-client";

export type SurveyAction = "view" | "advance" | "back" | "login" | "finish";
export type SurveyEvent =
  | { event: "web_landing_start"; placement: "hero" | "footer" }
  | { event: "web_survey_step"; action: SurveyAction; question: string; attempt: string; sequence: number };

export function trackSurvey(detail: SurveyEvent, locale: string) {
  if (analyticsStaysQuiet()) return;
  const device = deviceToken();
  if (!device) return;
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Between-Device": device },
    keepalive: true,
    body: JSON.stringify({ ...detail, locale: locale === "en" ? "en" : "ru" }),
  }).catch(() => undefined);
}
