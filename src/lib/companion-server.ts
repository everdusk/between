import { normalizeAitunnelKey } from "@/app/api/brief/route";
import {
  applyCompanionNotes,
  companionContext,
  emptyCompanion,
  readCompanionReply,
  type CompanionState,
} from "./companion-memory";
import { askCompanion, CompanionModelError } from "./companion-model";
import { advanceCompanionIntake, type IntakeReply } from "./companion-intake";
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
import { startTelegramTyping } from "./telegram-bot";

const stateKey = (owner: string) => "between:user:" + owner + ":companion";

export async function handleCompanion(input: {
  userId: number;
  username?: string;
  messageId: number;
  action?: { id: string; data: string };
  text: string;
  start?: boolean;
  say: (reply: string, rows?: IntakeReply["rows"]) => Promise<boolean>;
}): Promise<boolean> {
  const { userId, username, messageId, text, start, action, say } = input;
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
  const receipt =
    key +
    ":reply:" +
    epoch +
    ":" +
    (action ? "callback:" + action.id : messageId);
  const lease = crypto.randomUUID();
  if (!(await redis.set(key + ":lock", lease, { nx: true, ex: 70 })))
    throw new Error("companion busy");
  let stopTyping: (() => void) | undefined;
  try {
    const saved = await redis.get<IntakeReply & { sent: boolean }>(receipt);
    if (saved?.sent) return true;
    let answer = saved?.text;
    let rows = saved?.rows;
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
      const urgent =
        !action &&
        /(?:не хочу жить|хочу умереть|хочу себя убить|поконч[уи]ть с собой|убью себя|причиню себе вред)/iu.test(
          text,
        );
      const intakeReply = urgent
        ? null
        : advanceCompanionIntake(state, { text, start, action: action?.data });
      if (intakeReply) {
        if (!intakeReply.text) return true;
        answer = intakeReply.text;
        rows = intakeReply.rows;
      } else {
        const context = companionContext(
          current.store,
          text,
          state.recent.at(-1),
        );
        const allowed = await takeBriefAttempt(owner, date, 120, "companion");
        try {
          if (!allowed) throw new Error("daily limit");
          stopTyping = startTelegramTyping(userId);
          const asked = await redis.get<string>(key + ":asked");
          const result = await askCompanion({
            apiKey: normalizeAitunnelKey(process.env.AITUNNEL_API_KEY),
            base: (
              process.env.AITUNNEL_BASE_URL?.trim() ||
              "https://api.aitunnel.ru/v1"
            ).replace(/\/+$/, ""),
            context: {
              preferences: {
                name: state.name,
                address: state.address,
                gender: state.gender,
              },
              ...(state.intake?.topic && {
                introduction: {
                  topic: state.intake.topic,
                  rating: state.intake.rating,
                },
              }),
              diary: context,
              recent: state.recent,
              lastScheduledQuestion: asked,
            },
            message: text,
            read: (raw) => readCompanionReply(raw, text, context),
          });
          answer = result.reply;
          notes = result.notes;
          if (result.gender) state.gender = result.gender;
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
        } catch (error) {
          const code = !allowed
            ? "daily_limit"
            : error instanceof CompanionModelError
              ? error.code
              : error instanceof Error && error.name === "TimeoutError"
                ? "timeout"
                : "request_failed";
          console.warn("companion_failed", { code });
          if (!allowed) {
            answer =
              "Сегодня достигнут лимит ответов компаньона. Продолжим завтра.";
          } else if (
            ["missing_key", "http_401", "http_403", "http_404"].includes(code)
          ) {
            answer =
              "Сейчас Luna недоступна для этого бота. Нужно проверить доступ в AI Tunnel.";
          } else if (code === "http_402") {
            answer =
              "AI Tunnel отклонил запрос из-за оплаты. Нужно проверить баланс.";
          } else {
            answer =
              "Сейчас не получается ответить. Попробуй отправить сообщение ещё раз чуть позже.";
          }
        }
      }
      let noteText = intakeReply ? "" : text;
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
            JSON.stringify({ text: answer, rows, sent: false }),
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
    stopTyping?.();
    stopTyping = undefined;
    if (!(await say(answer, rows)))
      throw new Error("companion delivery failed");
    await redis.set(
      receipt,
      { text: answer, rows, sent: true },
      { xx: true, ex: 172800 },
    );
    return true;
  } finally {
    stopTyping?.();
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
  if (!question || state?.intake?.step !== "done" || question.due > date)
    return null;
  const last = await redis.get<string>(key + ":asked");
  if (last === question.text) return null;
  return {
    text: question.text,
    delivered: () => redis.set(key + ":asked", question.text),
  };
}
