import { z } from "zod";
import {
  DesignRunId,
  IsoTimestamp,
  ModelInvocationId,
  Sha256,
  ShortText,
} from "./common.ts";
import { DesignProfileProvenance } from "./profile.ts";

export const ModelInvocationRole = z.enum(["direction-generation", "critique"]);

export const ModelSamplingSettings = z.object({
  temperature: z.number().finite().nullable(),
  topP: z.number().finite().nullable(),
  seed: z.number().int().nonnegative().nullable(),
  maxOutputTokens: z.number().int().positive().nullable(),
}).strict();

export const ModelTokenUsage = z.object({
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
}).strict();

export const ModelToolPermissions = z.object({
  enabled: z.boolean(),
  allowedTools: z.array(ShortText),
}).strict().superRefine((permissions, context) => {
  if (!permissions.enabled && permissions.allowedTools.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowedTools"],
      message: "A call with tools disabled cannot list allowed tools",
    });
  }
});

/** Provider-supplied facts for one model call; hashes and role are attached by the runner. */
export const ModelInvocationMetadata = z.object({
  provider: ShortText,
  model: ShortText,
  modelVersion: ShortText.nullable(),
  sampling: ModelSamplingSettings,
  tokenUsage: ModelTokenUsage,
  toolPermissions: ModelToolPermissions,
  startedAt: IsoTimestamp,
  finishedAt: IsoTimestamp,
}).strict().refine((metadata) => Date.parse(metadata.finishedAt) >= Date.parse(metadata.startedAt), {
  message: "finishedAt must not precede startedAt",
  path: ["finishedAt"],
});

export const ModelInvocation = z.object({
  schemaVersion: z.literal(1),
  id: ModelInvocationId,
  role: ModelInvocationRole,
  provider: ShortText,
  model: ShortText,
  modelVersion: ShortText.nullable(),
  promptVersion: ShortText,
  promptSha256: Sha256,
  inputSha256: Sha256,
  outputSha256: Sha256,
  sampling: ModelSamplingSettings,
  tokenUsage: ModelTokenUsage,
  toolPermissions: ModelToolPermissions,
  startedAt: IsoTimestamp,
  finishedAt: IsoTimestamp,
}).strict().refine((invocation) => Date.parse(invocation.finishedAt) >= Date.parse(invocation.startedAt), {
  message: "finishedAt must not precede startedAt",
  path: ["finishedAt"],
});

export const ProcessArtifactDigest = z.object({
  path: z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/),
  sha256: Sha256,
}).strict();

export const DesignProcessManifest = z.object({
  schemaVersion: z.literal(1),
  id: DesignRunId,
  status: z.enum(["direction-gate-failed", "critiqued"]),
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp,
  modelInputSha256: Sha256,
  renderingEnvironmentSha256: Sha256,
  designProfile: DesignProfileProvenance.nullable().optional(),
  promptVersions: z.object({ directions: ShortText, critique: ShortText }).strict(),
  modelRelationship: z.enum(["not-compared", "same-model", "different-model"]),
  invocationRefs: z.array(ModelInvocationId).min(1),
  artifactDigests: z.array(ProcessArtifactDigest).min(1),
}).strict().superRefine((manifest, context) => {
  if (Date.parse(manifest.updatedAt) < Date.parse(manifest.createdAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["updatedAt"], message: "updatedAt must not precede createdAt" });
  }
  if (new Set(manifest.invocationRefs).size !== manifest.invocationRefs.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["invocationRefs"], message: "Invocation references must be unique" });
  }
  if (manifest.status === "direction-gate-failed" &&
      (manifest.invocationRefs.length !== 1 || manifest.modelRelationship !== "not-compared")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["invocationRefs"],
      message: "A failed direction gate has exactly one invocation and no model comparison",
    });
  }
  if (manifest.status === "critiqued" &&
      (manifest.invocationRefs.length !== 2 || manifest.modelRelationship === "not-compared")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["modelRelationship"],
      message: "A critiqued run records generation and critique invocations with a model comparison",
    });
  }
  const paths = manifest.artifactDigests.map((item) => item.path);
  if (new Set(paths).size !== paths.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifactDigests"], message: "Artifact paths must be unique" });
  }
});

export type ModelInvocationRole = z.infer<typeof ModelInvocationRole>;
export type ModelSamplingSettings = z.infer<typeof ModelSamplingSettings>;
export type ModelTokenUsage = z.infer<typeof ModelTokenUsage>;
export type ModelToolPermissions = z.infer<typeof ModelToolPermissions>;
export type ModelInvocationMetadata = z.infer<typeof ModelInvocationMetadata>;
export type ModelInvocation = z.infer<typeof ModelInvocation>;
export type DesignProcessManifest = z.infer<typeof DesignProcessManifest>;
