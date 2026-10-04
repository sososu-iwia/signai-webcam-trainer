import { useSyncExternalStore } from "react";
import { en, type MessageKey } from "./en";
import { ru } from "./ru";
export type Language = "en" | "ru";
export const languageStorageKey = "signai.language";
export function initialLanguage(
  stored: string | null,
  browser: string,
): Language {
  if (stored === "en" || stored === "ru") return stored;
  return browser.toLowerCase().startsWith("ru") ? "ru" : "en";
}
function readLanguage(): Language {
  let stored = null;
  try {
    stored = localStorage.getItem(languageStorageKey);
  } catch {
    stored = null;
  }
  return initialLanguage(
    stored,
    typeof navigator === "undefined" ? "en" : navigator.language,
  );
}
let language = readLanguage();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setLanguage(next: Language) {
  try {
    localStorage.setItem(languageStorageKey, next);
  } catch {
    language = next;
  }
  language = next;
  if (typeof document !== "undefined") document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}
if (typeof document !== "undefined") document.documentElement.lang = language;
export function translate(
  locale: Language,
  key: MessageKey,
  values: Record<string, string | number> = {},
) {
  const message = locale === "ru" ? ru[key] : en[key];
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    String(values[name] ?? placeholder),
  );
}
export function displayText(
  locale: Language,
  value: string | null | undefined,
): string {
  if (!value) return "";
  return Object.hasOwn(en, value)
    ? translate(locale, value as MessageKey)
    : value;
}
const pluralForms = {
  en: {
    day: ["day", "days", "days", "days"],
    attempt: ["attempt", "attempts", "attempts", "attempts"],
    session: [
      "completed session",
      "completed sessions",
      "completed sessions",
      "completed sessions",
    ],
    shape: [
      "shape completed",
      "shapes completed",
      "shapes completed",
      "shapes completed",
    ],
  },
  ru: {
    day: ["день", "дня", "дней", "дня"],
    attempt: ["попытка", "попытки", "попыток", "попытки"],
    session: [
      "занятие завершено",
      "занятия завершено",
      "занятий завершено",
      "занятия завершено",
    ],
    shape: [
      "форма выполнена",
      "формы выполнены",
      "форм выполнено",
      "формы выполнены",
    ],
  },
} as const;
export function plural(
  locale: Language,
  unit: keyof typeof pluralForms.en,
  count: number,
  includeCount = true,
) {
  const category = new Intl.PluralRules(locale).select(count);
  const index =
    category === "one"
      ? 0
      : category === "few"
        ? 1
        : category === "many"
          ? 2
          : 3;
  return `${includeCount ? `${count} ` : ""}${pluralForms[locale][unit][index]}`;
}
const translators = {
  en: createTranslator("en"),
  ru: createTranslator("ru"),
};
function createTranslator(locale: Language) {
  return {
    locale,
    t: (key: MessageKey, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    text: (value: string | null | undefined) => displayText(locale, value),
    plural: (
      unit: keyof typeof pluralForms.en,
      count: number,
      includeCount = true,
    ) => plural(locale, unit, count, includeCount),
  };
}
export function useI18n() {
  const current = useSyncExternalStore(subscribe, () => language);
  return translators[current];
}
