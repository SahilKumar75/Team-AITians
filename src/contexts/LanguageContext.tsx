"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { type Language, translations, type Translations } from "@/lib/i18n/translations";
import {
  addToRuntimeCache,
  protectRuntimeTokens,
  restoreRuntimeTokens,
  translateRuntimeText,
} from "@/lib/i18n/runtime-text";
import {
  getCachedTranslation,
  loadPersistentTranslationCache,
  savePersistentTranslationCache,
  setCachedTranslation,
  translationCacheKey,
} from "@/lib/i18n/cache";
import { isSupportedLanguage, toLocale } from "@/lib/i18n/locale";

interface TxOptions {
  sourceLang?: Language;
  scope?: string;
  preservePlaceholders?: boolean;
}

interface LanguageContextType {
  language: Language;
  locale: string;
  setLanguage: (lang: Language) => void;
  t: Translations;
  tk: (key: string, params?: Record<string, string | number>) => string;
  tx: (text: string, opts?: TxOptions) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const VALID_LANGUAGES: Language[] = ["en", "hi", "mr", "bh"];
const UNRESOLVED_COOLDOWN_MS = 10 * 60 * 1000;
const DYNAMIC_TRANSLATION_COOLDOWN_MS = 20 * 60 * 1000;

type QueueItem = {
  maskedText: string;
  scope?: string;
};

function sanitizeTranslatedText(input: string): string {
  if (!input) return input;
  // Remove dotted-circle artifacts that can appear around Indic combining marks.
  return input.replace(/\u25CC/g, "").normalize("NFC");
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, obj);
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useAuthSession();
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedFromServer, setHasFetchedFromServer] = useState(false);
  const [dynamicTranslations, setDynamicTranslations] = useState<Record<string, string>>({});

  const missingQueue = useRef<Map<string, QueueItem>>(new Map());
  const pendingKeys = useRef<Set<string>>(new Set());
  const unresolvedUntil = useRef<Map<string, number>>(new Map());
  const translationServiceDownUntil = useRef(0);
  const translationTimeout = useRef<NodeJS.Timeout | null>(null);

  const locale = useMemo(() => toLocale(language), [language]);

  const fetchUserLanguage = useCallback(async () => {
    try {
      const response = await fetch("/api/user/language");
      if (response.ok) {
        const data = await response.json();
        if (isSupportedLanguage(data?.language)) {
          setLanguageState(data.language);
          localStorage.setItem("language", data.language);
        }
      }
    } catch (error) {
      console.error("Failed to fetch user language:", error);
    } finally {
      setIsLoading(false);
      setHasFetchedFromServer(true);
    }
  }, []);

  useEffect(() => {
    let hadSavedLanguage = false;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("language");
      if (isSupportedLanguage(saved)) {
        setLanguageState(saved);
        hadSavedLanguage = true;
      }

      const persistedRaw = loadPersistentTranslationCache();
      let needsPersistSave = false;
      const persisted = Object.fromEntries(
        Object.entries(persistedRaw).filter(([key, val]) => {
          const sanitized = typeof val === "string" ? sanitizeTranslatedText(val) : val;
          const splitAt = key.indexOf("::");
          if (splitAt <= 0) return true;
          const sourceText = key.slice(splitAt + 2);
          return typeof sanitized === "string" && sanitized !== sourceText;
        })
      ) as Record<string, string>;
      Object.keys(persisted).forEach((key) => {
        const sanitized = sanitizeTranslatedText(persisted[key]);
        if (sanitized !== persistedRaw[key]) needsPersistSave = true;
        persisted[key] = sanitized;
      });
      if (Object.keys(persistedRaw).length !== Object.keys(persisted).length || needsPersistSave) {
        savePersistentTranslationCache(persisted);
      }
      setDynamicTranslations(persisted);
      Object.entries(persisted).forEach(([key, val]) => {
        const splitAt = key.indexOf("::");
        if (splitAt > 0) {
          const lang = key.slice(0, splitAt);
          const text = key.slice(splitAt + 2);
          if (isSupportedLanguage(lang)) {
            addToRuntimeCache(lang, text, val);
          }
        }
      });
    }

    if (status === "authenticated" && !hasFetchedFromServer && !hadSavedLanguage) {
      fetchUserLanguage();
    } else if (status === "unauthenticated") {
      setIsLoading(false);
    } else if (status !== "loading") {
      setIsLoading(false);
    }
  }, [status, hasFetchedFromServer, fetchUserLanguage]);

  useEffect(() => {
    return () => {
      if (translationTimeout.current) clearTimeout(translationTimeout.current);
    };
  }, []);

  const setLanguage = useCallback(
    async (lang: Language) => {
      setLanguageState(lang);
      if (typeof window !== "undefined") {
        localStorage.setItem("language", lang);
      }

      if (session?.user) {
        try {
          await fetch("/api/user/language", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language: lang }),
          });
        } catch (error) {
          console.error("Failed to save language to server:", error);
        }
      }
    },
    [session]
  );

  const flushTranslationQueue = useCallback(
    (targetLanguage: Language) => {
      if (translationTimeout.current) clearTimeout(translationTimeout.current);

      translationTimeout.current = setTimeout(async () => {
        const items = Array.from(missingQueue.current.values());
        missingQueue.current.clear();
        if (items.length === 0) return;

        const texts = items.map((item) => item.maskedText);
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              texts,
              targetLang: targetLanguage,
              preservePlaceholders: true,
              domain: "healthcare_ui",
            }),
          });

          const data = await res.json();
          const translatedArray = Array.isArray(data?.translations) ? data.translations : [];
          if (typeof data?.warning === "string" && data.warning.trim()) {
            translationServiceDownUntil.current = Date.now() + DYNAMIC_TRANSLATION_COOLDOWN_MS;
          } else {
            translationServiceDownUntil.current = 0;
          }

          setDynamicTranslations((prev) => {
            const next = { ...prev };
            items.forEach((item, idx) => {
              const translatedMasked =
                typeof translatedArray[idx] === "string" && translatedArray[idx].trim()
                  ? sanitizeTranslatedText(translatedArray[idx])
                  : item.maskedText;
              const key = translationCacheKey(targetLanguage, item.maskedText);
              if (translatedMasked !== item.maskedText) {
                next[key] = translatedMasked;
                setCachedTranslation(targetLanguage, item.maskedText, translatedMasked);
                addToRuntimeCache(targetLanguage, item.maskedText, translatedMasked);
                unresolvedUntil.current.delete(key);
              } else {
                delete next[key];
                unresolvedUntil.current.set(key, Date.now() + UNRESOLVED_COOLDOWN_MS);
              }
              pendingKeys.current.delete(key);
            });
            savePersistentTranslationCache(next);
            return next;
          });
        } catch (err) {
          console.error("Dynamic translation request failed:", err);
          translationServiceDownUntil.current = Date.now() + DYNAMIC_TRANSLATION_COOLDOWN_MS;
          items.forEach((item) => {
            pendingKeys.current.delete(translationCacheKey(targetLanguage, item.maskedText));
          });
        }
      }, 350);
    },
    []
  );

  const tx = useCallback(
    (text: string, opts?: TxOptions) => {
      if (!text) return text;
      if (language === "en") return text;

      const preserve = opts?.preservePlaceholders !== false;
      const { masked, tokens } = preserve ? protectRuntimeTokens(text) : { masked: text, tokens: [] };

      const staticHit = translateRuntimeText(language, masked);
      if (staticHit !== masked) {
        return preserve ? restoreRuntimeTokens(staticHit, tokens) : staticHit;
      }

      const key = translationCacheKey(language, masked);
      const runtimeHit = dynamicTranslations[key] || getCachedTranslation(language, masked);
      if (runtimeHit) {
        return preserve ? restoreRuntimeTokens(runtimeHit, tokens) : runtimeHit;
      }

      const nextRetryAt = unresolvedUntil.current.get(key);
      if (typeof nextRetryAt === "number" && nextRetryAt > Date.now()) {
        return text;
      }
      if (translationServiceDownUntil.current > Date.now()) {
        return text;
      }

      if (!pendingKeys.current.has(key)) {
        pendingKeys.current.add(key);
        missingQueue.current.set(key, { maskedText: masked, scope: opts?.scope });
        flushTranslationQueue(language);
      }

      return text;
    },
    [dynamicTranslations, flushTranslationQueue, language]
  );

  const tk = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const raw = getByPath(translations[language], key);
      if (typeof raw !== "string") return tx(key, { scope: "key_fallback", preservePlaceholders: false });
      return interpolate(raw, params);
    },
    [language, tx]
  );

  const value: LanguageContextType = {
    language,
    locale,
    setLanguage,
    t: translations[language],
    tk,
    tx,
    isLoading,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
