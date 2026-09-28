import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesignModelInput as DesignModelInputSchema } from "../src/contracts/design/model-input.ts";
import { ReviewPacket as ReviewPacketSchema } from "../src/contracts/design/review.ts";
import { sha256Bytes } from "../src/environment/hash.ts";
import {
  createReviewPacket,
  readReviewDecision,
  readReviewPacket,
  reviewPacketSha256,
  validateReviewRecord,
  writeReviewDecision,
  writeReviewPacket,
} from "../src/design/review.ts";

const png = new Uint8Array(24);
png.set([137, 80, 78, 71, 13, 10, 26, 10]);
new DataView(png.buffer).setUint32(16, 20);
new DataView(png.buffer).setUint32(20, 10);
const pngBase64 = Buffer.from(png).toString("base64");
const pngSha256 = sha256Bytes(png);

const captureMetadata = [
  {
    id: "cap_00000001",
    sha256: pngSha256,
    stateRef: "st_00000001",
    stateKind: "default",
    triggerKinds: ["initial"],
    viewportRef: "vp_00000001",
    viewport: { label: "mobile", width: 320, height: 640 },
    mediaType: "image/png",
    width: 20,
    height: 10,
  },
  {
    id: "cap_00000002",
    sha256: pngSha256,
    stateRef: "st_00000002",
    stateKind: "open",
    triggerKinds: ["click"],
    viewportRef: "vp_00000001",
    viewport: { label: "mobile", width: 320, height: 640 },
    mediaType: "image/png",
    width: 20,
    height: 10,
  },
  {
    id: "cap_00000003",
    sha256: pngSha256,
    stateRef: "st_00000003",
    stateKind: "focus-visible",
    triggerKinds: ["focus"],
    viewportRef: "vp_00000001",
    viewport: { label: "mobile", width: 320, height: 640 },
    mediaType: "image/png",
    width: 20,
    height: 10,
  },
] as const;

const input = DesignModelInputSchema.parse({
  schemaVersion: 1,
  intent: {
    schemaVersion: 2,
    id: "intent_00000001",
    product: "Harbor Log",
    rationale: "Make active work straightforward to scan.",
    statements: [{
      id: "istat_00000001",
      kind: "job",
      statement: "Review active work without losing context.",
    }],
  },
  references: {
    schemaVersion: 2,
    id: "refs_00000001",
    intentRef: "intent_00000001",
    references: [{
      schemaVersion: 2,
      id: "ref_00000001",
      sourceKind: "generated",
      use: [{
        id: "raspect_00000001",
        aspect: "information density",
        rationale: "Keep repeated actions close to the records they affect.",
      }],
      doNotUse: [],
      evidenceRefs: ["ev_00000001"],
    }],
  },
  evidence: {
    schemaVersion: 1,
    id: "ev_00000001",
    purpose: "hierarchy",
    trustMode: "generated",
    contentTreatment: "original",
    originalPixelsApproved: true,
    renderingEnvironmentSha256: "a".repeat(64),
    sanitizer: null,
    captures: captureMetadata,
  },
  captures: captureMetadata.map((capture) => ({ ...capture, imageBase64: pngBase64 })),
  systemModel: null,
});

const axes = [
  {
    composition: "editorial-grid", spatialModel: "contained", density: "balanced",
    navigationModel: "top-bar", hierarchy: "typographic", surfaceModel: "flat",
    componentAnatomy: "record-rows", imagery: "none", motion: "restrained",
  },
  {
    composition: "open-canvas", spatialModel: "expansive", density: "compact",
    navigationModel: "side-rail", hierarchy: "positional", surfaceModel: "layered",
    componentAnatomy: "work-panels", imagery: "documentary", motion: "guided",
  },
  {
    composition: "stacked-sequence", spatialModel: "edge-to-edge", density: "dense",
    navigationModel: "bottom-bar", hierarchy: "chromatic", surfaceModel: "elevated",
    componentAnatomy: "card-list", imagery: "illustrative", motion: "immediate",
  },
] as const;

function makeDirections() {
  return axes.map((strategyAxes, index) => ({
    schemaVersion: 2 as const,
    id: `dir_0000000${index + 1}`,
    thesis: `Direction ${index + 1} presents a distinct way to review work.`,
    rationale: "The arrangement responds to the stated review job.",
    intentRefs: ["istat_00000001"],
    evidenceRefs: ["ev_00000001"],
    decisionRefs: [],
    systemModelRefs: [],
    strategyAxes,
    choices: [{
      id: `choice_0000000${index + 1}`,
      area: "layout" as const,
      statement: `Use layout approach ${index + 1}.`,
      rationale: "The arrangement keeps review context visible.",
      intentRefs: ["istat_00000001"],
      referenceAspectRefs: ["raspect_00000001"],
      evidenceRefs: ["ev_00000001"],
      captureRefs: index === 0 ? ["cap_00000001"] : [],
    }],
    uncertainties: [],
  }));
}

