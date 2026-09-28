import { z } from "zod";
import { EvidenceId, ViewportKey } from "../ids.ts";
import {
  CaptureId,
  Sha256,
  StateDefinitionId,
} from "./common.ts";
import { InterfaceStateKind } from "./state.ts";

export const CapturePurpose = z.enum([
  "composition",
  "hierarchy",
  "density",
  "motion",
  "imagery",
]);

export const CaptureTrigger = z.enum([
  "initial",
  "click",
  "hover",
  "mouse-down",
  "mouse-up",
  "focus",
  "fill",
  "press",
  "check",
  "uncheck",
  "select-option",
  "tab",
]);

export const CaptureFileRef = z
  .object({
    id: CaptureId,
    sha256: Sha256,
    path: z.string().regex(/^captures\/cap_[a-z0-9]{8,64}\.png$/),
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
  })
  .strict()
  .superRefine((capture, context) => {
    if (!capture.path.endsWith(".png") || !capture.path.includes(capture.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["path"],
        message: "Capture path must match its opaque ID and media type",
      });
    }
  });

const EvidenceBase = z.object({
  schemaVersion: z.literal(1),
  id: EvidenceId,
  purpose: CapturePurpose,
  renderingEnvironmentSha256: Sha256,
  captures: z.array(CaptureFileRef).min(1),
});

export const PerceptualEvidence = z.discriminatedUnion("trustMode", [
  EvidenceBase.extend({
    trustMode: z.literal("trusted-project"),
    contentTreatment: z.literal("original"),
    originalPixelsApproved: z.literal(true),
    sanitizer: z.null(),
  }).strict(),
  EvidenceBase.extend({
    trustMode: z.literal("sanitized-external"),
    contentTreatment: z.literal("light-dom-geometry-placeholders-shadow-dom-text-suppressed"),
    originalPixelsApproved: z.literal(false),
    sanitizer: z.object({ version: z.string().min(1).max(80), sha256: Sha256 }).strict(),
  }).strict(),
  EvidenceBase.extend({
    trustMode: z.literal("generated"),
    contentTreatment: z.literal("original"),
    originalPixelsApproved: z.literal(true),
    sanitizer: z.null(),
  }).strict(),
]);

export type CaptureTrigger = z.infer<typeof CaptureTrigger>;
export type CapturePurpose = z.infer<typeof CapturePurpose>;
export type CaptureFileRef = z.infer<typeof CaptureFileRef>;
export type PerceptualEvidence = z.infer<typeof PerceptualEvidence>;
