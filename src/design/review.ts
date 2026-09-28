import { z } from "zod";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { identityHash, sha256Bytes } from "../environment/hash.ts";
import { DesignModelInput as DesignModelInputSchema } from "../contracts/design/model-input.ts";
import type { DesignModelInput } from "../contracts/design/model-input.ts";
import { CritiqueReport as CritiqueReportSchema } from "../contracts/design/critique.ts";
import type { CritiqueReport } from "../contracts/design/critique.ts";
import { DesignDirection as DesignDirectionSchema } from "../contracts/design/direction.ts";
import type { DesignDirection } from "../contracts/design/direction.ts";
import {
  ReviewCapture,
  ReviewPacket,
  ReviewRecord,
  type ReviewPacket as ReviewPacketArtifact,
  type ReviewRecord as ReviewRecordArtifact,
} from "../contracts/design/review.ts";
import { DesignRunId } from "../contracts/design/common.ts";

const ThreeDirections = z.array(DesignDirectionSchema).length(3);
const ThreeCritiques = z.array(CritiqueReportSchema).length(3);

function requireValid(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function captureCitations(
  directions: DesignDirection[],
  critiques: CritiqueReport[],
): Set<string> {
  const ids = new Set<string>();
  for (const direction of directions) {
    for (const choice of direction.choices) {
      choice.captureRefs.forEach((id) => ids.add(id));
    }
  }
  for (const critique of critiques) {
    for (const finding of critique.findings) {
      finding.supportRefs.forEach((ref) => {
        if (ref.kind === "state-evidence") ids.add(ref.id);
      });
    }
    for (const assessment of critique.choiceAssessments) {
      assessment.supportRefs.forEach((ref) => {
        if (ref.kind === "state-evidence") ids.add(ref.id);
      });
    }
  }
  return ids;
}

function validateSourceCitations(
  directions: DesignDirection[],
  critiques: CritiqueReport[],
  input: DesignModelInput,
): void {
  const intentIds = new Set(input.intent.statements.map(({ id }) => id));
  const referenceAspectIds = new Set(input.references.references.flatMap((reference) =>
    [...reference.use, ...reference.doNotUse].map(({ id }) => id),
  ));
  const evidenceIds = new Set([input.evidence.id]);
  const captureIds = new Set(input.captures.map(({ id }) => id));
  const systemModelIds = new Set(input.systemModel ? [input.systemModel.id] : []);
  const systemTokenIds = new Set(input.systemModel?.tokens.map(({ id }) => id) ?? []);
  const choiceIds = new Set(directions.flatMap((direction) => direction.choices.map(({ id }) => id)));

  for (const direction of directions) {
    requireValid(
      direction.intentRefs.every((id) => intentIds.has(id)),
      `Direction ${direction.id} cites an intent statement absent from the model input`,
    );
    requireValid(
      direction.evidenceRefs.every((id) => evidenceIds.has(id)),
      `Direction ${direction.id} cites evidence absent from the model input`,
    );
    requireValid(
      direction.decisionRefs.length === 0,
      `Direction ${direction.id} cannot cite human decisions before review`,
    );
    requireValid(
      direction.systemModelRefs.every((id) => systemModelIds.has(id)),
      `Direction ${direction.id} cites a system model absent from the model input`,
    );

    for (const choice of direction.choices) {
      requireValid(
        choice.intentRefs.every((id) => intentIds.has(id)),
        `Choice ${choice.id} cites an intent statement absent from the model input`,
      );
      requireValid(
        choice.referenceAspectRefs.every((id) => referenceAspectIds.has(id)),
        `Choice ${choice.id} cites a reference aspect absent from the model input`,
      );
      requireValid(
        choice.evidenceRefs.every((id) => evidenceIds.has(id)),
        `Choice ${choice.id} cites evidence absent from the model input`,
      );
      requireValid(
        choice.captureRefs.every((id) => captureIds.has(id)),
        `Choice ${choice.id} cites a capture absent from the model input`,
      );
    }
  }

  for (const critique of critiques) {
    requireValid(
      critique.intentRefs.every((id) => intentIds.has(id)),
      `Critique ${critique.id} cites an intent statement absent from the model input`,
    );
    requireValid(
      critique.evidenceRefs.every((id) => evidenceIds.has(id)),
      `Critique ${critique.id} cites evidence absent from the model input`,
    );
    for (const finding of critique.findings) {
      for (const ref of finding.supportRefs) {
        const available = ref.kind === "intent-statement" ? intentIds.has(ref.id)
          : ref.kind === "reference-aspect" ? referenceAspectIds.has(ref.id)
            : ref.kind === "state-evidence" ? captureIds.has(ref.id)
              : ref.kind === "system-model" ? systemModelIds.has(ref.id)
                : ref.kind === "system-token" ? systemTokenIds.has(ref.id)
                  : ref.kind === "direction-choice" ? choiceIds.has(ref.id)
                    : false;
        requireValid(available, `Critique ${critique.id} cites unavailable ${ref.kind}: ${ref.id}`);
      }
    }
    for (const assessment of critique.choiceAssessments) {
      for (const ref of assessment.supportRefs) {
        const available = ref.kind === "intent-statement" ? intentIds.has(ref.id)
          : ref.kind === "reference-aspect" ? referenceAspectIds.has(ref.id)
            : ref.kind === "state-evidence" ? captureIds.has(ref.id)
              : ref.kind === "system-model" ? systemModelIds.has(ref.id)
                : ref.kind === "system-token" ? systemTokenIds.has(ref.id)
                  : false;
        requireValid(available, `Critique ${critique.id} cites unavailable ${ref.kind}: ${ref.id}`);
      }
    }
  }
}

/**
 * Creates an inspectable human-review packet without image bytes, source labels, or raw paths.
 * Capture links are reconstructed from opaque IDs under the fixed run-relative perceptual folder.
 */
export function createReviewPacket(
  runRef: string,
  directions: DesignDirection[],
  critiques: CritiqueReport[],
  modelInput: DesignModelInput,
): ReviewPacketArtifact {
  const parsedRunRef = DesignRunId.parse(runRef);
  const parsedInput = DesignModelInputSchema.parse(modelInput);
  const parsedDirections = ThreeDirections.parse(directions);
  const parsedCritiques = ThreeCritiques.parse(critiques);

  const directionIds = new Set(parsedDirections.map(({ id }) => id));
  const critiqueByDirection = new Map<string, CritiqueReport>();
  for (const critique of parsedCritiques) {
    requireValid(directionIds.has(critique.directionRef), `Critique ${critique.id} targets an unknown direction`);
    requireValid(!critiqueByDirection.has(critique.directionRef), `Duplicate critique for ${critique.directionRef}`);
    critiqueByDirection.set(critique.directionRef, critique);
  }
  requireValid(critiqueByDirection.size === parsedDirections.length, "Exactly one critique is required for each direction");
  validateSourceCitations(parsedDirections, parsedCritiques, parsedInput);

  const citedCaptureIds = captureCitations(parsedDirections, parsedCritiques);
  const capturesById = new Map(parsedInput.evidence.captures.map((capture) => [capture.id, capture]));
  const captures = [...citedCaptureIds].map((id) => {
    const metadata = capturesById.get(id);
    requireValid(metadata !== undefined, `Cited capture ${id} has no sanitized evidence metadata`);
    return ReviewCapture.parse({
      ...metadata,
      path: `perceptual/captures/${id}.png`,
    });
  });

  return ReviewPacket.parse({
    schemaVersion: 1,
    runRef: parsedRunRef,
    intent: parsedInput.intent,
    references: parsedInput.references,
    evidence: parsedInput.evidence,
    systemModel: parsedInput.systemModel,
    directionReviews: parsedDirections.map((direction) => ({
      direction,
      critique: critiqueByDirection.get(direction.id),
    })),
    captures,
  });
}

/** SHA-256 of the schema-validated packet using the repository's canonical JSON serialization. */
export function reviewPacketSha256(packetValue: ReviewPacketArtifact): string {
  return identityHash(ReviewPacket.parse(packetValue));
}

/** Validates a human decision against the exact directions, choices, and captures in a packet. */
export function validateReviewRecord(
  packetValue: ReviewPacketArtifact,
  recordValue: unknown,
): ReviewRecordArtifact {
  const packet = ReviewPacket.parse(packetValue);
  const record = ReviewRecord.parse(recordValue);
  requireValid(record.runRef === packet.runRef, "Review record runRef does not match the review packet");
  requireValid(
    record.packetSha256 === reviewPacketSha256(packet),
    "Review record packetSha256 does not match this exact review packet",
  );

  const directionIds = new Set(packet.directionReviews.map(({ direction }) => direction.id));
  const choiceIds = new Set(packet.directionReviews.flatMap(({ direction }) =>
    direction.choices.map(({ id }) => id),
  ));
  const captureIds = new Set(packet.captures.map(({ id }) => id));
  const validSubjectRefs = new Set<string>([
    packet.runRef,
    packet.intent.id,
    packet.evidence.id,
    ...packet.intent.statements.map(({ id }) => id),
    packet.references.id,
    ...packet.references.references.flatMap((reference) => [
      reference.id,
      ...reference.evidenceRefs,
      ...reference.use.map(({ id }) => id),
      ...reference.doNotUse.map(({ id }) => id),
    ]),
    ...packet.evidence.captures.flatMap((capture) => [capture.id, capture.stateRef, capture.viewportRef]),
    ...(packet.systemModel ? [packet.systemModel.id, ...packet.systemModel.intentRefs, ...packet.systemModel.tokens.map(({ id }) => id)] : []),
  ]);
  for (const { direction, critique } of packet.directionReviews) {
    validSubjectRefs.add(direction.id);
    direction.intentRefs.forEach((id) => validSubjectRefs.add(id));
    direction.evidenceRefs.forEach((id) => validSubjectRefs.add(id));
    direction.decisionRefs.forEach((id) => validSubjectRefs.add(id));
    direction.systemModelRefs.forEach((id) => validSubjectRefs.add(id));
    for (const choice of direction.choices) {
      validSubjectRefs.add(choice.id);
      choice.intentRefs.forEach((id) => validSubjectRefs.add(id));
      choice.referenceAspectRefs.forEach((id) => validSubjectRefs.add(id));
      choice.evidenceRefs.forEach((id) => validSubjectRefs.add(id));
      choice.captureRefs.forEach((id) => validSubjectRefs.add(id));
    }
    validSubjectRefs.add(critique.id);
    critique.intentRefs.forEach((id) => validSubjectRefs.add(id));
    critique.evidenceRefs.forEach((id) => validSubjectRefs.add(id));
    for (const finding of critique.findings) {
      validSubjectRefs.add(finding.id);
      finding.supportRefs.forEach((ref) => validSubjectRefs.add(ref.id));
    }
    for (const assessment of critique.choiceAssessments) {
      validSubjectRefs.add(assessment.choiceRef);
      assessment.supportRefs.forEach((ref) => validSubjectRefs.add(ref.id));
    }
  }

  for (const decision of record.decisions) {
    for (const subjectRef of decision.subjectRefs) {
      if (subjectRef.startsWith("dir_")) {
        requireValid(directionIds.has(subjectRef), `Decision cites a direction absent from the packet: ${subjectRef}`);
      } else if (subjectRef.startsWith("choice_")) {
        requireValid(choiceIds.has(subjectRef), `Decision cites a choice absent from the packet: ${subjectRef}`);
      } else if (subjectRef.startsWith("cap_")) {
        requireValid(captureIds.has(subjectRef), `Decision cites a capture absent from the packet: ${subjectRef}`);
      } else {
        requireValid(validSubjectRefs.has(subjectRef), `Decision cites an artifact absent from the packet: ${subjectRef}`);
      }
    }

    if (decision.pairwiseComparison) {
      const { preferredDirectionRef, otherDirectionRef } = decision.pairwiseComparison;
      requireValid(
        preferredDirectionRef !== otherDirectionRef,
        "Pairwise comparison must cite two different directions",
      );
      requireValid(directionIds.has(preferredDirectionRef), `Pairwise comparison cites a direction absent from the packet: ${preferredDirectionRef}`);
      requireValid(directionIds.has(otherDirectionRef), `Pairwise comparison cites a direction absent from the packet: ${otherDirectionRef}`);
      requireValid(
        decision.subjectRefs.includes(preferredDirectionRef) && decision.subjectRefs.includes(otherDirectionRef),
        "Pairwise directions must both be listed as decision subjects",
      );
    }
  }

  return record;
}

const PACKET_FILE = "packet.json";
const PACKET_HASH_FILE = "packet.sha256";
const DECISION_FILE = "decision.json";

function isWithin(parent: string, candidate: string): boolean {
  const fromParent = relative(parent, candidate);
  return fromParent !== ".." && !fromParent.startsWith(`..${sep}`) && !isAbsolute(fromParent);
}

async function reviewDirectory(runDirectory: string, create: boolean): Promise<string> {
  const requestedRoot = resolve(runDirectory);
  const rootInfo = await lstat(requestedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("Review run directory must be an existing regular directory, not a symlink");
  }
  const runRoot = await realpath(requestedRoot);
  const reviewPath = join(runRoot, "review");

  if (create) {
    try {
      await mkdir(reviewPath, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }

  const reviewInfo = await lstat(reviewPath);
  if (!reviewInfo.isDirectory() || reviewInfo.isSymbolicLink()) {
    throw new Error("Review artifact directory must be a regular directory, not a symlink");
  }
  const resolvedReviewPath = await realpath(reviewPath);
  if (!isWithin(runRoot, resolvedReviewPath)) {
    throw new Error("Review artifact directory escaped the explicit run directory");
  }
  return resolvedReviewPath;
}

async function readJsonFile<T>(directory: string, filename: string, schema: z.ZodType<T>): Promise<T> {
  const path = join(directory, filename);
  const fileInfo = await lstat(path);
  if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
    throw new Error(`Review artifact ${filename} must be a regular file, not a symlink`);
  }
  const resolvedPath = await realpath(path);
  if (!isWithin(directory, resolvedPath)) throw new Error(`Review artifact ${filename} escaped its review directory`);

  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const openedInfo = await handle.stat();
    if (!openedInfo.isFile()) throw new Error(`Review artifact ${filename} is not a regular file`);
    let value: unknown;
    try {
      value = JSON.parse(await handle.readFile("utf8"));
    } catch {
      throw new Error(`Review artifact ${filename} is not valid JSON`);
    }
    return schema.parse(value);
  } finally {
    await handle.close();
  }
}

async function validatePacketCaptureFiles(runDirectory: string, packet: ReviewPacketArtifact): Promise<void> {
  const runRoot = await realpath(resolve(runDirectory));
  for (const capture of packet.captures) {
    const parts = capture.path.split("/");
    let parent = runRoot;
    for (const component of parts.slice(0, -1)) {
      parent = join(parent, component);
      const parentInfo = await lstat(parent);
      if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
        throw new Error(`Review capture directory is not a regular directory: ${capture.path}`);
      }
      const parentResolved = await realpath(parent);
      if (!isWithin(runRoot, parentResolved)) {
        throw new Error(`Review capture directory escaped the run directory: ${capture.path}`);
      }
    }

    const filePath = join(runRoot, ...parts);
    const fileInfo = await lstat(filePath);
    if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
      throw new Error(`Review capture is not a regular file: ${capture.path}`);
    }
    const resolvedFile = await realpath(filePath);
    if (!isWithin(runRoot, resolvedFile)) throw new Error(`Review capture escaped the run directory: ${capture.path}`);
    const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const bytes = await handle.readFile();
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const validSignature = signature.every((value, index) => bytes[index] === value);
      const dimensionsMatch = bytes.length >= 24 &&
        bytes.readUInt32BE(16) === capture.width && bytes.readUInt32BE(20) === capture.height;
      if (sha256Bytes(bytes) !== capture.sha256 || !validSignature || !dimensionsMatch) {
        throw new Error(`Review capture bytes do not match packet metadata: ${capture.id}`);
      }
    } finally {
      await handle.close();
    }
  }
}

