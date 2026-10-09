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

async function gemini(prompt: string, apiKey: string): Promise<string | null> {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM}\n\nФакты:\n${prompt}` }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
      }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  return text || null;
}

async function groq(prompt: string, apiKey: string): Promise<string | null> {
  const model = process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Факты:\n${prompt}` },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || null;
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

  const text = geminiKey
    ? await gemini(facts, geminiKey)
    : await groq(facts, groqKey as string);

  if (!text) {
    return NextResponse.json({ ok: true, text: null, reason: "model_failed" });
  }

  if (redisConfigured()) {
    await cacheBrief(validated.user.id, stamp, text);
  }
  return NextResponse.json({ ok: true, text });
}
