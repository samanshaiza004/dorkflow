import { z } from "zod";
import { EvidenceId } from "../contracts/ids.ts";
import {
  B9HumanReviewId,
  DesignRunId,
  ImplementationContractId,
  IsoTimestamp,
  NonEmptyText,
  RequirementId,
  Sha256,
  VerificationReportId,
} from "../contracts/design/common.ts";
import { identityHash } from "../environment/hash.ts";

export const B9RequirementStatus = z.enum([
  "PASS",
  "FAIL",
  "HUMAN-REVIEW",
  "NOT-APPLICABLE",
]);

export const B9RequirementResult = z
  .object({
    requirementId: RequirementId,
    status: B9RequirementStatus,
    method: z.enum([
      "browser-dom",
      "browser-interaction",
      "copy-inventory",
      "contrast-measurement",
      "source-provenance",
      "human-review",
      "combined",
    ]),
    evidenceRefs: z.array(EvidenceId).min(1),
    rationale: NonEmptyText,
  })
  .strict();

export type B9RequirementResult = z.infer<typeof B9RequirementResult>;

export const B9EvidenceArtifact = z
  .object({
    id: EvidenceId,
    path: z.string().trim().min(1),
    sha256: Sha256,
    kind: z.enum(["measurement", "screenshot", "source-record", "event-log"]),
    description: NonEmptyText,
  })
  .strict();

export const B9HumanReviewItem = z
  .object({
    id: B9HumanReviewId,
    status: z.enum(["PENDING", "COMPLETED"]),
    question: NonEmptyText,
    evidenceRefs: z.array(EvidenceId).min(1),
    disposition: z.enum(["PASS", "REVISE", "FAIL"]).optional(),
    rationale: NonEmptyText.optional(),
  })
  .strict()
  .superRefine((item, context) => {
    const hasOutcome = item.disposition !== undefined && item.rationale !== undefined;
    if (item.status === "COMPLETED" && !hasOutcome) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Completed human review requires disposition and rationale" });
    }
    if (item.status === "PENDING" && (item.disposition !== undefined || item.rationale !== undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Pending human review cannot contain a disposition or rationale" });
    }
  });

const GitCommit = z.string().regex(/^[a-f0-9]{40}$/);

export const B9VerificationReport = z
  .object({
    schemaVersion: z.literal(1),
    id: VerificationReportId,
    runRef: DesignRunId,
    contractRef: ImplementationContractId,
    checkedAt: IsoTimestamp,
    status: z.enum(["PASS", "FAIL", "REVIEW-PENDING"]),
    frozenInputs: z
    .object({
        contractSha256: Sha256,
        verificationHarnessSha256: Sha256,
        controlCommit: GitCommit,
        b6CandidateTreeSha256: Sha256,
        implementationBaseCommit: GitCommit,
        implementationCommit: GitCommit,
        renderingEnvironmentSha256: Sha256,
        fontSha256: Sha256,
      })
      .strict(),
    runtime: z
      .object({
        browser: z.string().trim().min(1),
        browserVersion: z.string().trim().min(1),
        nodeVersion: z.string().trim().min(1),
        platform: z.string().trim().min(1),
        architecture: z.string().trim().min(1),
        locale: z.string().trim().min(1),
        timezoneId: z.string().trim().min(1),
        deviceScaleFactor: z.number().positive(),
        viewportWidths: z.array(z.number().int().positive()).min(1),
      })
      .strict(),
    requirements: z.array(B9RequirementResult).min(1),
    evidenceArtifacts: z.array(B9EvidenceArtifact).min(1),
    humanReview: z.array(B9HumanReviewItem),
    deviations: z.array(
      z
        .object({
          id: z.string().regex(/^deviation_[a-z0-9]{8,64}$/),
          requirementRefs: z.array(RequirementId).min(1),
          detectedAt: NonEmptyText,
          disposition: NonEmptyText,
        })
        .strict(),
    ),
  })
  .strict();

export type B9VerificationReport = z.infer<typeof B9VerificationReport>;

export const B9HumanReviewResolutionItem = z
  .object({
    reviewItemRef: B9HumanReviewId,
    disposition: z.enum(["PASS", "REVISE", "FAIL"]),
    requirementRefs: z.array(RequirementId).min(1),
    rationale: NonEmptyText,
  })
  .strict();
export type B9HumanReviewResolutionItem = z.infer<typeof B9HumanReviewResolutionItem>;

export const B9HumanReviewResolution = z
  .object({
    schemaVersion: z.literal(1),
    reportRef: VerificationReportId,
    reportSha256: Sha256,
    decidedAt: IsoTimestamp,
    resolutions: z.array(B9HumanReviewResolutionItem),
  })
  .strict()
  .superRefine((resolution, context) => {
    const reviewIds = resolution.resolutions.map(({ reviewItemRef }) => reviewItemRef);
    if (new Set(reviewIds).size !== reviewIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["resolutions"], message: "B9 review item resolutions must be unique" });
    }
    const requirementIds = resolution.resolutions.flatMap(({ requirementRefs }) => requirementRefs);
    if (new Set(requirementIds).size !== requirementIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["resolutions"], message: "A B9 requirement may be resolved only once" });
    }
  });
export type B9HumanReviewResolution = z.infer<typeof B9HumanReviewResolution>;

