export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "ko", label: "한국어" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];
export const DEFAULT_LANGUAGE_ID: LanguageId = "en";

export function isAllowedLanguage(id: unknown): id is LanguageId {
  return LANGUAGES.some((l) => l.id === id);
}
