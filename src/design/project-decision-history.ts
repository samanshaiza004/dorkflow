import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { link, lstat, mkdir, open, readdir, realpath, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  ProjectDecisionContext,
  ProjectDecisionHistoryManifest,
  ProjectDecisionQuery,
  ProjectDecisionRecord,
  type ProjectDecisionHistoryManifest as ProjectDecisionHistoryManifestArtifact,
  type ProjectDecisionRecord as ProjectDecisionRecordArtifact,
} from "../contracts/design/project-decision-history.ts";
import { B9VerificationClosure } from "./b9-verification.ts";
import { ReviewRecord } from "../contracts/design/review.ts";
import { NonEmptyText, ProjectId } from "../contracts/design/common.ts";
import { identityHash, sha256Bytes } from "../environment/hash.ts";

const METADATA_FILE = "project.json";
const HISTORY_DIRECTORY = ".dorkflow";
const DECISIONS_DIRECTORY = "decisions";
const SOURCES_DIRECTORY = "sources";
const STAGING_DIRECTORY = ".staging";
const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_DECISION_BYTES = 32 * 1024;

function isWithin(parent: string, candidate: string): boolean {
  const fromParent = relative(parent, candidate);
  return fromParent !== ".." && !fromParent.startsWith(`..${sep}`) && !isAbsolute(fromParent);
}

async function ensureDirectory(parent: string, name: string, root: string, create: boolean): Promise<string> {
  const path = join(parent, name);
  if (create) {
    try {
      await mkdir(path, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Project decision-history directory is missing: ${path}`);
    }
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`Project decision-history path must be a real directory, not a symlink: ${path}`);
  }
  const resolved = await realpath(path);
  if (!isWithin(root, resolved)) throw new Error(`Project decision-history path escaped the project root: ${path}`);
  return resolved;
}

async function resolveStore(projectRoot: string, create: boolean) {
  const requestedRoot = resolve(projectRoot);
  const rootInfo = await lstat(requestedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("Project decision-history root must be an existing real directory, not a symlink");
  }
  const root = await realpath(requestedRoot);
  const hidden = await ensureDirectory(root, HISTORY_DIRECTORY, root, create);
  const decisions = await ensureDirectory(hidden, DECISIONS_DIRECTORY, root, create);
  const sources = await ensureDirectory(hidden, SOURCES_DIRECTORY, root, create);
  return { root, hidden, decisions, sources, manifestPath: join(hidden, METADATA_FILE) };
}

async function ensureStaging(
  store: Awaited<ReturnType<typeof resolveStore>>,
  targetDirectory: string,
): Promise<string> {
  return ensureDirectory(targetDirectory, STAGING_DIRECTORY, store.root, true);
}

async function readRegularFile(path: string, boundary: string, maxBytes: number): Promise<Uint8Array> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Project history artifact must be a regular file, not a symlink: ${path}`);
  const resolved = await realpath(path);
  if (!isWithin(boundary, resolved)) throw new Error(`Project history artifact escaped its boundary: ${path}`);
  const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const openedInfo = await handle.stat();
    if (!openedInfo.isFile() || openedInfo.size > maxBytes) throw new Error(`Project history artifact is not a bounded regular file: ${path}`);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function writeOnce(path: string, bytes: Uint8Array, maximum: number, stagingDirectory: string): Promise<void> {
  if (bytes.byteLength > maximum) throw new Error(`Project decision-history artifact exceeds ${maximum} bytes`);
  const temporaryPath = join(stagingDirectory, `write-${randomBytes(16).toString("hex")}.tmp`);
  const flags = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, flags, 0o600);
    if (!(await handle.stat()).isFile()) throw new Error("Project history staging artifact is not a regular file");
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    // Linking the complete staged inode publishes it atomically without replacing an existing entry.
    await link(temporaryPath, path);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const conflict = new Error(`Project history artifact already exists and is immutable: ${path}`);
      Object.assign(conflict, { code: "EEXIST" });
      throw conflict;
    }
    throw error;
  }
  await unlink(temporaryPath).catch(() => undefined);
}

async function readManifestAt(path: string, root: string): Promise<ProjectDecisionHistoryManifestArtifact> {
  const bytes = await readRegularFile(path, root, MAX_DECISION_BYTES);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("Project decision-history project.json is not valid UTF-8 JSON");
  }
  return ProjectDecisionHistoryManifest.parse(value);
}

