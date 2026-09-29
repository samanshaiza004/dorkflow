import { constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { open, lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  DesignAntiReference,
  DesignAtlasReference,
  DesignProfileCompassDocument,
  DesignProfileFloorDocument,
  DesignProfileManifest,
  DesignProfileProvenance,
  DesignProfileRailDocument,
  ModelDesignProfile,
  type DesignAntiReference as DesignAntiReferenceArtifact,
  type DesignAtlasReference as DesignAtlasReferenceArtifact,
  type DesignProfileFloorDocument as DesignProfileFloorArtifact,
  type DesignProfileManifest as DesignProfileManifestArtifact,
  type DesignProfileProvenance as DesignProfileProvenanceArtifact,
  type DesignProfileRailDocument as DesignProfileRailArtifact,
  type ModelDesignProfile as ModelDesignProfileArtifact,
} from "../contracts/design/profile.ts";
import { sha256Bytes, identityHash } from "../environment/hash.ts";

const MAX_PROFILE_FILE_BYTES = 256 * 1024;
const MAX_PROFILE_TOTAL_BYTES = 2 * 1024 * 1024;

export type ResolvedDesignProfile = {
  root: string;
  manifest: DesignProfileManifestArtifact;
  floor: DesignProfileFloorArtifact[];
  rails: DesignProfileRailArtifact[];
  compass: ReturnType<typeof DesignProfileCompassDocument.parse>;
  atlas: DesignAtlasReferenceArtifact[];
  antiReferences: DesignAntiReferenceArtifact[];
  provenance: DesignProfileProvenanceArtifact;
};

function within(parent: string, candidate: string): boolean {
  const relativePath = relative(parent, candidate);
  return relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath);
}

function runGit(root: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5_000,
    }).trim();
  } catch {
    throw new Error("Design Profile must be inside a local Git working tree with a commit");
  }
}

