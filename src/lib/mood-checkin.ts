import type { LocaleId } from "./i18n";
import { feelingLabel, translate, type MessageKey } from "./messages";
import type { PICKER_FEELINGS } from "./types";

type PickerFeeling = (typeof PICKER_FEELINGS)[number];

const checkins = {
  тревожно: { emoji: "😟", reply: "botMoodConcern" },
  спокойно: { emoji: "😌", reply: "botMoodCalm" },
  злость: { emoji: "😠", reply: "botMoodWhatHappened" },
  грусть: { emoji: "😔", reply: "botMoodWhatHappened" },
  радость: { emoji: "😊", reply: "botMoodJoy" },
  усталость: { emoji: "🪫", reply: "botMoodLowEnergy" },
  стыд: { emoji: "🫣", reply: "botMoodWhatHappened" },
  пусто: { emoji: "🌫️", reply: "botMoodLowEnergy" },
  напряжение: { emoji: "😬", reply: "botMoodConcern" },
} satisfies Record<PickerFeeling, { emoji: string; reply: MessageKey }>;

export function moodButtonLabel(locale: LocaleId, feeling: PickerFeeling) {
  return checkins[feeling].emoji + " " + feelingLabel(locale, feeling);
}

export function moodCheckinReply(locale: LocaleId, feeling: PickerFeeling) {
  return moodButtonLabel(locale, feeling) + "\n\n" + translate(locale, checkins[feeling].reply);
}
