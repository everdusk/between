import { normalizeAitunnelKey } from "@/app/api/brief/route";
import {
  applyCompanionNotes,
  companionContext,
  emptyCompanion,
  readCompanionReply,
  type CompanionState,
} from "./companion-memory";
import { companionPrompt } from "./companion-prompt";
import {
  getRedis,
  getUserTimezone,
  journalCacheId,
  takeBriefAttempt,
} from "./redis";
import { normalizeStore } from "./migrate";
import { emptyStore } from "./types";
import { todayInTimeZone } from "./zoned";
import { isReviewOwner } from "./review-owner";
import { resolveJournalId } from "./web-account-store";

const hello =
  "Привет! Я ИИ-компаньон Between. Здесь можно поговорить, а важные моменты я сохраню в твоём дневнике. Иногда буду вспоминать то, о чём мы уже говорили. Как тебя называть? Можно выбрать любое имя.";
const preferences = "Как удобнее общаться — на «ты» или на «вы»?";
const background = (address?: string) =>
  address?.toLowerCase().includes("ты")
    ? "Сколько тебе лет и в каком роде к тебе обращаться? Если не хочется отвечать, можно пропустить."
    : "Сколько вам лет и в каком роде к вам обращаться? Если не хочется отвечать, можно пропустить.";
const discovery =
  "Что в последнее время особенно радует или беспокоит? Можно начать с любого события.";
const stateKey = (owner: string) => "between:user:" + owner + ":companion";

