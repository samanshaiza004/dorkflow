import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CritiqueReport,
  DesignDirection,
  DesignModelInput,
} from "../src/contracts/design/index.ts";
import { DesignModelInput as DesignModelInputSchema } from "../src/contracts/design/model-input.ts";
import { DesignProcessManifest } from "../src/contracts/design/invocation.ts";
import { sha256Bytes } from "../src/environment/hash.ts";
import {
  createDesignModelInput,
  DIRECTIONS_INSTRUCTIONS,
  runDirectionCritiqueSlice,
  type DesignProcessArtifacts,
  type DesignProcessModel,
  type ModelCallResponse,
} from "../src/design/process.ts";
import { persistDesignProcessRun } from "../src/design/artifacts.ts";
import { readReviewDecision, readReviewPacket, reviewPacketSha256, writeReviewDecision } from "../src/design/review.ts";

const samplePng = new Uint8Array(24);
samplePng.set([137, 80, 78, 71, 13, 10, 26, 10]);
new DataView(samplePng.buffer).setUint32(16, 1440);
new DataView(samplePng.buffer).setUint32(20, 900);
const samplePngSha256 = sha256Bytes(samplePng);
const profileTemplate = join(dirname(fileURLToPath(import.meta.url)), "../templates/dorkflow-design-atlas-template");

