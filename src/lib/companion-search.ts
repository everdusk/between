import { practiceTitles } from "./companion-practices";
import { dialogueCards } from "./companion-dialogue-cards";

export type PracticeCard = { id: string; title: string; text: string };

export const practiceSearchTool = {
  type: "function",
  function: {
    name: "search_practices",
    description: "Найти приём для текущей реплики. Передай один обезличенный запрос: ситуация, её разговорные синонимы и подход. Без имён, цитат пользователя и текста дневника.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        dialogueCard: {
          type: "string",
          description: "Необязательно. Выбери один подход к текущей просьбе с учётом предыдущего обмена. Для простого отклика, паузы, бытового пояснения или смены темы укажи plain. Если полезнее поиск книжного приёма, опусти поле. " +
            dialogueCards.map(card => card.id + ": " + card.title).join(". "),
          enum: ["plain", ...dialogueCards.map(card => card.id)],
        },
      },
      required: ["query"],
    },
  },
};

export async function searchPracticeCards(base: string, apiKey: string, kb: string, query: string, signal: AbortSignal, request: typeof fetch): Promise<PracticeCard[]> {
  const response = await request(base + "/knowledge-bases/" + encodeURIComponent(kb) + "/search", {
    method: "POST", cache: "no-store",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: 3, rerank: false }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("practice search unavailable");
  }
  const data = await response.json();
  const cards: PracticeCard[] = [];
  for (const hit of data?.data?.[0]?.results ?? []) {
    if (typeof hit?.path !== "string" || typeof hit.text !== "string" || !hit.text.trim()) continue;
    const id = hit.path.split("/").at(-1)?.replace(/\.md$/i, "");
    if (!id || !/^[a-z][a-z0-9-]{0,90}$/.test(id) || cards.some(c => c.id === id)) continue;
    const header = hit.text.split("\n", 1)[0].replace(/^.*?\.md\s*[—–-]\s*/, "").replace(/^#+\s*/, "").trim();
    const title = practiceTitles[id] ?? (header && header !== hit.path ? header.slice(0, 96) : id);
    cards.push({ id, title, text: hit.text.slice(0, 1800) });
  }
  return cards;
}

export type PracticeSearchStatus = "skipped" | "failed" | number; // Number of distinct cards returned by the index.

export function practiceDecision(cited: unknown, reason: unknown, cards: PracticeCard[]) {
  const used = cards.filter(c => Array.isArray(cited) && cited.includes(c.id));
  const baseOnly = Array.isArray(cited) && cited.length === 0 &&
    (reason === "support" || reason === "not_applicable");
  return { used, baseOnly, confirmed: used.length > 0 || baseOnly };
}

export function practiceFooter(cited: unknown, cards: PracticeCard[], status: PracticeSearchStatus, reason?: unknown) {
  const { used, baseOnly } = practiceDecision(cited, reason, cards);
  const titles = used.map(c => c.title);
  const lookup = typeof status === "number" ? "из базы получено " + status
    : status === "failed" ? "поиск недоступен" : "без поиска в базе";
  if (titles.length) return "Карточки ответа · " + titles.join(" · ") + " (" + lookup + ")";
  if (cards.length && !baseOnly) return "Карточки · " + lookup + ", бот не указал источник";
  if (baseOnly) return "Карточки · " + lookup + (reason === "support" ? ", поддержка без отдельного приёма" : ", подходящего приёма не нашлось");
  return "Карточки · " + lookup + ", ответ без карточек";
}
