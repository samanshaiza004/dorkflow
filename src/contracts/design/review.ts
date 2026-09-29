import { z } from "zod";
import { ViewportKey } from "../ids.ts";
import {
  CaptureId,
  DesignRunId,
  Sha256,
  StateDefinitionId,
} from "./common.ts";
import { CaptureTrigger } from "./evidence.ts";
import { CritiqueReport } from "./critique.ts";
import { DesignDirection } from "./direction.ts";
import { HumanDecision } from "./decision.ts";
import { InterfaceStateKind } from "./state.ts";
import { DesignIntent } from "./intent.ts";
import { ModelEvidence, ModelReferenceSet } from "./model-input.ts";
import { SystemModel } from "./system-model.ts";
import { ModelDesignProfile } from "./profile.ts";

/** A packet path is relative to the run root and can only address sanitized perceptual captures. */
export const ReviewCapture = z
  .object({
    id: CaptureId,
    path: z.string().regex(/^perceptual\/captures\/cap_[a-z0-9]{8,64}\.png$/),
    sha256: Sha256,
    stateRef: StateDefinitionId,
    stateKind: InterfaceStateKind,
    triggerKinds: z.array(CaptureTrigger).min(1),
    viewportRef: ViewportKey,
    viewport: z
      .object({
        label: z.enum(["mobile", "tablet", "desktop"]),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict(),
    mediaType: z.literal("image/png"),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict()
  .superRefine((capture, context) => {
    if (capture.path !== `perceptual/captures/${capture.id}.png`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["path"],
        message: "Review capture path must be derived from its opaque ID",
      });
    }
  });

export const DirectionReview = z
  .object({
    direction: DesignDirection,
    critique: CritiqueReport,
  })
  .strict()
  .superRefine((review, context) => {
    if (review.critique.directionRef !== review.direction.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["critique", "directionRef"],
        message: "Review critique must assess its paired direction",
      });
    }

    const choiceIds = review.direction.choices.map((choice) => choice.id);
    const assessmentIds = review.critique.choiceAssessments.map((assessment) => assessment.choiceRef);
    if (
      new Set(assessmentIds).size !== assessmentIds.length ||
      assessmentIds.length !== choiceIds.length ||
      choiceIds.some((id) => !assessmentIds.includes(id))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["critique", "choiceAssessments"],
        message: "Review critique must assess every paired direction choice exactly once",
      });
    }
  });

/**
 * File-based human review input. Directions retain their choice-level source citations, critiques
 * retain their findings/assessments, and only referenced sanitized captures receive safe paths.
 */
export const ReviewPacket = z
  .object({
    schemaVersion: z.literal(1),
    runRef: DesignRunId,
    intent: DesignIntent,
    references: ModelReferenceSet,
    evidence: ModelEvidence,
    systemModel: SystemModel.nullable(),
    designProfile: ModelDesignProfile.optional(),
    directionReviews: z.array(DirectionReview).length(3),
    captures: z.array(ReviewCapture),
  })
  .strict()
  .superRefine((packet, context) => {
    const directionIds = packet.directionReviews.map(({ direction }) => direction.id);
    const critiqueIds = packet.directionReviews.map(({ critique }) => critique.id);
    const choiceIds = packet.directionReviews.flatMap(({ direction }) => direction.choices.map(({ id }) => id));
    const captureIds = packet.captures.map(({ id }) => id);
    const evidenceCaptures = new Map(packet.evidence.captures.map((capture) => [capture.id, capture]));

    if (packet.references.intentRef !== packet.intent.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["references", "intentRef"],
        message: "Review packet references must belong to its intent",
      });
    }
    if (packet.systemModel && !packet.systemModel.intentRefs.includes(packet.intent.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["systemModel", "intentRefs"],
        message: "Review system model must refer to this packet's intent",
      });
    }
    for (const [index, capture] of packet.captures.entries()) {
      const source = evidenceCaptures.get(capture.id);
      const matches = source && source.sha256 === capture.sha256 && source.stateRef === capture.stateRef &&
        source.stateKind === capture.stateKind && source.viewportRef === capture.viewportRef &&
        source.mediaType === capture.mediaType && source.width === capture.width && source.height === capture.height &&
        JSON.stringify(source.triggerKinds) === JSON.stringify(capture.triggerKinds) &&
        JSON.stringify(source.viewport) === JSON.stringify(capture.viewport);
      if (!matches) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["captures", index],
          message: "Review capture metadata must match model-facing evidence",
        });
      }
    }

    const requireUnique = (values: string[], path: (string | number)[], label: string) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: `${label} must be unique within a review packet`,
        });
      }
    };
    requireUnique(directionIds, ["directionReviews"], "Direction IDs");
    requireUnique(critiqueIds, ["directionReviews"], "Critique IDs");
    requireUnique(choiceIds, ["directionReviews"], "Choice IDs");
    requireUnique(captureIds, ["captures"], "Capture IDs");

    const citedCaptureIds = new Set<string>();
    for (const { direction, critique } of packet.directionReviews) {
      for (const choice of direction.choices) {
        choice.captureRefs.forEach((id) => citedCaptureIds.add(id));
      }
      for (const finding of critique.findings) {
        finding.supportRefs
          .filter((ref) => ref.kind === "state-evidence")
          .forEach((ref) => citedCaptureIds.add(ref.id));
      }
      for (const assessment of critique.choiceAssessments) {
        assessment.supportRefs
          .filter((ref) => ref.kind === "state-evidence")
          .forEach((ref) => citedCaptureIds.add(ref.id));
      }
    }
    if (
      citedCaptureIds.size !== captureIds.length ||
      captureIds.some((id) => !citedCaptureIds.has(id))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["captures"],
        message: "Packet capture map must contain exactly the captures cited by its directions and critiques",
      });
    }
  });

export const ReviewDecision = HumanDecision;

export const ReviewRecord = z
  .object({
    schemaVersion: z.literal(1),
    runRef: DesignRunId,
    packetSha256: Sha256,
    decisions: z.array(ReviewDecision).min(1),
  })
  .strict()
  .superRefine((record, context) => {
    const ids = record.decisions.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["decisions"], message: "Human decision IDs must be unique in a review record" });
    }
  });

export type ReviewCapture = z.infer<typeof ReviewCapture>;
export type DirectionReview = z.infer<typeof DirectionReview>;
export type ReviewPacket = z.infer<typeof ReviewPacket>;
export type ReviewRecord = z.infer<typeof ReviewRecord>;