export const B9RequirementOutcome = z
  .object({
    requirementId: RequirementId,
    status: B9RequirementStatus,
    resolutionRefs: z.array(B9HumanReviewId),
  })
  .strict();
export type B9RequirementOutcome = z.infer<typeof B9RequirementOutcome>;

export const B9VerificationClosure = z
  .object({
    schemaVersion: z.literal(1),
    reportRef: VerificationReportId,
    reportSha256: Sha256,
    resolutionSha256: Sha256,
    decidedAt: IsoTimestamp,
    status: z.enum(["PASS", "FAIL", "REVIEW-PENDING"]),
    resolutions: z.array(B9HumanReviewResolutionItem),
    requirementOutcomes: z.array(B9RequirementOutcome).min(1),
  })
  .strict();
export type B9VerificationClosure = z.infer<typeof B9VerificationClosure>;

/** Applies a separately recorded human resolution without mutating the frozen verification report. */
export function resolveB9Verification(
  reportValue: unknown,
  actualReportSha256: string,
  resolutionValue: unknown,
): B9VerificationClosure {
  const report = B9VerificationReport.parse(reportValue);
  const resolution = B9HumanReviewResolution.parse(resolutionValue);
  const reportSha256 = Sha256.parse(actualReportSha256);
  if (resolution.reportRef !== report.id || resolution.reportSha256 !== reportSha256) {
    throw new Error("B9 human resolution is not bound to this exact verification report");
  }

  const pendingReviews = report.humanReview.filter(({ status }) => status === "PENDING").map(({ id }) => id);
  const resolutionRefs = resolution.resolutions.map(({ reviewItemRef }) => reviewItemRef);
  if (pendingReviews.length !== resolutionRefs.length || pendingReviews.some((id) => !resolutionRefs.includes(id))) {
    throw new Error("B9 human resolution must address every and only pending review item");
  }

  const requirementStatuses = new Map(report.requirements.map(({ requirementId, status }) => [requirementId, status]));
  const resolutionByRequirement = new Map<string, B9HumanReviewResolutionItem>();
  for (const item of resolution.resolutions) {
    for (const requirementRef of item.requirementRefs) {
      if (requirementStatuses.get(requirementRef) !== "HUMAN-REVIEW") {
        throw new Error(`B9 resolution ${item.reviewItemRef} references a requirement that is not pending human review: ${requirementRef}`);
      }
      resolutionByRequirement.set(requirementRef, item);
    }
  }
  const unresolvedRequirements = report.requirements
    .filter(({ status }) => status === "HUMAN-REVIEW")
    .map(({ requirementId }) => requirementId)
    .filter((requirementId) => !resolutionByRequirement.has(requirementId));
  if (unresolvedRequirements.length > 0) {
    throw new Error(`B9 human resolution omits pending requirements: ${unresolvedRequirements.join(", ")}`);
  }

  const requirementOutcomes = report.requirements.map(({ requirementId, status }) => {
    const resolution = resolutionByRequirement.get(requirementId);
    const resolvedStatus = resolution?.disposition === "PASS"
      ? "PASS"
      : resolution?.disposition === "FAIL"
        ? "FAIL"
        : resolution?.disposition === "REVISE"
          ? "HUMAN-REVIEW"
          : status;
    return B9RequirementOutcome.parse({
      requirementId,
      status: resolvedStatus,
      resolutionRefs: resolution ? [resolution.reviewItemRef] : [],
    });
  });

  return B9VerificationClosure.parse({
    schemaVersion: 1,
    reportRef: report.id,
    reportSha256,
    resolutionSha256: identityHash(resolution),
    decidedAt: resolution.decidedAt,
    status: summarizeB9Requirements(requirementOutcomes),
    resolutions: resolution.resolutions,
    requirementOutcomes,
  });
}

/** Enforce one explicit B9 outcome for every requirement in the frozen contract. */
export function completeB9RequirementResults(
  expectedRequirementIds: readonly string[],
  untrustedResults: readonly unknown[],
): B9RequirementResult[] {
  const expected = expectedRequirementIds.map((id) => RequirementId.parse(id));
  const expectedSet = new Set(expected);
  if (expectedSet.size !== expected.length) {
    throw new Error("Frozen contract contains duplicate requirement IDs");
  }

  const parsed = untrustedResults.map((result) => B9RequirementResult.parse(result));
  const byId = new Map<string, B9RequirementResult>();
  for (const result of parsed) {
    if (byId.has(result.requirementId)) {
      throw new Error(`Duplicate B9 result for ${result.requirementId}`);
    }
    if (!expectedSet.has(result.requirementId)) {
      throw new Error(`Unexpected B9 result for ${result.requirementId}`);
    }
    byId.set(result.requirementId, result);
  }

  const missing = expected.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`Missing B9 results for: ${missing.join(", ")}`);
  }
  return expected.map((id) => byId.get(id)!);
}

/** Hard failures take precedence; pending human judgments never become a pass. */
export function summarizeB9Requirements(
  results: readonly Pick<B9RequirementResult, "status">[],
): "PASS" | "FAIL" | "REVIEW-PENDING" {
  if (results.length === 0) throw new Error("Cannot summarize an empty B9 result set");
  if (results.some(({ status }) => status === "FAIL")) return "FAIL";
  if (results.some(({ status }) => status === "HUMAN-REVIEW")) return "REVIEW-PENDING";
  return "PASS";
}
