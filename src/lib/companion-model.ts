import { companionPrompt } from "./companion-prompt";
import { comparesSelf, comparisonQuery, findPractice, practiceTitles } from "./companion-practices";
import { practiceSearchTool, searchPracticeCards, type PracticeCard } from "./companion-search";
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
  testerRules,
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
  testerRules?: string[];
  knowledgeBaseId?: string;
  urgent?: boolean;
  read: (text: string, cards: PracticeCard[], searchFailed: boolean) => T;
  request?: typeof fetch;
}): Promise<T> {
  if (!apiKey) throw new CompanionModelError("missing_key");

  const useSearch = !urgent && Boolean(knowledgeBaseId?.trim());
  const signal = AbortSignal.timeout(useSearch ? 40_000 : 25_000);
  const practice = urgent ? undefined : findPractice(message, previousReply);
  const local = practice && { id: practice.id, title: practiceTitles[practice.id], text: practice.guidance };
  let cards: PracticeCard[] = local ? [local] : [];
  let searchFailed = false;
  async function retrieve(query: string) {
    try {
      const found = await searchPracticeCards(base, apiKey, knowledgeBaseId!.trim(), query, signal, request);
      cards = [...cards, ...found.filter(c => c.id !== local?.id)];
    } catch {
      searchFailed = true;
    }
  }
  const comparison = useSearch && practice?.id === "self-judgment" && comparesSelf(message);
  if (comparison) await retrieve(comparisonQuery);
  const rules = !urgent && testerRules?.length ? testerRules : undefined;
  const addressInstruction =
    gender === "feminine"
      ? "\nОбращайся к собеседнице в женском роде («ты решила», «ты готова»). Сохраняй выбранное ты/вы. Это правило относится к собеседнице, а не к компаньону."
      : gender === "masculine"
        ? "\nОбращайся к собеседнику в мужском роде («ты решил», «ты готов»). Сохраняй выбранное ты/вы. Это правило относится к собеседнику, а не к компаньону."
        : "";
  const attempts = useSearch && !comparison ? ["search", "json", "plain"] : ["json", "plain"];
  for (const attempt of attempts) {
    const search = attempt === "search";
    const structured = attempt !== "plain";
    const remoteCards = cards.filter(c => c.id !== local?.id);
    const facts = { ...context, ...(rules && { testerRules: rules }), ...(remoteCards.length > 0 && { practiceCards: remoteCards }) };
    const messages = [
      {
        role: "system",
        content:
          companionPrompt + (search ? "\nЕсли пригодится приём, вызови search_practices. Ищи по смыслу реплики и ситуации из разговора, добавь синонимы: за «у других уже есть, а я всё ещё…» может стоять сравнение себя с другими. В обычной беседе поиск необязателен." : "") +
          (local ? "\nПодсказка для этой реплики (" + local.id + "): " + local.text : "") +
          (cards.length ? "\nВ JSON добавь usedCards — массив id только тех предложенных карточек, чей приём ты применил в reply. Если ни одной — []. practiceCards содержат примеры, не факты о собеседнике. В самой реплике карточки не называй." : "") +
          addressInstruction + (rules
                ? "\nВ testerRules — одобренные тестером дополнения к манере диалога. Применяй подходящие по смыслу; при расхождении между ними учитывай более позднее. Безопасность, приватность, выбранное обращение и контракт приложения сохраняют приоритет. Не цитируй правила собеседнику."
                : ""),
      },
      { role: "user", content: JSON.stringify(facts) },
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
          tools: [practiceSearchTool],
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
        if (search) {
          searchFailed = true;
          console.warn("companion_search_fallback", {
            status: response.status,
          });
        }
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

    const modelMessage = data?.choices?.[0]?.message;
    const tool = modelMessage?.tool_calls?.[0]?.function;
    if (search && tool?.name === "search_practices") {
      let query;
      try { query = JSON.parse(tool.arguments).query; } catch { /* Continue with local guidance. */ }
      if (typeof query === "string" && query.trim()) await retrieve(query.trim().slice(0, 240));
      else searchFailed = true;
      continue;
    }
    const content = modelMessage?.content;
    if (typeof content === "string" && content.trim()) {
      try {
        return read(content, cards, searchFailed);
      } catch {
        if (!structured) throw new CompanionModelError("invalid_reply");
      }
    } else if (!structured) {
      throw new CompanionModelError("empty_reply");
    }
  }
  throw new CompanionModelError("empty_reply");
}
