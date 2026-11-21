export const messengerChoices = ["telegram", "max", "whatsapp", "none"] as const;
export type MessengerChoice = typeof messengerChoices[number];

export function validMessengerChoices(value: unknown): value is MessengerChoice[] {
  return Array.isArray(value) && value.length > 0 && value.length <= messengerChoices.length &&
    value.every(item => messengerChoices.includes(item)) && new Set(value).size === value.length &&
    (!value.includes("none") || value.length === 1);
}