function makeCritiques(directions = makeDirections()) {
  return directions.map((direction, index) => ({
    schemaVersion: 2 as const,
    id: `crit_0000000${index + 1}`,
    directionRef: direction.id,
    intentRefs: ["istat_00000001"],
    evidenceRefs: ["ev_00000001"],
    findings: index === 1 ? [{
      id: "finding_00000001",
      category: "responsive" as const,
      severity: "medium" as const,
      supportRefs: [{ kind: "state-evidence" as const, id: "cap_00000002" }],
      rationale: "The open state needs enough room on narrow screens.",
      suggestedResolution: "Check the open state at the narrow viewport.",
    }] : [],
    choiceAssessments: direction.choices.map((choice) => ({
      choiceRef: choice.id,
      assessment: "supported" as const,
      supportRefs: [{ kind: "intent-statement" as const, id: "istat_00000001" }],
      rationale: "The choice is connected to the stated review job.",
    })),
    uncertainties: [],
  }));
}

function makePacket() {
  const directions = makeDirections();
  return createReviewPacket("run_00000001", directions, makeCritiques(directions).reverse(), input);
}

async function writePacketCaptures(runDirectory: string, packet = makePacket()): Promise<void> {
  await mkdir(join(runDirectory, "perceptual", "captures"), { recursive: true });
  for (const capture of packet.captures) {
    await writeFile(join(runDirectory, capture.path), png, { flag: "wx" });
  }
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  const packet = makePacket();
  return {
    schemaVersion: 1,
    runRef: "run_00000001",
    packetSha256: reviewPacketSha256(packet),
    decisions: [{
      schemaVersion: 1,
      id: "hdec_00000001",
      subjectRefs: ["dir_00000001", "dir_00000002", "choice_00000001", "cap_00000001"],
      disposition: "prefer",
      rationale: "This direction best supports the review task.",
      pairwiseComparison: {
        preferredDirectionRef: "dir_00000001",
        otherDirectionRef: "dir_00000002",
        rationale: "The first keeps the review sequence clearer.",
      },
    }],
    ...overrides,
  };
}

