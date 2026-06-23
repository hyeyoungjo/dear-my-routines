// TODO: install ai + @ai-sdk/google, then restore real implementation
// import { createGoogleGenerativeAI } from "@ai-sdk/google";
// import type { LanguageModel } from "ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModel(modelId: string): any {
  void modelId;
  throw new Error("AI packages not installed. Run: npm install ai @ai-sdk/google zod");
}
