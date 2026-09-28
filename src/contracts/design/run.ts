import { z } from "zod";
import { ArtifactRef, DesignRunId, IsoTimestamp, Sha256 } from "./common.ts";

export const RunLifecycle = z.enum([
  "created",
  "active",
  "blocked",
  "completed",
  "failed",
  "cancelled",
]);

export const RunStageName = z.enum([
  "intent",
  "references",
  "evidence-capture",
  "system-recovery",
  "directions",
  "critique",
  "human-review",
  "consolidation",
  "implementation-contract",
  "implementation",
  "verification",
]);

export const RunStage = z
  .object({
    stage: RunStageName,
    status: z.enum(["pending", "active", "completed", "blocked", "failed", "skipped"]),
    startedAt: IsoTimestamp.nullable(),
    finishedAt: IsoTimestamp.nullable(),
    artifactRefs: z.array(ArtifactRef),
  })
  .strict()
  .refine((stage) => stage.status !== "completed" || stage.finishedAt !== null, {
    message: "A completed stage must have a finish timestamp",
    path: ["finishedAt"],
  });

export const RunArtifactHash = z
  .object({
    artifactRef: ArtifactRef,
    sha256: Sha256,
  })
  .strict();

export const DesignRun = z
  .object({
    schemaVersion: z.literal(1),
    id: DesignRunId,
    lifecycle: RunLifecycle,
    createdAt: IsoTimestamp,
    updatedAt: IsoTimestamp,
    stages: z.array(RunStage).min(1),
    artifactHashes: z.array(RunArtifactHash),
  })
  .strict()
  .refine((run) => run.updatedAt >= run.createdAt, {
    message: "updatedAt must not precede createdAt",
    path: ["updatedAt"],
  });

export type RunLifecycle = z.infer<typeof RunLifecycle>;
export type RunStageName = z.infer<typeof RunStageName>;
export type RunStage = z.infer<typeof RunStage>;
export type RunArtifactHash = z.infer<typeof RunArtifactHash>;
export type DesignRun = z.infer<typeof DesignRun>;
