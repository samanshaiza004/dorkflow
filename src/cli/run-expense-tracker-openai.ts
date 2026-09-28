import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256Text } from "../environment/hash.ts";
import type { DesignIntent, ReferenceSet } from "../contracts/design/index.ts";
import { createDesignModelInput, runDirectionCritiqueSlice } from "../design/process.ts";
import { OpenAIResponsesDesignProcessModel } from "../design/openai-responses.ts";
import { persistDesignProcessRun } from "../design/artifacts.ts";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const bundleRoot = join(repositoryRoot, "artifacts/phase-b-expense-tracker");
const runDirectory = join(bundleRoot, "run-006");

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set; no model request was sent");
  }

  const artifacts = {
    intent: await readJson<DesignIntent>(join(bundleRoot, "intent.json")),
    references: await readJson<ReferenceSet>(join(bundleRoot, "references.json")),
    runDirectory,
    systemModel: null,
  };
  const frozenInputPath = join(bundleRoot, "model-input-lato-final.json");
  const frozenInput = await readJson<unknown>(frozenInputPath);
  const regeneratedInput = await createDesignModelInput(artifacts);
  if (sha256Text(JSON.stringify(frozenInput)) !== sha256Text(JSON.stringify(regeneratedInput))) {
    throw new Error("Frozen model input no longer matches the Lato-pinned capture; no model request was sent");
  }
  const runInfo = await lstat(runDirectory);
  if (!runInfo.isDirectory() || runInfo.isSymbolicLink()) {
    throw new Error("Frozen capture run must be a real directory; no model request was sent");
  }
  try {
    const processRoot = join(runDirectory, "design-process");
    const processInfo = await lstat(processRoot);
    if (!processInfo.isDirectory() || processInfo.isSymbolicLink()) {
      throw new Error("Existing design-process output path is not a real directory; no model request was sent");
    }
    if ((await readdir(processRoot)).length > 0) {
      throw new Error("This frozen capture already has a model run; no duplicate request was sent");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const model = new OpenAIResponsesDesignProcessModel(apiKey);
  const result = await runDirectionCritiqueSlice(artifacts, model);
  const persisted = await persistDesignProcessRun(artifacts, result);
  console.log(JSON.stringify({
    status: result.status,
    runId: result.runId,
    inputSha256: result.inputSha256,
    directions: result.directions.length,
    diversity: result.diversity,
    modelInvocations: result.modelInvocations,
    reviewPacketPath: result.status === "critiqued" ? join(persisted.directory, "review/packet.json") : null,
    persistedRunDirectory: persisted.directory,
  }, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : "OpenAI design-process run failed";
  console.error(`OpenAI design-process run failed: ${message}`);
  process.exitCode = 1;
}