describe("file-based B5 review artifacts", () => {
  test("pairs each direction with its critique and maps only cited sanitized captures", () => {
    const packet = makePacket();
    expect(packet.directionReviews).toHaveLength(3);
    expect(packet.directionReviews.map(({ direction, critique }) => [direction.id, critique.directionRef])).toEqual([
      ["dir_00000001", "dir_00000001"],
      ["dir_00000002", "dir_00000002"],
      ["dir_00000003", "dir_00000003"],
    ]);
    expect(packet.captures.map(({ id, path }) => [id, path])).toEqual([
      ["cap_00000001", "perceptual/captures/cap_00000001.png"],
      ["cap_00000002", "perceptual/captures/cap_00000002.png"],
    ]);
    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("imageBase64");
    expect(serialized).not.toContain(pngBase64);
    expect(serialized).not.toContain("quarantine");
    expect(serialized).not.toContain("/Users/");
    expect(packet.directionReviews[0]!.direction.choices[0]!.intentRefs).toContain("istat_00000001");
    expect(packet.directionReviews[1]!.critique.findings[0]!.supportRefs).toContainEqual({
      kind: "state-evidence",
      id: "cap_00000002",
    });
  });

  test("rejects incomplete direction sets, unmatched critiques, and unavailable citations", () => {
    const directions = makeDirections();
    const critiques = makeCritiques(directions);
    expect(() => createReviewPacket("run_00000001", directions.slice(0, 2), critiques, input)).toThrow();

    const wrongTarget = makeCritiques(directions);
    wrongTarget[0]!.directionRef = "dir_99999999";
    expect(() => createReviewPacket("run_00000001", directions, wrongTarget, input)).toThrow("targets an unknown direction");

    const unknownCapture = makeDirections();
    unknownCapture[0]!.choices[0]!.captureRefs = ["cap_99999999"];
    expect(() => createReviewPacket("run_00000001", unknownCapture, critiques, input)).toThrow("capture absent from the model input");
  });

  test("strict packet validation refuses duplicate identities and traversal/quarantine paths", () => {
    const packet = makePacket();
    const duplicateDirection = structuredClone(packet);
    duplicateDirection.directionReviews[1]!.direction.id = duplicateDirection.directionReviews[0]!.direction.id;
    expect(() => ReviewPacketSchema.parse(duplicateDirection)).toThrow("Direction IDs must be unique");

    for (const unsafePath of ["../quarantine/cap_00000001.png", "/tmp/cap_00000001.png", "perceptual/../quarantine/x.png"]) {
      const unsafe = structuredClone(packet);
      unsafe.captures[0]!.path = unsafePath;
      expect(() => ReviewPacketSchema.parse(unsafe)).toThrow();
    }

    const unreferenced = structuredClone(packet);
    unreferenced.captures.push({
      ...unreferenced.captures[0]!,
      id: "cap_00000003",
      path: "perceptual/captures/cap_00000003.png",
    });
    expect(() => ReviewPacketSchema.parse(unreferenced)).toThrow("exactly the captures cited");
  });

  test("validates HumanDecision subjects, run identity, and pairwise directions", () => {
    const packet = makePacket();
    const valid = validateReviewRecord(packet, makeRecord());
    expect(valid.decisions[0]!.id).toBe("hdec_00000001");

    for (const subjectRef of ["dir_99999999", "choice_99999999", "cap_99999999"]) {
      const candidate = makeRecord();
      candidate.decisions[0]!.subjectRefs = [subjectRef];
      expect(() => validateReviewRecord(packet, candidate)).toThrow("absent from the packet");
    }

    const absentIntent = makeRecord();
    absentIntent.decisions[0]!.subjectRefs = ["istat_99999999"];
    expect(() => validateReviewRecord(packet, absentIntent)).toThrow("artifact absent from the packet");

    const absentPairwise = makeRecord();
    absentPairwise.decisions[0]!.pairwiseComparison.otherDirectionRef = "dir_99999999";
    expect(() => validateReviewRecord(packet, absentPairwise)).toThrow("Pairwise comparison cites a direction absent");

    const samePairwise = makeRecord();
    samePairwise.decisions[0]!.pairwiseComparison.otherDirectionRef = "dir_00000001";
    expect(() => validateReviewRecord(packet, samePairwise)).toThrow();

    const wrongRun = makeRecord({ runRef: "run_00000002" });
    expect(() => validateReviewRecord(packet, wrongRun)).toThrow("runRef does not match");
  });

  test("binds a decision to the canonical hash of the exact packet", () => {
    const packet = makePacket();
    const record = makeRecord();
    expect(record.packetSha256).toBe(reviewPacketSha256(packet));

    const reorderedTopLevel = Object.fromEntries(Object.entries(packet).reverse());
    expect(reviewPacketSha256(reorderedTopLevel as typeof packet)).toBe(record.packetSha256);
    expect(() => validateReviewRecord(packet, record)).not.toThrow();

    const changedPacket = structuredClone(packet);
    changedPacket.directionReviews[0]!.direction.rationale += " Updated after review.";
    expect(reviewPacketSha256(changedPacket)).not.toBe(record.packetSha256);
    expect(() => validateReviewRecord(changedPacket, record)).toThrow("packetSha256 does not match");

    const wrongHash = { ...record, packetSha256: "0".repeat(64) };
    expect(() => validateReviewRecord(packet, wrongHash)).toThrow("packetSha256 does not match");
  });

  test("rejects critique-to-direction mismatch and structurally invalid review records", () => {
    const packet = makePacket();
    const mismatch = structuredClone(packet);
    mismatch.directionReviews[0]!.critique.directionRef = "dir_00000002";
    expect(() => ReviewPacketSchema.parse(mismatch)).toThrow("paired direction");

    const extra = makeRecord();
    (extra as Record<string, unknown>).unexpected = "must be rejected";
    expect(() => validateReviewRecord(packet, extra)).toThrow();
  });

  test("writes and reads packet/decision files once without overwriting either", async () => {
    const runDirectory = await mkdtemp(join(tmpdir(), "dorkflow-review-files-"));
    try {
      const packet = makePacket();
      await writePacketCaptures(runDirectory, packet);
      const writtenPacket = await writeReviewPacket(runDirectory, packet);
      expect(writtenPacket).toEqual(packet);
      expect(await readReviewPacket(runDirectory)).toEqual(packet);
      expect(await readFile(join(runDirectory, "review", "packet.sha256"), "utf8")).toBe(reviewPacketSha256(packet));

      const decision = makeRecord();
      const invalidDecision = makeRecord();
      invalidDecision.decisions[0]!.subjectRefs = ["choice_99999999"];
      await expect(writeReviewDecision(runDirectory, invalidDecision)).rejects.toThrow("absent from the packet");
      expect(await readFile(join(runDirectory, "review", "decision.json"), "utf8").catch(() => null)).toBeNull();
      const writtenDecision = await writeReviewDecision(runDirectory, decision);
      expect(writtenDecision).toEqual(validateReviewRecord(packet, decision));
      expect(await readReviewDecision(runDirectory)).toEqual(writtenDecision);

      const packetBytes = await readFile(join(runDirectory, "review", "packet.json"), "utf8");
      const decisionBytes = await readFile(join(runDirectory, "review", "decision.json"), "utf8");
      await expect(writeReviewPacket(runDirectory, packet)).rejects.toThrow("will not be overwritten");
      await expect(writeReviewDecision(runDirectory, makeRecord())).rejects.toThrow("will not be overwritten");
      expect(await readFile(join(runDirectory, "review", "packet.json"), "utf8")).toBe(packetBytes);
      expect(await readFile(join(runDirectory, "review", "decision.json"), "utf8")).toBe(decisionBytes);
    } finally {
      await rm(runDirectory, { recursive: true, force: true });
    }
  });

  test("rejects missing or modified screenshot files when reading the review packet", async () => {
    const runDirectory = await mkdtemp(join(tmpdir(), "dorkflow-review-capture-integrity-"));
    try {
      const packet = makePacket();
      await writePacketCaptures(runDirectory, packet);
      await writeReviewPacket(runDirectory, packet);
      expect(await readReviewPacket(runDirectory)).toEqual(packet);
      await writeFile(join(runDirectory, packet.captures[0]!.path), new Uint8Array([1, 2, 3]));
      await expect(readReviewPacket(runDirectory)).rejects.toThrow("bytes do not match packet metadata");
    } finally {
      await rm(runDirectory, { recursive: true, force: true });
    }
  });

  test("rejects a modified packet hash sidecar", async () => {
    const runDirectory = await mkdtemp(join(tmpdir(), "dorkflow-review-packet-hash-"));
    try {
      const packet = makePacket();
      await writePacketCaptures(runDirectory, packet);
      await writeReviewPacket(runDirectory, packet);
      await writeFile(join(runDirectory, "review", "packet.sha256"), "0".repeat(64));
      await expect(readReviewPacket(runDirectory)).rejects.toThrow("hash does not match");
    } finally {
      await rm(runDirectory, { recursive: true, force: true });
    }
  });

  test("refuses symlinked run/review directories and symlink artifact files", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "dorkflow-review-links-"));
    try {
      const runDirectory = join(tempRoot, "run");
      const outsideDirectory = join(tempRoot, "outside");
      await mkdir(runDirectory);
      await mkdir(outsideDirectory);
      await symlink(outsideDirectory, join(runDirectory, "review"), "dir");
      await expect(writeReviewPacket(runDirectory, makePacket())).rejects.toThrow("not a symlink");
      expect(await readFile(join(outsideDirectory, "packet.json"), "utf8").catch(() => null)).toBeNull();

      const cleanRun = join(tempRoot, "clean-run");
      const realRun = join(tempRoot, "real-run");
      await mkdir(cleanRun);
      await mkdir(realRun);
      await mkdir(join(cleanRun, "review"));
      await writePacketCaptures(cleanRun);
      const externalPacket = join(tempRoot, "external-packet.json");
      await writeFile(externalPacket, JSON.stringify(makePacket()));
      await symlink(externalPacket, join(cleanRun, "review", "packet.json"));
      await expect(readReviewPacket(cleanRun)).rejects.toThrow("not a symlink");

      const decisionRun = join(tempRoot, "decision-run");
      await mkdir(decisionRun);
      await writePacketCaptures(decisionRun);
      await writeReviewPacket(decisionRun, makePacket());
      const externalDecision = join(tempRoot, "external-decision.json");
      const externalDecisionValue = JSON.stringify(makeRecord());
      await writeFile(externalDecision, externalDecisionValue);
      await symlink(externalDecision, join(decisionRun, "review", "decision.json"));
      await expect(writeReviewDecision(decisionRun, makeRecord())).rejects.toThrow("will not be overwritten");
      expect(await readFile(externalDecision, "utf8")).toBe(externalDecisionValue);

      const runAlias = join(tempRoot, "run-alias");
      await symlink(realRun, runAlias, "dir");
      await expect(writeReviewPacket(runAlias, makePacket())).rejects.toThrow("run directory");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("requires the persisted packet before accepting a decision", async () => {
    const runDirectory = await mkdtemp(join(tmpdir(), "dorkflow-review-order-"));
    try {
      await mkdir(join(runDirectory, "review"));
      await expect(writeReviewDecision(runDirectory, makeRecord())).rejects.toThrow();
      await expect(readReviewDecision(runDirectory)).rejects.toThrow();
    } finally {
      await rm(runDirectory, { recursive: true, force: true });
    }
  });
});
