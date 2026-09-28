import { describe, expect, test } from "bun:test";
import { DesignDecisionGraph } from "../src/contracts/design/decision-graph.ts";

const graph = {
  schemaVersion: 1,
  id: "graph_12345678",
  nodes: [
    {
      id: "node_12345678",
      kind: "intent",
      statement: "Prioritize clarity.",
      provenanceRefs: ["intent_12345678"],
    },
    {
      id: "node_abcdefgh",
      kind: "decision",
      statement: "Use a clear hierarchy.",
      provenanceRefs: ["hdec_12345678"],
    },
  ],
  edges: [
    {
      id: "edge_12345678",
      from: "node_12345678",
      to: "node_abcdefgh",
      relation: "motivates",
      provenanceRefs: ["intent_12345678"],
    },
  ],
} as const;

describe("decision graph invariants", () => {
  test("preserves valid graph data", () => {
    expect(DesignDecisionGraph.parse(graph)).toEqual(graph);
  });

  test("rejects duplicate node IDs", () => {
    const result = DesignDecisionGraph.safeParse({
      ...graph,
      nodes: [graph.nodes[0], { ...graph.nodes[1], id: graph.nodes[0].id }],
      edges: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        issue.path.join(".") === "nodes.1.id" && issue.message.includes("unique")
      )).toBe(true);
    }
  });

  test("rejects duplicate edge IDs", () => {
    const result = DesignDecisionGraph.safeParse({
      ...graph,
      edges: [
        graph.edges[0],
        { ...graph.edges[0], from: "node_abcdefgh", to: "node_12345678" },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        issue.path.join(".") === "edges.1.id" && issue.message.includes("unique")
      )).toBe(true);
    }
  });

  test("rejects self-edges", () => {
    const result = DesignDecisionGraph.safeParse({
      ...graph,
      edges: [{ ...graph.edges[0], to: graph.edges[0].from }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        issue.path.join(".") === "edges.0.to" && issue.message.includes("itself")
      )).toBe(true);
    }
  });
});
