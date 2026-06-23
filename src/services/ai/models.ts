export type AiProvider = "google";

export type AiModelOption = {
  id: string;
  label: string;
  provider: AiProvider;
};

export const AI_MODELS: AiModelOption[] = [
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "google" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", provider: "google" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "google" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google" },
];

export const DEFAULT_MODEL_ID: string =
  process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

export function isAllowedModel(id: string | null | undefined): boolean {
  if (!id) return false;
  return AI_MODELS.some((m) => m.id === id);
}

export function resolveModelId(id: string | null | undefined): string {
  return isAllowedModel(id) ? id! : DEFAULT_MODEL_ID;
}
