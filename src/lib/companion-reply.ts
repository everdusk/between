// Fallback for generated text, including messages queued before the style change.
export function companionDisplayText(text: string) {
  return text.replaceAll("—", "–");
}

// Gemma occasionally repeats the tail of a Russian noun inside a single word.
// Restrict the repair to long suffixes; deliberate repetitions like «еле-еле» are valid.
export function cleanGeneratedReply(text: string, userText: string) {
  return companionDisplayText(text).replace(
    /(?<![\p{L}\p{N}_])([а-яё]+?)([а-яё]?[ае]ни(?:е|я|ю|ем|и|й|ям|ями|ях))\2(?![\p{L}\p{N}_])/giu,
    (word, stem: string, ending: string) => userText.includes(word) ? word : stem + ending,
  );
}

export type TelegramReplyMessage = {
  message_id: number;
  chat: { id: number };
  from?: { id: number; is_bot?: boolean };
  text?: string;
  caption?: string;
  forward_origin?: unknown;
};

export type CompanionReplyTarget = {
  author: "user" | "assistant";
  messageId: number;
  text?: string;
  quote?: string;
};

type PreviousTurn = {
  user: string;
  reply: string;
  retryOf?: string;
  replyTo?: { author: "user" | "assistant"; text: string };
};

export function retryContext(text: string, target?: CompanionReplyTarget, turn?: PreviousTurn) {
  const line = text.toLowerCase().replace(/ё/g, "е").trim().replace(/[.!?…]+$/u, "").trim();
  if (!/^(?:и |ну )?(?:пожалуйста[, ]+)?(?:попробуй(?:те)? (?:ответить )?еще раз(?: (?:на этот вопрос ответить|ответить на этот вопрос|ответить))?|еще раз попробуй(?:те)?(?: ответить)?|ответь(?:те)? (?:еще раз|заново|по-другому)(?: на этот вопрос)?)(?:[, ]+пожалуйста)?$/u.test(line)) return;
  const selected = target?.quote ?? target?.text;
  const original = target?.author === "user" ? selected
    : turn?.retryOf ?? (turn?.replyTo?.author === "user" ? turn.replyTo.text : turn?.user);
  return {
    original,
    previousAnswer: target?.author === "assistant" ? selected : turn?.reply,
  };
}

export function telegramReplyTarget(message: {
  chat: { id: number };
  from?: { id: number };
  reply_to_message?: TelegramReplyMessage;
  quote?: { text: string; is_manual?: boolean };
}): CompanionReplyTarget | undefined {
  const original = message.reply_to_message;
  if (!original?.from || original.forward_origin || original.chat.id !== message.chat.id ||
      message.from?.id !== message.chat.id) return;
  const author = original.from.is_bot ? "assistant" : "user";
  if (author === "user" && original.from.id !== message.from.id) return;
  let text = original.text ?? original.caption;
  if (author === "assistant") {
    text = text?.replace(/\n\n(?:Карточки(?: ответа)? · [^\n]+|Ответ без карточек)$/u, "");
  }
  const quote = message.quote?.is_manual && message.quote.text;
  return {
    author, messageId: original.message_id,
    ...(text && { text: text.slice(0, 4096) }),
    ...(quote && text?.includes(quote) && { quote: quote.slice(0, 1024) }),
  };
}
