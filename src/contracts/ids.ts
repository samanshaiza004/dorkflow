import { z } from "zod";

const opaque = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[a-z0-9]{8,64}$`));

export const ElementId = opaque("el");
export const PageKey = opaque("pg");
export const ViewportKey = opaque("vp");
export const EvidenceId = opaque("ev");
export const ObservationValueId = opaque("obs");
export const RelationshipId = opaque("rel");
export const ProposalId = opaque("prop");
export const ComponentKey = opaque("cmp");
export const GroundTruthId = opaque("gt");

export type ElementId = z.infer<typeof ElementId>;
export type PageKey = z.infer<typeof PageKey>;
export type ViewportKey = z.infer<typeof ViewportKey>;
export type EvidenceId = z.infer<typeof EvidenceId>;
export type ObservationValueId = z.infer<typeof ObservationValueId>;
export type RelationshipId = z.infer<typeof RelationshipId>;
export type ProposalId = z.infer<typeof ProposalId>;
export type ComponentKey = z.infer<typeof ComponentKey>;
export type GroundTruthId = z.infer<typeof GroundTruthId>;
