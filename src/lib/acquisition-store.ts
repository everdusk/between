import { createHmac, randomBytes } from "node:crypto";
import type { Redis } from "@upstash/redis";
import { analyticsQuiet } from "./analytics-model";
import { todayInTimeZone } from "./zoned";
import {
  ACQUISITION_TTL, acquisitionFresh, acquisitionIds, acquisitionPayload, acquisitionRef,
  type Acquisition, type AcquisitionMessenger, type MessengerConversion,
} from "./acquisition";

export const ACQUISITION_PENDING = "between:acquisition:pending";
export const ACQUISITION_SYNC = "between:acquisition:sync";
export const ACQUISITION_LOCK = "between:acquisition:lock";
export type AcquisitionStore = Pick<Redis, "get" | "set" | "eval" | "zrange" | "zrem" | "zcard">;

export const QUEUE_CONVERSION = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('SET', KEYS[3], '1', 'EX', ARGV[3])
redis.call('ZADD', KEYS[2], ARGV[2], KEYS[1])
return 1`;

export const ACK_CONVERSIONS = `
for i = 2, #KEYS do
  local value = redis.call('GET', KEYS[i])
  if value then
    local record = cjson.decode(value)
    record.uploadId = tonumber(ARGV[1])
    redis.call('SET', KEYS[i], cjson.encode(record), 'EX', ARGV[2])
  end
  redis.call('ZREM', KEYS[1], KEYS[i])
end
return 1`;

export const RELEASE_ACQUISITION_LOCK = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

export async function createAcquisition(
  redis: AcquisitionStore,
  input: { clientId?: unknown; yclid?: unknown; ref?: unknown },
  now = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  const ref = acquisitionRef(input.ref);
  if (ref) {
    const saved = await redis.get<Acquisition>(`between:acquisition:ref:${ref}`);
    // A phone scanning a desktop QR keeps the desktop's original attribution.
    const nextYclid = acquisitionIds(input)?.yclid;
    if (saved && acquisitionFresh(saved, now) && (!nextYclid || saved.yclid === nextYclid)) return ref;
  }
  const ids = acquisitionIds(input);
  if (!ids) return null;
  const token = randomBytes(16).toString("hex");
  await redis.set(`between:acquisition:ref:${token}`, { ...ids, at: now }, { ex: ACQUISITION_TTL });
  return token;
}

/** An authenticated messenger update is required; a website button can never call this endpoint. */
export async function queueMessengerConversion(
  redis: AcquisitionStore,
  input: { payload: string | null; messenger: AcquisitionMessenger; userId: number; username?: string | null; pepper: string; owners?: string; ownerTestUntil?: number },
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const ref = acquisitionPayload(input.payload);
  if (!ref || !input.pepper || !Number.isSafeInteger(input.userId) || input.userId <= 0) return false;
  const ownerTestActive = typeof input.ownerTestUntil === "number" && Number.isSafeInteger(input.ownerTestUntil) && now < input.ownerTestUntil;
  if (analyticsQuiet({ ...input, owners: input.owners }) && !ownerTestActive) return false;
  const record = await redis.get<Acquisition>(`between:acquisition:ref:${ref}`);
  if (!record || !acquisitionFresh(record, now)) return false;
  const actor = createHmac("sha256", input.pepper).update(`${input.messenger}:${input.userId}`).digest("hex");
  const day = todayInTimeZone("Europe/Moscow", new Date(now * 1000));
  const conversion: MessengerConversion = { ...record, messenger: input.messenger, time: now };
  const queued = await redis.eval(QUEUE_CONVERSION,
    [`between:acquisition:conversion:${input.messenger}:${ref}`, ACQUISITION_PENDING, `between:acquisition:actor:${actor}:${day}`],
    [JSON.stringify(conversion), now, ACQUISITION_TTL]);
  return queued === 1;
}

export async function pendingConversions(redis: AcquisitionStore, now = Math.floor(Date.now() / 1000)) {
  const keys = await redis.zrange<string[]>(ACQUISITION_PENDING, 0, 49);
  const rows: { key: string; conversion: MessengerConversion }[] = [];
  for (const key of keys) {
    const conversion = await redis.get<MessengerConversion>(key);
    if (!conversion || conversion.uploadId || !acquisitionFresh(conversion, now)) {
      await redis.zrem(ACQUISITION_PENDING, key);
    } else rows.push({ key, conversion });
  }
  return rows;
}
