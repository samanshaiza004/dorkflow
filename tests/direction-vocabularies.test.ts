import { describe, expect, test } from "bun:test";
import {
  DensityStrategy,
  DirectionChoice,
  DesignDirection,
  StrategyAxes,
  SurfaceModelStrategy,
  type DesignDirection as DesignDirectionValue,
} from "../src/contracts/design/direction.ts";

const baseDirection: DesignDirectionValue = {
  schemaVersion: 2,
  id: "dir_12345678",
  thesis: "Make operational work easy to scan.",
  rationale: "The interface prioritizes quick reading and reliable actions.",
  intentRefs: ["istat_12345678"],
  evidenceRefs: ["ev_12345678"],
  decisionRefs: [],
  systemModelRefs: [],
  strategyAxes: {
    composition: "editorial-grid",
    spatialModel: "contained",
    density: "balanced",
    navigationModel: "top-bar",
    hierarchy: "typographic",
    surfaceModel: "flat",
    componentAnatomy: "compact-rows",
    imagery: "documentary",
    motion: "restrained",
  },
  choices: [{
    id: "choice_12345678",
    area: "navigation",
    statement: "Keep primary actions in a top bar.",
    rationale: "This keeps navigation predictable.",
    intentRefs: ["istat_12345678"],
    referenceAspectRefs: [],
    evidenceRefs: ["ev_12345678"],
    captureRefs: [],
  }],
  uncertainties: [],
};

function withChoice(
  area: "density" | "surfaces",
  rationale = "This category needs a project-specific treatment.",
): DesignDirectionValue["choices"][number] {
  return {
    id: area === "density" ? "choice_density123" : "choice_surface123",
    area,
    statement: `Use a project-specific ${area} treatment.`,
    rationale,
    intentRefs: ["istat_abcdefgh"],
    referenceAspectRefs: [],
    evidenceRefs: ["ev_12345678"],
    captureRefs: [],
  };
}

describe("direction strategy axis vocabularies", () => {
  test("accepts the controlled density and surface categories", () => {
    expect(DensityStrategy.options).toEqual([
      "sparse", "relaxed", "balanced", "compact", "dense", "other",
    ]);
    expect(SurfaceModelStrategy.options).toEqual([
      "flat", "bounded", "elevated", "layered", "immersive", "other",
    ]);

    for (const density of DensityStrategy.options) {
      const direction = structuredClone(baseDirection);
      direction.strategyAxes.density = density;
      if (density === "other") direction.choices.push(withChoice("density"));
      expect(DesignDirection.safeParse(direction).success).toBe(true);
    }

    for (const surfaceModel of SurfaceModelStrategy.options) {
      const direction = structuredClone(baseDirection);
      direction.strategyAxes.surfaceModel = surfaceModel;
      if (surfaceModel === "other") direction.choices.push(withChoice("surfaces"));
      expect(DesignDirection.safeParse(direction).success).toBe(true);
    }
  });

  test("rejects uncontrolled values only on density and surfaceModel", () => {
    expect(StrategyAxes.safeParse({
      ...baseDirection.strategyAxes,
      composition: "custom-composition",
      density: "information-dense",
    }).success).toBe(false);

    expect(StrategyAxes.safeParse({
      ...baseDirection.strategyAxes,
      surfaceModel: "tonal-layers",
    }).success).toBe(false);

    const otherAxesDirection = structuredClone(baseDirection);
    otherAxesDirection.strategyAxes.composition = "custom-composition";
    otherAxesDirection.strategyAxes.navigationModel = "custom-navigation";
    expect(DesignDirection.safeParse(otherAxesDirection).success).toBe(true);
  });

  test("requires an area-matched, reasoned choice for each axis set to other", () => {
    const densityDirection = structuredClone(baseDirection);
    densityDirection.strategyAxes.density = "other";
    expect(DesignDirection.safeParse(densityDirection).success).toBe(false);

    densityDirection.choices.push(withChoice("surfaces"));
    expect(DesignDirection.safeParse(densityDirection).success).toBe(false);

    densityDirection.choices.push(withChoice("density"));
    expect(DesignDirection.safeParse(densityDirection).success).toBe(true);

    const surfaceDirection = structuredClone(baseDirection);
    surfaceDirection.strategyAxes.surfaceModel = "other";
    surfaceDirection.choices.push(withChoice("surfaces", "   "));
    expect(DesignDirection.safeParse(surfaceDirection).success).toBe(false);

    surfaceDirection.choices[1] = withChoice("surfaces");
    expect(DesignDirection.safeParse(surfaceDirection).success).toBe(true);
  });

  test("choice provenance cites intent statements, reference aspects, or evidence", () => {
    const choice = structuredClone(baseDirection.choices[0]!);
    choice.intentRefs = ["istat_abcdefgh"];
    choice.evidenceRefs = [];
    expect(DirectionChoice.safeParse(choice).success).toBe(true);

    choice.intentRefs = [];
    choice.referenceAspectRefs = ["raspect_12345678"];
    expect(DirectionChoice.safeParse(choice).success).toBe(true);

    choice.referenceAspectRefs = [];
    choice.evidenceRefs = ["ev_12345678"];
    expect(DirectionChoice.safeParse(choice).success).toBe(true);

    choice.evidenceRefs = [];
    choice.captureRefs = ["cap_12345678"];
    expect(DirectionChoice.safeParse(choice).success).toBe(true);

    choice.captureRefs = [];
    choice.evidenceRefs = [];
    expect(DirectionChoice.safeParse(choice).success).toBe(false);

    expect(DirectionChoice.safeParse({
      ...choice,
      intentRefs: ["intent_12345678"],
    }).success).toBe(false);
  });

  test("a category difference is normalization only, not evidence of creativity", () => {
    const first = structuredClone(baseDirection);
    const second = structuredClone(baseDirection);
    second.strategyAxes.density = "dense";

    const parsedFirst = DesignDirection.parse(first);
    const parsedSecond = DesignDirection.parse(second);
    expect(parsedFirst.strategyAxes.density).not.toBe(parsedSecond.strategyAxes.density);
    expect(parsedSecond).not.toHaveProperty("creativity");
  });
});
