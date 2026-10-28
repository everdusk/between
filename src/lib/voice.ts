import { normalizeAitunnelKey } from "@/app/api/brief/route";

export const WHISPER_MODEL = "whisper-1";
export const VOICE_DAILY_LIMIT = 10;
export const VOICE_BODY_MAX = 8000;
const VOICE_BYTES_MAX = 20 * 1024 * 1024;

const AUDIO_EXT = /\.(ogg|oga|mp3|m4a|wav|webm|mpeg|mp4)$/i;

export function voiceFileName(filePath: string | undefined, mime: string | undefined): string {
  const fromPath = filePath?.split("/").pop() ?? "";
  if (AUDIO_EXT.test(fromPath)) return fromPath;
  if (mime?.includes("mpeg")) return "voice.mp3";
  if (mime?.includes("mp4") || mime?.includes("m4a")) return "voice.m4a";
  if (mime?.includes("wav")) return "voice.wav";
  if (mime?.includes("webm")) return "voice.webm";
  return "voice.ogg";
}

export function transcriptFromResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const text = (payload as { text?: unknown }).text;
  return typeof text === "string" ? text.trim() : "";
}

/** Caption stays above the transcript. The journal body is capped. */
export function voiceNoteBody(transcript: string, caption = ""): string {
  const heard = transcript.trim();
  const lead = caption.trim();
  const joined = lead ? `${lead}\n${heard}` : heard;
  return joined.trim().slice(0, VOICE_BODY_MAX);
}

export function voiceReplyPreview(text: string): string {
  const clean = text.trim();
  if (clean.length <= 700) return clean;
  return `${clean.slice(0, 697)}…`;
}

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "forbidden" | "nokey" | "fail" | "big" };

export function voiceKeyReady(): boolean {
  return normalizeAitunnelKey(process.env.AITUNNEL_API_KEY).startsWith("sk-aitunnel-");
}

export async function transcribeVoice(input: {
  bytes: Uint8Array;
  filename: string;
  language?: string;
}): Promise<TranscribeResult> {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > VOICE_BYTES_MAX) {
    return { ok: false, reason: "big" };
  }
  const key = normalizeAitunnelKey(process.env.AITUNNEL_API_KEY);
  if (!key.startsWith("sk-aitunnel-")) return { ok: false, reason: "nokey" };
  const base = (process.env.AITUNNEL_BASE_URL?.trim() || "https://api.aitunnel.ru/v1").replace(
    /\/+$/,
    "",
  );
  const form = new FormData();
  form.set("model", WHISPER_MODEL);
  form.set("temperature", "0");
  if (input.language && /^[a-z]{2}$/.test(input.language)) form.set("language", input.language);
  form.set("file", new File([Buffer.from(input.bytes)], input.filename));
  try {
    const res = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (res.status === 403) return { ok: false, reason: "forbidden" };
    if (!res.ok) return { ok: false, reason: "fail" };
    const text = transcriptFromResponse(await res.json());
    if (!text) return { ok: false, reason: "empty" };
    return { ok: true, text };
  } catch {
    return { ok: false, reason: "fail" };
  }
}
