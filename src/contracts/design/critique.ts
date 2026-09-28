import { z } from "zod";
import { EvidenceId } from "../ids.ts";
import {
  CaptureId,
  CritiqueFindingId,
  CritiqueReportId,
  DesignDirectionId,
  DirectionChoiceId,
  HumanDecisionId,
  IntentStatementId,
  NonEmptyText,
  ReferenceAspectId,
  SystemModelId,
  SystemTokenId,
} from "./common.ts";

/** Typed citations make the reason for a critique inspectable and resolvable. */
export const CritiqueSupportRef = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("intent-statement"), id: IntentStatementId }).strict(),
  z.object({ kind: z.literal("reference-aspect"), id: ReferenceAspectId }).strict(),
  z.object({ kind: z.literal("state-evidence"), id: CaptureId }).strict(),
  z.object({ kind: z.literal("system-model"), id: SystemModelId }).strict(),
  z.object({ kind: z.literal("system-token"), id: SystemTokenId }).strict(),
  z.object({ kind: z.literal("human-decision"), id: HumanDecisionId }).strict(),
  z.object({ kind: z.literal("direction-choice"), id: DirectionChoiceId }).strict(),
]);

/** Choice assessments must cite source material, not the generated choice they assess. */
export const ChoiceGroundingRef = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("intent-statement"), id: IntentStatementId }).strict(),
  z.object({ kind: z.literal("reference-aspect"), id: ReferenceAspectId }).strict(),
  z.object({ kind: z.literal("state-evidence"), id: CaptureId }).strict(),
  z.object({ kind: z.literal("system-model"), id: SystemModelId }).strict(),
  z.object({ kind: z.literal("system-token"), id: SystemTokenId }).strict(),
  z.object({ kind: z.literal("human-decision"), id: HumanDecisionId }).strict(),
]);

export const CritiqueFinding = z
  .object({
    id: CritiqueFindingId,
    category: z.enum([
      "necessity",
      "specificity",
      "consistency",
      "exception",
      "dependency",
      "default-suspicion",
      "hierarchy",
      "accessibility",
      "responsive",
      "motion",
    ]),
    severity: z.enum(["informational", "low", "medium", "high", "blocking"]),
    supportRefs: z.array(CritiqueSupportRef).min(1),
    rationale: NonEmptyText,
    suggestedResolution: NonEmptyText,
  })
  .strict();

export const ChoiceSupportAssessment = z
  .object({
    choiceRef: DirectionChoiceId,
    assessment: z.enum(["supported", "weakly-supported", "unsupported-default-like"]),
    supportRefs: z.array(ChoiceGroundingRef).min(1),
    rationale: NonEmptyText,
  })
  .strict();

export const CritiqueReport = z
  .object({
    schemaVersion: z.literal(2),
    id: CritiqueReportId,
    directionRef: DesignDirectionId,
    intentRefs: z.array(IntentStatementId).min(1),
    evidenceRefs: z.array(EvidenceId).min(1),
    findings: z.array(CritiqueFinding),
    choiceAssessments: z.array(ChoiceSupportAssessment).min(1),
    uncertainties: z.array(NonEmptyText),
  })
  .strict();

export type CritiqueSupportRef = z.infer<typeof CritiqueSupportRef>;
export type ChoiceGroundingRef = z.infer<typeof ChoiceGroundingRef>;
export type CritiqueFinding = z.infer<typeof CritiqueFinding>;
export type ChoiceSupportAssessment = z.infer<typeof ChoiceSupportAssessment>;
export type CritiqueReport = z.infer<typeof CritiqueReport>;
