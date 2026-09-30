import { z } from "zod";
import { ArtifactRef, B9HumanReviewId, DesignRunId, IsoTimestamp, NonEmptyText, ProjectId, Sha256, VerificationReportId } from "./common.ts";
import { HumanDecision } from "./decision.ts";

const ReviewRecordSource = z.object({
  kind: z.literal("review-record"),
  runRef: DesignRunId,
  sourceSha256: Sha256,
  packetSha256: Sha256,
}).strict();

const B9ClosureSource = z.object({
  kind: z.literal("b9-closure"),
  runRef: DesignRunId,
  sourceSha256: Sha256,
  reportRef: VerificationReportId,
  reportSha256: Sha256,
  resolutionSha256: Sha256,
  reviewItemRef: B9HumanReviewId,
}).strict();

export const ProjectDecisionSource = z.discriminatedUnion("kind", [ReviewRecordSource, B9ClosureSource]);

export const ProjectDecisionHistoryManifest = z.object({
  schemaVersion: z.literal(1),
  projectId: ProjectId,
  name: NonEmptyText,
  createdAt: IsoTimestamp,
}).strict();

export const ProjectDecisionRecord = z.object({
  schemaVersion: z.literal(1),
  projectId: ProjectId,
  decisionAt: IsoTimestamp.nullable(),
  recordedAt: IsoTimestamp,
  source: ProjectDecisionSource,
  decision: HumanDecision,
}).strict();

export const ProjectDecisionDisposition = z.enum(["accept", "reject", "revise", "prefer"]);

export const ProjectDecisionQuery = z.object({
  subjectRefs: z.array(ArtifactRef).min(1).max(64),
  dispositions: z.array(ProjectDecisionDisposition).max(4).optional(),
}).strict().superRefine((query, context) => {
  if (new Set(query.subjectRefs).size !== query.subjectRefs.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["subjectRefs"], message: "Decision query references must be unique" });
  }
  if (query.dispositions && new Set(query.dispositions).size !== query.dispositions.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dispositions"], message: "Decision query dispositions must be unique" });
  }
});

export const ProjectDecisionContext = z.object({
  scope: z.literal("project-only"),
  projectId: ProjectId,
  projectName: NonEmptyText,
  query: ProjectDecisionQuery,
  precedents: z.array(ProjectDecisionRecord),
}).strict();

export type ProjectDecisionSource = z.infer<typeof ProjectDecisionSource>;
export type ProjectDecisionHistoryManifest = z.infer<typeof ProjectDecisionHistoryManifest>;
export type ProjectDecisionRecord = z.infer<typeof ProjectDecisionRecord>;
export type ProjectDecisionQuery = z.infer<typeof ProjectDecisionQuery>;
export type ProjectDecisionContext = z.infer<typeof ProjectDecisionContext>;
