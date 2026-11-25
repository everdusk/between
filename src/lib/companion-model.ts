import { companionPrompt } from "./companion-prompt";
import { findPractice } from "./companion-practices";

export class CompanionModelError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function askCompanion<T>({
  apiKey,
  base,
  context,
  message,
  previousReply,
  urgent = false,
  read,
  request = fetch,
}: {
  apiKey: string;
  base: string;
  context: object;
  message: string;
  previousReply?: string;
  urgent?: boolean;
  read: (text: string) => T;
  request?: typeof fetch;
}): Promise<T> {
  if (!apiKey) throw new CompanionModelError("missing_key");

  const signal = AbortSignal.timeout(25_000);
  const practice = urgent ? undefined : findPractice(message, previousReply);
  const messages = [
    {
      role: "system",
      content: practice
        ? companionPrompt + "\nПодсказка для этой реплики: " + practice.guidance
        : companionPrompt,
    },
    { role: "user", content: JSON.stringify(context) },
    { role: "user", content: message },
  ];
  for (const structured of [true, false]) {
    const response = await request(base + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      signal,
      cache: "no-store",
      body: JSON.stringify({
        model: "gpt-6-luna",
        max_tokens: 4096,
        reasoning: { effort: "medium", exclude: true },
        ...(structured && { response_format: { type: "json_object" } }),
        messages,
      }),
    });
    if (!response.ok) {
      if (structured && [400, 422, 502, 503].includes(response.status)) {
        await response.body?.cancel();
        continue;
      }
      throw new CompanionModelError("http_" + response.status);
    }

    const data = await response.json().catch(() => null);
    const usage = data?.usage;
    if (usage)
      console.info("companion_usage", {
        input: usage.prompt_tokens,
        cached: usage.prompt_tokens_details?.cached_tokens,
        output: usage.completion_tokens,
        reasoning: usage.completion_tokens_details?.reasoning_tokens,
        rub: usage.cost_rub,
      });

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      try {
        return read(content);
      } catch {
        if (!structured) throw new CompanionModelError("invalid_reply");
      }
    } else if (!structured) {
      throw new CompanionModelError("empty_reply");
    }
  }
  throw new CompanionModelError("empty_reply");
}
