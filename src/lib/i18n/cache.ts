import type { Language } from "@/lib/i18n/translations";

const STORAGE_KEY = "dynamic_translations";
const memoryCache = new Map<string, string>();

export function translationCacheKey(language: Language, text: string): string {
  return `${language}::${text}`;
}

export function getCachedTranslation(language: Language, text: string): string | undefined {
  return memoryCache.get(translationCacheKey(language, text));
}

export function setCachedTranslation(language: Language, text: string, translated: string): void {
  memoryCache.set(translationCacheKey(language, text), translated);
}

export function loadPersistentTranslationCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === "string") memoryCache.set(key, value);
    });
    return parsed;
  } catch {
    return {};
  }
}

export function savePersistentTranslationCache(entries: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage errors in private mode / quota pressure
  }
}

export function getMemoryCacheSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  memoryCache.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
