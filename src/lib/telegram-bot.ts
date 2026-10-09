import { PICKER_FEELINGS, type CheckinSlot } from "./types";

const SLOT_CODE: Record<CheckinSlot, string> = {
  morning: "m",
  day: "d",
  evening: "e",
};

const CODE_SLOT: Record<string, CheckinSlot> = {
  m: "morning",
  d: "day",
  e: "evening",
};

export function feelingKeyboard(slot: CheckinSlot) {
  const code = SLOT_CODE[slot];
  const rows = [];
  for (let index = 0; index < PICKER_FEELINGS.length; index += 3) {
    rows.push(
      PICKER_FEELINGS.slice(index, index + 3).map((feeling, offset) => ({
        text: feeling,
        callback_data: `c:${code}:${index + offset}`,
      })),
    );
  }
  return { inline_keyboard: rows };
}

export function parseFeelingCallback(
  data: string,
): { slot: CheckinSlot; feeling: (typeof PICKER_FEELINGS)[number] } | null {
  const match = /^c:([mde]):(\d)$/.exec(data);
  if (!match) return null;
  const slot = CODE_SLOT[match[1]];
  const feeling = PICKER_FEELINGS[Number(match[2])];
  if (!slot || !feeling) return null;
  return { slot, feeling };
}

export function miniAppKeyboard(url: string) {
  return {
    inline_keyboard: [[{ text: "Открыть Between", web_app: { url } }]],
  };
}

export async function telegramRequest(
  method: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}
