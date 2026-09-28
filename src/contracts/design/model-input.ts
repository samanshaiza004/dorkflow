import { z } from "zod";
import { EvidenceId, ViewportKey } from "../ids.ts";
import { CapturePurpose, CaptureTrigger } from "./evidence.ts";
import { DesignIntent } from "./intent.ts";
import { CaptureId, Sha256, StateDefinitionId } from "./common.ts";
import { ReferenceAspect } from "./reference.ts";
import { ReferenceId, ReferenceSetId, DesignIntentId } from "./common.ts";
import { InterfaceStateKind } from "./state.ts";
import { SystemModel } from "./system-model.ts";

const ModelEvidenceCapture = z.object({
  id: CaptureId,
  sha256: Sha256,
  stateRef: StateDefinitionId,
  stateKind: InterfaceStateKind,
  triggerKinds: z.array(CaptureTrigger).min(1),
  viewportRef: ViewportKey,
  viewport: z.object({
    label: z.enum(["mobile", "tablet", "desktop"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).strict(),
  mediaType: z.literal("image/png"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict();

const ModelEvidenceBase = z.object({
  schemaVersion: z.literal(1),
  id: EvidenceId,
  purpose: CapturePurpose,
  renderingEnvironmentSha256: Sha256,
  captures: z.array(ModelEvidenceCapture).min(1),
});

export const ModelEvidence = z.discriminatedUnion("trustMode", [
  ModelEvidenceBase.extend({
    trustMode: z.literal("trusted-project"),
    contentTreatment: z.literal("original"),
    originalPixelsApproved: z.literal(true),
    sanitizer: z.null(),
  }).strict(),
  ModelEvidenceBase.extend({
    trustMode: z.literal("sanitized-external"),
    contentTreatment: z.literal("light-dom-geometry-placeholders-shadow-dom-text-suppressed"),
    originalPixelsApproved: z.literal(false),
    sanitizer: z.object({ version: z.string().min(1).max(80), sha256: Sha256 }).strict(),
  }).strict(),
  ModelEvidenceBase.extend({
    trustMode: z.literal("generated"),
    contentTreatment: z.literal("original"),
    originalPixelsApproved: z.literal(true),
    sanitizer: z.null(),
  }).strict(),
]);

// Source labels and source IDs stay in the authoring/source index; the model only needs attributed aspects.
const ModelReference = z.object({
  schemaVersion: z.literal(2),
  id: ReferenceId,
  sourceKind: z.enum(["local-project", "external", "generated"]),
  use: z.array(ReferenceAspect),
  doNotUse: z.array(ReferenceAspect),
  evidenceRefs: z.array(EvidenceId).min(1),
}).strict();

export const ModelReferenceSet = z.object({
  schemaVersion: z.literal(2),
  id: ReferenceSetId,
  intentRef: DesignIntentId,
  references: z.array(ModelReference).min(1),
}).strict();

const ModelCapture = ModelEvidenceCapture.extend({
  imageBase64: z.string().min(32).max(12_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();

export const DesignModelInput = z
  .object({
    schemaVersion: z.literal(1),
    intent: DesignIntent,
    references: ModelReferenceSet,
    evidence: ModelEvidence,
    captures: z.array(ModelCapture).min(1),
    systemModel: SystemModel.nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.references.intentRef !== input.intent.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["references", "intentRef"],
        message: "Reference set must belong to the supplied intent",
      });
    }

    const evidenceId = input.evidence.id;
    input.references.references.forEach((reference, referenceIndex) => {
      reference.evidenceRefs.forEach((id, evidenceIndex) => {
        if (id !== evidenceId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["references", "references", referenceIndex, "evidenceRefs", evidenceIndex],
            message: "Reference evidence citation is not present in this model input",
          });
        }
      });
    });

    if (input.systemModel && !input.systemModel.intentRefs.includes(input.intent.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["systemModel", "intentRefs"],
        message: "System model must cite the supplied intent",
      });
    }

    const captureIds = input.captures.map((capture) => capture.id);
    if (new Set(captureIds).size !== captureIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["captures"],
        message: "Model-facing capture IDs must be unique",
      });
    }
    const evidenceCaptures = new Map(input.evidence.captures.map((capture) => [capture.id, capture]));
    if (captureIds.length !== evidenceCaptures.size || captureIds.some((id) => !evidenceCaptures.has(id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["captures"],
        message: "Model input must include exactly the captures described by its evidence",
      });
    }
    input.captures.forEach((capture, index) => {
      const metadata = evidenceCaptures.get(capture.id);
      if (!metadata) return;
      for (const field of ["sha256", "stateRef", "stateKind", "viewportRef", "mediaType", "width", "height"] as const) {
        if (capture[field] !== metadata[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["captures", index, field],
            message: "Capture model input metadata must match its evidence record",
          });
        }
      }
      if (JSON.stringify(capture.triggerKinds) !== JSON.stringify(metadata.triggerKinds) ||
          JSON.stringify(capture.viewport) !== JSON.stringify(metadata.viewport)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["captures", index],
          message: "Capture triggers and viewport must match the evidence record",
        });
      }
    });
  });

export type ModelEvidence = z.infer<typeof ModelEvidence>;
export type ModelReferenceSet = z.infer<typeof ModelReferenceSet>;
export type ModelCapture = z.infer<typeof ModelCapture>;
export type DesignModelInput = z.infer<typeof DesignModelInput>;