async function readExistingManifest(store: Awaited<ReturnType<typeof resolveStore>>): Promise<ProjectDecisionHistoryManifestArtifact> {
  return readManifestAt(store.manifestPath, store.root);
}

/** Creates a project-local history store once; an existing identity/name is never silently changed. */
export async function initializeProjectDecisionHistory(
  projectRoot: string,
  input: { name: string; projectId?: string; createdAt?: string },
): Promise<ProjectDecisionHistoryManifestArtifact> {
  const store = await resolveStore(projectRoot, true);
  const name = NonEmptyText.parse(input.name);
  let existing: ProjectDecisionHistoryManifestArtifact | undefined;
  try {
    existing = await readExistingManifest(store);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (existing) {
    if (existing.name !== name) throw new Error("Project decision-history name differs from its initialized identity");
    if (input.projectId && existing.projectId !== ProjectId.parse(input.projectId)) {
      throw new Error("Project decision-history ID differs from its initialized identity");
    }
    return existing;
  }

  const manifest = ProjectDecisionHistoryManifest.parse({
    schemaVersion: 1,
    projectId: input.projectId ?? `proj_${randomBytes(12).toString("hex")}`,
    name,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
  const bytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  try {
    await writeOnce(store.manifestPath, bytes, MAX_DECISION_BYTES, await ensureStaging(store, store.hidden));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const raced = await readExistingManifest(store);
    if (raced.name !== name || (input.projectId && raced.projectId !== input.projectId)) {
      throw new Error("Concurrent project decision-history initialization chose a different identity");
    }
    return raced;
  }
  return manifest;
}

async function requireManifest(store: Awaited<ReturnType<typeof resolveStore>>): Promise<ProjectDecisionHistoryManifestArtifact> {
  try {
    return await readExistingManifest(store);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Project decision history is not initialized; initialize it before use");
    }
    throw error;
  }
}

/** Stores the exact source JSON bytes once, addressed only by their full SHA-256. */
export async function storeProjectDecisionSource(projectRoot: string, bytes: Uint8Array): Promise<string> {
  const store = await resolveStore(projectRoot, false);
  await requireManifest(store);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error(`Project decision source must be between 1 and ${MAX_SOURCE_BYTES} bytes`);
  }
  const sourceSha256 = sha256Bytes(bytes);
  const path = join(store.sources, `${sourceSha256}.json`);
  try {
    await writeOnce(path, bytes, MAX_SOURCE_BYTES, await ensureStaging(store, store.sources));
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("already exists and is immutable")) throw error;
    const existing = await readRegularFile(path, store.root, MAX_SOURCE_BYTES);
    if (sha256Bytes(existing) !== sourceSha256) throw new Error("Existing project decision source has unexpected bytes");
  }
  return sourceSha256;
}

async function validateSourceForRecord(
  store: Awaited<ReturnType<typeof resolveStore>>,
  record: ProjectDecisionRecordArtifact,
): Promise<void> {
  const bytes = await readRegularFile(join(store.sources, `${record.source.sourceSha256}.json`), store.root, MAX_SOURCE_BYTES);
  if (sha256Bytes(bytes) !== record.source.sourceSha256) throw new Error("Project decision source hash does not match its stored bytes");
  let sourceValue: unknown;
  try {
    sourceValue = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("Project decision source is not valid UTF-8 JSON");
  }

  if (record.source.kind === "review-record") {
    const sourceRecord = ReviewRecord.parse(sourceValue);
    if (sourceRecord.runRef !== record.source.runRef || sourceRecord.packetSha256 !== record.source.packetSha256) {
      throw new Error("Project decision source does not match its review-record provenance");
    }
    const sourceDecision = sourceRecord.decisions.find(({ id }) => id === record.decision.id);
    if (!sourceDecision || identityHash(sourceDecision) !== identityHash(record.decision)) {
      throw new Error("Project decision differs from the cited review record");
    }
    return;
  }

  const closureSource = record.source;
  const closure = B9VerificationClosure.parse(sourceValue);
  if (
    closure.reportRef !== closureSource.reportRef ||
    closure.reportSha256 !== closureSource.reportSha256 ||
    closure.resolutionSha256 !== closureSource.resolutionSha256
  ) throw new Error("Project decision source does not match its B9 closure provenance");
  const resolution = closure.resolutions.find(({ reviewItemRef }) => reviewItemRef === closureSource.reviewItemRef);
  const disposition = resolution?.disposition === "PASS" ? "accept" : resolution?.disposition === "REVISE" ? "revise" : resolution?.disposition === "FAIL" ? "reject" : null;
  if (
    !resolution ||
    record.decision.disposition !== disposition ||
    !record.decision.subjectRefs.includes(closureSource.reviewItemRef) ||
    record.decision.rationale !== resolution.rationale
  ) throw new Error("Project decision differs from the cited B9 human resolution");
}

