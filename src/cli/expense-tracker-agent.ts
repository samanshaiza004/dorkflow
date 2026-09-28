import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DesignModelInput } from "../contracts/design/model-input.ts";
import { DesignRunId, Sha256 } from "../contracts/design/common.ts";
import { sha256Bytes, sha256Text } from "../environment/hash.ts";
import {
  getAgentHandoffStatus,
  prepareAgentHandoff,
  submitAgentCritiques,
  submitAgentDirections,
  submitAgentReviewDecision,
  type ExternalAgentIdentity,
} from "../design/agent-handoff.ts";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../..");
const BUNDLE_ROOT = join(REPOSITORY_ROOT, "artifacts/phase-b-expense-tracker");
const AGENT_RUNS_ROOT = join(BUNDLE_ROOT, "agent-runs");
const FROZEN_INPUT_PATH = "model-input-lato-final.json";
const MAX_RESULT_BYTES = 2 * 1024 * 1024;

const BundleManifest = z.object({
  source: z.object({ commit: z.string().regex(/^[a-f0-9]{40}$/) }).passthrough(),
  capture: z.object({
    runDirectory: z.string().regex(/^run-[0-9]{3}$/),
    repeatRunDirectory: z.string().regex(/^run-[0-9]{3}$/),
    inputSha256: Sha256,
  }).passthrough(),
  modelInput: z.object({
    path: z.literal(FROZEN_INPUT_PATH),
    fileSha256: Sha256,
    modelInputSha256: Sha256,
  }).passthrough(),
}).passthrough();

function within(parent: string, candidate: string): boolean {
  const fromParent = relative(parent, candidate);
  return fromParent !== ".." && !fromParent.startsWith(`..${sep}`) && !isAbsolute(fromParent);
}

async function readWithin(rootPath: string, relativePath: string, maxBytes = 32 * 1024 * 1024): Promise<Buffer> {
  const root = await realpath(rootPath);
  const target = resolve(root, relativePath);
  if (!within(root, target)) throw new Error(`Frozen experiment file escaped its bundle: ${relativePath}`);
  const pathFromRoot = relative(root, target);
  let current = root;
  for (const part of pathFromRoot.split(sep).slice(0, -1)) {
    current = join(current, part);
    const directory = await lstat(current);
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error(`Frozen experiment path is not a regular directory: ${current}`);
  }
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maxBytes) {
    throw new Error(`Frozen experiment file is not a bounded regular file: ${relativePath}`);
  }
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await handle.stat()).isFile()) throw new Error(`Frozen experiment file is not regular: ${relativePath}`);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function loadFrozenInput() {
  const manifestBytes = await readWithin(BUNDLE_ROOT, "bundle-manifest.json", 2 * 1024 * 1024);
  const manifest = BundleManifest.parse(JSON.parse(manifestBytes.toString("utf8")));
  const inputBytes = await readWithin(BUNDLE_ROOT, manifest.modelInput.path, 16 * 1024 * 1024);
  if (sha256Bytes(inputBytes) !== manifest.modelInput.fileSha256) throw new Error("Frozen model-input file hash does not match the bundle manifest");
  const input = DesignModelInput.parse(JSON.parse(inputBytes.toString("utf8")));
  if (sha256Text(JSON.stringify(input)) !== manifest.modelInput.modelInputSha256 ||
      manifest.modelInput.modelInputSha256 !== manifest.capture.inputSha256) {
    throw new Error("Frozen model-input identity does not match the bundle manifest");
  }
  if (input.evidence.trustMode !== "trusted-project" || !input.evidence.originalPixelsApproved) {
    throw new Error("This real-interface handoff requires explicitly approved trusted-project captures");
  }

  for (const capture of input.captures) {
    const first = await readWithin(BUNDLE_ROOT, `${manifest.capture.runDirectory}/perceptual/captures/${capture.id}.png`, 20 * 1024 * 1024);
    const repeated = await readWithin(BUNDLE_ROOT, `${manifest.capture.repeatRunDirectory}/perceptual/captures/${capture.id}.png`, 20 * 1024 * 1024);
    const embedded = Buffer.from(capture.imageBase64, "base64");
    if (sha256Bytes(first) !== capture.sha256 || !first.equals(repeated) || !first.equals(embedded)) {
      throw new Error(`Frozen capture differs from the final repeated capture: ${capture.id}`);
    }
  }
  return {
    input,
    experiment: {
      experiment: "phase-b-b2-b5-expense-tracker-dress-rehearsal",
      bundleManifestSha256: sha256Bytes(manifestBytes),
      sourceCommit: manifest.source.commit,
      modelInputFileSha256: manifest.modelInput.fileSha256,
      modelInputSha256: manifest.modelInput.modelInputSha256,
      renderingEnvironmentSha256: input.evidence.renderingEnvironmentSha256,
      captureRun: manifest.capture.runDirectory,
      repeatRun: manifest.capture.repeatRunDirectory,
    },
  };
}

