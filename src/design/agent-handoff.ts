import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { CritiqueReport, DesignDirection, DesignRunId } from "../contracts/design/index.ts";
import { ExternalStageExecution } from "../contracts/design/external-execution.ts";
import { DesignModelInput } from "../contracts/design/model-input.ts";
import type { DesignModelInput as DesignModelInputType } from "../contracts/design/model-input.ts";
import { sha256Bytes, sha256Text, stableJson } from "../environment/hash.ts";
import { validateDirectionDiversity, type DirectionDiversityReport } from "./direction-diversity.ts";
import {
  CRITIQUE_INSTRUCTIONS,
  CRITIQUE_PROMPT_VERSION,
  DIRECTIONS_INSTRUCTIONS,
  DIRECTIONS_PROMPT_VERSION,
  summarizeIntentionality,
  validateCritiques,
  validateDirections,
  validateModelImages,
} from "./process.ts";
import { CRITIQUES_RESPONSE_SCHEMA, DIRECTIONS_RESPONSE_SCHEMA } from "./response-schemas.ts";
import {
  createReviewPacket,
  readReviewDecision,
  readReviewPacket,
  reviewPacketSha256,
  writeReviewDecision,
  writeReviewPacket,
} from "./review.ts";

export type PreparedAgentHandoff = {
  runId: string;
  runDirectory: string;
  contextPath: string;
  instructionsPath: string;
  schemaPath: string;
};

export type ExternalAgentIdentity = {
  agentName?: string | null;
  agentVersion?: string | null;
  modelName?: string | null;
  modelVersion?: string | null;
};

export type AgentHandoffExperimentMetadata = {
  experiment: string;
  bundleManifestSha256: string;
  sourceCommit: string;
  modelInputFileSha256: string;
  modelInputSha256: string;
  renderingEnvironmentSha256: string;
  captureRun: string;
  repeatRun: string;
};

export type AgentDirectionSubmission = {
  status: "direction-gate-failed" | "critique-ready";
  runId: string;
  diversity: DirectionDiversityReport;
  critiqueInstructionsPath: string | null;
};

export type AgentCritiqueSubmission = {
  status: "human-review-required";
  runId: string;
  reviewPacketPath: string;
  reviewPacketSha256: string;
  intentionality: ReturnType<typeof summarizeIntentionality>[];
};

export type AgentHandoffStatus = {
  status: "ready" | "blocked" | "human-review-required" | "completed";
  stage: "directions" | "critique" | null;
  runId: string;
  inputPath: string | null;
  instructionsPath: string | null;
  schemaPath: string | null;
  reviewPacketPath: string | null;
  message: string;
};

