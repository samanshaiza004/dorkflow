import { z } from "zod";
import {
  ArtifactRef,
  DecisionEdgeId,
  DecisionNodeId,
  DesignDecisionGraphId,
  NonEmptyText,
} from "./common.ts";

export const DecisionNode = z
  .object({
    id: DecisionNodeId,
    kind: z.enum([
      "intent",
      "observation",
      "reference",
      "decision",
      "human-judgment",
      "interface-property",
      "requirement",
    ]),
    statement: NonEmptyText,
    provenanceRefs: z.array(ArtifactRef).min(1),
  })
  .strict();

export const DecisionEdge = z
  .object({
    id: DecisionEdgeId,
    from: DecisionNodeId,
    to: DecisionNodeId,
    relation: z.enum([
      "supports",
      "motivates",
      "implements",
      "conflicts-with",
      "supersedes",
      "derived-from",
      "approved-by",
      "rejected-by",
      "evidenced-by",
    ]),
    provenanceRefs: z.array(ArtifactRef).min(1),
  })
  .strict();

export const DesignDecisionGraph = z
  .object({
    schemaVersion: z.literal(1),
    id: DesignDecisionGraphId,
    nodes: z.array(DecisionNode),
    edges: z.array(DecisionEdge),
  })
  .strict()
  .superRefine((graph, context) => {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    graph.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.from)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["edges", index, "from"], message: "Edge source must exist in graph nodes" });
      }
      if (!nodeIds.has(edge.to)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["edges", index, "to"], message: "Edge target must exist in graph nodes" });
      }
    });
  });

export type DecisionNode = z.infer<typeof DecisionNode>;
export type DecisionEdge = z.infer<typeof DecisionEdge>;
export type DesignDecisionGraph = z.infer<typeof DesignDecisionGraph>;
