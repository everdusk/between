export type PasswordSettingsKind = "form" | "telegram" | "max" | "messenger" | "none" | "hidden";

/** Change-password only after an email registration. A messenger entry says so instead. */
export function passwordSettingsKind(input: {
  inTelegram: boolean;
  inMax: boolean;
  signedIn: boolean;
  hasPassword: boolean;
  telegramLinked: boolean;
  maxLinked: boolean;
}): PasswordSettingsKind {
  if (input.inMax) return "max";
  if (input.inTelegram) return "telegram";
  if (!input.signedIn) return "hidden";
  if (input.hasPassword) return "form";
  if (input.telegramLinked && input.maxLinked) return "messenger";
  if (input.maxLinked) return "max";
  if (input.telegramLinked) return "telegram";
  return "none";
}
