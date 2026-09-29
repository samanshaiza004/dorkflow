import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DesignModelInput } from "../src/contracts/design/index.ts";
import type { DesignDirection } from "../src/contracts/design/index.ts";
import { sha256Bytes, sha256Text } from "../src/environment/hash.ts";
import { DesignModelInput as DesignModelInputSchema } from "../src/contracts/design/model-input.ts";
import {
  getAgentHandoffStatus,
  prepareAgentHandoff,
  submitAgentDirections,
  submitAgentCritiques,
  submitAgentReviewDecision,
} from "../src/design/agent-handoff.ts";

const samplePng = new Uint8Array(24);
samplePng.set([137, 80, 78, 71, 13, 10, 26, 10]);
new DataView(samplePng.buffer).setUint32(16, 1440);
new DataView(samplePng.buffer).setUint32(20, 900);

const modelInput: DesignModelInput = {
  schemaVersion: 1,
  intent: {
    schemaVersion: 2,
    id: "intent_12345678",
    product: "Harbor Log",
    rationale: "Keep operational information easy to scan.",
    statements: [{ id: "istat_12345678", kind: "job", statement: "Review active work without losing context." }],
  },
  references: {
    schemaVersion: 2,
    id: "refs_12345678",
    intentRef: "intent_12345678",
    references: [{
      schemaVersion: 2,
      id: "ref_12345678",
      sourceKind: "generated",
      use: [{ id: "raspect_12345678", aspect: "information density", rationale: "Keep repeated actions near records." }],
      doNotUse: [],
      evidenceRefs: ["ev_12345678"],
    }],
  },
  evidence: {
    schemaVersion: 1,
    id: "ev_12345678",
    purpose: "hierarchy",
    trustMode: "trusted-project",
    contentTreatment: "original",
    originalPixelsApproved: true,
    renderingEnvironmentSha256: "a".repeat(64),
    sanitizer: null,
    captures: [{
      id: "cap_12345678",
      sha256: sha256Bytes(samplePng),
      stateRef: "st_12345678",
      stateKind: "default",
      triggerKinds: ["initial"],
      viewportRef: "vp_12345678",
      viewport: { label: "desktop", width: 1440, height: 900 },
      mediaType: "image/png",
      width: 1440,
      height: 900,
    }],
  },
  captures: [{
    id: "cap_12345678",
    sha256: sha256Bytes(samplePng),
    stateRef: "st_12345678",
    stateKind: "default",
    triggerKinds: ["initial"],
    viewportRef: "vp_12345678",
    viewport: { label: "desktop", width: 1440, height: 900 },
    mediaType: "image/png",
    width: 1440,
    height: 900,
    imageBase64: Buffer.from(samplePng).toString("base64"),
  }],
  systemModel: null,
};

function createDirections(): DesignDirection[] {
  const axes = [
    { composition: "editorial-grid", spatialModel: "contained", density: "balanced", navigationModel: "top-bar", hierarchy: "typographic", surfaceModel: "flat", componentAnatomy: "record-rows", imagery: "none", motion: "restrained" },
    { composition: "open-canvas", spatialModel: "expansive", density: "compact", navigationModel: "side-rail", hierarchy: "positional", surfaceModel: "layered", componentAnatomy: "work-panels", imagery: "documentary", motion: "guided" },
    { composition: "stacked-sequence", spatialModel: "edge-to-edge", density: "dense", navigationModel: "bottom-bar", hierarchy: "chromatic", surfaceModel: "elevated", componentAnatomy: "card-list", imagery: "illustrative", motion: "immediate" },
  ] as const;
  return axes.map((strategyAxes, index) => ({
    schemaVersion: 2,
    id: `dir_0000000${index + 1}`,
    thesis: `Direction ${index + 1} is a distinct working instrument.`,
    rationale: "The strategy supports the stated review job.",
    intentRefs: ["istat_12345678"],
    evidenceRefs: ["ev_12345678"],
    decisionRefs: [],
    systemModelRefs: [],
    strategyAxes,
    choices: [{
      id: `choice_0000000${index + 1}`,
      area: "layout",
      statement: `Use layout approach ${index + 1}.`,
      rationale: "The arrangement preserves the scan context.",
      intentRefs: ["istat_12345678"],
      referenceAspectRefs: ["raspect_12345678"],
      evidenceRefs: ["ev_12345678"],
      captureRefs: ["cap_12345678"],
    }],
    uncertainties: [],
  }));
}

