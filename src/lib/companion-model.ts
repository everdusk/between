import { companionPrompt } from "./companion-prompt";
import { comparesSelf, comparisonQuery, continuesComparison, findPractice, practiceTitles, practices } from "./companion-practices";
import { practiceSearchTool, searchPracticeCards, type PracticeCard, type PracticeSearchStatus } from "./companion-search";
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
  previousMessage,
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
  previousMessage?: string;
  testerRules?: string[];
  knowledgeBaseId?: string;
  urgent?: boolean;
  read: (text: string, cards: PracticeCard[], status: PracticeSearchStatus) => T;
  request?: typeof fetch;
}): Promise<T> {
  if (!apiKey) throw new CompanionModelError("missing_key");

  const line = message.trim().toLowerCase().replace(/ё/g, "е");
  const acknowledgment = /^(?:да|нет|ага|угу|точно|наверное)[.!… ]*$/u.test(line);
  const skip = /^(?:привет|здравствуй(?:те)?|спасибо(?: большое)?|пока|понятно|доброе утро)[!.… ]*$/u.test(line) ||
    /^(?:запиши|сохрани|запомни|не записывай|не хочу обсуждать|оставим тему|покажи мои темы|пройдись по темам)(?:$|[\s:,.!])/u.test(line) ||
    (acknowledgment && !previousReply?.includes("?"));
  const useSearch = !urgent && !skip && Boolean(knowledgeBaseId?.trim());
  const signal = AbortSignal.timeout(useSearch ? 40_000 : 25_000);
  const comparison = comparesSelf(message) || continuesComparison(message, previousMessage, previousReply);
  const practice = urgent || skip ? undefined : findPractice(message, previousReply) ??
    (comparison ? practices.find(p => p.id === "self-judgment") : undefined);
  const local = practice && { id: practice.id, title: practiceTitles[practice.id], text: practice.guidance };
  let cards: PracticeCard[] = local ? [local] : [];
  let searchStatus: PracticeSearchStatus = "skipped";
  async function retrieve(query: string) {
    try {
      const found = await searchPracticeCards(base, apiKey, knowledgeBaseId!.trim(), query, signal, request);
      searchStatus = found.length;
      cards = [...cards, ...found.filter(c => c.id !== local?.id)];
    } catch {
      searchStatus = "failed";
    }
    console.info("companion_practice_search", { result: searchStatus });
  }
  const directQuery = comparison && (!practice || practice.id === "self-judgment")
    ? comparisonQuery : local?.title;
  if (useSearch && directQuery) await retrieve(directQuery);
  const rules = !urgent && testerRules?.length ? testerRules : undefined;
  const addressInstruction =
    gender === "feminine"
      ? "\nОбращайся к собеседнице в женском роде («ты решила», «ты готова»). Сохраняй выбранное ты/вы. Это правило относится к собеседнице, а не к компаньону."
      : gender === "masculine"
        ? "\nОбращайся к собеседнику в мужском роде («ты решил», «ты готов»). Сохраняй выбранное ты/вы. Это правило относится к собеседнику, а не к компаньону."
        : "";
  const attempts = useSearch && !directQuery ? ["search", "json", "plain"] : ["json", "plain"];
  const genericQuery = "Поддерживающий диалог: подхватить смысл ответа на предыдущий вопрос, учесть уточнение и продолжить без пересказа и допроса";
  for (const attempt of attempts) {
    const search = attempt === "search";
    const structured = attempt !== "plain";
    const remoteCards = cards.filter(c => c.id !== local?.id);
    const facts = { ...context, ...(rules && { testerRules: rules }), ...(remoteCards.length > 0 && { practiceCards: remoteCards }) };
    const messages = [
      {
        role: "system",
        content:
          companionPrompt + (search ? "\nСначала вызови search_practices. Определи тему по текущей реплике и последнему обмену в recent. Для короткого ответа учти вопрос, на который человек отвечает. При смене темы ищи по новой ситуации. В запросе только обобщённые термины и синонимы, без личных деталей." : "") +
          (local ? "\nПодсказка для этой реплики (" + local.id + "): " + local.text : "") +
          (cards.length ? "\nПрочти предложенные карточки. Если есть подходящий приём, используй его для следующего содержательного хода с учётом того, что человек уже объяснил. В JSON добавь usedCards — массив id только тех карточек, чей приём ты применил в reply. Если ни одной — []. practiceCards содержат примеры, не факты о собеседнике. В самой реплике карточки не называй." : "") +
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
          tool_choice: { type: "function", function: { name: "search_practices" } },
        }),
        ...(structured && !search && { response_format: { type: "json_object" } }),
        messages,
      }),
    });
    if (!response.ok) {
      if (
        (structured && [400, 422, 502, 503].includes(response.status)) ||
        (search && [403, 404].includes(response.status))
      ) {
        await response.body?.cancel();
        if (search) await retrieve(genericQuery);
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

    const modelMessage = data?.choices?.[0]?.message;
    const tool = modelMessage?.tool_calls?.[0]?.function;
    if (search) {
      let query;
      if (tool?.name === "search_practices") {
        try { query = JSON.parse(tool.arguments).query; } catch { /* Use the general practice query. */ }
      }
      await retrieve(typeof query === "string" && query.trim() ? query.trim().slice(0, 240) : genericQuery);
      continue;
    }
    const content = modelMessage?.content;
    if (typeof content === "string" && content.trim()) {
      try {
        return read(content, cards, searchStatus);
      } catch {
        if (!structured) throw new CompanionModelError("invalid_reply");
      }
    } else if (!structured) {
      throw new CompanionModelError("empty_reply");
    }
  }
  throw new CompanionModelError("empty_reply");
}
