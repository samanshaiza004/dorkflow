import { describe, expect, test } from "bun:test";
import { canTransition, canUseAsKillGate, HoldoutRecord } from "../src/contracts/lifecycle.ts";

const base = {
  schemaVersion: 1 as const,
  benchmarkId: "bench_holdout_001",
  role: "sealed-holdout" as const,
  benchmarkVersion: "hidden-v1",
  createdAt: "2026-09-04T00:00:00.000Z",
  seedRecordPath: "authoring-control/seed.json",
  sourceRecordPath: "authoring-control/source.json",
  groundTruthPath: "ground-truth/hidden-v1.json",
  bundleHash: "a".repeat(64),
  evaluationLockHash: "b".repeat(64),
  resultHash: null,
};

describe("holdout lifecycle", () => {
  test("enforces CREATED -> SEALED -> EVALUATED -> REVEALED", () => {
    expect(canTransition("CREATED", "SEALED")).toBe(true);
    expect(canTransition("SEALED", "EVALUATED")).toBe(true);
    expect(canTransition("EVALUATED", "REVEALED")).toBe(true);
    expect(canTransition("REVEALED", "SEALED")).toBe(false);
  });

  test("only a sealed, locked holdout can be a kill-gate input", () => {
    expect(canUseAsKillGate(HoldoutRecord.parse({ ...base, state: "SEALED" }))).toBe(true);
    expect(canUseAsKillGate(HoldoutRecord.parse({ ...base, state: "REVEALED" }))).toBe(false);
    expect(canUseAsKillGate(HoldoutRecord.parse({ ...base, state: "BURNED" }))).toBe(false);
    expect(canUseAsKillGate(HoldoutRecord.parse({ ...base, state: "SEALED", evaluationLockHash: null }))).toBe(false);
  });
});
