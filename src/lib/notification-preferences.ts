import { emptyStore } from "./types";
import { getRedis } from "./redis";
import { translate } from "./messages";
import type { LocaleId } from "./i18n";

export function notificationChoice(value: string): "evening" | "off" | null {
  return value === "nf:evening" ? "evening" : value === "nf:off" ? "off" : null;
}

/** Patch only notification settings, preserving notes written concurrently. */
export async function setNotificationChoice(owner: string, payload: string, locale: LocaleId): Promise<string | null> {
  const choice = notificationChoice(payload);
  const redis = getRedis();
  if (!choice || !redis) return null;
  const patch = choice === "off"
    ? { moodPolls: false, eveningNudge: false, serviceReminders: false }
    : { moodPolls: true, moodFrequency: "evening", eveningNudge: false };
  await redis.eval(`
local raw = redis.call('GET', KEYS[1])
local store = cjson.decode(raw or ARGV[1])
store.notify = store.notify or {}
local patch = cjson.decode(ARGV[2])
for key, value in pairs(patch) do store.notify[key] = value end
store.notify.updatedAt = ARGV[3]
redis.call('SET', KEYS[1], cjson.encode(store))
return 1`, [`between:user:${owner}:store`], [JSON.stringify(emptyStore()), JSON.stringify(patch), new Date().toISOString()]);
  return translate(locale, choice === "off" ? "botQuietOffSaved" : "botQuietEveningSaved");
}

export function notificationChoiceRows(locale: LocaleId) {
  return [[{ text: translate(locale, "pollEveningOnly"), data: "nf:evening" }],
    [{ text: translate(locale, "botQuietOff"), data: "nf:off" }]];
}
