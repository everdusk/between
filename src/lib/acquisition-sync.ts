import { randomBytes } from "node:crypto";
import { conversionCsv, ACQUISITION_TTL } from "./acquisition";
import {
  ACK_CONVERSIONS, ACQUISITION_LOCK, ACQUISITION_PENDING, ACQUISITION_SYNC,
  RELEASE_ACQUISITION_LOCK, pendingConversions, type AcquisitionStore,
} from "./acquisition-store";
import { YANDEX_METRIKA_ID } from "./landing";

type UploadOptions = { token?: string; counterId?: number; send?: typeof fetch };

/** Accepted upload != matched conversion. Store the upload id for checking in Metrika. */
export async function syncAcquisition(redis: AcquisitionStore, options: UploadOptions = {}) {
  const token = options.token ?? process.env.METRIKA_OAUTH_TOKEN?.trim();
  if (!token) return { status: "not_configured", pending: await redis.zcard(ACQUISITION_PENDING) };
  const lock = randomBytes(16).toString("hex");
  if (!await redis.set(ACQUISITION_LOCK, lock, { nx: true, ex: 60 })) return { status: "busy" };
  try {
    const rows = await pendingConversions(redis);
    if (!rows.length) return { status: "empty", pending: await redis.zcard(ACQUISITION_PENDING) };
    const form = new FormData();
    form.set("file", new Blob([conversionCsv(rows.map((row) => row.conversion))], { type: "text/csv;charset=utf-8" }), "messenger-starts.csv");
    const response = await (options.send ?? fetch)(
      `https://api-metrika.yandex.net/management/v1/counter/${options.counterId ?? YANDEX_METRIKA_ID}/offline_conversions/upload`,
      { method: "POST", headers: { Authorization: `OAuth ${token}` }, body: form, signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) throw new Error(`Metrika HTTP ${response.status}`);
    const body = await response.json() as { uploading?: { id?: number } };
    const uploadId = body.uploading?.id;
    if (!Number.isSafeInteger(uploadId) || (uploadId ?? 0) <= 0) throw new Error("Metrika returned no upload id");
    await redis.eval(ACK_CONVERSIONS, [ACQUISITION_PENDING, ...rows.map((row) => row.key)], [uploadId!, ACQUISITION_TTL]);
    const result = { status: "uploaded", accepted: rows.length, uploadId, at: new Date().toISOString() };
    await redis.set(ACQUISITION_SYNC, result, { ex: ACQUISITION_TTL });
    return result;
  } catch (error) {
    const result = { status: "error", error: error instanceof Error && error.message.startsWith("Metrika ") ? error.message : "Upload failed; pending conversions retained", at: new Date().toISOString() };
    await redis.set(ACQUISITION_SYNC, result, { ex: ACQUISITION_TTL });
    return result;
  } finally {
    await redis.eval(RELEASE_ACQUISITION_LOCK, [ACQUISITION_LOCK], [lock]);
  }
}