async function ensureAgentRunsDirectory(): Promise<void> {
  try {
    await mkdir(AGENT_RUNS_ROOT, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const info = await lstat(AGENT_RUNS_ROOT);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Agent-run output must be a regular directory, not a symlink");
}

function runDirectoryFromId(value: string): string {
  const runId = DesignRunId.parse(value);
  return join(AGENT_RUNS_ROOT, runId);
}

async function readExternalResult(path: string): Promise<string> {
  const absolutePath = resolve(path);
  const info = await lstat(absolutePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_RESULT_BYTES) {
    throw new Error("Submitted result must be a regular non-symlink file no larger than 2 MiB");
  }
  const handle = await open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > MAX_RESULT_BYTES) throw new Error("Submitted result exceeds the 2 MiB limit");
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}

function parseIdentityOptions(args: string[]): { positional: string[]; identity: ExternalAgentIdentity } {
  const positional: string[] = [];
  const identity: ExternalAgentIdentity = {};
  const options: Record<string, keyof ExternalAgentIdentity> = {
    "--agent": "agentName",
    "--agent-version": "agentVersion",
    "--model": "modelName",
    "--model-version": "modelVersion",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const key = options[arg];
    if (!key) {
      if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
      positional.push(arg);
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
    identity[key] = value;
    index += 1;
  }
  return { positional, identity };
}

function printStatus(status: Awaited<ReturnType<typeof getAgentHandoffStatus>>): void {
  const nextCommand = status.stage
    ? `bun run b2:expense-tracker-agent -- submit ${status.runId} ${status.stage} <result.json> --agent Codex`
    : null;
  console.log(JSON.stringify({ ...status, nextCommand }, null, 2));
}

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (!command || command === "help" || command === "--help") {
    console.log([
      "Expense Tracker B2-B5 file handoff (no API key required)",
      "  start",
      "  next <run-id>",
      "  submit <run-id> directions|critique <result.json> [--agent name] [--agent-version version] [--model name] [--model-version version]",
      "  review <run-id>",
      "  review submit <run-id> <decision.json>",
    ].join("\n"));
    return;
  }

  if (command === "start") {
    if (rest.length !== 0) throw new Error("start takes no arguments");
    const { input, experiment } = await loadFrozenInput();
    await ensureAgentRunsDirectory();
    const runId = `run_${randomBytes(16).toString("hex")}`;
    const prepared = await prepareAgentHandoff(input, join(AGENT_RUNS_ROOT, runId), experiment);
    printStatus(await getAgentHandoffStatus(prepared.runDirectory));
    return;
  }

  if (command === "next") {
    if (rest.length !== 1) throw new Error("next requires exactly one run ID");
    printStatus(await getAgentHandoffStatus(runDirectoryFromId(rest[0]!)));
    return;
  }

  if (command === "submit") {
    const { positional, identity } = parseIdentityOptions(rest);
    if (positional.length !== 3) throw new Error("submit requires a run ID, stage, and result file");
    const [runId, stage, resultPath] = positional as [string, string, string];
    const runDirectory = runDirectoryFromId(runId);
    const result = await readExternalResult(resultPath);
    if (stage === "directions") {
      console.log(JSON.stringify(await submitAgentDirections(runDirectory, result, identity), null, 2));
    } else if (stage === "critique") {
      console.log(JSON.stringify(await submitAgentCritiques(runDirectory, result, identity), null, 2));
    } else {
      throw new Error("Stage must be directions or critique");
    }
    printStatus(await getAgentHandoffStatus(runDirectory));
    return;
  }

  if (command === "review") {
    if (rest[0] === "submit") {
      if (rest.length !== 3) throw new Error("review submit requires a run ID and decision file");
      const runDirectory = runDirectoryFromId(rest[1]!);
      const decision = await readExternalResult(rest[2]!);
      console.log(JSON.stringify(await submitAgentReviewDecision(runDirectory, decision), null, 2));
      printStatus(await getAgentHandoffStatus(runDirectory));
      return;
    }
    if (rest.length !== 1) throw new Error("review requires exactly one run ID");
    printStatus(await getAgentHandoffStatus(runDirectoryFromId(rest[0]!)));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`Expense Tracker agent handoff failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
