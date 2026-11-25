import type { CompanionState } from "./companion-memory";

export type AddressGender = "feminine" | "masculine";

// Model-only evidence is optional. Discard quoted speech and require a
// first-person subject before trusting an unfamiliar grammatical form.
export function hasAddressEvidence(message: string, quote: string) {
  const ownWords = message.replace(
    /«[^»]*(?:»|$)|“[^”]*(?:”|$)|"[^"]*(?:"|$)/gu,
    " ",
  );
  return /(?:^|[^\p{L}])я\s/iu.test(quote) && ownWords.includes(quote);
}

// Anchor to the speaker's own words. A statement further inside a story or
// quotation isn't strong enough to replace an existing preference.
const request =
  /^(?:пожалуйста[, ]+)?(?:(?:обращай(?:ся|тесь)(?: ко мне)?|пиши(?:те)?(?: мне| обо мне)?|говори(?:те)? обо мне) в (женском|мужском) роде|используй(?:те)? (женский|мужской) род)(?=$|[\s.!(),])/iu;
const identity =
  /^(?:вообще-то\s+)?я\s+(женщина|девушка|мужчина|парень)(?=$|[.,!])/iu;
const selfReport =
  /^(?:(?:сегодня|вчера|потом|утром|вечером)\s+)?я\s+(?:(?:не|уже|тоже|так|и|всё-таки|все-таки|вчера|сегодня|наконец|просто|сама|сам)\s+)*(?:решил|устал|встал|сделал|написал|пош[её]л|пошл|приш[её]л|пришл|смог|хотел|понял|проснул|испугал|расстроил|сказал|был|рад)(а)?(?:ся|сь)?(?=$|[\s.!?,…])/iu;

function requestedGender(text: string): AddressGender | undefined {
  const match = request.exec(text.trim());
  if (match)
    return (match[1] || match[2]).toLowerCase().startsWith("жен")
      ? "feminine"
      : "masculine";
}

function grammaticalGender(text: string): AddressGender | undefined {
  const words = text.trim();
  const noun = identity.exec(words)?.[1]?.toLowerCase();
  if (noun)
    return noun === "женщина" || noun === "девушка" ? "feminine" : "masculine";
  const verb = selfReport.exec(words);
  if (verb) return verb[1] ? "feminine" : "masculine";
}

export function rememberAddress(state: CompanionState, message: string) {
  const explicit = requestedGender(message);
  if (explicit) {
    state.gender = explicit;
    state.genderSource = "request";
    return;
  }
  if (state.genderSource === "request") return;

  // Older profiles could have a model guess, or no gender at all. Recover
  // first-person evidence from the user's turns, never the bot's replies.
  const history = state.genderSource
    ? []
    : state.recent.map((turn) => turn.user).reverse();
  const preferred = history
    .map(requestedGender)
    .find((value) => value !== undefined);
  if (preferred) {
    state.gender = preferred;
    state.genderSource = "request";
    return;
  }
  const evidence = [message, ...history]
    .map(grammaticalGender)
    .find((value) => value !== undefined);
  if (evidence) {
    state.gender = evidence;
    state.genderSource = "self";
  }
}
