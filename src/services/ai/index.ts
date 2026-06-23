import { generateObject } from "ai";
import type { z } from "zod";
import { getModel } from "./provider";

export async function generateStructured<T>(args: {
  modelId: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
}): Promise<T> {
  const model = getModel(args.modelId);
  const result = await generateObject({
    model,
    schema: args.schema,
    system: args.system,
    prompt: args.prompt,
  });
  return result.object;
}
