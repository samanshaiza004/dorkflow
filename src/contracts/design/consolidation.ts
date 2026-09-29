import { z } from "zod";
import {
  CaptureId,
  DesignDirectionId,
  DirectionChoiceId,
  DesignRunId,
  EvidenceRequestId,
  NonEmptyText,
  Sha256,
} from "./common.ts";
import { StateDefinition } from "./state.ts";

export const EvidenceRequest = z
  .object({
    schemaVersion: z.literal(1),
    id: EvidenceRequestId,
    candidateRef: DesignDirectionId,
    choiceRefs: z.array(DirectionChoiceId).min(1),
    claim: NonEmptyText,
    requiredState: StateDefinition,
    proofCriteria: z.array(NonEmptyText).min(1).max(12),
    status: z.enum(["requested", "captured", "reviewed"]),
    captureRefs: z.array(CaptureId),
    reviewOutcome: z.enum(["satisfied", "not-satisfied", "unresolved"]).nullable(),
  })
  .strict()
  .superRefine((request, context) => {
    if (new Set(request.choiceRefs).size !== request.choiceRefs.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["choiceRefs"], message: "Evidence request choice refs must be unique" });
    }
    if (request.status === "requested" && (request.captureRefs.length > 0 || request.reviewOutcome !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Requested evidence cannot have captures or a review outcome" });
    }
    if (request.status === "captured" && (request.captureRefs.length === 0 || request.reviewOutcome !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Captured evidence needs a capture ref and awaits human review" });
    }
    if (request.status === "reviewed" && (request.captureRefs.length === 0 || request.reviewOutcome === null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Reviewed evidence needs a capture ref and an outcome" });
    }
  });

export const EvidenceRequestSet = z
  .object({
    schemaVersion: z.literal(1),
    runRef: DesignRunId,
    candidateRef: DesignDirectionId,
    sourcePacketSha256: Sha256,
    sourceDecisionSha256: Sha256,
    requests: z.array(EvidenceRequest).min(1),
  })
  .strict()
  .superRefine((set, context) => {
    const ids = set.requests.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["requests"], message: "Evidence request IDs must be unique" });
    }
    const stateIds = set.requests.map(({ requiredState }) => requiredState.id);
    if (new Set(stateIds).size !== stateIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["requests"], message: "Evidence request state IDs must be unique" });
    }
    set.requests.forEach((request, index) => {
      if (request.candidateRef !== set.candidateRef) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["requests", index, "candidateRef"], message: "Evidence request must target this candidate" });
      }
    });
  });

export type EvidenceRequest = z.infer<typeof EvidenceRequest>;
export type EvidenceRequestSet = z.infer<typeof EvidenceRequestSet>;