async function writeJsonOnce<T>(directory: string, filename: string, value: T): Promise<void> {
  // O_EXCL makes the no-overwrite rule atomic; O_NOFOLLOW refuses an existing symlink target.
  const path = join(directory, filename);
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(path, flags, 0o600);
    const openedInfo = await handle.stat();
    if (!openedInfo.isFile()) throw new Error(`Review artifact ${filename} is not a regular file`);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined);
      await unlink(path).catch(() => undefined);
    }
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Review artifact already exists and will not be overwritten: ${filename}`);
    }
    throw error;
  }
  await handle.close();
}

async function writeTextOnce(directory: string, filename: string, value: string): Promise<void> {
  const path = join(directory, filename);
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  const handle = await open(path, flags, 0o600).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Review artifact already exists and will not be overwritten: ${filename}`);
    }
    throw error;
  });
  let closed = false;
  try {
    if (!(await handle.stat()).isFile()) throw new Error(`Review artifact ${filename} is not a regular file`);
    await handle.writeFile(value, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    closed = true;
    await unlink(path).catch(() => undefined);
    throw error;
  } finally {
    if (!closed) await handle.close();
  }
}

async function readPacketHash(directory: string, packet: ReviewPacketArtifact): Promise<string> {
  const path = join(directory, PACKET_HASH_FILE);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Review packet hash must be a regular file, not a symlink");
  const resolvedPath = await realpath(path);
  if (!isWithin(directory, resolvedPath)) throw new Error("Review packet hash escaped its review directory");
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const savedHash = await handle.readFile("utf8");
    const expectedHash = reviewPacketSha256(packet);
    if (savedHash !== expectedHash) throw new Error("Review packet hash does not match packet.json");
    return savedHash;
  } finally {
    await handle.close();
  }
}

