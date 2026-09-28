import { z } from "zod";
import { EvidenceId } from "../ids.ts";
import {
  CaptureId,
  DesignDirectionId,
  DirectionChoiceId,
  DesignSlug,
  HumanDecisionId,
  IntentStatementId,
  NonEmptyText,
  ReferenceAspectId,
  SystemModelId,
} from "./common.ts";

export const DensityStrategy = z.enum([
  "sparse",
  "relaxed",
  "balanced",
  "compact",
  "dense",
  "other",
]);

export const SurfaceModelStrategy = z.enum([
  "flat",
  "bounded",
  "elevated",
  "layered",
  "immersive",
  "other",
]);

export const StrategyAxes = z
  .object({
    composition: DesignSlug,
    spatialModel: DesignSlug,
    density: DensityStrategy,
    navigationModel: DesignSlug,
    hierarchy: DesignSlug,
    surfaceModel: SurfaceModelStrategy,
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
    intentRefs: z.array(IntentStatementId),
    referenceAspectRefs: z.array(ReferenceAspectId),
    evidenceRefs: z.array(EvidenceId),
    captureRefs: z.array(CaptureId),
  })
  .strict()
  .refine(
    (choice) =>
      choice.intentRefs.length +
        choice.referenceAspectRefs.length +
        choice.evidenceRefs.length +
        choice.captureRefs.length >
      0,
    {
      message: "A design choice must cite an intent statement, reference aspect, or evidence",
    },
  );

export const DesignDirection = z
  .object({
    schemaVersion: z.literal(2),
    id: DesignDirectionId,
    thesis: NonEmptyText,
    rationale: NonEmptyText,
    intentRefs: z.array(IntentStatementId).min(1),
    evidenceRefs: z.array(EvidenceId).min(1),
    decisionRefs: z.array(HumanDecisionId),
    systemModelRefs: z.array(SystemModelId),
    strategyAxes: StrategyAxes,
    choices: z.array(DirectionChoice).min(1),
    uncertainties: z.array(NonEmptyText),
  })
  .strict()
  .superRefine((direction, context) => {
    const otherAxisRequirements = [
      {
        axis: "density",
        value: direction.strategyAxes.density,
        area: "density",
      },
      {
        axis: "surfaceModel",
        value: direction.strategyAxes.surfaceModel,
        area: "surfaces",
      },
    ] as const;

    for (const requirement of otherAxisRequirements) {
      if (
        requirement.value === "other" &&
        !direction.choices.some(
          (choice) => choice.area === requirement.area && choice.rationale.trim().length > 0,
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["choices"],
          message: `${requirement.axis} set to "other" requires a ${requirement.area} choice with rationale`,
        });
      }
    }
  });

export type StrategyAxes = z.infer<typeof StrategyAxes>;
export type DensityStrategy = z.infer<typeof DensityStrategy>;
export type SurfaceModelStrategy = z.infer<typeof SurfaceModelStrategy>;
export type DirectionChoice = z.infer<typeof DirectionChoice>;
export type DesignDirection = z.infer<typeof DesignDirection>;
