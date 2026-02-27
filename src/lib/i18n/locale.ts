import type { Language } from "@/lib/i18n/translations";

export const LANGUAGE_TO_BCP47: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  bh: "hi-IN", // Bhojpuri recognition fallback via Hindi STT
};

export const LANGUAGE_TO_LABEL: Record<Language, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  bh: "Bhojpuri",
};

export function toLocale(language: Language): string {
  return LANGUAGE_TO_BCP47[language] || "en-IN";
}

export function isSupportedLanguage(input: unknown): input is Language {
  return input === "en" || input === "hi" || input === "mr" || input === "bh";
}
