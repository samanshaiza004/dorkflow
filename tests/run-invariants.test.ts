import { describe, expect, test } from "bun:test";
import { DesignRun } from "../src/contracts/design/run.ts";

const run = {
  schemaVersion: 1,
  id: "run_12345678",
  lifecycle: "active",
  createdAt: "2026-09-27T12:00:00.000Z",
  updatedAt: "2026-09-27T12:00:00.000Z",
  stages: [
    {
      stage: "intent",
      status: "completed",
      startedAt: "2026-09-27T12:00:00.000Z",
      finishedAt: "2026-09-27T12:00:00.000Z",
      artifactRefs: ["intent_12345678"],
    },
    {
      stage: "verification",
      status: "pending",
      startedAt: null,
      finishedAt: null,
      artifactRefs: [],
    },
  ],
  artifactHashes: [],
} as const;

describe("design run invariants", () => {
  test("preserves valid run data", () => {
    expect(DesignRun.parse(run)).toEqual(run);
  });

  test("rejects duplicate stage names", () => {
    const result = DesignRun.safeParse({
      ...run,
      stages: [run.stages[0], { ...run.stages[1], stage: run.stages[0].stage }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        issue.path.join(".") === "stages.1.stage" && issue.message.includes("unique")
      )).toBe(true);
    }
  });
});
