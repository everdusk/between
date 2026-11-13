import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cached: Uint8Array | null = null;

/** The flow picture on the welcome. Read once per process. */
export async function loadWelcomeImage(): Promise<Uint8Array | null> {
  if (cached) return cached;
  try {
    const bytes = await readFile(join(process.cwd(), "public/welcome-flow.png"));
    if (bytes.byteLength < 32 || bytes[0] !== 0x89) return null;
    cached = new Uint8Array(bytes);
    return cached;
  } catch {
    return null;
  }
}
