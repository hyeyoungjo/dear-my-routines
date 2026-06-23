// TODO: install ai + @ai-sdk/google + zod, then restore real implementation
// import { generateObject } from "ai";
// import type { z } from "zod";
import { getModel } from "./provider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateStructured<T>(args: {
  modelId: string;
  schema: unknown;
  system: string;
  prompt: string;
}): Promise<T> {
  void getModel(args.modelId); // throws: AI packages not installed
  throw new Error("AI packages not installed. Run: npm install ai @ai-sdk/google zod");
}
