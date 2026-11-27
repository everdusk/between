import { practiceTitles } from "./companion-practices";

export type PracticeCard = { id: string; title: string; text: string };

export const practiceSearchTool = {
  type: "function",
  function: {
    name: "search_practices",
    description: "Найти приём для текущей реплики. Передай один обезличенный запрос: ситуация, её разговорные синонимы и подход. Без имён, цитат пользователя и текста дневника.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
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

export function practiceFooter(cited: unknown, cards: PracticeCard[], failed: boolean) {
  const ids = Array.isArray(cited) ? cited : [];
  const titles = cards.filter(c => ids.includes(c.id)).map(c => c.title);
  if (titles.length) return "Карточки ответа · " + titles.join(" · ");
  if (failed) return "Карточки · поиск недоступен, источник ответа не указан";
  if (cards.length && (!Array.isArray(cited) || ids.length)) return "Карточки · источник ответа не подтверждён";
  return "Ответ без карточек";
}
