import { companionPrompt } from "./companion-prompt";
import { findPractice } from "./companion-practices";
import type { AddressGender } from "./companion-address";

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
  gender,
  previousReply,
  knowledgeBaseId,
  urgent = false,
  read,
  request = fetch,
}: {
  apiKey: string;
  base: string;
  context: object;
  message: string;
  gender?: AddressGender;
  previousReply?: string;
  knowledgeBaseId?: string;
  urgent?: boolean;
  read: (text: string) => T;
  request?: typeof fetch;
}): Promise<T> {
  if (!apiKey) throw new CompanionModelError("missing_key");

  const useSearch = !urgent && Boolean(knowledgeBaseId?.trim());
  const signal = AbortSignal.timeout(useSearch ? 40_000 : 25_000);
  const practice = urgent ? undefined : findPractice(message, previousReply);
  const addressInstruction =
    gender === "feminine"
      ? "\nОбращайся к собеседнице в женском роде («ты решила», «ты готова»). Сохраняй выбранное ты/вы. Это правило относится к собеседнице, а не к компаньону."
      : gender === "masculine"
        ? "\nОбращайся к собеседнику в мужском роде («ты решил», «ты готов»). Сохраняй выбранное ты/вы. Это правило относится к собеседнику, а не к компаньону."
        : "";
  const attempts = useSearch ? ["search", "json", "plain"] : ["json", "plain"];
  for (const attempt of attempts) {
    const search = attempt === "search";
    const structured = attempt !== "plain";
    const messages = [
      {
        role: "system",
        content:
          (search
            ? companionPrompt +
              "\nЕсли для продолжения беседы пригодится приём, поищи в базе практик по смыслу текущей ситуации с учётом последних реплик. Задай один короткий обезличенный поисковый запрос без имён, идентификаторов и цитат из дневника. Учти, случилось ли это, лишь ожидается или уже стало легче. Для обычной беседы поиск необязателен. Карточки содержат методические примеры, а не факты о собеседнике. Верни обычный JSON."
            : practice
              ? companionPrompt +
                "\nПодсказка для этой реплики: " +
                practice.guidance
              : companionPrompt) + addressInstruction,
      },
      { role: "user", content: JSON.stringify(context) },
      { role: "user", content: message },
    ];
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
        ...(search && {
          tools: [
            {
              type: "aitunnel:file_search",
              parameters: {
                knowledge_base_ids: [knowledgeBaseId!.trim()],
                max_results: 2,
                max_uses: 1,
                rerank: false,
              },
            },
          ],
        }),
        ...(structured && { response_format: { type: "json_object" } }),
        messages,
      }),
    });
    if (!response.ok) {
      if (
        (structured && [400, 422, 502, 503].includes(response.status)) ||
        (search && [403, 404].includes(response.status))
      ) {
        if (search)
          console.warn("companion_search_fallback", {
            status: response.status,
          });
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
        searches: usage.server_tool_use?.file_search_requests ?? 0,
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
