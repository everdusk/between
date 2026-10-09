import { normalizeStore, storeChangedShape } from "./migrate";
import { emptyStore, STORAGE_KEY, type TherapyStore } from "./types";

export type StorageResult =
  | { ok: true; data: TherapyStore }
  | { ok: false; error: string };

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
    const normalized = normalizeStore(parsed);
    if (!normalized) {
      return {
        ok: false,
        error: "Данные в хранилище повреждены. Можно начать заново.",
      };
    }
    if (storeChangedShape(parsed, normalized)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    return { ok: true, data: normalized };
  } catch {
    return {
      ok: false,
      error: "Не удалось прочитать сохранённые данные.",
    };
  }
}

export function saveStore(store: TherapyStore): StorageResult {
  try {
    const normalized = normalizeStore(store) ?? store;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return { ok: true, data: normalized };
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
