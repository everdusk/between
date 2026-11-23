import { after } from "next/server";
import { analyticsQuiet } from "./analytics-model";
import { captureSurveyEvent } from "./product-analytics-server";
import { getRedis } from "./redis";
import { sessionSecret, sessionTokenFromRequest } from "./web-account";
import { accountFromSession } from "./web-account-store";

type Messenger = "telegram" | "max";
type Context = {
  attempt: string;
  device: string;
  source: "direct" | "survey";
  locale: "ru" | "en";
};

export async function quietWebAccount(req: Request) {
  const secret = sessionSecret();
  const token = secret ? sessionTokenFromRequest(req) : null;
  const account = secret && token ? await accountFromSession(token, secret) : null;
  const owners = process.env.ANALYTICS_OWNERS;
  return account && (analyticsQuiet({ username: account.telegramUsername, messenger: "web", owners }) ||
    analyticsQuiet({ userId: account.maxUserId, messenger: "max", owners }));
}

async function registrationContext(req: Request): Promise<Context | null> {
  const device = req.headers.get("x-between-device");
  const attempt = req.headers.get("x-between-attempt");
  const source = req.headers.get("x-between-source");
  const locale = req.headers.get("x-between-locale");
  if (!device || !/^[a-z0-9]{32}$/.test(device) || !attempt ||
      !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(attempt) ||
      (source !== "direct" && source !== "survey") || (locale !== "ru" && locale !== "en")) return null;
  if (await quietWebAccount(req)) return null;
  return { attempt, device, source, locale };
}

type YandexError = "provider_error" | "taken" | "server_error" | "account_not_found";

async function capture(context: Context, method: Messenger | "email" | "yandex", stage: string, reason?: YandexError) {
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim() || process.env.APP_SECRET?.trim();
  if (pepper) await captureSurveyEvent("web_registration_step", {
    messenger: "web", survey_version: 1, locale: context.locale, attempt_id: context.attempt,
    registration_source: context.source, registration_step: stage, method,
    ...(reason ? { error_operation: "oauth_callback", error_reason: reason } : {}),
  }, context.device, pepper);
}

// Keep attribution separate from the actual login challenge. Older clients send no context.
export async function rememberProviderAttempt(req: Request, method: Messenger | "yandex", token: string, ttl: number) {
  try {
    const context = await registrationContext(req);
    if (context) await getRedis()?.set(`between:registration:${method}:${token}`, context, { ex: ttl });
  } catch { /* An analytics outage must not interrupt authentication. */ }
}

export function recordBotStep(method: Messenger, token: string, stage: "bot_started" | "bot_confirmed",
  userId: number, username?: string) {
  if (analyticsQuiet({ messenger: method, userId, username, owners: process.env.ANALYTICS_OWNERS })) return;
  after(async () => {
    const context = await getRedis()?.get<Context>(`between:registration:${method}:${token}`);
    if (context) await capture(context, method, stage);
  });
}

export function recordYandexResult(state: string, stage: "signed_in" | "oauth_cancelled" | "error", reason?: YandexError) {
  after(async () => {
    const context = await getRedis()?.getdel<Context>(`between:registration:yandex:${state}`);
    if (context) await capture(context, "yandex", stage, reason);
  });
}

export function recordVerifiedEmail(req: Request) {
  after(async () => {
    const context = await registrationContext(req);
    if (context) await capture(context, "email", "code_verified");
  });
}
