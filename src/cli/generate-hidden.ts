import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { RenderingEnvironment } from "../contracts/environment.ts";
import { generateHiddenBenchmark, makePublicHoldoutRecord } from "../benchmarks/hidden-generator.ts";

const repository = resolve(import.meta.dirname, "../..");
const environmentPath = join(repository, "benchmarks/rendering-environment.json");
const environment = RenderingEnvironment.parse(JSON.parse(await readFile(environmentPath, "utf8")));
const requestedRole = process.argv.includes("--development") ? "development" : process.argv.includes("--sealed") ? "sealed-holdout" : "development";
const role = requestedRole as "development" | "sealed-holdout";
const benchmarkId = role === "development" ? "bench_hidden_development" : "bench_hidden_001";
const privateStore = process.env.DORKFLOW_SEALED_STORE;
const renderedRoot = role === "development" ? join(repository, "benchmarks/development/coherent-system-v1/rendered") : join(privateStore ?? "", benchmarkId, "rendered");
const generationOptions = {
  benchmarkId,
  renderedRoot,
  environmentSha256: environment.environmentSha256,
  ...(privateStore ? { privateStore } : {}),
};
const manifest = await generateHiddenBenchmark(role, generationOptions);
const publicRecord = makePublicHoldoutRecord(manifest);
const publicMetadata = join(repository, "benchmarks/holdouts/public-metadata");
await mkdir(publicMetadata, { recursive: true });
await writeFile(join(publicMetadata, `${benchmarkId}.record.json`), `${JSON.stringify(publicRecord, null, 2)}\n`, {
  encoding: "utf8",
  ...(role === "sealed-holdout" ? { flag: "wx" } : {}),
});
console.log(`Generated ${role} benchmark ${manifest.benchmarkId} with frozen bundle ${manifest.bundleSha256}`);
