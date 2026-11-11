import { randomBytes } from "node:crypto";

export const WEEK_PDF_TTL_SECONDS = 10 * 60;
export const WEEK_PDF_MAX_BYTES = 1_500_000;

export type WeekPdfStored = {
  filename: string;
  pdf: string;
};

export type WeekPdfRedis = {
  set: (key: string, value: WeekPdfStored, options: { ex: number }) => Promise<unknown>;
  get: (key: string) => Promise<WeekPdfStored | string | null>;
};

export function weekPdfKey(id: string): string {
  return `between:week-pdf:${id}`;
}

/** Keep the download name inside the ASCII pattern the sheet already uses. */
export function safePdfName(name: string): string {
  const trimmed = name.trim();
  if (/^between-[A-Za-z0-9._-]+\.pdf$/.test(trimmed)) return trimmed;
  return "between-week.pdf";
}

export async function saveWeekPdfFile(
  redis: WeekPdfRedis,
  bytes: Uint8Array,
  filename: string,
): Promise<string> {
  if (bytes.byteLength < 5 || bytes.byteLength > WEEK_PDF_MAX_BYTES) {
    throw new Error("size");
  }
  const head = Buffer.from(bytes.subarray(0, 5)).toString("utf8");
  if (head !== "%PDF-") throw new Error("type");
  const id = randomBytes(16).toString("hex");
  await redis.set(
    weekPdfKey(id),
    { filename: safePdfName(filename), pdf: Buffer.from(bytes).toString("base64") },
    { ex: WEEK_PDF_TTL_SECONDS },
  );
  return id;
}

export async function loadWeekPdfFile(
  redis: WeekPdfRedis,
  id: string,
): Promise<{ filename: string; bytes: Uint8Array } | null> {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  const raw = await redis.get(weekPdfKey(id));
  if (!raw) return null;
  let stored: WeekPdfStored | null = null;
  if (typeof raw === "string") {
    try {
      stored = JSON.parse(raw) as WeekPdfStored;
    } catch {
      stored = null;
    }
  } else {
    stored = raw;
  }
  if (!stored || typeof stored.pdf !== "string" || typeof stored.filename !== "string") return null;
  const bytes = Buffer.from(stored.pdf, "base64");
  if (bytes.subarray(0, 5).toString("utf8") !== "%PDF-") return null;
  return { filename: safePdfName(stored.filename), bytes };
}
