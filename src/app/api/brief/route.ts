import { NextResponse } from "next/server";
import { parseModelBacklog } from "@/lib/brief";
import { parseModelThemes, THERAPY_THEMES } from "@/lib/tags";
import { parseDedupHit, parseJudgeVerdict } from "@/lib/themes";
import { isLocale, modelLanguageName, type LocaleId } from "@/lib/i18n";
import {
  cacheBrief,
  getCachedBrief,
  redisConfigured,
  takeBriefAttempt,
} from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import { todayInTimeZone } from "@/lib/zoned";

export type BriefKind = "brief" | "backlog" | "themes" | "judge" | "dedup" | "pattern";

function settlesJson(kind: BriefKind): boolean {
  return kind === "backlog" || kind === "themes" || kind === "judge" || kind === "dedup";
}

/** Daily stop per kind. A cached stamp does not count. */
export function modelBudget(kind: BriefKind): { limit: number; bucket: string } {
  if (kind === "judge" || kind === "dedup") return { limit: 30, bucket: "judge" };
  if (kind === "themes") return { limit: 10, bucket: "themes" };
  if (kind === "pattern") return { limit: 8, bucket: "pattern" };
  return { limit: 8, bucket: "brief" };
}

type GenLimits = { temperature: number; maxTokens: number };