/** Appends one immutable, source-validated decision. Exact duplicate submissions are idempotent. */
export async function appendProjectDecision(
  projectRoot: string,
  recordValue: unknown,
): Promise<{ created: boolean; record: ProjectDecisionRecordArtifact }> {
  const store = await resolveStore(projectRoot, false);
  const manifest = await requireManifest(store);
  const record = ProjectDecisionRecord.parse(recordValue);
  if (record.projectId !== manifest.projectId) throw new Error("Project decision belongs to a different project history");
  await validateSourceForRecord(store, record);
  const path = join(store.decisions, `${record.decision.id}.json`);
  try {
    await writeOnce(path, new TextEncoder().encode(`${JSON.stringify(record, null, 2)}\n`), MAX_DECISION_BYTES, await ensureStaging(store, store.decisions));
    return { created: true, record };
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("already exists and is immutable")) throw error;
    const existingBytes = await readRegularFile(path, store.root, MAX_DECISION_BYTES);
    let existingValue: unknown;
    try {
      existingValue = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(existingBytes));
    } catch {
      throw new Error(`Existing decision ${record.decision.id} is corrupt; refusing to overwrite it`);
    }
    const existing = ProjectDecisionRecord.parse(existingValue);
    if (identityHash(existing) !== identityHash(record)) {
      throw new Error(`Decision ID conflict; immutable history entry will not be overwritten: ${record.decision.id}`);
    }
    return { created: false, record: existing };
  }
}

/** Loads the complete, validated project-local history in stable recorded-time order. */
export async function readProjectDecisionHistory(projectRoot: string): Promise<{
  manifest: ProjectDecisionHistoryManifestArtifact;
  decisions: ProjectDecisionRecordArtifact[];
}> {
  const store = await resolveStore(projectRoot, false);
  const manifest = await requireManifest(store);
  const entries = await readdir(store.decisions, { withFileTypes: true });
  const decisions: ProjectDecisionRecordArtifact[] = [];
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Project decision-history entry cannot be a symlink: ${entry.name}`);
    if (entry.name === STAGING_DIRECTORY) {
      await ensureDirectory(store.decisions, STAGING_DIRECTORY, store.root, false);
      continue;
    }
    if (!entry.isFile() || !/^hdec_[a-z0-9]{8,64}\.json$/.test(entry.name)) {
      throw new Error(`Unexpected project decision-history entry: ${entry.name}`);
    }
    const bytes = await readRegularFile(join(store.decisions, entry.name), store.root, MAX_DECISION_BYTES);
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new Error(`Project decision-history entry is not valid UTF-8 JSON: ${entry.name}`);
    }
    const record = ProjectDecisionRecord.parse(value);
    if (`${record.decision.id}.json` !== entry.name) throw new Error(`Decision filename does not match its opaque ID: ${entry.name}`);
    if (record.projectId !== manifest.projectId) throw new Error(`Decision ${record.decision.id} belongs to another project`);
    if (ids.has(record.decision.id)) throw new Error(`Duplicate project decision ID: ${record.decision.id}`);
    ids.add(record.decision.id);
    await validateSourceForRecord(store, record);
    decisions.push(record);
  }
  decisions.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.decision.id.localeCompare(right.decision.id));
  return { manifest, decisions };
}

/** Returns only exact subject-reference matches; the result is explicitly project-scoped. */
export async function retrieveProjectDecisionHistory(
  projectRoot: string,
  queryValue: unknown,
) {
  const query = ProjectDecisionQuery.parse(queryValue);
  const { manifest, decisions } = await readProjectDecisionHistory(projectRoot);
  const requested = new Set(query.subjectRefs);
  const dispositionFilter = query.dispositions ? new Set(query.dispositions) : undefined;
  return ProjectDecisionContext.parse({
    scope: "project-only",
    projectId: manifest.projectId,
    projectName: manifest.name,
    query,
    precedents: decisions.filter(({ decision }) =>
      decision.subjectRefs.some((subjectRef) => requested.has(subjectRef)) &&
      (!dispositionFilter || dispositionFilter.has(decision.disposition)),
    ),
  });
}
