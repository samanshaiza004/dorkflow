import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { PerceptualEvidence, type CaptureFileRef, type PerceptualEvidence as PerceptualEvidenceArtifact } from "../contracts/design/index.ts";
import { sha256Bytes } from "../environment/hash.ts";

export type PerceptualCaptureInput = {
  metadata: CaptureFileRef;
  bytes: Uint8Array;
};

export type ModelFacingPerceptualInput = {
  evidence: PerceptualEvidenceArtifact;
  captures: PerceptualCaptureInput[];
};

function isWithin(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent);
}

function verifyPng(bytes: Uint8Array, capture: CaptureFileRef): void {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) {
    throw new Error(`Perceptual capture is not a valid PNG header: ${capture.id}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(16) !== capture.width || view.getUint32(20) !== capture.height) {
    throw new Error(`Perceptual capture dimensions do not match metadata: ${capture.id}`);
  }
}

async function readRegularFileWithoutFollowingSymlinks(path: string): Promise<Uint8Array> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("Model-facing perceptual artifacts must be regular files, not links");
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const fileStats = await handle.stat();
    if (!fileStats.isFile()) throw new Error("Model-facing perceptual artifact is not a regular file");
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

/** Builds model input from a run's perceptual folder; the caller cannot select quarantine paths. */
export async function loadPerceptualInput(runDirectory: string): Promise<ModelFacingPerceptualInput> {
  const runRoot = await realpath(resolve(runDirectory));
  const perceptualPath = join(runRoot, "perceptual");
  const perceptualMetadata = await lstat(perceptualPath);
  if (!perceptualMetadata.isDirectory() || perceptualMetadata.isSymbolicLink()) {
    throw new Error("Model-facing perceptual artifacts must be stored in a regular directory");
  }
  const root = await realpath(perceptualPath);
  if (!isWithin(runRoot, root)) throw new Error("Perceptual artifact directory escaped its run root");
  const evidenceBytes = await readRegularFileWithoutFollowingSymlinks(resolve(root, "evidence.json"));
  let untrustedJson: unknown;
  try {
    untrustedJson = JSON.parse(new TextDecoder().decode(evidenceBytes));
  } catch {
    throw new Error("Perceptual evidence is not valid JSON");
  }
  const evidence = PerceptualEvidence.parse(untrustedJson);

  const capturesPath = resolve(root, "captures");
  const capturesDirectoryMetadata = await lstat(capturesPath);
  if (!capturesDirectoryMetadata.isDirectory() || capturesDirectoryMetadata.isSymbolicLink()) {
    throw new Error("Model-facing captures must be stored in a regular directory");
  }
  const capturesRoot = await realpath(capturesPath);
  if (!isWithin(root, capturesRoot)) throw new Error("Perceptual capture directory escaped its artifact root");
  const captures = await Promise.all(evidence.captures.map(async (capture) => {
    const path = resolve(root, capture.path);
    const resolvedPath = await realpath(path);
    if (!isWithin(capturesRoot, resolvedPath)) {
      throw new Error("Perceptual capture escaped the model-facing capture directory");
    }
    const bytes = await readRegularFileWithoutFollowingSymlinks(path);
    if (sha256Bytes(bytes) !== capture.sha256) {
      throw new Error(`Perceptual capture hash mismatch for ${capture.id}`);
    }
    verifyPng(bytes, capture);
    return { metadata: capture, bytes };
  }));
  return { evidence, captures };
}