export function briefSystemPrompt(locale: LocaleId, kind: BriefKind = "brief"): string {
  const lang =
    locale === "ru"
      ? "Пиши по-русски."
      : `Пиши на языке «${modelLanguageName(locale)}».`;
  if (kind === "judge") {
    return [
      "Ты решаешь, относится ли одна запись дневника к подготовке к сеансу психотерапии.",
      "Ответ — только один JSON-объект, без markdown.",
      '{"relevant":true,"match_theme":null,"intensity":1,"new_theme":null,"confidence":0.5,"quote":"","reason":""}',
      "relevant: быт без эмоционального заряда — false. intensity — заряд 1–10.",
      "match_theme: id открытой темы, если это ТА ЖЕ проблема (тот же человек, ситуация или паттерн), иначе null.",
      "Одна запись — максимум одна тема. «Мама звонила», «поругались про праздник», «мама обиделась» — одна тема.",
      "new_theme: {\"title\":\"...\"} только если relevant=true и match_theme=null. title — паттерн, не событие: «конфликты с мамой из-за границ», не «поругалась из-за телефона».",
      "Если relevant=false, new_theme=null.",
      "«Всё нормально» при высокой отметке тревоги — relevant=true, решает интенсивность.",
      "Отметка тяжело, стыд, пусто, тревожно, злость, грусть или напряжение значит relevant=true и intensity не ниже 8. Если match_theme=null, new_theme обязателен.",
      "Спокойная отметка при длинном тяжёлом тексте — relevant=true, intensity ставь по тексту, не по отметке.",
      "Разовый мелкий негатив без повторяющегося паттерна — relevant=false.",
      "quote — дословная фраза из записи, не длиннее 140 символов, не пересказ. Ничего не выдумывать.",
      "confidence — 0–1. reason — одно предложение.",
      "Темы с dismissed не приходят во вход. Не предлагай их заново.",
      lang,
    ].join(" ");
  }
  if (kind === "dedup") {
    return [
      "Сравни одну тему с открытыми темами. Это одна и та же проблема, или нет?",
      "Ответ — только JSON. Если нет: {\"same\":false}.",
      "Если да: {\"same\":true,\"theme_id\":\"id соседа\",\"confidence\":0.9,\"title\":\"общий паттерн\"}.",
      "theme_id скопируй из списка. title — паттерн по объединённым цитатам, не новый эпизод.",
      "confidence ниже 0.85 не ставь, если сомневаешься: верни same=false.",
      lang,
    ].join(" ");
  }
  if (kind === "pattern") {
    return [
      "По JSON тем напиши 2 или 3 предложения: что здесь выглядит как повторяющийся паттерн.",
      "Только то, что есть в JSON. Без совета, без диагноза, без утешения, без общих фраз вроде «вы испытывали разные эмоции».",
      "Если паттерна не видно, верни пустую строку.",
      lang,
    ].join(" ");
  }
  if (kind === "themes") {
    return [
      "Для каждой заметки выбери темы психотерапии, о которых она на самом деле.",
      `Темы только из списка: ${THERAPY_THEMES.join(", ")}.`,
      "Решай по смыслу заметки, не по отдельным словам. Слово еда, дом, друзья, мама или сон само по себе не тема.",
      "Быт, место, вкусный ужин и пересказ сна не размечай. Если за этим видна тема из списка — поставь её, не больше трёх.",
      "Отметка чувства в скобках не делает тему. Нет подходящей темы — themes: [].",
      "Не выдумывай темы вне списка. Без совета, без диагноза, без утешения.",
      "Верни только JSON-массив без markdown. На каждую заметку один объект {\"id\":\"...\",\"themes\":[\"...\"]}. id скопируй как в фактах.",
    ].join(" ");
  }
  if (kind === "backlog") {
    const lang =
      locale === "ru"
        ? "Пиши text по-русски."
        : `Пиши text на языке «${modelLanguageName(locale)}». Названия состояний в фактах могут быть по-русски — в text передай их на языке ответа.`;
    return [
      "Прочитай заметки как историю недели и собери список тем к сеансу психотерапии.",
      "Важность решай по тому, что произошло в тексте: тянет ли это человека, есть ли конфликт, выбор, боль, потеря или отношения, у которых в самой заметке есть вес.",
      "Не поднимай тему только потому, что в тексте есть слово тревога, мама, работа или еда, и не потому, что отметка или тема повторилась. Отметка чувства — пометка человека, не оценка важности.",
      "Пропусти быт, в котором для сеанса ничего не происходит. Оставь быт, если из текста видно, что за ним стоит что-то, о чём человеку есть говорить.",
      "Верни только JSON-массив, без пояснений и без markdown. Не больше 7 объектов вида {\"text\":\"...\",\"priority\":\"high\"}.",
      "priority — только high, mid или low.",
      "high — в тексте видно, что это давит, не отпускает, или человек сам вынес это на сеанс.",
      "mid — ясный эпизод, который стоит назвать.",
      "low — упомянуто вскользь, без веса в самой заметке.",
      "Строки из блока «человек сам записал к сеансу» оставь, если в них есть о чём говорить, и ставь им high.",
      "text — сам эпизод из заметки, до 80 символов. Не пиши ярлык и число вроде «еда — 2» или «тревожно — 2».",
      "Без совета, без диагноза, без утешения.",
      "Если по контексту тем к сеансу нет, верни [].",
      lang,
    ].join(" ");
  }
  return [
    "Ты собираешь факты к сеансу психотерапии.",
    "Используй только факты ниже. Не ставь диагнозы, не давай советов, не утешай, не интерпретируй и не выдумывай события.",
    "Формат: короткие пункты, каждый с новой строки, начинается с «— ». Один пункт — один факт, с датой или числом повторов.",
    "Без вступления и без заключения. Не повторяй одну мысль. Если фактов мало, перечисли их и остановись.",
    lang,
  ].join(" ");
}

function settleModelText(raw: string | null, kind: BriefKind): string | null {
  if (!raw) return null;
  if (kind === "brief" || kind === "pattern") return raw;
  if (kind === "themes") {
    const parsed = parseModelThemes(raw);
    if (parsed === null) return null;
    return JSON.stringify(parsed);
  }
  if (kind === "judge") {
    const parsed = parseJudgeVerdict(raw);
    return parsed ? JSON.stringify(parsed) : null;
  }
  if (kind === "dedup") {
    const parsed = parseDedupHit(raw);
    return JSON.stringify(
      parsed
        ? { same: true, theme_id: parsed.themeId, confidence: parsed.confidence, title: parsed.title }
        : { same: false },
    );
  }
  const parsed = parseModelBacklog(raw);
  if (parsed === null) return null;
  return JSON.stringify(parsed);
}

type GeminiPart = { text?: string; thought?: boolean };

