import { after } from "next/server";
import { getRedis } from "./redis";
import { queueMessengerConversion } from "./acquisition-store";
import { syncAcquisition } from "./acquisition-sync";
import type { AcquisitionMessenger } from "./acquisition";

export function scheduleAcquisitionSync() {
  after(async () => {
    try {
      const redis = getRedis();
      if (redis) await syncAcquisition(redis);
    } catch {
      console.warn("messenger acquisition upload unavailable");
    }
  });
}

export async function trackMessengerStart(input: { payload: string | null; messenger: AcquisitionMessenger; userId: number; username?: string | null }) {
  try {
    const redis = getRedis();
    const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim();
    if (!redis || !pepper) return;
    // Persist before acknowledging the messenger webhook; upload after its reply.
    await queueMessengerConversion(redis, { ...input, pepper, owners: process.env.ANALYTICS_OWNERS });
    scheduleAcquisitionSync();
  } catch {
    console.warn("messenger acquisition could not be recorded");
  }
}
