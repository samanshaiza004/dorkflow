import { canTransition, HoldoutRecord, assertFreshKillGate } from "../contracts/lifecycle.ts";

const example = HoldoutRecord.parse({
  schemaVersion: 1,
  benchmarkId: "bench_hidden_v1",
  role: "sealed-holdout",
  state: "SEALED",
  benchmarkVersion: "hidden-v1",
  createdAt: "2026-09-04T00:00:00.000Z",
  seedRecordPath: "authoring-control/seed.json",
  sourceRecordPath: "authoring-control/source.json",
  groundTruthPath: "ground-truth/hidden-v1.json",
  bundleHash: "a".repeat(64),
  evaluationLockHash: "b".repeat(64),
  resultHash: null,
});

assertFreshKillGate(example);
if (!canTransition("SEALED", "EVALUATED")) throw new Error("Lifecycle smoke check failed");
console.log("A0 smoke checks passed: holdout lifecycle and kill-gate policy are active.");