async function generate(payload: object) {
  const key = normalizeAitunnelKey(process.env.AITUNNEL_API_KEY);
  if (!key) throw new Error("companion unavailable");
  const base = (
    process.env.AITUNNEL_BASE_URL?.trim() || "https://api.aitunnel.ru/v1"
  ).replace(/\/+$/, "");
  const response = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
    body: JSON.stringify({
      model: "gpt-6-luna",
      response_format: { type: "json_object" },
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: companionPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!response.ok) throw new Error("companion provider " + response.status);
  const data = await response.json();
  const usage = data.usage;
  if (usage)
    console.info("companion_usage", {
      input: usage.prompt_tokens,
      cached: usage.prompt_tokens_details?.cached_tokens,
      output: usage.completion_tokens,
      rub: usage.cost_rub,
    });
  return data.choices?.[0]?.message?.content ?? "";
}

export async function handleCompanion(input: {
  userId: number;
  username?: string;
  messageId: number;
  text: string;
  start?: boolean;
  say: (reply: string) => Promise<boolean>;
}): Promise<boolean> {
  const { userId, username, messageId, text, start, say } = input;
  const redis = getRedis();
  if (
    !redis ||
    !(await isReviewOwner({
      telegramUserId: userId,
      telegramUsername: username ?? null,
      messenger: "telegram",
    }))
  )
    return false;
  const owner = await resolveJournalId(userId);
  const key = stateKey(owner);
  if (!start && !(await redis.exists(key))) return false;
  const epoch = await journalCacheId(owner);
  const receipt = key + ":reply:" + epoch + ":" + messageId;
  const lease = crypto.randomUUID();
  if (!(await redis.set(key + ":lock", lease, { nx: true, ex: 70 })))
    throw new Error("companion busy");
  try {
    const saved = await redis.get<{ text: string; sent: boolean }>(receipt);
    if (saved?.sent) return true;
    let answer = saved?.text;
    if (!answer) {
      const previous = await redis.get<CompanionState>(key);
      if (!previous && !start) return false;
      const state = previous ?? emptyCompanion();
      const priorUserText = state.recent.at(-1)?.user;
      const date = todayInTimeZone(await getUserTimezone(owner));
      const at = new Date().toISOString();
      const storeKey = "between:user:" + owner + ":store";
      const snapshot = async () => {
        const [stamp, value] = await redis.eval<string[], [string, unknown]>(
          "local v=redis.call('GET',KEYS[1]); return {redis.sha1hex(v or ''),v or ''}",
          [storeKey],
          [],
        );
        const raw =
          typeof value === "string" && value ? JSON.parse(value) : value;
        const store = raw ? normalizeStore(raw) : emptyStore();
        if (!store) throw new Error("invalid journal");
        return { stamp, store, original: raw || store };
      };
      let current = await snapshot();
      let notes: ReturnType<typeof readCompanionReply>["notes"] = [];
      if (start) {
        answer =
          state.stage === "name"
            ? hello
            : state.stage === "address"
              ? preferences
              : state.stage === "background"
                ? background(state.address)
                : state.stage === "discovery"
                  ? discovery
                  : "Я здесь. О чём хочется поговорить сегодня?";
      } else if (state.stage === "name") {
        state.name = text.slice(0, 100);
        state.stage = "address";
        answer = preferences;
      } else if (state.stage === "address") {
        state.address = text.slice(0, 80);
        state.stage = "background";
        answer = background(state.address);
      } else if (state.stage === "background") {
        state.background = text.slice(0, 120);
        state.stage = "discovery";
        answer = discovery;
      } else {
        const context = companionContext(
          current.store,
          text,
          state.recent.at(-1),
        );
        const mode =
          state.stage === "discovery" && state.discovery >= 2
            ? "recap"
            : state.stage;
        const allowed = await takeBriefAttempt(owner, date, 120, "companion");
        try {
          if (!allowed) throw new Error("daily limit");
          const asked = await redis.get<string>(key + ":asked");
          const raw = await generate({
            mode,
            preferences: {
              name: state.name,
              address: state.address,
              background: state.background,
            },
            diary: context,
            recent: state.recent,
            lastScheduledQuestion: asked,
            message: text,
          });
          const result = readCompanionReply(raw, text, context);
          answer = result.reply;
          notes = result.notes;
          if (mode === "recap") state.stage = "chat";
          if (state.stage === "discovery") state.discovery++;
          if (
            result.followUp &&
            (!state.followUp || state.followUp.text === asked)
          ) {
            const later = new Date(at);
            later.setUTCDate(later.getUTCDate() + 4);
            state.followUp = {
              text: result.followUp,
              due: later.toISOString().slice(0, 10),
            };
          }
          state.recent = [
            ...state.recent,
            { user: text.slice(0, 1500), reply: answer.slice(0, 900) },
          ].slice(-6);
        } catch {
          answer = allowed
            ? "Сейчас не получается ответить. Попробуйте отправить сообщение ещё раз чуть позже."
            : "Сегодня достигнут лимит ответов компаньона. Продолжим завтра.";
        }
      }
      let noteText = start ? "" : text;
      if (
        /^(?:запиши|сохрани|запомни) (?:это|моё последнее сообщение)[.!]?$/iu.test(
          noteText.trim(),
        )
      ) {
        noteText = priorUserText ? "Запиши: " + priorUserText : "";
        notes = [];
        if (!priorUserText) answer = "Что именно сохранить в дневнике?";
      }
      const baseAnswer = answer;
      let committed = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) current = await snapshot();
        const next = applyCompanionNotes(
          current.store,
          noteText,
          notes,
          messageId,
          date,
          at,
        );
        answer =
          baseAnswer +
          (next.entries.length > current.store.entries.length
            ? "\n\n✓ Сохранено в дневнике."
            : "");
        const code = await redis.eval<string[], number>(
          `if redis.call('GET',KEYS[4])~=ARGV[4] or redis.call('GET',KEYS[5])~=ARGV[5] then return -1 end
          if redis.sha1hex(redis.call('GET',KEYS[1]) or '')~=ARGV[1] then return 0 end
          if ARGV[2]~='' then redis.call('SET',KEYS[1],ARGV[2]) end
          redis.call('SET',KEYS[2],ARGV[3]); redis.call('SET',KEYS[3],ARGV[6],'EX',172800); return 1`,
          [
            storeKey,
            key,
            receipt,
            "between:user:" + owner + ":cache-id",
            key + ":lock",
          ],
          [
            current.stamp,
            next === current.store
              ? ""
              : JSON.stringify({
                  ...current.original,
                  entries: [
                    ...next.entries.slice(
                      0,
                      next.entries.length - current.store.entries.length,
                    ),
                    ...current.original.entries,
                  ],
                  themes: next.themes,
                  themeLinks: next.themeLinks,
                  judgeSettled: next.judgeSettled,
                }),
            JSON.stringify(state),
            epoch,
            lease,
            JSON.stringify({ text: answer, sent: false }),
          ],
        );
        if (code < 0) throw new Error("journal changed");
        if (code === 1) {
          committed = true;
          break;
        }
      }
      if (!committed) throw new Error("retry companion");
    }
    if (!(await say(answer))) throw new Error("companion delivery failed");
    await redis.set(
      receipt,
      { text: answer, sent: true },
      { xx: true, ex: 172800 },
    );
    return true;
  } finally {
    await redis.eval(
      "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
      [key + ":lock"],
      [lease],
    );
  }
}

export async function dueCompanionQuestion(owner: string, date: string) {
  const redis = getRedis();
  if (!redis) return null;
  const key = stateKey(owner);
  const state = await redis.get<CompanionState>(key);
  const question = state?.followUp;
  if (state?.stage !== "chat" || !question || question.due > date) return null;
  const last = await redis.get<string>(key + ":asked");
  if (last === question.text) return null;
  return {
    text: question.text,
    delivered: () => redis.set(key + ":asked", question.text),
  };
}
