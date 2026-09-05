import { z } from "zod";
import { BenchmarkRole } from "./ground-truth.ts";

export const BundleManifest = z
  .object({
    schemaVersion: z.literal(1),
    benchmarkId: z.string().regex(/^bench_[a-z0-9._-]{3,80}$/),
    benchmarkRole: BenchmarkRole,
    benchmarkVersion: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    renderingEnvironmentSha256: z.string().regex(/^[a-f0-9]{64}$/),
    files: z.array(z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().nonnegative() }).strict()).min(1),
    bundleSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourcePackage: z
      .object({ name: z.string().min(1), version: z.string().min(1), url: z.string().url(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .nullable(),
    privateInputsOutsideWorkspace: z.boolean(),
  })
  .strict();

export type BundleManifest = z.infer<typeof BundleManifest>;