export function textFromGeminiParts(parts: GeminiPart[] | undefined): string {
  return (parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

async function geminiOnce(
  prompt: string,
  apiKey: string,
  model: string,
  thinking: boolean,
  system: string,
  limits: GenLimits,
  json = false,
): Promise<{ text: string | null; status: number }> {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: limits.maxTokens,
    temperature: limits.temperature,
  };
  if (json) generationConfig.responseMimeType = "application/json";
  if (thinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\nФакты:\n${prompt}` }] }],
        generationConfig,
      }),
    },
  );
  if (!res.ok) return { text: null, status: res.status };
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] } }[];
  };
  const text = textFromGeminiParts(data.candidates?.[0]?.content?.parts);
  return { text: text || null, status: res.status };
}

function geminiDetail(status: number): string {
  return status && status !== 200 ? `gemini_${status}` : "gemini_empty";
}

async function gemini(
  prompt: string,
  apiKey: string,
  system: string,
  kind: BriefKind,
  limits: GenLimits,
): Promise<{ text: string | null; detail: string }> {
  const preferred = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const json = kind === "judge" || kind === "dedup";
  const first = await geminiOnce(
    prompt,
    apiKey,
    preferred,
    !preferred.startsWith("gemini-2.0"),
    system,
    limits,
    json,
  );
  const firstText = settleModelText(first.text, kind);
  if (firstText) return { text: firstText, detail: "" };
  if (first.status === 401 || first.status === 403) {
    return { text: null, detail: geminiDetail(first.status) };
  }
  if (preferred !== "gemini-2.0-flash") {
    const second = await geminiOnce(prompt, apiKey, "gemini-2.0-flash", false, system, limits, json);
    const secondText = settleModelText(second.text, kind);
    if (secondText) return { text: secondText, detail: "" };
    if ((first.text || second.text) && settlesJson(kind)) {
      return { text: null, detail: kind === "themes" ? "themes_parse" : "backlog_parse" };
    }
    return { text: null, detail: geminiDetail(second.status || first.status) };
  }
  if (first.text && settlesJson(kind)) {
    return { text: null, detail: kind === "themes" ? "themes_parse" : "backlog_parse" };
  }
  return { text: null, detail: geminiDetail(first.status) };
}

const GROQ_FALLBACK = "openai/gpt-oss-20b";

/** Groq shut these off for free and developer keys on 2026-08-16. */
const RETIRED_GROQ_MODELS = new Set([
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
]);

export function resolveGroqModel(configured: string | undefined): string {
  const name = configured?.trim();
  if (!name || RETIRED_GROQ_MODELS.has(name)) return GROQ_FALLBACK;
  return name;
}

export const AITUNNEL_MODEL = "~deepseek/deepseek-v4-flash-latest";

const RETIRED_AITUNNEL_MODELS = new Set([
  "deepseek-v4.1-flash-1017",
  "deepseek/deepseek-v4.1-flash-1017",
]);

export function resolveAitunnelModel(configured: string | undefined): string {
  const name = configured?.trim();
  if (!name || RETIRED_AITUNNEL_MODELS.has(name)) return AITUNNEL_MODEL;
  return name;
}

/** Vercel values often keep quotes, a Bearer prefix, or a line break from the paste. */
export function normalizeAitunnelKey(raw: string | undefined): string {
  let key = raw?.trim() ?? "";
  if (
    (key.startsWith('"') && key.endsWith('"') && key.length >= 2) ||
    (key.startsWith("'") && key.endsWith("'") && key.length >= 2)
  ) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/^Bearer\s+/i, "").replace(/\s+/g, "");
}

export function aitunnelKeyProblem(key: string): "shape" | null {
  if (!key) return "shape";
  if (!key.startsWith("sk-aitunnel-")) return "shape";
  return null;
}

function clipProviderMessage(raw: string): string {
  const text = raw.replace(/sk-[a-z0-9_-]+/gi, "sk-…").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function readLooseText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const visible = value
      .filter((part) => {
        if (!part || typeof part !== "object") return true;
        const row = part as { type?: unknown; thought?: unknown };
        return row.thought !== true && row.type !== "reasoning" && row.type !== "thinking";
      })
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("")
      .trim();
    if (visible) return visible;
  }
  if (value && typeof value === "object" && typeof (value as { content?: unknown }).content === "string") {
    return (value as { content: string }).content.trim();
  }
  return "";
}

/** DeepSeek often leaves content empty and puts the answer in reasoning. */
export function textFromChatMessage(
  message: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown } | undefined,
  prose = false,
): string {
  const content = readLooseText(message?.content);
  if (content) return content;
  const thought = readLooseText(message?.reasoning) || readLooseText(message?.reasoning_content);
  if (!thought) return "";
  if (!prose || thought.length < 700) return thought;
  const parts = thought
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1] ?? thought;
  return last.length >= 20 ? last : thought;
}

function aitunnelBase(): string {
  const raw = process.env.AITUNNEL_BASE_URL?.trim() || "https://api.aitunnel.ru/v1";
  return raw.replace(/\/+$/, "");
}

async function groqOnce(
  prompt: string,
  apiKey: string,
  model: string,
  system: string,
  limits: GenLimits,
): Promise<{ text: string | null; status: number }> {
  const body: Record<string, unknown> = {
    model,
    temperature: limits.temperature,
    max_completion_tokens: limits.maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Факты:\n${prompt}` },
    ],
  };
  if (model.includes("gpt-oss")) body.reasoning_effort = "low";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { text: null, status: res.status };
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  return { text: text || null, status: res.status };
}

