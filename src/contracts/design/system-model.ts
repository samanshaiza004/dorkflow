import { z } from "zod";
import { ComponentKey, EvidenceId } from "../ids.ts";
import {
  Confidence,
  DesignIntentId,
  NonEmptyText,
  Sha256,
  SystemModelId,
  SystemTokenId,
} from "./common.ts";

export const SystemToken = z
  .object({
    id: SystemTokenId,
    name: z.string().trim().min(1).max(160),
    layer: z.enum(["primitive", "semantic", "component"]),
    value: z.union([z.string().trim().min(1).max(500), z.number().finite()]),
    semanticRole: z.string().trim().min(1).max(120).nullable(),
    componentRef: ComponentKey.nullable(),
    confidence: Confidence,
    evidenceRefs: z.array(EvidenceId).min(1),
  })
  .strict();

export const SystemModel = z
  .object({
    schemaVersion: z.literal(1),
    id: SystemModelId,
    intentRefs: z.array(DesignIntentId).min(1),
    sourceArtifactHashes: z.array(Sha256).min(1),
    tokens: z.array(SystemToken),
    evidenceRefs: z.array(EvidenceId).min(1),
    uncertainties: z.array(NonEmptyText),
  })
  .strict();

export type SystemToken = z.infer<typeof SystemToken>;
export type SystemModel = z.infer<typeof SystemModel>;
