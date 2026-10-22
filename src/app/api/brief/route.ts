import { NextResponse } from "next/server";
import { parseModelBacklog } from "@/lib/brief";
import { isLocale, modelLanguageName, type LocaleId } from "@/lib/i18n";
import {
  cacheBrief,
  getCachedBrief,
  redisConfigured,
  takeBriefAttempt,
} from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import { todayInTimeZone } from "@/lib/zoned";

export type BriefKind = "brief" | "backlog";

type GenLimits = { temperature: number; maxTokens: number };

export function briefSystemPrompt(locale: LocaleId, kind: BriefKind = "brief"): string {
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
  const lang =
    locale === "ru"
      ? "Пиши по-русски."
      : `Пиши на языке «${modelLanguageName(locale)}». Названия состояний в фактах могут быть по-русски — в ответе передай их на языке ответа.`;
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
  if (kind === "brief") return raw;
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
): Promise<{ text: string | null; status: number }> {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: limits.maxTokens,
    temperature: limits.temperature,
  };
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
  const first = await geminiOnce(
    prompt,
    apiKey,
    preferred,
    !preferred.startsWith("gemini-2.0"),
    system,
    limits,
  );
  const firstText = settleModelText(first.text, kind);
  if (firstText) return { text: firstText, detail: "" };
  if (first.status === 401 || first.status === 403) {
    return { text: null, detail: geminiDetail(first.status) };
  }
  if (preferred !== "gemini-2.0-flash") {
    const second = await geminiOnce(prompt, apiKey, "gemini-2.0-flash", false, system, limits);
    const secondText = settleModelText(second.text, kind);
    if (secondText) return { text: secondText, detail: "" };
    if ((first.text || second.text) && kind === "backlog") {
      return { text: null, detail: "backlog_parse" };
    }
    return { text: null, detail: geminiDetail(second.status || first.status) };
  }
  if (first.text && kind === "backlog") return { text: null, detail: "backlog_parse" };
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
    (first.status === 400 || first.status === 404 || (Boolean(first.text) && kind === "backlog")) &&
    preferred !== GROQ_FALLBACK;
  if (retryModel) {
    const second = await groqOnce(prompt, apiKey, GROQ_FALLBACK, system, limits);
    const secondText = settleModelText(second.text, kind);
    if (secondText) return { text: secondText, detail: "" };
    if ((first.text || second.text) && kind === "backlog") {
      return { text: null, detail: "backlog_parse" };
    }
    const status = second.status || first.status;
    return { text: null, detail: status && status !== 200 ? `groq_${status}` : "groq_empty" };
  }
  if (first.text && kind === "backlog") return { text: null, detail: "backlog_parse" };
  return {
    text: null,
    detail: first.status && first.status !== 200 ? `groq_${first.status}` : "groq_empty",
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
  const kind: BriefKind = payload.kind === "backlog" ? "backlog" : "brief";
  const limits: GenLimits =
    kind === "backlog"
      ? { temperature: 0.2, maxTokens: 700 }
      : { temperature: 0.2, maxTokens: 480 };
  const system = briefSystemPrompt(locale, kind);
  if (!facts || facts.length > 4000 || !stamp || stamp.length > 64) {
    return NextResponse.json({ ok: false, error: "invalid_brief" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!geminiKey && !groqKey) {
    return NextResponse.json({ ok: true, text: null, reason: "no_model" });
  }

  if (redisConfigured()) {
    const cached = await getCachedBrief(validated.user.id, stamp);
    if (cached) return NextResponse.json({ ok: true, text: cached, cached: true });
    const allowed = await takeBriefAttempt(
      validated.user.id,
      todayInTimeZone(null),
    );
    if (!allowed) {
      return NextResponse.json({ ok: true, text: null, reason: "limit" });
    }
  }

  const result = geminiKey
    ? await gemini(facts, geminiKey, system, kind, limits)
    : await groq(facts, groqKey as string, system, kind, limits);

  if (!result.text && geminiKey && groqKey) {
    const fallback = await groq(facts, groqKey, system, kind, limits);
    if (fallback.text) {
      if (redisConfigured()) await cacheBrief(validated.user.id, stamp, fallback.text);
      return NextResponse.json({ ok: true, text: fallback.text });
    }
  }

  if (!result.text) {
    return NextResponse.json({
      ok: true,
      text: null,
      reason: "model_failed",
      detail: result.detail,
    });
  }

  if (redisConfigured()) {
    await cacheBrief(validated.user.id, stamp, result.text);
  }
  return NextResponse.json({ ok: true, text: result.text });
}