function createCritiques(directions: DesignDirection[]) {
  return directions.map((direction, index) => ({
    schemaVersion: 2,
    id: `crit_0000000${index + 1}`,
    directionRef: direction.id,
    intentRefs: ["istat_12345678"],
    evidenceRefs: ["ev_12345678"],
    findings: [],
    choiceAssessments: direction.choices.map((choice) => ({
      choiceRef: choice.id,
      assessment: "supported" as const,
      supportRefs: [{ kind: "intent-statement" as const, id: "istat_12345678" }],
      rationale: "The design choice is supported by the stated user job.",
    })),
    uncertainties: [],
  }));
}

test("prepares an agent-facing directions package without exposing inline image bytes", async () => {
  const parent = await mkdtemp(join(tmpdir(), "dorkflow-agent-handoff-"));
  try {
    const runDirectory = join(parent, "run_1234567890abcdef1234567890abcdef");
    const prepared = await prepareAgentHandoff(modelInput, runDirectory);
    const context = await readFile(prepared.contextPath, "utf8");
    const instructions = await readFile(prepared.instructionsPath, "utf8");
    const schema = JSON.parse(await readFile(prepared.schemaPath, "utf8"));

    expect(context).not.toContain("imageBase64");
    expect(context).toContain("perceptual/captures/cap_12345678.png");
    expect(instructions).toContain("three structurally distinct");
    expect(schema.properties.directions.items.properties.schemaVersion.enum).toEqual([2]);
    expect(new Uint8Array(await readFile(join(runDirectory, "perceptual/captures/cap_12345678.png")))).toEqual(samplePng);
    expect((await stat(prepared.runDirectory)).isDirectory()).toBe(true);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("binds an agent handoff to its frozen experiment manifest without exposing it as model content", async () => {
  const parent = await mkdtemp(join(tmpdir(), "dorkflow-agent-handoff-"));
  try {
    const experiment = {
      experiment: "expense-tracker-test",
      bundleManifestSha256: "b".repeat(64),
      sourceCommit: "c".repeat(40),
      modelInputFileSha256: "d".repeat(64),
      modelInputSha256: "e".repeat(64),
      renderingEnvironmentSha256: "a".repeat(64),
      captureRun: "run-010",
      repeatRun: "run-012",
    };
    await expect(prepareAgentHandoff(modelInput, join(parent, "run_22222222222222222222222222222222"), experiment)).rejects.toThrow("does not match the supplied frozen model input");

    const matched = {
      ...experiment,
      modelInputSha256: sha256Text(JSON.stringify(DesignModelInputSchema.parse(modelInput))),
    };
    const prepared = await prepareAgentHandoff(
      modelInput,
      join(parent, "run_33333333333333333333333333333333"),
      matched,
    );
    expect(JSON.parse(await readFile(join(prepared.runDirectory, "experiment.json"), "utf8"))).toMatchObject({
      sourceCommit: "c".repeat(40),
      captureRun: "run-010",
      repeatRun: "run-012",
    });
    expect(await readFile(prepared.contextPath, "utf8")).not.toContain("bundleManifestSha256");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("accepts directions only after citation validation and diversity, then prepares critique", async () => {
  const parent = await mkdtemp(join(tmpdir(), "dorkflow-agent-handoff-"));
  try {
    const prepared = await prepareAgentHandoff(
      modelInput,
      join(parent, "run_1234567890abcdef1234567890abcdef"),
    );
    const result = await submitAgentDirections(
      prepared.runDirectory,
      JSON.stringify({ directions: createDirections() }),
      { agentName: "Codex", modelName: null },
    );

    expect(result.status).toBe("critique-ready");
    expect(result.diversity.passed).toBe(true);
    expect(await readFile(join(prepared.runDirectory, "critique/instructions.md"), "utf8")).toContain("Critique all three directions");
    expect(JSON.parse(await readFile(join(prepared.runDirectory, "directions/execution.json"), "utf8"))).toMatchObject({
      executor: { kind: "external-agent", agentName: "Codex", modelName: null },
      reproducibility: "agent-reported",
    });
    const execution = await readFile(join(prepared.runDirectory, "directions/execution.json"), "utf8");
    expect(execution).not.toContain("tokenUsage");
    expect(execution).not.toContain("toolPermissions");
    expect(JSON.parse(execution).instructionsVersion).toBe("dorkflow-directions-v4");
    await expect(submitAgentDirections(
      prepared.runDirectory,
      JSON.stringify({ directions: createDirections() }),
    )).rejects.toThrow("already exists");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("does not prepare critique when the direction diversity gate fails", async () => {
  const parent = await mkdtemp(join(tmpdir(), "dorkflow-agent-handoff-"));
  try {
    const prepared = await prepareAgentHandoff(
      modelInput,
      join(parent, "run_abcdef0123456789abcdef0123456789"),
    );
    const directions = createDirections();
    directions[2] = { ...directions[2]!, strategyAxes: directions[0]!.strategyAxes };
    const result = await submitAgentDirections(
      prepared.runDirectory,
      JSON.stringify({ directions }),
    );

    expect(result.status).toBe("direction-gate-failed");
    expect(result.diversity.passed).toBe(false);
    expect(JSON.parse(await readFile(join(prepared.runDirectory, "directions/execution.json"), "utf8"))).toMatchObject({
      executor: { agentName: null, modelName: null },
      reproducibility: "unknown",
    });
    await expect(stat(join(prepared.runDirectory, "critique"))).rejects.toThrow();
    await expect(submitAgentCritiques(prepared.runDirectory, JSON.stringify({ critiques: [] }))).rejects.toThrow("before the direction diversity gate passes");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("rejects direction citations that do not resolve to the supplied input", async () => {
  const parent = await mkdtemp(join(tmpdir(), "dorkflow-agent-handoff-"));
  try {
    const prepared = await prepareAgentHandoff(
      modelInput,
      join(parent, "run_1023456789abcdef0123456789abcdef"),
    );
    const directions = createDirections();
    directions[0]!.choices[0]!.intentRefs = ["istat_notprovided"];
    await expect(submitAgentDirections(prepared.runDirectory, JSON.stringify({ directions }))).rejects.toThrow("intent statement not supplied");
    await expect(stat(join(prepared.runDirectory, "directions/result.json"))).rejects.toThrow();
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("completes critique and creates the B5 packet with honest external-agent provenance", async () => {
  const parent = await mkdtemp(join(tmpdir(), "dorkflow-agent-handoff-"));
  try {
    const prepared = await prepareAgentHandoff(
      modelInput,
      join(parent, "run_0123456789abcdef0123456789abcdef"),
    );
    expect((await getAgentHandoffStatus(prepared.runDirectory)).stage).toBe("directions");
    const directions = createDirections();
    await submitAgentDirections(prepared.runDirectory, JSON.stringify({ directions }), { agentName: "Codex" });
    expect((await getAgentHandoffStatus(prepared.runDirectory)).stage).toBe("critique");
    const result = await submitAgentCritiques(
      prepared.runDirectory,
      JSON.stringify({ critiques: createCritiques(directions) }),
      { agentName: "Codex" },
    );

    expect(result.status).toBe("human-review-required");
    expect(result.reviewPacketSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(await readFile(result.reviewPacketPath, "utf8")).directionReviews).toHaveLength(3);
    expect(JSON.parse(await readFile(join(prepared.runDirectory, "critique/execution.json"), "utf8"))).toMatchObject({
      stage: "critique",
      instructionsVersion: "dorkflow-critique-v4",
      executor: { kind: "external-agent", agentName: "Codex" },
      reproducibility: "agent-reported",
    });
    expect(JSON.parse(await readFile(join(prepared.runDirectory, "intentionality.json"), "utf8"))).toHaveLength(3);
    expect((await readFile(join(prepared.runDirectory, "perceptual/captures/cap_12345678.png"))).byteLength).toBe(24);
    expect((await getAgentHandoffStatus(prepared.runDirectory)).status).toBe("human-review-required");
    const decision = {
      schemaVersion: 1,
      runRef: prepared.runId,
      packetSha256: result.reviewPacketSha256,
      decisions: [{
        schemaVersion: 1,
        id: "hdec_87654321",
        subjectRefs: [directions[0]!.id, directions[1]!.id],
        disposition: "prefer",
        rationale: "This direction best supports the scan-and-record job.",
        pairwiseComparison: {
          preferredDirectionRef: directions[0]!.id,
          otherDirectionRef: directions[1]!.id,
          rationale: "It keeps the transaction task and context clearer.",
        },
      }],
    };
    await submitAgentReviewDecision(prepared.runDirectory, JSON.stringify(decision));
    expect((await getAgentHandoffStatus(prepared.runDirectory)).status).toBe("completed");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
