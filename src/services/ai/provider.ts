import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Builds a Gemini language model bound to a specific user's API key.
 *
 * The provider is created per call (not module-global) on purpose: the key is
 * resolved per request via resolveAiApiKey, so one user's key must never leak
 * into another user's call. Keep this the only place that touches the provider
 * SDK — all callers go through the AI SDK abstraction (ADR-005, model-agnostic).
 */
export function getModel(modelId: string, apiKey: string): LanguageModel {
  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelId);
}
