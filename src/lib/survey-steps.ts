import { authOperations, registrationReason } from "./registration-errors";
import { validMessengerChoices } from "./intro-messengers";
import { questions, type SurveyFeeling } from "./intro-questions";

export const noteStep: Record<SurveyFeeling, string> = {
  тревожно: "note_worry", злость: "note_anger", усталость: "note_tired",
  грусть: "note_sad", стыд: "note_shame", пусто: "note_empty",
  напряжение: "note_tense", спокойно: "note_calm", радость: "note_joy",
};

const stepTitles: Record<string, string> = {
  v2_messengers: "Мессенджеры", v2_bot_demo: "Пример чата с ботом",
  v2_therapy_first: "Терапия · первый вопрос", v2_gender_after_therapy: "Пол",
  ...Object.fromEntries(["gender","name","therapy","recent","current","spectrum","situation","clarification","observation"].map((id,i)=>["v2_"+id,["Пол","Имя","Терапия","Чувство в последнее время","Чувство сейчас","Спектр","Ситуация","Уточнение","Наблюдение"][i]])),
  name: "Как вас зовут?", therapy: "Вы занимаетесь с психотерапевтом?",
  mood_morning: "Чувства · утро", mood_day: "Чувства · день", mood_evening: "Чувства · вечер",
  focus: "Какое чувство разобрать?", another: "Разобрать ещё одно чувство?",
  first_note: "Первая запись · свободная тема",
  ...Object.fromEntries(Object.entries(noteStep).map(([f, id]) => [id, `Первая запись · ${f}`])),
  ...Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, q.title[0]])),
};

/** Accept only known screens and navigation actions. Never forward arbitrary properties. */
export function surveyProperties(data: Record<string, unknown>): Record<string, unknown> | null {
  if (data.locale !== "ru" && data.locale !== "en") return null;
  const common = { messenger: "web", locale: data.locale, survey_version: typeof data.question === "string" && data.question.startsWith("v2_") ? 2 : 1 };
  if (data.event === "web_registration_step") {
    if (typeof data.attempt !== "string" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(data.attempt) ||
        (data.source !== "direct" && data.source !== "survey") ||
        typeof data.stage !== "string" || !["form_view","email_started","email_submitted","code_requested","code_submitted","email_registered","messenger_started","signed_in","error","result_view"].includes(data.stage) ||
        typeof data.method !== "string" || !["form","email","password","telegram","max"].includes(data.method)) return null;
    return { ...common, attempt_id: data.attempt, registration_source: data.source, registration_step: data.stage, method: data.method,
      ...(data.stage === "error" && authOperations.some(op => op === data.operation)
        ? { error_operation: data.operation, error_reason: registrationReason(data.reason) } : {}),
    };
  }
  if (data.event === "web_landing_start") {
    return ["hero", "footer", "guide_emotions", "guide_therapy", "guide_worry", "guide_anger"].includes(String(data.placement)) && typeof data.placement === "string"
      ? { ...common, placement: data.placement } : null;
  }
  if (data.event !== "web_survey_step" || typeof data.question !== "string" ||
      !Object.hasOwn(stepTitles, data.question) ||
      typeof data.attempt !== "string" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(data.attempt) ||
      typeof data.sequence !== "number" || !Number.isSafeInteger(data.sequence) || data.sequence < 1 ||
      !["view", "advance", "back", "login", "finish"].includes(String(data.action)) || typeof data.action !== "string") return null;
  return { ...common, question_id: data.question, question_title: stepTitles[data.question],
    ...(data.question === "v2_messengers" && data.action === "advance" && validMessengerChoices(data.messengers)
      ? { selected_messengers: data.messengers } : {}),
    survey_action: data.action, attempt_id: data.attempt, sequence: data.sequence };
}
