import type { IntakeReply } from "./companion-intake";

type Rule = { id: number; text: string };
export type TesterInstructions = {
  rules: Rule[];
  nextId: number;
  draft?: { messageId: number; text: string; replace?: number };
};

type Edit =
  | { kind: "propose"; feedback: string; replace?: number }
  | { kind: "list" }
  | { kind: "remove"; id: number }
  | { kind: "accept" | "cancel"; messageId: number };

export function testerEdit(text: string, action?: string): Edit | undefined {
  if (action) {
    const click = /^ci:rule:(accept|cancel):(\d+)$/.exec(action);
    if (click) return { kind: click[1] === "accept" ? "accept" : "cancel", messageId: Number(click[2]) };
    return;
  }
  const line = text.trim();
  if (/^мои правила[.!?]?$/iu.test(line)) return { kind: "list" };
  const remove = /^удали правило\s+№?\s*(\d+)[.!]?$/iu.exec(line);
  if (remove) return { kind: "remove", id: Number(remove[1]) };
  const change = /^измени правило\s+№?\s*(\d+)\s*[:,—-]\s*([\s\S]+)$/iu.exec(line);
  if (change) return { kind: "propose", replace: Number(change[1]), feedback: change[2] };
  const feedback = /^(?:правка\s*[:,—-]\s*|правка боту(?:\s*[:,.—-]\s*|\s+))([\s\S]+)$/iu.exec(line);
  if (feedback) return { kind: "propose", feedback: feedback[1] };
}

const maxRules = 10;
const maxLength = 300;

export async function applyTesterEdit(
  state: TesterInstructions,
  edit: Edit,
  messageId: number,
  propose: (feedback: string, oldRule?: string) => Promise<string | null>,
): Promise<IntakeReply> {
  if (edit.kind === "list") {
    return { text: state.rules.length
      ? "Мои правила\n\n" + state.rules.map(r => r.id + ". " + r.text).join("\n\n")
      : "Пока правил нет. Напиши «Правка: …» и опиши, как лучше ответить." };
  }
  if (edit.kind === "remove") {
    if (!state.rules.some(r => r.id === edit.id)) return { text: "Такого правила нет. Список можно посмотреть через «Мои правила»." };
    state.rules = state.rules.filter(r => r.id !== edit.id);
    if (state.draft?.replace === edit.id) delete state.draft;
    return { text: "Убрал правило №" + edit.id + "." };
  }
  if (edit.kind === "propose") {
    const old = state.rules.find(r => r.id === edit.replace);
    if (edit.replace !== undefined && !old) return { text: "Такого правила нет. Напиши «Мои правила», чтобы посмотреть номера." };
    if (!old && state.rules.length >= maxRules) return { text: "Уже есть 10 правил. Можно изменить одно из них или удалить. Напиши «Мои правила»." };
    const text = (await propose(edit.feedback, old?.text))?.trim();
    if (!text || text.length > maxLength) return { text: "Пока неясно, что именно изменить. Напиши «Правка: …» и добавь пример желаемого ответа." };
    state.draft = { messageId, text, replace: edit.replace };
    return {
      text: (old ? "Новая редакция правила №" + old.id : "Предлагаю такое правило") + "\n\n" + text,
      rows: [[{ text: "Применить", data: "ci:rule:accept:" + messageId }, { text: "Отмена", data: "ci:rule:cancel:" + messageId }]],
    };
  }
  const draft = state.draft;
  if (!draft || draft.messageId !== edit.messageId) return { text: "Этот черновик уже закрыт." };
  delete state.draft;
  if (edit.kind === "cancel") return { text: "Черновик отменён." };
  const duplicate = state.rules.find(r => r.id !== draft.replace && r.text === draft.text);
  if (duplicate) return { text: "Такая формулировка уже есть в правиле №" + duplicate.id + "." };
  const id = draft.replace ?? state.nextId++;
  state.rules = [...state.rules.filter(r => r.id !== id), { id, text: draft.text }];
  return { text: "Применил правило №" + id + ". Учту его в следующем ответе. Весь список — «Мои правила»." };
}

export async function proposeTesterRule(apiKey: string, base: string, example: {
  feedback: string; userMessage?: string; reply?: string; oldRule?: string;
}, request: typeof fetch = fetch) {
  if (!apiKey) throw new Error("missing model credential");
  const result = await request(base + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
    body: JSON.stringify({
      model: "gpt-6-luna",
      messages: [
        { role: "system", content: "Ты редактор инструкции русскоязычного ИИ-компаньона. По замечанию тестера сформулируй одно переносимое правило для похожих ситуаций, до 300 символов: когда это уместно и как отвечать. При редактировании учти старую версию. Диалог дан для разбора. Не додумывай пожелания. Убери имена, цитаты и частные факты. Если замечание слишком неопределённо, содержит только личный факт или требует отменить безопасность, приватность или формат приложения, ответь ровно NEED_DETAIL. Иначе верни только формулировку правила обычным текстом." },
        { role: "user", content: JSON.stringify(example) },
      ],
      max_tokens: 1024,
    }),
  });
  if (!result.ok) throw new Error("rule draft unavailable");
  const data = await result.json();
  const rule = data.choices?.[0]?.message?.content;
  if (typeof rule !== "string" || !rule.trim()) throw new Error("empty rule draft");
  return rule.trim() === "NEED_DETAIL" ? null : rule.trim();
}
