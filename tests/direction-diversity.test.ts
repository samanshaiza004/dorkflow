import { describe, expect, test } from "bun:test";
import {
  STRATEGY_AXES,
  validateDirectionDiversity,
  type DesignDirection,
  type StrategyAxes,
} from "../src/design/direction-diversity.ts";

function direction(id: string, overrides: Partial<StrategyAxes> = {}): DesignDirection {
  return {
    id,
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
      ...overrides,
    },
  };
}

describe("validateDirectionDiversity", () => {
  test("does not treat palette-only differences as a direction axis", () => {
    const withPalettes: DesignDirection[] = ["a", "b"].map((id, index) => {
      const candidate = direction(id);
      Object.assign(candidate.strategyAxes, {
        palette: index === 0 ? "blue" : "orange",
      });
      return candidate;
    });

    expect(STRATEGY_AXES).not.toContain("palette");
    expect(STRATEGY_AXES).not.toContain("color");
    const report = validateDirectionDiversity(withPalettes);
    expect(report.passed).toBe(false);
    expect(report.pairs[0]).toMatchObject({
      directionIds: ["a", "b"],
      differingAxes: [],
      differenceCount: 0,
    });
  });

  test("fails pairs with fewer than three differing axes", () => {
    const report = validateDirectionDiversity([
      direction("one", { composition: "asymmetric-columns" }),
      direction("two", { spatialModel: "edge-to-edge" }),
    ]);

    expect(report.passed).toBe(false);
    expect(report.failedPairs).toHaveLength(1);
    expect(report.failedPairs[0]).toMatchObject({
      differingAxes: ["composition", "spatialModel"],
      differenceCount: 2,
      passes: false,
    });
  });

  test("passes pairs that differ on at least three axes", () => {
    const report = validateDirectionDiversity([
      direction("a"),
      direction("b", {
        composition: "asymmetric-columns",
        spatialModel: "edge-to-edge",
        density: "dense",
      }),
      direction("c", {
        navigationModel: "left-rail",
        hierarchy: "color-led",
        surfaceModel: "tonal-layers",
        componentAnatomy: "feature-panels",
        imagery: "illustrative",
        motion: "expressive",
      }),
    ]);

    expect(report.passed).toBe(true);
    expect(report.failedPairs).toHaveLength(0);
    expect(report.pairs[0]).toMatchObject({
      directionIds: ["a", "b"],
      differingAxes: ["composition", "spatialModel", "density"],
      differenceCount: 3,
      passes: true,
    });
  });

  test("requires three candidate directions before the set can pass", () => {
    const report = validateDirectionDiversity([
      direction("a"),
      direction("b", {
        composition: "asymmetric-columns",
        spatialModel: "edge-to-edge",
        density: "dense",
      }),
    ]);

    expect(report.hasEnoughDirections).toBe(false);
    expect(report.minimumDirectionCount).toBe(3);
    expect(report.passed).toBe(false);
  });

  test("rejects duplicate direction IDs", () => {
    expect(() =>
      validateDirectionDiversity([direction("same"), direction("same")]),
    ).toThrow("Direction IDs must be unique; duplicate ID: same");
  });

  test("is deterministic and pair ordering is independent of input order", () => {
    const input = [
      direction("c", { imagery: "none", motion: "none" }),
      direction("a", { composition: "modular" }),
      direction("b", {
        composition: "asymmetric-columns",
        spatialModel: "edge-to-edge",
        density: "dense",
      }),
    ];
    const untouchedSnapshot = structuredClone(input);
    const forward = validateDirectionDiversity(input);
    const reverse = validateDirectionDiversity([...input].reverse());

    expect(forward).toEqual(reverse);
    expect(forward.pairs.map((pair) => pair.directionIds)).toEqual([
      ["a", "b"],
      ["a", "c"],
      ["b", "c"],
    ]);
    expect(input).toEqual(untouchedSnapshot);
    expect(validateDirectionDiversity(input)).toEqual(forward);
  });
});
