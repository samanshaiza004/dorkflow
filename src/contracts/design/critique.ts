import { z } from "zod";
import { EvidenceId } from "../ids.ts";
import {
  ArtifactRef,
  CritiqueFindingId,
  CritiqueReportId,
  DesignDirectionId,
  DesignIntentId,
  NonEmptyText,
} from "./common.ts";

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
    refs: z.array(ArtifactRef).min(1),
    evidenceRefs: z.array(EvidenceId).min(1),
    rationale: NonEmptyText,
    suggestedResolution: NonEmptyText,
  })
  .strict();

export const CritiqueReport = z
  .object({
    schemaVersion: z.literal(1),
    id: CritiqueReportId,
    directionRef: DesignDirectionId,
    intentRefs: z.array(DesignIntentId).min(1),
    evidenceRefs: z.array(EvidenceId).min(1),
    findings: z.array(CritiqueFinding),
    uncertainties: z.array(NonEmptyText),
  })
  .strict();

export type CritiqueFinding = z.infer<typeof CritiqueFinding>;
export type CritiqueReport = z.infer<typeof CritiqueReport>;
