import { z } from "zod";
import { EvidenceId } from "../ids.ts";
import {
  DesignIntentId,
  NonEmptyText,
  ReferenceAspectId,
  ReferenceId,
  ReferenceSourceId,
  ReferenceSetId,
  ShortText,
} from "./common.ts";

export const ReferenceAspect = z
  .object({
    id: ReferenceAspectId,
    aspect: z.string().trim().min(1).max(120),
    rationale: NonEmptyText,
  })
  .strict();

export const Reference = z
  .object({
    schemaVersion: z.literal(2),
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
  })
  .superRefine((reference, context) => {
    const seen = new Set<string>();
    for (const field of ["use", "doNotUse"] as const) {
      reference[field].forEach((aspect, index) => {
        if (seen.has(aspect.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field, index, "id"],
            message: "Reference aspect IDs must be unique within a reference",
          });
        }
        seen.add(aspect.id);
      });
    }
  });

// Raw URLs and repository paths belong in the quarantined source index, never in this model-facing artifact.

export const ReferenceSet = z
  .object({
    schemaVersion: z.literal(2),
    id: ReferenceSetId,
    intentRef: DesignIntentId,
    references: z.array(Reference).min(1),
  })
  .strict()
  .superRefine((set, context) => {
    const referenceIds = new Set<string>();
    const aspectIds = new Set<string>();
    set.references.forEach((reference, referenceIndex) => {
      if (referenceIds.has(reference.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["references", referenceIndex, "id"],
          message: "Reference IDs must be unique within a reference set",
        });
      }
      referenceIds.add(reference.id);
      for (const field of ["use", "doNotUse"] as const) {
        reference[field].forEach((aspect, aspectIndex) => {
          if (aspectIds.has(aspect.id)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["references", referenceIndex, field, aspectIndex, "id"],
              message: "Reference aspect IDs must be unique within a reference set",
            });
          }
          aspectIds.add(aspect.id);
        });
      }
    });
  });

export type ReferenceAspect = z.infer<typeof ReferenceAspect>;
export type Reference = z.infer<typeof Reference>;
export type ReferenceSet = z.infer<typeof ReferenceSet>;
