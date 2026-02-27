import type { Language } from "@/lib/i18n/translations";
import { toLocale } from "@/lib/i18n/locale";

export function formatDateByLanguage(
  value: Date | string | number,
  language: Language,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(toLocale(language), options).format(date);
}

export function formatNumberByLanguage(
  value: number,
  language: Language,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(toLocale(language), options).format(value);
}
