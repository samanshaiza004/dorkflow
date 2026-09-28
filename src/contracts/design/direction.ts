import { z } from "zod";
import { EvidenceId } from "../ids.ts";
import {
  DesignDirectionId,
  DirectionChoiceId,
  DesignIntentId,
  DesignSlug,
  HumanDecisionId,
  NonEmptyText,
  SystemModelId,
} from "./common.ts";

export const StrategyAxes = z
  .object({
    composition: DesignSlug,
    spatialModel: DesignSlug,
    density: DesignSlug,
    navigationModel: DesignSlug,
    hierarchy: DesignSlug,
    surfaceModel: DesignSlug,
    componentAnatomy: DesignSlug,
    imagery: DesignSlug,
    motion: DesignSlug,
  })
  .strict();

export const DirectionChoice = z
  .object({
    id: DirectionChoiceId,
    area: z.enum([
      "typography",
      "palette",
      "spatial-model",
      "density",
      "layout",
      "surfaces",
      "borders",
      "imagery",
      "motion",
      "navigation",
      "component-anatomy",
    ]),
    statement: NonEmptyText,
    rationale: NonEmptyText,
    intentRefs: z.array(DesignIntentId),
    evidenceRefs: z.array(EvidenceId),
  })
  .strict()
  .refine((choice) => choice.intentRefs.length + choice.evidenceRefs.length > 0, {
    message: "A design choice must cite intent or evidence",
  });

export const DesignDirection = z
  .object({
    schemaVersion: z.literal(1),
    id: DesignDirectionId,
    thesis: NonEmptyText,
    rationale: NonEmptyText,
    intentRefs: z.array(DesignIntentId).min(1),
    evidenceRefs: z.array(EvidenceId).min(1),
    decisionRefs: z.array(HumanDecisionId),
    systemModelRefs: z.array(SystemModelId),
    strategyAxes: StrategyAxes,
    choices: z.array(DirectionChoice).min(1),
    uncertainties: z.array(NonEmptyText),
  })
  .strict();

export type StrategyAxes = z.infer<typeof StrategyAxes>;
export type DirectionChoice = z.infer<typeof DirectionChoice>;
export type DesignDirection = z.infer<typeof DesignDirection>;
