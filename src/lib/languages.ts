export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "ko", label: "한국어" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];
export const DEFAULT_LANGUAGE_ID: LanguageId = "en";

export function isAllowedLanguage(id: unknown): id is LanguageId {
  return LANGUAGES.some((l) => l.id === id);
}

/**
 * The native label for a language id (e.g. "ko" → "한국어"), used to tell the AI
 * which language to answer in. Falls back to the default language's label for an
 * unknown/null id (null = user never picked one, so the UI default applies).
 */
export function languageLabel(id: string | null | undefined): string {
  return (
    LANGUAGES.find((l) => l.id === id)?.label ??
    LANGUAGES.find((l) => l.id === DEFAULT_LANGUAGE_ID)!.label
  );
}
