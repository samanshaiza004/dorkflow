import { z } from "zod";
import { DesignIntentId, NonEmptyText, ShortText } from "./common.ts";

export const DesignIntent = z
  .object({
    schemaVersion: z.literal(1),
    id: DesignIntentId,
    product: ShortText,
    rationale: NonEmptyText,
    audience: z.array(ShortText).min(1),
    primaryJobs: z.array(ShortText).min(1),
    attributes: z.array(ShortText).min(1),
    avoid: z.array(ShortText),
    constraints: z.array(ShortText),
    existingStrengths: z.array(ShortText),
    existingProblems: z.array(ShortText),
  })
  .strict();

export type DesignIntent = z.infer<typeof DesignIntent>;
