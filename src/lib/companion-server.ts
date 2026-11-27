import { normalizeAitunnelKey } from "@/app/api/brief/route";
import {
  applyCompanionNotes,
  companionContext,
  companionEntryPatch,
  emptyCompanion,
  explicitNote,
  readCompanionReply,
  recentCompanionNotes,
  recentMoodCheckin,
  type CompanionState,
} from "./companion-memory";
import { askCompanion, CompanionModelError } from "./companion-model";
import { practiceFooter } from "./companion-search";
import { companionDisplayText, retryContext, type CompanionReplyTarget } from "./companion-reply";
import { rememberAddress } from "./companion-address";
import { applyTesterEdit, proposeTesterRule, testerEdit } from "./companion-training";
import { advanceCompanionIntake, type IntakeReply } from "./companion-intake";
import {
  getRedis,
  getUserTimezone,
  journalCacheId,
  takeBriefAttempt,
} from "./redis";
import { normalizeStore } from "./migrate";
import { emptyStore, type JournalEntry } from "./types";
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
  replyTo?: CompanionReplyTarget;
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
      const edit = !start && testerEdit(text, action?.data);
      if (!edit) rememberAddress(state, action || start ? "" : text);
      const target = input.replyTo;
      const turn = target
        ? state.recent.findLast(t => target.author === "user"
          ? t.messageId === target.messageId
          : Boolean(target.text) && t.reply === target.text?.slice(0, 900))
        : state.recent.at(-1);
      // Telegram omits the transcript when someone replies to a voice message.
      const replyTo = target?.author === "user" && !target.text && turn
        ? { ...target, text: turn.user } : target;
      const focus = replyTo?.quote ?? replyTo?.text;
      const priorUserText = replyTo?.author === "user" ? focus : turn?.user;
      const priorReply = replyTo?.author === "assistant" ? focus : turn?.reply;
      const retry = retryContext(text, replyTo, turn);
      const date = todayInTimeZone(await getUserTimezone(owner));
      const at = new Date().toISOString();
      const conversationNotes = recentCompanionNotes(state, at);
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
      const apiKey = normalizeAitunnelKey(process.env.AITUNNEL_API_KEY);
      const base = (process.env.AITUNNEL_BASE_URL?.trim() || "https://api.aitunnel.ru/v1").replace(/\/+$/, "");
      let intakeReply: IntakeReply | null;
      if (edit) {
        const instructions = state.testerInstructions ??= { rules: [], nextId: 1 };
        try {
          intakeReply = await applyTesterEdit(instructions, edit, messageId, async (feedback, oldRule) => {
            if (!(await takeBriefAttempt(owner, date, 120, "companion"))) throw new Error("daily limit");
            stopTyping = startTelegramTyping(userId);
            return proposeTesterRule(apiKey, base, {
              feedback, oldRule, userMessage: replyTo?.author === "user" ? replyTo.text : turn?.user,
              reply: replyTo?.author === "assistant" ? replyTo.text : turn?.reply, selectedQuote: replyTo?.quote,
            });
          });
        } catch {
          intakeReply = { text: "Не удалось подготовить правило. Попробуй отправить правку чуть позже." };
        }
      } else {
        intakeReply = urgent ? null : advanceCompanionIntake(state, { text, start, action: action?.data });
      }
      const savePreviousMessage =
        !intakeReply &&
        /^(?:запиши|сохрани|запомни) (?:это|мо[её] последнее сообщение)[.!]?$/iu.test(
          text.trim(),
        );
      const saveFromReply = savePreviousMessage && replyTo && / это[.!]?$/iu.test(text.trim());
      const saveSource = saveFromReply
        ? (replyTo.author === "user" ? focus : undefined)
        : state.recent.at(-1)?.user;
      if (intakeReply) {
        if (!intakeReply.text) return true;
        answer = intakeReply.text;
        rows = intakeReply.rows;
      } else {
        const context = companionContext(
          current.store,
          retry?.original ?? text,
          replyTo ? { ...turn, user: focus ?? "", reply: replyTo.author === "assistant" ? focus ?? "" : turn?.reply ?? "" } : turn,
          conversationNotes,
          turn ? state.recent.slice(0, state.recent.indexOf(turn)) : [],
        );
        const allowed = await takeBriefAttempt(owner, date, 120, "companion");
        try {
          if (!allowed) throw new Error("daily limit");
          stopTyping = startTelegramTyping(userId);
          const asked = await redis.get<string>(key + ":asked");
          const result = await askCompanion({
            apiKey,
            base,
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
              recentMoodCheckin: recentMoodCheckin(current.store, state, at),
              recent: state.recent,
              ...(savePreviousMessage && { savePreviousMessage: true, saveSource }),
              lastScheduledQuestion: asked,
            },
            message: text,
            gender: state.gender,
            testerRules: state.testerInstructions?.rules.map(rule => rule.text),
            replyTo,
            retry,
            previousReply: priorReply,
            previousMessage: priorUserText,
            knowledgeBaseId:
              process.env.COMPANION_KNOWLEDGE_BASE_ID ??
              (process.env.VERCEL_ENV === "production"
                ? "kb_between-priemy-obscheniya-sjsakm"
                : undefined),
            urgent,
            read: (raw, cards, searchStatus) => {
              const parsed = readCompanionReply(
                raw,
                text,
                context,
                savePreviousMessage ? (saveSource ?? "") : undefined,
              );
              return { ...parsed, footer: practiceFooter(parsed.usedCards, cards, searchStatus, parsed.noCardReason) };
            },
          });
          answer = result.reply;
          notes = retry ? [] : result.notes;
          if (!state.gender && result.gender) state.gender = result.gender;
          if (
            !retry && result.followUp &&
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
            { messageId, topicId: result.topicId, user: text.slice(0, 1500), reply: result.reply.slice(0, 900),
              ...(retry?.original && { retryOf: retry.original.slice(0, 1500) }),
              ...(replyTo && focus && { replyTo: { author: replyTo.author, text: focus.slice(0, 300) } }),
            },
          ].slice(-6);
          if (!urgent) answer += "\n\n" + result.footer;
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
      if (savePreviousMessage) {
        noteText = saveSource ? "Запиши: " + saveSource : "";
        if (!saveSource) {
          notes = [];
          answer = "Что именно сохранить в дневнике?";
        }
      }
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
          conversationNotes,
        );
        const entryChanges = companionEntryPatch(
          current.store.entries,
          next.entries,
        );
        const byId = new Map(entryChanges.map((entry) => [entry.id, entry]));
        const existing = entryChanges.length
          ? current.original.entries.map((raw: JournalEntry | null) => {
              const updated = raw && byId.get(raw.id);
              if (!updated) return raw;
              byId.delete(updated.id);
              return {
                ...raw,
                body: updated.body,
                feelings: updated.feelings,
                updatedAt: updated.updatedAt,
              };
            })
          : current.original.entries;
        const nextConversation = new Map(
          conversationNotes.map((entry) => [entry.id, entry]),
        );
        if (!explicitNote(noteText)) {
          for (const entry of entryChanges) {
            nextConversation.delete(entry.id);
            nextConversation.set(entry.id, {
              id: entry.id,
              updatedAt: entry.updatedAt,
            });
          }
        }
        const nextState = intakeReply
          ? state
          : {
              ...state,
              conversation: {
                lastTurnAt: at,
                notes: [...nextConversation.values()].slice(-6),
              },
            };
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
                  entries: [...byId.values(), ...existing],
                  themes: next.themes,
                  themeLinks: next.themeLinks,
                  judgeSettled: next.judgeSettled,
                }),
            JSON.stringify(nextState),
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
    if (!(await say(companionDisplayText(answer), rows)))
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
    text: companionDisplayText(question.text),
    delivered: () => redis.set(key + ":asked", question.text),
  };
}