async function readProfileFile(root: string, filePath: string): Promise<Buffer> {
  const parts = filePath.split("/");
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Design Profile is missing required file: ${filePath}`);
      }
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error(`Design Profile does not allow symlinks: ${filePath}`);
    if (index < parts.length - 1 && !info.isDirectory()) {
      throw new Error(`Design Profile path parent is not a directory: ${filePath}`);
    }
    if (index === parts.length - 1 && !info.isFile()) {
      throw new Error(`Design Profile input must be a regular file: ${filePath}`);
    }
  }

  const resolved = await realpath(current);
  if (!within(root, resolved)) throw new Error(`Design Profile input escaped its repository: ${filePath}`);
  const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_PROFILE_FILE_BYTES) {
      throw new Error(`Design Profile file must be a regular file no larger than 256 KiB: ${filePath}`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function parseJson<T>(bytes: Buffer, filePath: string, schema: { parse(value: unknown): T }): T {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error(`Design Profile JSON is invalid or not UTF-8: ${filePath}`);
  }
  try {
    return schema.parse(value);
  } catch (error) {
    throw new Error(`Design Profile validation failed in ${filePath}: ${error instanceof Error ? error.message : "invalid data"}`);
  }
}

function assertUniqueItemIds(profile: {
  floor: DesignProfileFloorArtifact[];
  rails: DesignProfileRailArtifact[];
  compass: ReturnType<typeof DesignProfileCompassDocument.parse>;
  atlas: DesignAtlasReferenceArtifact[];
  antiReferences: DesignAntiReferenceArtifact[];
}): void {
  const ids = [
    ...profile.floor.flatMap(({ id, requirements }) => [id, ...requirements.map((item) => item.id)]),
    ...profile.rails.flatMap(({ id, rails }) => [id, ...rails.map((item) => item.id)]),
    profile.compass.id,
    ...profile.compass.principles.map(({ id }) => id),
    ...profile.atlas.map(({ id }) => id),
    ...profile.antiReferences.map(({ id }) => id),
  ];
  if (new Set(ids).size !== ids.length) throw new Error("Design Profile item IDs must be unique across the profile");
}

/** Reads only manifest-listed, bounded, regular profile files and pins them to local Git state. */
export async function resolveDesignProfile(requestedPath: string): Promise<ResolvedDesignProfile> {
  if (!requestedPath.trim()) throw new Error("Design Profile path cannot be empty");
  const requestedRoot = resolve(requestedPath);
  let rootInfo;
  try {
    rootInfo = await lstat(requestedRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Design Profile path does not exist");
    }
    throw error;
  }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("Design Profile path must be a real directory, not a symlink");
  }
  const root = await realpath(requestedRoot);
  const gitRootText = runGit(root, ["rev-parse", "--show-toplevel"]);
  const gitRoot = await realpath(gitRootText);
  if (gitRoot !== root) throw new Error("Design Profile path must be the root of its local Git repository");

  const revision = runGit(root, ["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40,64}$/.test(revision)) throw new Error("Git did not return a concrete commit for the Design Profile");
  const statusBefore = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);

  const manifestBytes = await readProfileFile(root, "profile.json");
  const manifest = parseJson(manifestBytes, "profile.json", DesignProfileManifest);
  const filePaths = [
    "profile.json",
    ...manifest.floorFiles,
    ...manifest.railFiles,
    manifest.compassFile,
    ...manifest.atlasFiles,
    ...manifest.antiReferenceFiles,
  ];
  let totalBytes = 0;
  const bytesByPath = new Map<string, Buffer>();
  for (const filePath of filePaths) {
    if (bytesByPath.has(filePath)) continue;
    const bytes = filePath === "profile.json" ? manifestBytes : await readProfileFile(root, filePath);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_PROFILE_TOTAL_BYTES) throw new Error("Design Profile inputs exceed the 2 MiB total size limit");
    bytesByPath.set(filePath, bytes);
  }

  const floor = manifest.floorFiles.map((filePath) =>
    parseJson(bytesByPath.get(filePath)!, filePath, DesignProfileFloorDocument),
  );
  const rails = manifest.railFiles.map((filePath) =>
    parseJson(bytesByPath.get(filePath)!, filePath, DesignProfileRailDocument),
  );
  const compass = parseJson(bytesByPath.get(manifest.compassFile)!, manifest.compassFile, DesignProfileCompassDocument);
  const atlas = manifest.atlasFiles.map((filePath) => parseJson(bytesByPath.get(filePath)!, filePath, DesignAtlasReference));
  const antiReferences = manifest.antiReferenceFiles.map((filePath) =>
    parseJson(bytesByPath.get(filePath)!, filePath, DesignAntiReference),
  );
  const profileData = { floor, rails, compass, atlas, antiReferences };
  assertUniqueItemIds(profileData);

  const fileDigests = [...bytesByPath.entries()]
    .map(([path, bytes]) => ({ path, sha256: sha256Bytes(bytes) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const profileSha256 = identityHash({ schemaVersion: 1, profileId: manifest.profileId, files: fileDigests });

  const statusAfter = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const revisionAfter = runGit(root, ["rev-parse", "HEAD"]);
  if (statusBefore !== statusAfter || revision !== revisionAfter) {
    throw new Error("Design Profile changed while it was being resolved; retry from a stable working tree");
  }

  const provenance = DesignProfileProvenance.parse({
    sourceKind: "git-worktree",
    profileId: manifest.profileId,
    revision,
    worktreeState: statusAfter.length === 0 ? "clean" : "dirty",
    profileSha256,
    files: fileDigests,
  });
  return {
    root,
    manifest,
    floor,
    rails,
    compass,
    atlas,
    antiReferences,
    provenance,
  };
}

/** Project only the default guidance; profile Atlas material is never injected automatically. */
export function toModelDesignProfile(profile: ResolvedDesignProfile): ModelDesignProfileArtifact {
  return ModelDesignProfile.parse({
    schemaVersion: 1,
    profileId: profile.manifest.profileId,
    provenance: profile.provenance,
    floor: profile.floor,
    rails: profile.rails,
    compass: profile.compass,
  });
}
