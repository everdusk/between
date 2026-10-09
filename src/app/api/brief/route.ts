import { NextResponse } from "next/server";
import {
  cacheBrief,
  getCachedBrief,
  redisConfigured,
  takeBriefAttempt,
} from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import { todayInTimeZone } from "@/lib/zoned";

const SYSTEM = [
  "Ты помогаешь человеку собрать короткий бриф к сеансу психотерапии.",
  "Используй только факты ниже. Не ставь диагнозы, не давай советов, не выдумывай события и цитаты.",
  "Напиши по-русски три коротких абзаца: как прошла неделя по состояниям, какие темы повторялись, что вынести на сеанс.",
  "Если фактов мало, так и напиши.",
].join(" ");

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
): Promise<{ text: string | null; status: number }> {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: 1024,
    temperature: 0.4,
  };
  if (thinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM}\n\nФакты:\n${prompt}` }] }],
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

async function gemini(prompt: string, apiKey: string): Promise<{ text: string | null; detail: string }> {
  const preferred = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const first = await geminiOnce(
    prompt,
    apiKey,
    preferred,
    !preferred.startsWith("gemini-2.0"),
  );
  if (first.text) return { text: first.text, detail: "" };
  if (first.status === 401 || first.status === 403) {
    return { text: null, detail: geminiDetail(first.status) };
  }
  if (preferred !== "gemini-2.0-flash") {
    const second = await geminiOnce(prompt, apiKey, "gemini-2.0-flash", false);
    if (second.text) return { text: second.text, detail: "" };
    return { text: null, detail: geminiDetail(second.status || first.status) };
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

async function groqOnce(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<{ text: string | null; status: number }> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0.4,
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: SYSTEM },
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

async function groq(prompt: string, apiKey: string): Promise<{ text: string | null; detail: string }> {
  const preferred = resolveGroqModel(process.env.GROQ_MODEL);
  const first = await groqOnce(prompt, apiKey, preferred);
  if (first.text) return { text: first.text, detail: "" };
  if ((first.status === 400 || first.status === 404) && preferred !== GROQ_FALLBACK) {
    const second = await groqOnce(prompt, apiKey, GROQ_FALLBACK);
    if (second.text) return { text: second.text, detail: "" };
    const status = second.status || first.status;
    return { text: null, detail: status && status !== 200 ? `groq_${status}` : "groq_empty" };
  }
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
  const payload = body as { facts?: unknown; stamp?: unknown };
  const facts = typeof payload.facts === "string" ? payload.facts.trim() : "";
  const stamp = typeof payload.stamp === "string" ? payload.stamp.trim() : "";
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
    ? await gemini(facts, geminiKey)
    : await groq(facts, groqKey as string);

  if (!result.text && geminiKey && groqKey) {
    const fallback = await groq(facts, groqKey);
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
