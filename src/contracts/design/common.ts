import { z } from "zod";
import {
  ComponentKey,
  ElementId,
  EvidenceId,
  GroundTruthId,
  ObservationValueId,
  PageKey,
  ProposalId,
  RelationshipId,
  ViewportKey,
} from "../ids.ts";

const opaque = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[a-z0-9]{8,64}$`));

export const DesignIntentId = opaque("intent");
export const IntentStatementId = opaque("istat");
export const ReferenceId = opaque("ref");
export const ReferenceAspectId = opaque("raspect");
export const ReferenceSourceId = opaque("refsrc");
export const ReferenceSetId = opaque("refs");
export const StateDefinitionId = opaque("st");
export const StateMatrixId = opaque("matrix");
export const CaptureId = opaque("cap");
export const SystemModelId = opaque("sys");
export const SystemTokenId = opaque("tok");
export const DesignDirectionId = opaque("dir");
export const DirectionChoiceId = opaque("choice");
export const CritiqueReportId = opaque("crit");
export const CritiqueFindingId = opaque("finding");
export const EvidenceRequestId = opaque("ereq");
export const ModelInvocationId = opaque("inv");
export const HumanDecisionId = opaque("hdec");
export const DesignDecisionGraphId = opaque("graph");
export const DecisionNodeId = opaque("node");
export const DecisionEdgeId = opaque("edge");
export const ImplementationContractId = opaque("contract");
export const RequirementId = opaque("req");
export const VerificationReportId = opaque("verify");
export const DesignRunId = opaque("run");
export const ProjectId = opaque("proj");
export const B9HumanReviewId = opaque("b9review");

export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const DesignSlug = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(64);
export const NonEmptyText = z.string().trim().min(1).max(5000);
export const ShortText = z.string().trim().min(1).max(500);
export const Confidence = z.number().finite().min(0).max(1);
export const IsoTimestamp = z.string().datetime({ offset: true });

// A closed union keeps provenance links opaque while rejecting arbitrary identifiers.
export const ArtifactRef = z.union([
  DesignIntentId,
  IntentStatementId,
  ReferenceId,
  ReferenceAspectId,
  ReferenceSetId,
  StateDefinitionId,
  StateMatrixId,
  CaptureId,
  SystemModelId,
  SystemTokenId,
  DesignDirectionId,
  DirectionChoiceId,
  CritiqueReportId,
  CritiqueFindingId,
  ModelInvocationId,
  HumanDecisionId,
  DesignDecisionGraphId,
  DecisionNodeId,
  DecisionEdgeId,
  ImplementationContractId,
  RequirementId,
  EvidenceRequestId,
  VerificationReportId,
  B9HumanReviewId,
  DesignRunId,
  ElementId,
  EvidenceId,
  GroundTruthId,
  ObservationValueId,
  PageKey,
  ProposalId,
  RelationshipId,
  ComponentKey,
  ViewportKey,
]);

export const EvidenceRefs = z.array(EvidenceId).min(1);
export const IntentRefs = z.array(IntentStatementId).min(1);
