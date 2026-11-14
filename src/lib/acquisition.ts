import { LANDING_BOT_URL, LANDING_MAX_URL } from "./landing";

export type AcquisitionMessenger = "telegram" | "max";
export const ACQUISITION_TTL = 10 * 24 * 60 * 60;
export const ACQUISITION_COOKIE = "between_acquisition";
export const ACQUISITION_GOALS = {
  telegram: "messenger_start_telegram",
  max: "messenger_start_max",
} as const;

export type Acquisition = { clientId?: string; yclid?: string; at: number };
export type MessengerConversion = Acquisition & {
  messenger: AcquisitionMessenger;
  time: number;
  uploadId?: number;
};

export function acquisitionRef(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value) ? value : null;
}

export function acquisitionPayload(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("ad_") ? acquisitionRef(value.slice(3)) : null;
}

export function acquisitionIds(input: { clientId?: unknown; yclid?: unknown }): Pick<Acquisition, "clientId" | "yclid"> | null {
  const clientId = typeof input.clientId === "string" && /^\d{1,32}$/.test(input.clientId) ? input.clientId : undefined;
  const yclid = typeof input.yclid === "string" && /^\d{1,64}$/.test(input.yclid) ? input.yclid : undefined;
  return clientId || yclid ? { ...(clientId ? { clientId } : {}), ...(yclid ? { yclid } : {}) } : null;
}

export function acquisitionFresh(record: Acquisition, now = Math.floor(Date.now() / 1000)): boolean {
  return Boolean(acquisitionIds(record)) && Number.isSafeInteger(record.at) && record.at <= now && now - record.at < ACQUISITION_TTL;
}

export function messengerStartUrl(messenger: AcquisitionMessenger, ref?: string | null): string {
  const url = new URL(messenger === "telegram" ? LANDING_BOT_URL : LANDING_MAX_URL);
  if (acquisitionRef(ref)) url.searchParams.set("start", `ad_${ref}`);
  return url.toString();
}

/** Only website/click identifiers and the technical start event leave the server. */
export function conversionCsv(rows: MessengerConversion[]): string {
  return "ClientId,yclid,Target,DateTime\n" + rows.map((row) => {
    const ids = acquisitionIds(row);
    if (!ids || !Number.isSafeInteger(row.time) || !Object.hasOwn(ACQUISITION_GOALS, row.messenger)) {
      throw new Error("Invalid messenger conversion");
    }
    return `${ids.clientId ?? ""},${ids.yclid ?? ""},${ACQUISITION_GOALS[row.messenger]},${row.time}`;
  }).join("\n") + "\n";
}