const MAX_SUBMISSION_BYTES = 2 * 1024 * 1024;
const Directions = z.array(DesignDirection).length(3);
const Critiques = z.array(CritiqueReport).length(3);
const DirectionsEnvelope = z.object({ directions: Directions }).strict();
const CritiquesEnvelope = z.object({ critiques: Critiques }).strict();
const AgentExperimentMetadata = z.object({
  experiment: z.string().min(1).max(200),
  bundleManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  modelInputFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
  modelInputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  renderingEnvironmentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  captureRun: z.string().regex(/^run-[0-9]{3}$/),
  repeatRun: z.string().regex(/^run-[0-9]{3}$/),
}).strict();
const PreparedStage = z.object({
  schemaVersion: z.literal(1),
  stage: z.enum(["directions", "critique"]),
  status: z.literal("prepared"),
  preparedAt: z.string().datetime({ offset: true }),
  instructionsVersion: z.string().min(1).max(500),
  inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  fullModelInputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  instructionsSha256: z.string().regex(/^[a-f0-9]{64}$/),
  schemaSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).passthrough();

function parseSubmission<T>(
  rawOutput: string,
  schema: z.ZodTypeAny,
  key: string,
): T {
  if (Buffer.byteLength(rawOutput, "utf8") > MAX_SUBMISSION_BYTES) {
    throw new Error("Submitted JSON exceeds the 2 MiB handoff limit");
  }
  let value: unknown;
  try {
    value = JSON.parse(rawOutput);
  } catch {
    throw new Error("Submitted result must be valid JSON");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== 1 || !Object.hasOwn(value, key)) {
    throw new Error(`Submitted result must contain exactly one top-level ${JSON.stringify(key)} property`);
  }
  const parsed = schema.parse(value) as Record<string, unknown>;
  return parsed[key] as T;
}

function within(parent: string, candidate: string): boolean {
  const fromParent = relative(parent, candidate);
  return fromParent !== ".." && !fromParent.startsWith(`..${sep}`) && !isAbsolute(fromParent);
}

function createModelContext(input: DesignModelInputType): Record<string, unknown> {
  const { captures, ...context } = input;
  return {
    ...context,
    inputSha256: sha256Text(JSON.stringify(input)),
    captures: captures.map(({ imageBase64: _image, ...capture }) => ({
      ...capture,
      path: `perceptual/captures/${capture.id}.png`,
    })),
  };
}

async function assertSafeParents(path: string, root: string): Promise<void> {
  const absolutePath = resolve(path);
  const resolvedRoot = resolve(root);
  const parentRelative = relative(resolvedRoot, dirname(absolutePath));
  if (parentRelative === ".." || parentRelative.startsWith(`..${sep}`) || isAbsolute(parentRelative)) {
    throw new Error(`Handoff artifact escaped its run directory: ${path}`);
  }
  const rootInfo = await lstat(resolvedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error("Handoff root must be a regular directory");
  let current = resolvedRoot;
  if (parentRelative !== ".") {
    for (const part of parentRelative.split(sep)) {
      current = join(current, part);
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Handoff parent is not a regular directory: ${current}`);
      if (!within(resolvedRoot, await realpath(current))) throw new Error(`Handoff parent escaped its run directory: ${current}`);
    }
  }
}

async function writeOnce(path: string, bytes: Uint8Array, root: string): Promise<void> {
  await assertSafeParents(path, root);
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(path, flags, 0o600);
    if (!(await handle.stat()).isFile()) throw new Error(`Handoff artifact is not a regular file: ${path}`);
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined);
      await unlink(path).catch(() => undefined);
    }
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Handoff artifact already exists and will not be overwritten: ${path}`);
    }
    throw error;
  }
  await handle.close();
}

async function ensureDirectory(path: string, parentRoot: string): Promise<void> {
  await assertSafeParents(path, parentRoot);
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Handoff path must be a regular directory: ${path}`);
  const resolved = await realpath(path);
  if (!within(parentRoot, resolved)) throw new Error(`Handoff directory escaped its run directory: ${path}`);
}

async function requireRunRoot(requestedPath: string): Promise<{ runRoot: string; runId: string }> {
  const absolutePath = resolve(requestedPath);
  const info = await lstat(absolutePath);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Handoff run must be a regular directory, not a symlink");
  const runRoot = await realpath(absolutePath);
  const parent = await realpath(dirname(absolutePath));
  if (!within(parent, runRoot)) throw new Error("Handoff run directory escaped its parent");
  return { runRoot, runId: DesignRunId.parse(basename(runRoot)) };
}

async function readRegularFile(path: string, parentRoot: string, maxBytes = 8 * 1024 * 1024): Promise<Buffer> {
  await assertSafeParents(path, parentRoot);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Handoff artifact must be a regular file: ${path}`);
  const resolvedPath = await realpath(path);
  if (!within(parentRoot, resolvedPath)) throw new Error(`Handoff artifact escaped its run directory: ${path}`);
  if (info.size > maxBytes) throw new Error(`Handoff artifact exceeds size limit: ${path}`);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const openedInfo = await handle.stat();
    if (!openedInfo.isFile() || openedInfo.size > maxBytes) throw new Error(`Handoff artifact is not a bounded regular file: ${path}`);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function readJson(path: string, parentRoot: string, maxBytes?: number): Promise<unknown> {
  let value: unknown;
  try {
    value = JSON.parse((await readRegularFile(path, parentRoot, maxBytes)).toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Handoff artifact is not valid JSON: ${path}`);
    throw error;
  }
  return value;
}

async function isRegularFile(path: string, root: string): Promise<boolean> {
  try {
    await readRegularFile(path, root);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function loadPreparedInput(runRoot: string): Promise<{ input: DesignModelInputType; context: Record<string, unknown> }> {
  const contextValue = await readJson(join(runRoot, "model-context.json"), runRoot, 8 * 1024 * 1024);
  if (contextValue === null || typeof contextValue !== "object" || Array.isArray(contextValue)) {
    throw new Error("Frozen model context must be a JSON object");
  }
  const contextRecord = contextValue as Record<string, unknown>;
  if (!Array.isArray(contextRecord.captures) || typeof contextRecord.inputSha256 !== "string") {
    throw new Error("Frozen model context is missing its capture list or input hash");
  }
  const captures = await Promise.all(contextRecord.captures.map(async (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Capture context must be an object");
    const capture = value as Record<string, unknown>;
    const id = z.string().regex(/^cap_[a-z0-9]{8,64}$/).parse(capture.id);
    const expectedPath = `perceptual/captures/${id}.png`;
    if (capture.path !== expectedPath) throw new Error(`Capture path is not the expected sanitized path: ${id}`);
    const bytes = await readRegularFile(join(runRoot, expectedPath), runRoot, 20 * 1024 * 1024);
    const { path: _path, ...metadata } = capture;
    return { ...metadata, imageBase64: bytes.toString("base64") };
  }));
  const { inputSha256, ...context } = contextRecord;
  const input = DesignModelInput.parse({ ...context, captures });
  validateModelImages(input);
  if (sha256Text(JSON.stringify(input)) !== inputSha256) throw new Error("Frozen model input hash changed after handoff preparation");
  if (stableJson(createModelContext(input)) !== stableJson(contextRecord)) {
    throw new Error("Frozen model context differs from the validated model input");
  }
  return { input, context: contextRecord };
}

async function loadPreparedStage(runRoot: string, stage: "directions" | "critique"): Promise<z.infer<typeof PreparedStage>> {
  return PreparedStage.parse(await readJson(join(runRoot, stage, "stage.json"), runRoot));
}

async function recordExternalExecution(
  runRoot: string,
  stage: "directions" | "critique",
  identity: ExternalAgentIdentity,
  stageRecord: z.infer<typeof PreparedStage>,
  outputBytes: Uint8Array,
): Promise<void> {
  const root = await realpath(runRoot);
  const instructionsPath = join(root, stage, "instructions.md");
  const schemaPath = join(root, stage, "response-schema.json");
  const instructions = await readRegularFile(instructionsPath, root);
  const schema = await readRegularFile(schemaPath, root);
  if (stageRecord.instructionsSha256 !== sha256Bytes(instructions) ||
      stageRecord.schemaSha256 !== sha256Bytes(schema)) {
    throw new Error(`${stage} instructions or schema changed after handoff preparation`);
  }
  const reported = [identity.agentName, identity.agentVersion, identity.modelName, identity.modelVersion]
    .some((field) => typeof field === "string" && field.trim().length > 0);
  const execution = ExternalStageExecution.parse({
    schemaVersion: 1,
    stage,
    executor: {
      kind: "external-agent",
      agentName: identity.agentName?.trim() || null,
      agentVersion: identity.agentVersion?.trim() || null,
      modelName: identity.modelName?.trim() || null,
      modelVersion: identity.modelVersion?.trim() || null,
    },
    reproducibility: reported ? "agent-reported" : "unknown",
    instructionsVersion: stageRecord.instructionsVersion,
    preparedAt: stageRecord.preparedAt,
    submittedAt: new Date().toISOString(),
    inputSha256: stageRecord.inputSha256,
    instructionsSha256: sha256Bytes(instructions),
    schemaSha256: sha256Bytes(schema),
    outputSha256: sha256Bytes(outputBytes),
  });
  await writeOnce(
    join(root, stage, "execution.json"),
    Buffer.from(`${JSON.stringify(execution, null, 2)}\n`, "utf8"),
    root,
  );
}

async function prepareCritiqueStage(
  runRoot: string,
  input: DesignModelInputType,
  directions: z.infer<typeof Directions>,
): Promise<string> {
  const stageDirectory = join(runRoot, "critique");
  await ensureDirectory(stageDirectory, runRoot);
  const critiqueInput = { context: createModelContext(input), directions };
  const inputBytes = Buffer.from(`${JSON.stringify(critiqueInput, null, 2)}\n`, "utf8");
  const instructionsBytes = Buffer.from(`${CRITIQUE_INSTRUCTIONS}\n`, "utf8");
  const schemaBytes = Buffer.from(`${JSON.stringify(CRITIQUES_RESPONSE_SCHEMA, null, 2)}\n`, "utf8");
  await writeOnce(join(stageDirectory, "input.json"), inputBytes, runRoot);
  await writeOnce(join(stageDirectory, "instructions.md"), instructionsBytes, runRoot);
  await writeOnce(join(stageDirectory, "response-schema.json"), schemaBytes, runRoot);
  const stageRecord = {
    schemaVersion: 1,
    stage: "critique",
    status: "prepared",
    preparedAt: new Date().toISOString(),
    instructionsVersion: CRITIQUE_PROMPT_VERSION,
    inputSha256: sha256Text(stableJson(critiqueInput)),
    fullModelInputSha256: sha256Text(JSON.stringify(input)),
    instructionsSha256: sha256Bytes(instructionsBytes),
    schemaSha256: sha256Bytes(schemaBytes),
  };
  await writeOnce(join(stageDirectory, "stage.json"), Buffer.from(`${JSON.stringify(stageRecord, null, 2)}\n`, "utf8"), runRoot);
  return join(stageDirectory, "instructions.md");
}

/** Creates the immutable, file-based directions handoff for an existing trusted agent. */
export async function prepareAgentHandoff(
  inputValue: DesignModelInputType,
  requestedRunDirectory: string,
  experimentValue?: AgentHandoffExperimentMetadata,
): Promise<PreparedAgentHandoff> {
  const input = DesignModelInput.parse(inputValue);
  validateModelImages(input);
  const experiment = experimentValue === undefined ? undefined : AgentExperimentMetadata.parse(experimentValue);
  if (experiment && (experiment.modelInputSha256 !== sha256Text(JSON.stringify(input)) ||
      experiment.renderingEnvironmentSha256 !== input.evidence.renderingEnvironmentSha256)) {
    throw new Error("Experiment metadata does not match the supplied frozen model input");
  }

  const requestedPath = resolve(requestedRunDirectory);
  const parentDirectory = dirname(requestedPath);
  const parentInfo = await lstat(parentDirectory);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    throw new Error("Handoff parent must be an existing regular directory, not a symlink");
  }
  const parentRoot = await realpath(parentDirectory);
  const runId = DesignRunId.parse(basename(requestedPath));
  const runDirectory = join(parentRoot, runId);
  await mkdir(runDirectory, { mode: 0o700 });
  const runRoot = await realpath(runDirectory);
  if (!within(parentRoot, runRoot)) throw new Error("Handoff run directory escaped its parent");

  const capturesDirectory = join(runRoot, "perceptual", "captures");
  await ensureDirectory(join(runRoot, "perceptual"), runRoot);
  await ensureDirectory(capturesDirectory, runRoot);
  const capturePaths: Array<{ id: string; path: string; sha256: string }> = [];
  for (const capture of input.captures) {
    const bytes = Buffer.from(capture.imageBase64, "base64");
    const path = `perceptual/captures/${capture.id}.png`;
    await writeOnce(join(runRoot, path), bytes, runRoot);
    capturePaths.push({ id: capture.id, path, sha256: capture.sha256 });
  }

  const modelContext = createModelContext(input);
  const contextBytes = Buffer.from(`${JSON.stringify(modelContext, null, 2)}\n`, "utf8");
  const instructionsBytes = Buffer.from(`${DIRECTIONS_INSTRUCTIONS}\n`, "utf8");
  const schemaBytes = Buffer.from(`${JSON.stringify(DIRECTIONS_RESPONSE_SCHEMA, null, 2)}\n`, "utf8");
  const directionsDirectory = join(runRoot, "directions");
  await ensureDirectory(directionsDirectory, runRoot);
  const preparedAt = new Date().toISOString();
  await writeOnce(join(runRoot, "model-context.json"), contextBytes, runRoot);
  if (experiment) {
    await writeOnce(join(runRoot, "experiment.json"), Buffer.from(`${JSON.stringify({
      schemaVersion: 1,
      ...experiment,
      preparedAt,
    }, null, 2)}\n`, "utf8"), runRoot);
  }
  await writeOnce(join(directionsDirectory, "instructions.md"), instructionsBytes, runRoot);
  await writeOnce(join(directionsDirectory, "response-schema.json"), schemaBytes, runRoot);

  const stageRecord = {
    schemaVersion: 1,
    stage: "directions",
    status: "prepared",
    preparedAt,
    instructionsVersion: DIRECTIONS_PROMPT_VERSION,
    inputSha256: sha256Text(stableJson(modelContext)),
    fullModelInputSha256: sha256Text(JSON.stringify(input)),
    instructionsSha256: sha256Bytes(instructionsBytes),
    schemaSha256: sha256Bytes(schemaBytes),
    captureFiles: capturePaths,
  };
  await writeOnce(
    join(directionsDirectory, "stage.json"),
    Buffer.from(`${JSON.stringify(stageRecord, null, 2)}\n`, "utf8"),
    runRoot,
  );

  return {
    runId,
    runDirectory: runRoot,
    contextPath: join(runRoot, "model-context.json"),
    instructionsPath: join(directionsDirectory, "instructions.md"),
    schemaPath: join(directionsDirectory, "response-schema.json"),
  };
}

/** Reports the next legal stage; human review is a hard stop after the critique packet. */
export async function getAgentHandoffStatus(requestedRunDirectory: string): Promise<AgentHandoffStatus> {
  const { runRoot, runId } = await requireRunRoot(requestedRunDirectory);
  const gatePath = join(runRoot, "directions/gate.json");
  if (!await isRegularFile(gatePath, runRoot)) {
    if (await isRegularFile(join(runRoot, "directions/result.json"), runRoot) ||
        await isRegularFile(join(runRoot, "directions/execution.json"), runRoot)) {
      return {
        status: "blocked",
        stage: null,
        runId,
        inputPath: null,
        instructionsPath: null,
        schemaPath: null,
        reviewPacketPath: null,
        message: "The directions submission is incomplete. Preserve this run for diagnosis and start a new immutable attempt.",
      };
    }
    await loadPreparedStage(runRoot, "directions");
    return {
      status: "ready",
      stage: "directions",
      runId,
      inputPath: join(runRoot, "model-context.json"),
      instructionsPath: join(runRoot, "directions/instructions.md"),
      schemaPath: join(runRoot, "directions/response-schema.json"),
      reviewPacketPath: null,
      message: "Propose three structurally distinct directions using only this frozen context, its screenshots, and the supplied schema.",
    };
  }

  const gate = await readJson(gatePath, runRoot);
  if (gate === null || typeof gate !== "object" || Array.isArray(gate)) throw new Error("Direction gate record is invalid");
  const gateStatus = (gate as Record<string, unknown>).status;
  if (gateStatus === "direction-gate-failed") {
    return {
      status: "blocked",
      stage: null,
      runId,
      inputPath: null,
      instructionsPath: null,
      schemaPath: null,
      reviewPacketPath: null,
      message: "Direction diversity failed. This immutable experiment run cannot proceed to critique; begin a new run to revise directions.",
    };
  }
  if (gateStatus !== "passed") throw new Error("Direction gate record has an unknown status");

  const packetPath = join(runRoot, "review/packet.json");
  if (await isRegularFile(packetPath, runRoot)) {
    const decisionPath = join(runRoot, "review/decision.json");
    const completed = await isRegularFile(decisionPath, runRoot);
    if (completed) await readReviewDecision(runRoot);
    return {
      status: completed ? "completed" : "human-review-required",
      stage: null,
      runId,
      inputPath: null,
      instructionsPath: null,
      schemaPath: null,
      reviewPacketPath: packetPath,
      message: completed ? "Human decision is recorded." : "Human review is required; the agent must stop here.",
    };
  }

  if (await isRegularFile(join(runRoot, "critique/result.json"), runRoot) ||
      await isRegularFile(join(runRoot, "critique/execution.json"), runRoot)) {
    return {
      status: "blocked",
      stage: null,
      runId,
      inputPath: null,
      instructionsPath: null,
      schemaPath: null,
      reviewPacketPath: null,
      message: "The critique submission is incomplete. Preserve this run for diagnosis and start a new immutable attempt.",
    };
  }

  await loadPreparedStage(runRoot, "critique");
  return {
    status: "ready",
    stage: "critique",
    runId,
    inputPath: join(runRoot, "critique/input.json"),
    instructionsPath: join(runRoot, "critique/instructions.md"),
    schemaPath: join(runRoot, "critique/response-schema.json"),
    reviewPacketPath: null,
    message: "Critique every choice against the frozen intent, evidence, and directions; do not implement or make the human's choice.",
  };
}

/** Validates a submitted directions artifact and opens critique only after the deterministic gate passes. */
export async function submitAgentDirections(
  requestedRunDirectory: string,
  rawOutput: string,
  identity: ExternalAgentIdentity = {},
): Promise<AgentDirectionSubmission> {
  const { runRoot, runId } = await requireRunRoot(requestedRunDirectory);
  const stageRecord = await loadPreparedStage(runRoot, "directions");
  if (stageRecord.stage !== "directions") throw new Error("Directions stage receipt does not match this submission");
  const { input, context } = await loadPreparedInput(runRoot);
  if (stageRecord.fullModelInputSha256 !== sha256Text(JSON.stringify(input))) {
    throw new Error("Directions stage was prepared from a different frozen input");
  }
  if (stageRecord.inputSha256 !== sha256Text(stableJson(context))) {
    throw new Error("Directions context changed after handoff preparation");
  }
  const directionInstructions = await readRegularFile(join(runRoot, "directions/instructions.md"), runRoot);
  const directionSchema = await readRegularFile(join(runRoot, "directions/response-schema.json"), runRoot);
  if (stageRecord.instructionsSha256 !== sha256Bytes(directionInstructions) ||
      stageRecord.schemaSha256 !== sha256Bytes(directionSchema)) {
    throw new Error("Directions instructions or schema changed after handoff preparation");
  }
  const rawBytes = Buffer.from(rawOutput, "utf8");
  const directions = parseSubmission<z.infer<typeof Directions>>(rawOutput, DirectionsEnvelope, "directions");
  validateDirections(input, directions);
  const diversity = validateDirectionDiversity(directions);
  const stageDirectory = join(runRoot, "directions");
  await writeOnce(join(stageDirectory, "result.json"), rawBytes, runRoot);
  await writeOnce(join(stageDirectory, "diversity.json"), Buffer.from(`${JSON.stringify(diversity, null, 2)}\n`, "utf8"), runRoot);
  await recordExternalExecution(runRoot, "directions", identity, stageRecord, rawBytes);

  if (!diversity.passed) {
    await writeOnce(join(stageDirectory, "gate.json"), Buffer.from(`${JSON.stringify({ status: "direction-gate-failed", diversity }, null, 2)}\n`, "utf8"), runRoot);
    return { status: "direction-gate-failed", runId, diversity, critiqueInstructionsPath: null };
  }

  await writeOnce(join(stageDirectory, "gate.json"), Buffer.from(`${JSON.stringify({ status: "passed", diversity }, null, 2)}\n`, "utf8"), runRoot);
  const critiqueInstructionsPath = await prepareCritiqueStage(runRoot, input, directions);
  return { status: "critique-ready", runId, diversity, critiqueInstructionsPath };
}

/** Validates critique and emits the B5 human-review packet without inventing API invocation metadata. */
export async function submitAgentCritiques(
  requestedRunDirectory: string,
  rawOutput: string,
  identity: ExternalAgentIdentity = {},
): Promise<AgentCritiqueSubmission> {
  const { runRoot, runId } = await requireRunRoot(requestedRunDirectory);
  const directionsGate = await readJson(join(runRoot, "directions/gate.json"), runRoot);
  if (directionsGate === null || typeof directionsGate !== "object" ||
      (directionsGate as Record<string, unknown>).status !== "passed") {
    throw new Error("Critique cannot be submitted before the direction diversity gate passes");
  }
  const stageRecord = await loadPreparedStage(runRoot, "critique");
  if (stageRecord.stage !== "critique") throw new Error("Critique stage receipt does not match this submission");
  const { input } = await loadPreparedInput(runRoot);
  if (stageRecord.fullModelInputSha256 !== sha256Text(JSON.stringify(input))) {
    throw new Error("Critique stage was prepared from a different frozen input");
  }
  const savedDirections = parseSubmission<z.infer<typeof Directions>>(
    (await readRegularFile(join(runRoot, "directions/result.json"), runRoot, MAX_SUBMISSION_BYTES)).toString("utf8"),
    DirectionsEnvelope,
    "directions",
  );
  validateDirections(input, savedDirections);
  const diversity = validateDirectionDiversity(savedDirections);
  if (!diversity.passed) throw new Error("Critique cannot proceed because the saved directions fail the diversity gate");
  const gate = z.object({ status: z.literal("passed"), diversity: z.unknown() }).strict().parse(directionsGate);
  if (stableJson(gate.diversity) !== stableJson(diversity)) {
    throw new Error("Saved direction gate does not match the validated directions");
  }
  const critiqueInputValue = await readJson(join(runRoot, "critique/input.json"), runRoot, 8 * 1024 * 1024);
  const critiqueInput = z.object({
    context: z.record(z.unknown()),
    directions: Directions,
  }).strict().parse(critiqueInputValue);
  if (sha256Text(stableJson(critiqueInput)) !== stageRecord.inputSha256) {
    throw new Error("Critique-stage input changed after handoff preparation");
  }
  const critiqueInstructions = await readRegularFile(join(runRoot, "critique/instructions.md"), runRoot);
  const critiqueSchema = await readRegularFile(join(runRoot, "critique/response-schema.json"), runRoot);
  if (stageRecord.instructionsSha256 !== sha256Bytes(critiqueInstructions) ||
      stageRecord.schemaSha256 !== sha256Bytes(critiqueSchema)) {
    throw new Error("Critique instructions or schema changed after handoff preparation");
  }
  const expectedCritiqueInput = { context: createModelContext(input), directions: savedDirections };
  if (stableJson(critiqueInput) !== stableJson(expectedCritiqueInput)) {
    throw new Error("Critique-stage context differs from the validated input and gated directions");
  }
  const directions = critiqueInput.directions;
  if (stableJson(directions) !== stableJson(savedDirections)) {
    throw new Error("Critique-stage directions differ from the directions that passed the gate");
  }
  validateDirections(input, directions);
  const rawBytes = Buffer.from(rawOutput, "utf8");
  const critiques = parseSubmission<z.infer<typeof Critiques>>(rawOutput, CritiquesEnvelope, "critiques");
  validateCritiques(input, directions, critiques);
  const intentionality = directions.map((direction) => summarizeIntentionality(
    direction,
    critiques.find((critique) => critique.directionRef === direction.id)!,
  ));
  const critiqueDirectory = join(runRoot, "critique");
  await writeOnce(join(critiqueDirectory, "result.json"), rawBytes, runRoot);
  await recordExternalExecution(runRoot, "critique", identity, stageRecord, rawBytes);
  await writeOnce(join(runRoot, "critiques.json"), Buffer.from(`${JSON.stringify(critiques, null, 2)}\n`, "utf8"), runRoot);
  await writeOnce(join(runRoot, "intentionality.json"), Buffer.from(`${JSON.stringify(intentionality, null, 2)}\n`, "utf8"), runRoot);
  const packet = createReviewPacket(runId, directions, critiques, input);
  await writeReviewPacket(runRoot, packet);
  return {
    status: "human-review-required",
    runId,
    reviewPacketPath: join(runRoot, "review/packet.json"),
    reviewPacketSha256: reviewPacketSha256(packet),
    intentionality,
  };
}

/** Records an explicit human B5 decision; no agent executor can call this implicitly. */
export async function submitAgentReviewDecision(
  requestedRunDirectory: string,
  rawDecision: string,
): Promise<{ decisionPath: string; packetSha256: string }> {
  const { runRoot } = await requireRunRoot(requestedRunDirectory);
  if (Buffer.byteLength(rawDecision, "utf8") > MAX_SUBMISSION_BYTES) {
    throw new Error("Human review decision exceeds the 2 MiB handoff limit");
  }
  let decision: unknown;
  try {
    decision = JSON.parse(rawDecision);
  } catch {
    throw new Error("Human review decision must be valid JSON");
  }
  const record = await writeReviewDecision(runRoot, decision);
  const packet = await readReviewPacket(runRoot);
  if (record.packetSha256 !== reviewPacketSha256(packet)) throw new Error("Recorded decision no longer matches the review packet");
  return { decisionPath: join(runRoot, "review/decision.json"), packetSha256: record.packetSha256 };
}
