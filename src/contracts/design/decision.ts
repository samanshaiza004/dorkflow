import { z } from "zod";
import {
  ArtifactRef,
  DesignDirectionId,
  HumanDecisionId,
  NonEmptyText,
} from "./common.ts";

export const PairwiseComparison = z
  .object({
    preferredDirectionRef: DesignDirectionId,
    otherDirectionRef: DesignDirectionId,
    rationale: NonEmptyText,
  })
  .strict()
  .refine((comparison) => comparison.preferredDirectionRef !== comparison.otherDirectionRef, {
    message: "A pairwise comparison must compare two different directions",
  });

export const HumanDecision = z
  .object({
    schemaVersion: z.literal(1),
    id: HumanDecisionId,
    subjectRefs: z.array(ArtifactRef).min(1),
    disposition: z.enum(["accept", "reject", "revise", "prefer"]),
    rationale: NonEmptyText,
    pairwiseComparison: PairwiseComparison.nullable(),
  })
  .strict()
  .refine((decision) => decision.disposition !== "prefer" || decision.pairwiseComparison !== null, {
    message: "A prefer decision requires an explicit pairwise comparison and rationale",
    path: ["pairwiseComparison"],
  });

export type PairwiseComparison = z.infer<typeof PairwiseComparison>;
export type HumanDecision = z.infer<typeof HumanDecision>;
