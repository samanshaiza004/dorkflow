import { expect, test } from "bun:test";
import { EvidenceRequestSet } from "../src/contracts/design/consolidation.ts";

const digest = "a".repeat(64);
const request = {
  schemaVersion: 1 as const,
  id: "ereq_00000001",
  candidateRef: "dir_00000001",
  choiceRefs: ["choice_00000001"],
  claim: "The proposed mobile order keeps the just-added row connected to the updated balance.",
  requiredState: {
    schemaVersion: 1 as const,
    id: "st_00000001",
    pagePath: "/",
    viewport: { label: "mobile", width: 375, height: 812 },
    setupActions: [],
    targetSelector: ".summary",
    stateKind: "custom" as const,
    settleMs: 0,
    assertions: [{ selector: ".summary", condition: "visible" as const }],
  },
  proofCriteria: ["The visible history includes the new row.", "The resulting balance is visible in the same capture."],
  status: "requested" as const,
  captureRefs: [],
  reviewOutcome: null,
};

const evidenceRequestSet = {
  schemaVersion: 1 as const,
  runRef: "run_00000001",
  candidateRef: "dir_00000001",
  sourcePacketSha256: digest,
  sourceDecisionSha256: digest,
  requests: [request],
};

test("evidence request sets bind requested states to one candidate and source review", () => {
  expect(EvidenceRequestSet.parse(evidenceRequestSet)).toEqual(evidenceRequestSet);
  expect(() => EvidenceRequestSet.parse({
    ...evidenceRequestSet,
    requests: [{ ...request, candidateRef: "dir_00000002" }],
  })).toThrow("Evidence request must target this candidate");
});

test("evidence request lifecycle distinguishes requested, captured, and human-reviewed evidence", () => {
  expect(() => EvidenceRequestSet.parse({
    ...evidenceRequestSet,
    requests: [{ ...request, status: "captured" }],
  })).toThrow("Captured evidence needs a capture ref");

  expect(() => EvidenceRequestSet.parse({
    ...evidenceRequestSet,
    requests: [{ ...request, status: "reviewed", captureRefs: ["cap_00000001"] }],
  })).toThrow("Reviewed evidence needs a capture ref and an outcome");
});
