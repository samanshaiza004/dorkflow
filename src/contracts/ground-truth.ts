import { z } from "zod";
import { GroundTruthId } from "./ids.ts";
import { ValueKind } from "./observation.ts";

export const BenchmarkRole = z.enum(["calibration", "development", "sealed-holdout"]);
export const GroundTruthClassification = z.enum(["intentional", "incidental"]);
export const GroundTruthLayer = z.enum(["primitive", "semantic", "component"]);

export const GroundTruthConcept = z
  .object({
    id: GroundTruthId,
    layer: GroundTruthLayer,
    classification: GroundTruthClassification,
    valueKind: ValueKind,
    canonicalValue: z.union([z.string(), z.number()]),
    semanticRole: z.string().min(1),
    componentRole: z.string().nullable(),
    componentSlot: z.string().nullable(),
    importanceWeight: z.number().positive(),
    major: z.boolean(),
    exercisedEvidenceIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const GroundTruthDataset = z
  .object({
    schemaVersion: z.literal(1),
    benchmarkRole: BenchmarkRole,
    benchmarkVersion: z.string().min(1),
    concepts: z.array(GroundTruthConcept).min(1),
  })
  .strict();

export type GroundTruthDataset = z.infer<typeof GroundTruthDataset>;