async function createProfileRepo(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "dorkflow-profile-process-test-"));
  try {
    await cp(profileTemplate, root, { recursive: true });
    const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
    git(["init", "--quiet"]);
    git(["config", "user.name", "Dorkflow Tests"]);
    git(["config", "user.email", "dorkflow-tests@example.invalid"]);
    git(["add", "--all"]);
    git(["commit", "--quiet", "-m", "freeze profile for process test"]);
    return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

const input = {
  schemaVersion: 1,
  intent: {
    schemaVersion: 2,
    id: "intent_12345678",
    product: "Harbor Log",
    rationale: "Keep operational information easy to scan.",
    statements: [{
      id: "istat_12345678",
      kind: "job",
      statement: "Review active work without losing context.",
    }],
  },
  references: {
    schemaVersion: 2,
    id: "refs_12345678",
    intentRef: "intent_12345678",
    references: [{
      schemaVersion: 2,
      id: "ref_12345678",
      sourceKind: "generated",
      use: [{
        id: "raspect_12345678",
        aspect: "information density",
        rationale: "Keep repeated actions close to the records they affect.",
      }],
      doNotUse: [],
      evidenceRefs: ["ev_12345678"],
    }],
  },
  evidence: {
    schemaVersion: 1,
    id: "ev_12345678",
    purpose: "hierarchy",
    trustMode: "generated",
    contentTreatment: "original",
    originalPixelsApproved: true,
    renderingEnvironmentSha256: "a".repeat(64),
    sanitizer: null,
    captures: [{
      id: "cap_12345678",
      sha256: samplePngSha256,
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
    sha256: samplePngSha256,
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
} satisfies DesignModelInput;

const axisSets = [
  {
    composition: "editorial-grid", spatialModel: "contained", density: "balanced" as const,
    navigationModel: "top-bar", hierarchy: "typographic", surfaceModel: "flat" as const,
    componentAnatomy: "record-rows", imagery: "none", motion: "restrained",
  },
  {
    composition: "open-canvas", spatialModel: "expansive", density: "compact" as const,
    navigationModel: "side-rail", hierarchy: "positional", surfaceModel: "layered" as const,
    componentAnatomy: "work-panels", imagery: "documentary", motion: "guided",
  },
  {
    composition: "stacked-sequence", spatialModel: "edge-to-edge", density: "dense" as const,
    navigationModel: "bottom-bar", hierarchy: "chromatic", surfaceModel: "elevated" as const,
    componentAnatomy: "card-list", imagery: "illustrative", motion: "immediate",
  },
];

function createDirections(): DesignDirection[] {
  return axisSets.map((strategyAxes, index) => ({
    schemaVersion: 2,
    id: `dir_0000000${index + 1}`,
    thesis: `Direction ${index + 1} treats the interface as a distinct working instrument.`,
    rationale: "The selected spatial model responds to the stated review job.",
    intentRefs: ["istat_12345678"],
    evidenceRefs: ["ev_12345678"],
    decisionRefs: [],
    systemModelRefs: [],
    strategyAxes,
    choices: [{
      id: `choice_0000000${index + 1}`,
      area: "layout",
      statement: `Use layout approach ${index + 1}.`,
      rationale: "The arrangement keeps review context visible.",
      intentRefs: ["istat_12345678"],
      referenceAspectRefs: ["raspect_12345678"],
      evidenceRefs: ["ev_12345678"],
      captureRefs: ["cap_12345678"],
    }],
    uncertainties: [],
  }));
}

function createCritiques(
  directions: DesignDirection[],
  supportRef?: CritiqueReport["choiceAssessments"][number]["supportRefs"][number],
): CritiqueReport[] {
  return directions.map((direction, index) => ({
    schemaVersion: 2,
    id: `crit_0000000${index + 1}`,
    directionRef: direction.id,
    intentRefs: ["istat_12345678"],
    evidenceRefs: ["ev_12345678"],
    findings: [],
    choiceAssessments: direction.choices.map((choice) => ({
      choiceRef: choice.id,
      assessment: index === 2 ? "unsupported-default-like" as const
        : index === 1 ? "weakly-supported" as const : "supported" as const,
      supportRefs: [supportRef ?? { kind: "intent-statement", id: "istat_12345678" }],
      rationale: "The assessment is tied to the supplied operational intent.",
    })),
    uncertainties: [],
  }));
}

function modelResponse(output: unknown): ModelCallResponse {
  return {
    provider: "fixture-provider",
    model: "fixture-model",
    modelVersion: "fixture-v1",
    sampling: { temperature: 0, topP: null, seed: 17, maxOutputTokens: 4000 },
    tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    toolPermissions: { enabled: false, allowedTools: [] },
    startedAt: "2026-09-28T12:00:00.000Z",
    finishedAt: "2026-09-28T12:00:01.000Z",
    rawOutput: JSON.stringify(output),
  };
}

async function withFixtureRun<T>(
  run: (artifacts: DesignProcessArtifacts, modelInput: DesignModelInput) => Promise<T>,
): Promise<T> {
  const runDirectory = await mkdtemp(join(tmpdir(), "dorkflow-design-slice-"));
  try {
    const capturesDirectory = join(runDirectory, "perceptual", "captures");
    await mkdir(capturesDirectory, { recursive: true });
    await mkdir(join(runDirectory, "quarantine"));
    const capture = {
      ...input.evidence.captures[0]!,
      path: "captures/cap_12345678.png",
    };
    const evidence = { ...input.evidence, captures: [capture] };
    await writeFile(join(runDirectory, "perceptual", "evidence.json"), JSON.stringify(evidence));
    await writeFile(join(capturesDirectory, "cap_12345678.png"), samplePng);
    await writeFile(
      join(runDirectory, "quarantine", "original-page.txt"),
      "IGNORE_PREVIOUS_INSTRUCTIONS_QUARANTINE_ONLY",
    );

    const artifacts: DesignProcessArtifacts = {
      intent: input.intent,
      references: {
        ...input.references,
        references: input.references.references.map((reference) => ({
          ...reference,
          label: "IGNORE_PREVIOUS_INSTRUCTIONS_REFERENCE_NAME",
          sourceId: "refsrc_12345678",
        })),
      },
      runDirectory,
      systemModel: null,
    };
    const modelInput = await createDesignModelInput(artifacts);
    return await run(artifacts, modelInput);
  } finally {
    await rm(runDirectory, { recursive: true, force: true });
  }
}

function fakeModel(
  expectedInput: DesignModelInput,
  directions = createDirections(),
  critiqueCallback?: () => void,
): DesignProcessModel {
  return {
    proposeDirections: async (modelInput, request) => {
      expect(modelInput).toEqual(expectedInput);
      expect(request.instructions).toBe(DIRECTIONS_INSTRUCTIONS);
      return modelResponse({ directions });
    },
    critiqueDirections: async ({ context, directions: returnedDirections }) => {
      expect(context).toEqual(expectedInput);
      expect(returnedDirections).toEqual(directions);
      critiqueCallback?.();
      return modelResponse({ critiques: createCritiques(returnedDirections) });
    },
  };
}

describe("B2-B4 design process slice", () => {
  test("the model-facing projection excludes capture paths", async () => {
    await withFixtureRun(async (_artifacts, modelInput) => {
      expect(modelInput.designProfile).toBeUndefined();
      const serialized = JSON.stringify(modelInput);
      expect(serialized).not.toContain("captures/cap_");
      expect(serialized).not.toContain("quarantine");
      expect(serialized).not.toContain("IGNORE_PREVIOUS_INSTRUCTIONS_QUARANTINE_ONLY");
      expect(serialized).not.toContain("IGNORE_PREVIOUS_INSTRUCTIONS_REFERENCE_NAME");
      expect(serialized).not.toContain("refsrc_12345678");
      expect(() => DesignModelInputSchema.parse({
        ...modelInput,
        evidence: {
          ...modelInput.evidence,
          captures: [{ ...modelInput.evidence.captures[0]!, path: "quarantine/original.png" }],
        },
      })).toThrow();
    });
  });

  test("threads optional profile guidance and citations into the model and frozen run provenance", async () => {
    const profileRepo = await createProfileRepo();
    try {
      await withFixtureRun(async (artifacts) => {
        const configured = { ...artifacts, designProfilePath: profileRepo.root };
        const modelInput = await createDesignModelInput(configured);
        expect(modelInput.designProfile?.provenance).toMatchObject({
          sourceKind: "git-worktree",
          worktreeState: "clean",
          revision: expect.stringMatching(/^[a-f0-9]{40}$/),
          profileSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        });
        const guidance = JSON.stringify(modelInput.designProfile);
        expect(guidance).toContain("floor-accessibility");
        expect(guidance).toContain("rail-preserve-purpose");
        expect(guidance).toContain("compass-familiar-patterns");
        expect(guidance).not.toContain("Common Thread Reading Room");
        expect(guidance).not.toContain("Harbor Operations Wallboard");

        const directions = createDirections();
        directions[0]!.choices[0]!.profileRefs = [{ kind: "profile-rail", id: "rail-preserve-purpose" }];
        const model = fakeModel(modelInput, directions);
        model.critiqueDirections = async ({ directions: returnedDirections }) => {
          const critiques = createCritiques(returnedDirections, {
            kind: "profile-rail",
            id: "rail-preserve-purpose",
          });
          return modelResponse({ critiques });
        };

        const result = await runDirectionCritiqueSlice(configured, model);
        expect(result.status).toBe("critiqued");
        if (result.status !== "critiqued") return;
        const persisted = await persistDesignProcessRun(configured, result);
        const manifest = DesignProcessManifest.parse(JSON.parse(await readFile(persisted.manifestPath, "utf8")));
        expect(manifest.designProfile).toEqual(modelInput.designProfile?.provenance);
        expect(manifest.artifactDigests.map(({ path }) => path)).toContain("design-profile/provenance.json");
        expect(JSON.parse(await readFile(join(persisted.directory, "design-profile/provenance.json"), "utf8")))
          .toEqual(modelInput.designProfile?.provenance);
        const packet = await readReviewPacket(persisted.directory);
        expect(packet.designProfile?.provenance).toEqual(modelInput.designProfile?.provenance);
        expect(JSON.stringify(packet)).not.toContain("Common Thread Reading Room");
      });
    } finally {
      await profileRepo.cleanup();
    }
  });

  test("validates direction citations, gates diversity, critiques, and reports support diagnostics", async () => {
    await withFixtureRun(async (artifacts, modelInput) => {
      const result = await runDirectionCritiqueSlice(artifacts, fakeModel(modelInput));

      expect(result.status).toBe("critiqued");
      if (result.status !== "critiqued") return;
      expect(result.inputSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.runId).toMatch(/^run_[a-f0-9]{32}$/);
      expect(result.modelInvocations).toHaveLength(2);
      expect(result.modelInvocations.map((item) => item.role)).toEqual(["direction-generation", "critique"]);
      expect(result.modelInvocations[0]?.promptSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.modelInvocations[0]?.inputSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.modelInvocations[0]?.outputSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.modelRelationship).toBe("same-model");
      expect(result.directions).toHaveLength(3);
      expect(result.diversity.passed).toBe(true);
      expect(result.critiques).toHaveLength(3);
      expect(result.intentionality).toEqual([
        expect.objectContaining({
          choiceCount: 1,
          citationCompleteCount: 1,
          criticSupportedCount: 1,
          weaklySupportedCount: 0,
          unsupportedDefaultLikeCount: 0,
          unsupportedChoiceRate: 0,
        }),
        expect.objectContaining({ weaklySupportedCount: 1, unsupportedChoiceRate: 0 }),
        expect.objectContaining({ unsupportedDefaultLikeCount: 1, unsupportedChoiceRate: 1 }),
      ]);
    });
  });

  test("persists a frozen process run, model invocations, review packet, and human decision", async () => {
    await withFixtureRun(async (artifacts, modelInput) => {
      const result = await runDirectionCritiqueSlice(artifacts, fakeModel(modelInput));
      expect(result.status).toBe("critiqued");
      if (result.status !== "critiqued") return;

      const persisted = await persistDesignProcessRun(artifacts, result);
      const manifestValue = JSON.parse(await readFile(persisted.manifestPath, "utf8"));
      const manifest = DesignProcessManifest.parse(manifestValue);
      expect(manifest.modelInputSha256).toBe(result.inputSha256);
      expect(manifest.invocationRefs).toEqual(result.modelInvocations.map(({ id }) => id));
      expect(manifest.artifactDigests.map(({ path }) => path)).toContain("review/packet.json");
      expect(manifest.artifactDigests.map(({ path }) => path)).toContain("review/packet.sha256");
      expect(manifest.artifactDigests.map(({ path }) => path)).toContain("perceptual/captures/cap_12345678.png");
      const instructions = JSON.parse(await readFile(join(persisted.directory, "instructions.json"), "utf8"));
      expect(instructions.responseSchemas.directions.properties.directions.items.properties.schemaVersion.enum).toEqual([2]);
      expect(instructions.responseSchemas.critique.properties.critiques.items.properties.schemaVersion.enum).toEqual([2]);

      const context = await readFile(join(persisted.directory, "model-context.json"), "utf8");
      expect(context).not.toContain("imageBase64");
      expect(context).not.toContain("quarantine");
      expect(context).not.toContain("IGNORE_PREVIOUS_INSTRUCTIONS_REFERENCE_NAME");
      const packet = await readReviewPacket(persisted.directory);
      expect(packet.directionReviews).toHaveLength(3);
      expect(packet.captures[0]?.path).toBe("perceptual/captures/cap_12345678.png");

      const decision = {
        schemaVersion: 1,
        runRef: result.runId,
        packetSha256: reviewPacketSha256(packet),
        decisions: [{
          schemaVersion: 1,
          id: "hdec_87654321",
          subjectRefs: [result.directions[0]!.id, result.directions[1]!.id, result.directions[0]!.choices[0]!.id],
          disposition: "prefer",
          rationale: "The first direction best supports the review job.",
          pairwiseComparison: {
            preferredDirectionRef: result.directions[0]!.id,
            otherDirectionRef: result.directions[1]!.id,
            rationale: "The first keeps the task hierarchy clearer.",
          },
        }],
      };
      await writeReviewDecision(persisted.directory, decision);
      expect((await readReviewDecision(persisted.directory)).decisions[0]!.id).toBe("hdec_87654321");
      await expect(persistDesignProcessRun(artifacts, result)).rejects.toThrow();
    });
  });

  test("does not call critique until the structural direction gate passes", async () => {
    const directions = createDirections();
    directions[2]!.strategyAxes = {
      ...directions[0]!.strategyAxes,
      motion: "different-motion",
      imagery: "different-imagery",
    };
    let critiqueCalled = false;

    await withFixtureRun(async (artifacts, modelInput) => {
      const result = await runDirectionCritiqueSlice(artifacts, fakeModel(modelInput, directions, () => { critiqueCalled = true; }));
      expect(result.status).toBe("direction-gate-failed");
      expect(result.modelInvocations).toHaveLength(1);
      expect(result.modelRelationship).toBe("not-compared");
      expect(critiqueCalled).toBe(false);
    });
  });

  test("refuses model calls with tools enabled", async () => {
    await withFixtureRun(async (artifacts, modelInput) => {
      const model = fakeModel(modelInput);
      model.proposeDirections = async () => ({
        ...modelResponse(createDirections()),
        toolPermissions: { enabled: true, allowedTools: ["filesystem"] },
      });
      await expect(runDirectionCritiqueSlice(artifacts, model)).rejects.toThrow("must not have tools enabled");
    });
  });

  test("records when the critic uses a different model identity", async () => {
    await withFixtureRun(async (artifacts, modelInput) => {
      const model = fakeModel(modelInput);
      model.critiqueDirections = async ({ directions }) => ({
        ...modelResponse(createCritiques(directions)),
        provider: "independent-provider",
        model: "critic-model",
      });
      const result = await runDirectionCritiqueSlice(artifacts, model);
      expect(result.status).toBe("critiqued");
      if (result.status === "critiqued") expect(result.modelRelationship).toBe("different-model");
    });
  });

  test("rejects citations that do not resolve to the supplied intent and references", async () => {
    const directions = createDirections();
    directions[0]!.choices[0]!.intentRefs = ["istat_missing1"];
    const badReferenceDirections = createDirections();
    badReferenceDirections[0]!.choices[0]!.referenceAspectRefs = ["raspect_missing1"];
    const badCaptureDirections = createDirections();
    badCaptureDirections[0]!.choices[0]!.captureRefs = ["cap_missing1"];
    await withFixtureRun(async (artifacts, modelInput) => {
      await expect(runDirectionCritiqueSlice(artifacts, fakeModel(modelInput, directions))).rejects.toThrow("not supplied to inference");
      await expect(runDirectionCritiqueSlice(artifacts, fakeModel(modelInput, badReferenceDirections))).rejects.toThrow("not supplied to inference");
      await expect(runDirectionCritiqueSlice(artifacts, fakeModel(modelInput, badCaptureDirections))).rejects.toThrow("capture not supplied to inference");
    });
  });

  test("requires every choice to receive exactly one critic assessment", async () => {
    await withFixtureRun(async (artifacts, modelInput) => {
      const model = fakeModel(modelInput);
      model.critiqueDirections = async ({ directions }) => {
        const critiques = createCritiques(directions);
        critiques[0]!.choiceAssessments = [{
          choiceRef: "choice_unknown1",
          assessment: "supported",
          supportRefs: [{ kind: "intent-statement", id: "istat_12345678" }],
          rationale: "This assessment points to no choice in the current direction.",
        }];
        return modelResponse(critiques);
      };
      await expect(runDirectionCritiqueSlice(artifacts, model)).rejects.toThrow("assess every direction choice exactly once");
    });
  });

  test("requires critique state citations to resolve to a captured state ID", async () => {
    await withFixtureRun(async (artifacts, modelInput) => {
      const model = fakeModel(modelInput);
      model.critiqueDirections = async ({ directions }) => {
        const critiques = createCritiques(directions);
        critiques[0]!.choiceAssessments[0]!.supportRefs = [{
          kind: "state-evidence",
          id: "cap_missing1",
        }];
        return modelResponse(critiques);
      };
      await expect(runDirectionCritiqueSlice(artifacts, model)).rejects.toThrow("unavailable state-evidence");
    });
  });

  test("accepts critique citations to an exact captured state", async () => {
    await withFixtureRun(async (artifacts, modelInput) => {
      const model = fakeModel(modelInput);
      model.critiqueDirections = async ({ directions }) => {
        const critiques = createCritiques(directions);
        critiques[0]!.choiceAssessments[0]!.supportRefs = [{
          kind: "state-evidence",
          id: "cap_12345678",
        }];
        return modelResponse(critiques);
      };
      const result = await runDirectionCritiqueSlice(artifacts, model);
      expect(result.status).toBe("critiqued");
    });
  });
});
