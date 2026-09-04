import { describe, expect, test } from "bun:test";
import { ModelInput, TrustedObservationBundle } from "../src/contracts/observation.ts";
import { DesignSystemProposal } from "../src/contracts/proposal.ts";

const ids = {
  page: "pg_12345678",
  viewport: "vp_12345678",
  element: "el_12345678",
  evidence: "ev_12345678",
  value: "obs_12345678",
  component: "cmp_12345678",
};

const observation = {
  schemaVersion: 1 as const,
  viewports: [{ id: ids.viewport, width: 375, height: 812, deviceScaleFactor: 1, label: "mobile" as const }],
  elements: [{
    id: ids.element,
    pageKey: ids.page,
    viewportKey: ids.viewport,
    state: "default" as const,
    role: "button" as const,
    geometry: { x: 0, y: 0, width: 120, height: 44 },
    typography: {
      familyFingerprint: "fp_font_12345678",
      fontSize: 16,
      fontWeight: 700,
      lineHeight: 24,
      letterSpacing: 0,
      textAlign: "center" as const,
      textTransform: "none" as const,
    },
    paint: {
      color: "#ffffff",
      backgroundColor: "#123456",
      border: { width: 0, style: "none" as const, color: "#ffffff" },
      radius: { topLeft: 4, topRight: 4, bottomRight: 4, bottomLeft: 4 },
      shadow: null,
      opacity: 1,
    },
    layout: {
      display: "inline-block" as const,
      position: "static" as const,
      parentId: null,
      componentKey: ids.component,
      gap: 0,
      padding: { top: 8, right: 16, bottom: 8, left: 16 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      flexDirection: "none" as const,
      alignItems: "normal" as const,
      justifyContent: "normal" as const,
    },
    contentMetrics: { characterCount: 8, lineCount: 1, wraps: false },
    evidenceIds: [ids.evidence],
  }],
  values: [{
    id: ids.value,
    kind: "color" as const,
    normalizedValue: "#123456",
    units: "color" as const,
    occurrenceCount: 1,
    pageCount: 1,
    viewportCount: 1,
    elementCount: 1,
    roles: ["button" as const],
    states: ["default" as const],
    componentKeys: [ids.component],
    evidenceIds: [ids.evidence],
  }],
  relationships: [],
  inventoryStats: { elementCount: 1, valueCount: 1, relationshipCount: 0, pageCount: 1, viewportCount: 1, stateCount: 1 },
};

describe("A0 contracts", () => {
  test("accepts a trusted observation bundle and model input", () => {
    expect(TrustedObservationBundle.parse(observation)).toEqual(observation);
    expect(ModelInput.parse(observation)).toEqual(observation);
  });

  test("rejects raw or source-shaped fields in a proposal", () => {
    expect(() => DesignSystemProposal.parse({
      schemaVersion: 1,
      primitives: [{
        id: "prop_12345678",
        name: "primary",
        valueRef: ids.value,
        confidence: 0.9,
        classification: "token",
        evidenceIds: [ids.evidence],
        text: "raw content must not be here",
      }],
      semanticTokens: [],
      componentTokens: [],
      decisions: [],
      uncertainties: [],
    })).toThrow();
  });
});
