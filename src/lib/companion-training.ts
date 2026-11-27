import type { IntakeReply } from "./companion-intake";

type Rule = { id: number; text: string };
export type TesterInstructions = {
  rules: Rule[];
  nextId: number;
  clearRequest?: number;
  draft?: { messageId: number; text: string; replace?: number };
};

type Edit =
  | { kind: "propose"; feedback: string; replace?: number }
  | { kind: "list" }
  | { kind: "clear" }
  | { kind: "clearConfirmed" | "keep"; messageId: number }
  | { kind: "remove"; id: number }
  | { kind: "accept" | "cancel"; messageId: number };

export function testerEdit(text: string, action?: string): Edit | undefined {
  if (action) {
    if (action === "ci:rule:clear") return { kind: "clear" };
    const clear = /^ci:rule:(clearConfirmed|keep):(\d+)$/.exec(action);
    if (clear) return { kind: clear[1] === "keep" ? "keep" : "clearConfirmed", messageId: Number(clear[2]) };
    const click = /^ci:rule:(accept|cancel):(\d+)$/.exec(action);
    if (click) return { kind: click[1] === "accept" ? "accept" : "cancel", messageId: Number(click[2]) };
    return;
  }
  const line = text.trim();
  if (/^мои правила[.!?]?$/iu.test(line)) return { kind: "list" };
  if (/^(?:очисти(?:ть)?|удали(?:ть)?) (?:все )?(?:мои |личные )?правила[.!]?$/iu.test(line)) return { kind: "clear" };
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
      : "Пока правил нет. Напиши «Правка: …» и опиши, как лучше ответить.",
      ...(state.rules.length || state.draft ? { rows: [[{ text: "Очистить мои правила", data: "ci:rule:clear" }]] } : {}) };
  }
  if (edit.kind === "clear") {
    if (!state.rules.length && !state.draft) return { text: "Личных правил пока нет." };
    state.clearRequest = messageId;
    return {
      text: "Удалить все личные правила и их черновик? Базовая инструкция продолжит действовать.",
      rows: [[{ text: "Удалить", data: "ci:rule:clearConfirmed:" + messageId }, { text: "Отмена", data: "ci:rule:keep:" + messageId }]],
    };
  }
  if (edit.kind === "clearConfirmed" || edit.kind === "keep") {
    if (state.clearRequest !== edit.messageId) return { text: "Этот запрос уже закрыт. Открой «Мои правила», чтобы увидеть текущий список." };
    delete state.clearRequest;
    if (edit.kind === "keep") return { text: "Личные правила сохранены." };
    state.rules = [];
    delete state.draft;
    return { text: "Личные правила очищены." };
  }
  if (edit.kind === "remove") {
    if (!state.rules.some(r => r.id === edit.id)) return { text: "Такого правила нет. Список можно посмотреть через «Мои правила»." };
    state.rules = state.rules.filter(r => r.id !== edit.id);
    delete state.clearRequest;
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
    delete state.clearRequest;
    return {
      text: (old ? "Новая редакция правила №" + old.id : "Предлагаю такое правило") + "\n\n" + text,
      rows: [[{ text: "Применить", data: "ci:rule:accept:" + messageId }, { text: "Отмена", data: "ci:rule:cancel:" + messageId }]],
    };
  }
  const draft = state.draft;
  if (!draft || draft.messageId !== edit.messageId) return { text: "Этот черновик уже закрыт." };
  delete state.draft;
  delete state.clearRequest;
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