async function groq(
  prompt: string,
  apiKey: string,
  system: string,
  kind: BriefKind,
  limits: GenLimits,
): Promise<{ text: string | null; detail: string }> {
  const preferred = resolveGroqModel(process.env.GROQ_MODEL);
  const first = await groqOnce(prompt, apiKey, preferred, system, limits);
  const firstText = settleModelText(first.text, kind);
  if (firstText) return { text: firstText, detail: "" };
  const retryModel =
    (first.status === 400 || first.status === 404 || (Boolean(first.text) && settlesJson(kind))) &&
    preferred !== GROQ_FALLBACK;
  if (retryModel) {
    const second = await groqOnce(prompt, apiKey, GROQ_FALLBACK, system, limits);
    const secondText = settleModelText(second.text, kind);
    if (secondText) return { text: secondText, detail: "" };
    if ((first.text || second.text) && settlesJson(kind)) {
      return { text: null, detail: kind === "themes" ? "themes_parse" : "backlog_parse" };
    }
    const status = second.status || first.status;
    return { text: null, detail: status && status !== 200 ? `groq_${status}` : "groq_empty" };
  }
  if (first.text && settlesJson(kind)) {
    return { text: null, detail: kind === "themes" ? "themes_parse" : "backlog_parse" };
  }
  return {
    text: null,
    detail: first.status && first.status !== 200 ? `groq_${first.status}` : "groq_empty",
  };
}

