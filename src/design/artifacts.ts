import { randomBytes } from "node:crypto";
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DesignProcessManifest, DesignRunId } from "../contracts/design/index.ts";
import { createDesignModelInput, CRITIQUE_INSTRUCTIONS, DIRECTIONS_INSTRUCTIONS, type DesignProcessArtifacts, type DesignProcessResult } from "./process.ts";
import { sha256Bytes, sha256Text } from "../environment/hash.ts";
import { createReviewPacket, reviewPacketSha256, writeReviewPacket } from "./review.ts";
import { CRITIQUES_RESPONSE_SCHEMA, DIRECTIONS_RESPONSE_SCHEMA } from "./response-schemas.ts";

export type PersistedDesignProcessRun = {
  directory: string;
  manifestPath: string;
};

async function requirePlainDirectory(path: string): Promise<void> {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(path);
    info = await lstat(path);
  }
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`Expected a real directory, not a symlink: ${path}`);
  }
}

async function writeJson(directory: string, path: string, value: unknown): Promise<{ path: string; sha256: string }> {
  const target = join(directory, path);
  await requirePlainDirectory(dirname(target));
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  await writeFile(target, bytes, { flag: "wx" });
  return { path, sha256: sha256Bytes(bytes) };
}

/** Writes immutable, inspectable outputs while leaving quarantine and capture inputs untouched. */
export async function persistDesignProcessRun(
  artifacts: DesignProcessArtifacts,
  result: DesignProcessResult,
): Promise<PersistedDesignProcessRun> {
  const requestedRoot = resolve(artifacts.runDirectory);
  const rootInfo = await lstat(requestedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("Design-process outputs require a real artifact run directory");
  }
  const runRoot = await realpath(requestedRoot);

  const input = await createDesignModelInput(artifacts);
  const serializedInput = JSON.stringify(input);
  if (sha256Text(serializedInput) !== result.inputSha256) {
    throw new Error("Model input changed after inference; refusing to persist mismatched artifacts");
  }

  const processRoot = join(runRoot, "design-process");
  await requirePlainDirectory(processRoot);
  const runDirectory = join(processRoot, result.runId);
  await mkdir(runDirectory);
  await mkdir(join(runDirectory, "perceptual"), { mode: 0o700 });
  await mkdir(join(runDirectory, "perceptual", "captures"), { mode: 0o700 });

  const { captures, ...modelContext } = input;
  const artifactDigests: { path: string; sha256: string }[] = [];
  const add = async (path: string, value: unknown) => artifactDigests.push(await writeJson(runDirectory, path, value));

  for (const capture of captures) {
    const bytes = Buffer.from(capture.imageBase64, "base64");
    if (sha256Bytes(bytes) !== capture.sha256) {
      throw new Error(`Capture hash changed before process artifact persistence: ${capture.id}`);
    }
    const path = `perceptual/captures/${capture.id}.png`;
    await writeFile(join(runDirectory, path), bytes, { flag: "wx", mode: 0o600 });
    artifactDigests.push({ path, sha256: sha256Bytes(bytes) });
  }

  await add("model-context.json", {
    ...modelContext,
    inputSha256: result.inputSha256,
    captures: captures.map(({ imageBase64: _image, ...capture }) => ({
      ...capture,
      path: `perceptual/captures/${capture.id}.png`,
    })),
  });
  if (input.designProfile) {
    await add("design-profile/provenance.json", input.designProfile.provenance);
  }
  await add("instructions.json", {
    schemaVersion: 1,
    directions: { version: result.promptVersions.directions, text: DIRECTIONS_INSTRUCTIONS },
    critique: { version: result.promptVersions.critique, text: CRITIQUE_INSTRUCTIONS },
    responseSchemas: {
      directions: DIRECTIONS_RESPONSE_SCHEMA,
      critique: CRITIQUES_RESPONSE_SCHEMA,
    },
  });
  await add("diversity.json", result.diversity);
  await add("directions.json", result.directions);
  if (result.status === "critiqued") {
    await add("critiques.json", result.critiques);
    await add("intentionality.json", result.intentionality);
    const packet = createReviewPacket(result.runId, result.directions, result.critiques, input);
    await writeReviewPacket(runDirectory, packet);
    artifactDigests.push({
      path: "review/packet.json",
      sha256: sha256Bytes(Buffer.from(`${JSON.stringify(packet, null, 2)}\n`, "utf8")),
    });
    artifactDigests.push({
      path: "review/packet.sha256",
      sha256: sha256Bytes(Buffer.from(reviewPacketSha256(packet), "utf8")),
    });
  }
  await add("invocations.json", result.modelInvocations);

  const createdAt = result.modelInvocations.reduce(
    (earliest, invocation) => Date.parse(invocation.startedAt) < Date.parse(earliest) ? invocation.startedAt : earliest,
    result.modelInvocations[0]!.startedAt,
  );
  const latestModelFinish = Math.max(...result.modelInvocations.map(({ finishedAt }) => Date.parse(finishedAt)));
  const updatedAt = new Date(Math.max(Date.now(), latestModelFinish)).toISOString();
  const manifest = DesignProcessManifest.parse({
    schemaVersion: 1,
    id: DesignRunId.parse(result.runId),
    status: result.status,
    createdAt,
    updatedAt,
    modelInputSha256: result.inputSha256,
    renderingEnvironmentSha256: input.evidence.renderingEnvironmentSha256,
    designProfile: input.designProfile?.provenance ?? null,
    promptVersions: result.promptVersions,
    modelRelationship: result.modelRelationship,
    invocationRefs: result.modelInvocations.map((invocation) => invocation.id),
    artifactDigests,
  });
  const manifestPath = join(runDirectory, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return { directory: runDirectory, manifestPath };
}
