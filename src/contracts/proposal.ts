import { z } from "zod";
import {
  ComponentKey,
  EvidenceId,
  ObservationValueId,
  ProposalId,
  RelationshipId,
} from "./ids.ts";

const confidence = z.number().min(0).max(1);
const name = z.string().regex(/^[a-z][a-z0-9._-]{1,80}$/);
const evidence = z.array(EvidenceId).min(1);
const classification = z.enum(["token", "intentional-decision", "incidental", "unknown"]);

export const PrimitiveCandidate = z
  .object({
    id: ProposalId,
    name,
    valueRef: ObservationValueId,
    confidence,
    classification,
    evidenceIds: evidence,
  })
  .strict();

export const SemanticTokenCandidate = z
  .object({
    id: ProposalId,
    name,
    valueRef: ObservationValueId,
    roles: z.array(z.enum(["text", "surface", "action", "border", "focus", "layout", "status", "unknown"])).min(1),
    confidence,
    classification,
    evidenceIds: evidence,
  })
  .strict();

export const ComponentTokenCandidate = z
  .object({
    id: ProposalId,
    name,
    componentKey: ComponentKey,
    slot: z.enum(["background", "foreground", "border", "radius", "shadow", "padding", "gap", "font", "focus", "layout", "unknown"]),
    valueRef: ObservationValueId.nullable(),
    relationshipRefs: z.array(RelationshipId),
    confidence,
    classification,
    evidenceIds: evidence,
  })
  .strict();

export const DecisionCandidate = z
  .object({
    id: ProposalId,
    subjectRefs: z.array(z.union([ProposalId, ObservationValueId])).min(1),
    classification: z.enum(["intentional", "incidental", "uncertain"]),
    confidence,
    evidenceIds: evidence,
  })
  .strict();

export const DesignSystemProposal = z
  .object({
    schemaVersion: z.literal(1),
    primitives: z.array(PrimitiveCandidate),
    semanticTokens: z.array(SemanticTokenCandidate),
    componentTokens: z.array(ComponentTokenCandidate),
    decisions: z.array(DecisionCandidate),
    uncertainties: z.array(DecisionCandidate),
  })
  .strict();

export type DesignSystemProposal = z.infer<typeof DesignSystemProposal>;
