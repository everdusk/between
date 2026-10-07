import { emptyStore, STORAGE_KEY, type TherapyStore } from "./types";

export type StorageResult =
  | { ok: true; data: TherapyStore }
  | { ok: false; error: string };

function isStore(value: unknown): value is TherapyStore {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    Array.isArray(v.entries) &&
    Array.isArray(v.sessions) &&
    Array.isArray(v.weekPreps)
  );
}

export function loadStore(): StorageResult {
  try {
    if (typeof window === "undefined") {
      return { ok: true, data: emptyStore() };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ok: true, data: emptyStore() };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isStore(parsed)) {
      return {
        ok: false,
        error: "Данные в хранилище повреждены. Можно начать заново.",
      };
    }
    return { ok: true, data: parsed };
  } catch {
    return {
      ok: false,
      error: "Не удалось прочитать сохранённые данные.",
    };
  }
}

export function saveStore(store: TherapyStore): StorageResult {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return { ok: true, data: store };
  } catch {
    return {
      ok: false,
      error:
        "Не удалось сохранить. Возможно, закончилось место в браузере.",
    };
  }
}

export function clearStore(): StorageResult {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return { ok: true, data: emptyStore() };
  } catch {
    return { ok: false, error: "Не удалось очистить хранилище." };
  }
}
