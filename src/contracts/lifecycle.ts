import { z } from "zod";

export const HoldoutRole = z.enum(["development", "sealed-holdout"]);
export const HoldoutState = z.enum(["CREATED", "SEALED", "EVALUATED", "REVEALED", "BURNED"]);

export const HoldoutRecord = z
  .object({
    schemaVersion: z.literal(1),
    benchmarkId: z.string().regex(/^bench_[a-z0-9._-]{3,80}$/),
    role: HoldoutRole,
    state: HoldoutState,
    benchmarkVersion: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    seedRecordPath: z.string().min(1),
    sourceRecordPath: z.string().min(1),
    groundTruthPath: z.string().min(1),
    bundleHash: z.string().regex(/^[a-f0-9]{64}$/),
    evaluationLockHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    resultHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  })
  .strict();

const transitions: Record<z.infer<typeof HoldoutState>, readonly z.infer<typeof HoldoutState>[]> = {
  CREATED: ["SEALED", "BURNED"],
  SEALED: ["EVALUATED", "BURNED"],
  EVALUATED: ["REVEALED", "BURNED"],
  REVEALED: [],
  BURNED: [],
};

export function canTransition(from: z.infer<typeof HoldoutState>, to: z.infer<typeof HoldoutState>): boolean {
  return transitions[from].includes(to);
}

export function canUseAsKillGate(record: z.infer<typeof HoldoutRecord>): boolean {
  return record.role === "sealed-holdout" && record.state === "SEALED" && record.evaluationLockHash !== null;
}

export function assertFreshKillGate(record: z.infer<typeof HoldoutRecord>): void {
  if (!canUseAsKillGate(record)) {
    throw new Error(`Holdout ${record.benchmarkId} is not a sealed, evaluation-locked kill-gate input`);
  }
}

export type HoldoutRecord = z.infer<typeof HoldoutRecord>;