/** Creates review/ if needed and writes packet.json exactly once beneath the supplied run directory. */
export async function writeReviewPacket(
  runDirectory: string,
  packetValue: ReviewPacketArtifact,
): Promise<ReviewPacketArtifact> {
  const packet = ReviewPacket.parse(packetValue);
  const directory = await reviewDirectory(runDirectory, true);
  await validatePacketCaptureFiles(runDirectory, packet);
  await writeJsonOnce(directory, PACKET_FILE, packet);
  await writeTextOnce(directory, PACKET_HASH_FILE, reviewPacketSha256(packet));
  return packet;
}

/** Reads and strictly validates the packet from an existing run directory. */
export async function readReviewPacket(runDirectory: string): Promise<ReviewPacketArtifact> {
  const directory = await reviewDirectory(runDirectory, false);
  const packet = await readJsonFile(directory, PACKET_FILE, ReviewPacket);
  await validatePacketCaptureFiles(runDirectory, packet);
  await readPacketHash(directory, packet);
  return packet;
}

/** Validates a decision against packet.json and writes review/decision.json exactly once. */
export async function writeReviewDecision(
  runDirectory: string,
  recordValue: unknown,
): Promise<ReviewRecordArtifact> {
  const directory = await reviewDirectory(runDirectory, false);
  const packet = await readReviewPacket(runDirectory);
  const record = validateReviewRecord(packet, recordValue);
  await writeJsonOnce(directory, DECISION_FILE, record);
  return record;
}

/** Reads and validates decision.json against the packet currently persisted for the run. */
export async function readReviewDecision(runDirectory: string): Promise<ReviewRecordArtifact> {
  const directory = await reviewDirectory(runDirectory, false);
  const packet = await readReviewPacket(runDirectory);
  const record = await readJsonFile(directory, DECISION_FILE, ReviewRecord);
  return validateReviewRecord(packet, record);
}
