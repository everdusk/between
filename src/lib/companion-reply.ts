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
