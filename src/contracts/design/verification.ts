import { z } from "zod";
import { EvidenceId } from "../ids.ts";
import {
  ArtifactRef,
  DesignRunId,
  ImplementationContractId,
  NonEmptyText,
  RequirementId,
  VerificationReportId,
} from "./common.ts";

export const VerificationCheck = z
  .object({
    id: RequirementId,
    category: z.enum([
      "behavior",
      "accessibility",
      "responsiveness",
      "content-preservation",
      "visual-regression",
      "perceptual-review",
      "performance",
      "design-system",
    ]),
    result: z.enum(["pass", "fail", "blocked", "not-run"]),
    subjectRefs: z.array(ArtifactRef).min(1),
    evidenceRefs: z.array(EvidenceId),
    rationale: NonEmptyText,
  })
  .strict();

export const VerificationReport = z
  .object({
    schemaVersion: z.literal(1),
    id: VerificationReportId,
    contractRef: ImplementationContractId,
    runRef: DesignRunId,
    createdAt: z.string().datetime({ offset: true }),
    status: z.enum(["pass", "fail", "blocked", "incomplete"]),
    checks: z.array(VerificationCheck).min(1),
  })
  .strict();

export type VerificationCheck = z.infer<typeof VerificationCheck>;
export type VerificationReport = z.infer<typeof VerificationReport>;
