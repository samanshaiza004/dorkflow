import { z } from "zod";
import { EvidenceId } from "../ids.ts";
import {
  DesignIntentId,
  NonEmptyText,
  ReferenceId,
  ReferenceSourceId,
  ReferenceSetId,
  ShortText,
} from "./common.ts";

export const ReferenceAspect = z
  .object({
    aspect: z.string().trim().min(1).max(120),
    rationale: NonEmptyText,
  })
  .strict();

export const Reference = z
  .object({
    schemaVersion: z.literal(1),
    id: ReferenceId,
    label: ShortText,
    sourceId: ReferenceSourceId,
    sourceKind: z.enum(["local-project", "external", "generated"]),
    use: z.array(ReferenceAspect),
    doNotUse: z.array(ReferenceAspect),
    evidenceRefs: z.array(EvidenceId).min(1),
  })
  .strict()
  .refine((reference) => reference.use.length + reference.doNotUse.length > 0, {
    message: "A reference must attribute at least one use or do-not-use aspect",
  });

// Raw URLs and repository paths belong in the quarantined source index, never in this model-facing artifact.

export const ReferenceSet = z
  .object({
    schemaVersion: z.literal(1),
    id: ReferenceSetId,
    intentRef: DesignIntentId,
    references: z.array(Reference).min(1),
  })
  .strict();

export type ReferenceAspect = z.infer<typeof ReferenceAspect>;
export type Reference = z.infer<typeof Reference>;
export type ReferenceSet = z.infer<typeof ReferenceSet>;
