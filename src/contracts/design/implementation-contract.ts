import { z } from "zod";
import { EvidenceId, ViewportKey } from "../ids.ts";
import {
  ArtifactRef,
  DesignDirectionId,
  DesignIntentId,
  DesignSlug,
  HumanDecisionId,
  ImplementationContractId,
  NonEmptyText,
  RequirementId,
  StateDefinitionId,
  SystemTokenId,
} from "./common.ts";

const RequirementBase = z.object({
  id: RequirementId,
  evidenceRefs: z.array(EvidenceId).min(1),
});

export const ContractToken = z
  .object({
    tokenRef: SystemTokenId.nullable(),
    name: z.string().trim().min(1).max(160),
    layer: z.enum(["primitive", "semantic", "component"]),
    value: z.union([z.string().trim().min(1).max(500), z.number().finite()]),
    evidenceRefs: z.array(EvidenceId).min(1),
  })
  .strict();

export const ComponentRequirement = RequirementBase.extend({
  component: DesignSlug,
  anatomy: z.array(NonEmptyText).min(1),
  rules: z.array(NonEmptyText).min(1),
}).strict();

export const StateRequirement = RequirementBase.extend({
  stateRef: StateDefinitionId,
  expectedBehavior: NonEmptyText,
}).strict();

export const MotionRequirement = RequirementBase.extend({
  trigger: DesignSlug,
  fromStateRef: StateDefinitionId,
  toStateRef: StateDefinitionId,
  durationMs: z.number().int().nonnegative(),
  delayMs: z.number().int().nonnegative(),
  easing: DesignSlug,
  reducedMotionBehavior: NonEmptyText,
}).strict();

export const ResponsiveRequirement = RequirementBase.extend({
  viewportRefs: z.array(ViewportKey).min(1),
  behavior: NonEmptyText,
}).strict();

export const AccessibilityRequirement = RequirementBase.extend({
  criterion: DesignSlug,
  requirement: NonEmptyText,
}).strict();

export const PreservationRequirement = RequirementBase.extend({
  scope: z.enum(["copy", "functionality", "accessibility", "responsive", "performance"]),
  verificationMethod: z.enum(["deterministic-check", "automated-test", "manual-review"]),
  requirement: NonEmptyText,
}).strict();

export const ExplicitException = z
  .object({
    id: RequirementId,
    subjectRef: ArtifactRef,
    requirementRef: RequirementId.nullable(),
    rationale: NonEmptyText,
    approvedByRef: HumanDecisionId,
    evidenceRefs: z.array(EvidenceId).min(1),
  })
  .strict();

export const ImplementationContract = z
  .object({
    schemaVersion: z.literal(1),
    id: ImplementationContractId,
    intentRefs: z.array(DesignIntentId).min(1),
    directionRef: DesignDirectionId,
    decisionRefs: z.array(HumanDecisionId).min(1),
    tokens: z.array(ContractToken),
    componentRequirements: z.array(ComponentRequirement),
    stateRequirements: z.array(StateRequirement),
    motionRequirements: z.array(MotionRequirement),
    responsiveRequirements: z.array(ResponsiveRequirement),
    accessibilityRequirements: z.array(AccessibilityRequirement),
    preservationRequirements: z.array(PreservationRequirement),
    explicitExceptions: z.array(ExplicitException),
  })
  .strict();

export type ContractToken = z.infer<typeof ContractToken>;
export type ComponentRequirement = z.infer<typeof ComponentRequirement>;
export type StateRequirement = z.infer<typeof StateRequirement>;
export type MotionRequirement = z.infer<typeof MotionRequirement>;
export type ResponsiveRequirement = z.infer<typeof ResponsiveRequirement>;
export type AccessibilityRequirement = z.infer<typeof AccessibilityRequirement>;
export type PreservationRequirement = z.infer<typeof PreservationRequirement>;
export type ExplicitException = z.infer<typeof ExplicitException>;
export type ImplementationContract = z.infer<typeof ImplementationContract>;
