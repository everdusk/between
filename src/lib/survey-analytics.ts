import { analyticsStaysQuiet, deviceToken } from "./analytics-client";

export type SurveyAction = "view" | "advance" | "back" | "login" | "finish";
export type RegistrationStep = "form_view" | "email_started" | "email_submitted" | "code_requested" | "code_submitted" | "email_registered" | "messenger_started" | "signed_in" | "error" | "result_view";
export type RegistrationMethod = "form" | "email" | "password" | "telegram" | "max";
export type SurveyEvent =
  | { event: "web_registration_step"; attempt: string; source: "survey" | "direct"; stage: RegistrationStep; method: RegistrationMethod }
  | { event: "web_landing_start"; placement: "hero" | "footer" | "guide_emotions" | "guide_therapy" }
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
