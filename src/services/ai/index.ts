import { generateObject } from "ai";
import type { ZodType } from "zod";
import { getModel } from "./provider";

/**
 * Generates a schema-validated object from the model.
 *
 * The AI SDK forces the model to return JSON matching `schema` and parses it,
 * so callers get a typed `T` back or a thrown error — never a half-parsed blob.
 * `apiKey` is passed in (not read from env) so the call is bound to the caller's
 * resolved key. See resolveAiApiKey for how the key is chosen per user.
 */
export async function generateStructured<T>(args: {
  modelId: string;
  apiKey: string;
  schema: ZodType<T>;
  system: string;
  prompt: string;
}): Promise<T> {
  const { object } = await generateObject({
    model: getModel(args.modelId, args.apiKey),
    schema: args.schema,
    system: args.system,
    prompt: args.prompt,
  });
  return object;
}