async function aitunnelOnce(
  prompt: string,
  apiKey: string,
  model: string,
  system: string,
  kind: BriefKind,
  limits: GenLimits,
  direct: boolean,
): Promise<{ text: string | null; status: number; message: string }> {
  const json = kind === "judge" || kind === "dedup";
  const body: Record<string, unknown> = {
    model,
    temperature: limits.temperature,
    max_tokens: Math.max(limits.maxTokens, direct ? 2048 : 4096),
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Факты:\n${prompt}` },
    ],
  };
  if (direct) {
    body.reasoning = { effort: "none" };
    if (json) body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${aitunnelBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = "";
    try {
      const data = (await res.json()) as { error?: { message?: unknown } };
      if (typeof data.error?.message === "string") message = clipProviderMessage(data.error.message);
    } catch {
      message = "";
    }
    return { text: null, status: res.status, message };
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown } }[];
  };
  const prose = kind === "brief" || kind === "pattern";
  const text = textFromChatMessage(data.choices?.[0]?.message, prose);
  return { text: text || null, status: res.status, message: "" };
}

async function aitunnel(
  prompt: string,
  apiKey: string,
  system: string,
  kind: BriefKind,
  limits: GenLimits,
): Promise<{ text: string | null; detail: string }> {
  const model = resolveAitunnelModel(process.env.AITUNNEL_MODEL);
  const first = await aitunnelOnce(prompt, apiKey, model, system, kind, limits, true);
  const firstText = settleModelText(first.text, kind);
  if (firstText) return { text: firstText, detail: "" };
  if (first.status === 401 || first.status === 403) {
    const detail = first.message ? `aitunnel_${first.status}:${first.message}` : `aitunnel_${first.status}`;
    return { text: null, detail };
  }
  const retry =
    first.status === 400 || first.status === 422 || (!first.text && first.status === 200);
  if (retry) {
    const second = await aitunnelOnce(prompt, apiKey, model, system, kind, limits, false);
    const secondText = settleModelText(second.text, kind);
    if (secondText) return { text: secondText, detail: "" };
    if ((first.text || second.text) && settlesJson(kind)) {
      return { text: null, detail: kind === "themes" ? "themes_parse" : "backlog_parse" };
    }
    const status = second.status || first.status;
    return { text: null, detail: status && status !== 200 ? `aitunnel_${status}` : "aitunnel_empty" };
  }
  if (first.text && settlesJson(kind)) {
    return { text: null, detail: kind === "themes" ? "themes_parse" : "backlog_parse" };
  }
  return {
    text: null,
    detail: first.status && first.status !== 200 ? `aitunnel_${first.status}` : "aitunnel_empty",
  };
}

export async function POST(req: Request) {
  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const validated = validateInitData(initData);
  if (!validated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const payload = body as {
    facts?: unknown;
    stamp?: unknown;
    locale?: unknown;
    kind?: unknown;
  };
  const facts = typeof payload.facts === "string" ? payload.facts.trim() : "";
  const stamp = typeof payload.stamp === "string" ? payload.stamp.trim() : "";
  const locale: LocaleId = isLocale(payload.locale) ? payload.locale : "ru";
  const kind: BriefKind =
    payload.kind === "backlog" ||
    payload.kind === "themes" ||
    payload.kind === "judge" ||
    payload.kind === "dedup" ||
    payload.kind === "pattern"
      ? payload.kind
      : "brief";
  const limits: GenLimits =
    kind === "backlog"
      ? { temperature: 0.2, maxTokens: 700 }
      : kind === "themes"
        ? { temperature: 0.1, maxTokens: 2000 }
        : kind === "judge"
          ? { temperature: 0.1, maxTokens: 400 }
          : kind === "dedup"
            ? { temperature: 0.1, maxTokens: 220 }
            : kind === "pattern"
              ? { temperature: 0.2, maxTokens: 220 }
              : { temperature: 0.2, maxTokens: 480 };
  const system = briefSystemPrompt(locale, kind);
  if (!facts || facts.length > 4000 || !stamp || stamp.length > 64) {
    return NextResponse.json({ ok: false, error: "invalid_brief" }, { status: 400 });
  }

  const tunnelConfigured = Boolean(process.env.AITUNNEL_API_KEY?.trim());
  const tunnelKey = normalizeAitunnelKey(process.env.AITUNNEL_API_KEY);
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!tunnelConfigured && !geminiKey && !groqKey) {
    return NextResponse.json({ ok: true, text: null, reason: "no_model" });
  }
  if (tunnelConfigured && aitunnelKeyProblem(tunnelKey)) {
    return NextResponse.json({
      ok: true,
      text: null,
      reason: "model_failed",
      detail: "aitunnel_key_shape",
    });
  }

  const budget = modelBudget(kind);
  const day = todayInTimeZone(null);
  if (redisConfigured()) {
    const cached = await getCachedBrief(validated.user.id, stamp);
    if (cached) return NextResponse.json({ ok: true, text: cached, cached: true });
    const allowed = await takeBriefAttempt(validated.user.id, day, budget.limit, budget.bucket);
    if (!allowed) {
      return NextResponse.json({ ok: true, text: null, reason: "limit" });
    }
  }

  const result = tunnelKey
    ? await aitunnel(facts, tunnelKey, system, kind, limits)
    : geminiKey
      ? await gemini(facts, geminiKey, system, kind, limits)
      : await groq(facts, groqKey as string, system, kind, limits);

  let text = result.text;
  if (!text && !tunnelKey && geminiKey && groqKey) {
    text = (await groq(facts, groqKey, system, kind, limits)).text;
  }

  if (!text) {
    return NextResponse.json({
      ok: true,
      text: null,
      reason: "model_failed",
      detail: result.detail,
    });
  }

  if (redisConfigured()) {
    await cacheBrief(validated.user.id, stamp, text);
  }
  return NextResponse.json({ ok: true, text });
}
