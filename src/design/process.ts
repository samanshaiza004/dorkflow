import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  ChoiceSupportAssessment,
  CritiqueReport,
  DesignDirection,
  DesignModelInput,
  ModelInvocation,
  ModelInvocationMetadata,
  ModelInvocationRole,
} from "../contracts/design/index.ts";
import type { ModelInvocation as ModelInvocationArtifact } from "../contracts/design/invocation.ts";
import type { DesignIntent } from "../contracts/design/intent.ts";
import type { ReferenceSet } from "../contracts/design/reference.ts";
import type { SystemModel } from "../contracts/design/system-model.ts";
import { loadPerceptualInput } from "../capture/perceptual-input.ts";
import { sha256Bytes, sha256Text, stableJson } from "../environment/hash.ts";
import { validateDirectionDiversity, type DirectionDiversityReport } from "./direction-diversity.ts";
import { DesignRunId } from "../contracts/design/common.ts";
import { CRITIQUES_RESPONSE_SCHEMA, DIRECTIONS_RESPONSE_SCHEMA } from "./response-schemas.ts";

export const DIRECTIONS_PROMPT_VERSION = "dorkflow-directions-v3";
export const CRITIQUE_PROMPT_VERSION = "dorkflow-critique-v3";

export const DIRECTIONS_INSTRUCTIONS = `
Propose exactly three structurally distinct design hypotheses before implementation.
Use only the supplied human-authored intent, attributed reference aspects, optional system model,
and model-facing perceptual evidence. Do not copy page copy or invent citations.
Return schemaVersion 2 for every DesignDirection. Top-level and choice-level intentRefs must be
exact IntentStatement IDs. referenceAspectRefs must be exact
ReferenceAspect IDs. evidenceRefs must be supplied Evidence IDs; when a choice relies on a
particular rendered state, cite its exact cap_ ID in captureRefs. Do not cite human decisions;
the human-review stage has not happened. Return one strict JSON object with a single "directions"
property containing exactly three DesignDirection objects. Direction diversity is checked
deterministically by strategy categories; do not create synonym-only axis changes to pass it.
Each major choice needs a product-specific rationale.
`.trim();

export const CRITIQUE_INSTRUCTIONS = `
Critique all three directions against the supplied intent, attributed references, optional system
model, and perceptual states. Do not apply a universal taste score and do not reject a familiar
pattern merely because it is familiar. For every choice in each direction, emit exactly one
ChoiceSupportAssessment: supported, weakly-supported, or unsupported-default-like. Judge whether
its specific rationale is actually supported by the cited input, not whether the choice is
fashionable. Every finding must cite one or more typed supportRefs (intent-statement,
reference-aspect, state-evidence, system-model, system-token, or direction-choice). For
state-evidence, cite the exact cap_ capture ID shown in the evidence metadata, not the evidence
bundle ID. Exact IDs only.
Return one strict JSON object with a single "critiques" property containing exactly three reports;
each report must have schemaVersion 2 and match CritiqueReport. This is a diagnostic critique,
not aesthetic authority; final taste belongs to the human.
`.trim();

export type DirectionRequest = {
  promptVersion: typeof DIRECTIONS_PROMPT_VERSION;
  instructions: string;
  responseShape: "three-design-directions";
  responseSchema: typeof DIRECTIONS_RESPONSE_SCHEMA;
};

export type CritiqueRequest = {
  promptVersion: typeof CRITIQUE_PROMPT_VERSION;
  instructions: string;
  responseShape: "three-critique-reports";
  responseSchema: typeof CRITIQUES_RESPONSE_SCHEMA;
};

export type ModelCallResponse = ModelInvocationMetadata & { rawOutput: string };

/** The only model seam for this slice; a provider adapter can implement these two calls. */
export interface DesignProcessModel {
  proposeDirections(input: DesignModelInput, request: DirectionRequest): Promise<ModelCallResponse>;
  critiqueDirections(
    input: { context: DesignModelInput; directions: DesignDirection[] },
    request: CritiqueRequest,
  ): Promise<ModelCallResponse>;
}

export type DesignProcessArtifacts = {
  intent: DesignIntent;
  references: ReferenceSet;
  runDirectory: string;
  systemModel: SystemModel | null;
};

export async function createDesignModelInput(artifacts: DesignProcessArtifacts): Promise<DesignModelInput> {
  const perceptualInput = await loadPerceptualInput(artifacts.runDirectory);
  const captures = perceptualInput.captures.map(({ metadata, bytes }) => ({
    id: metadata.id,
    sha256: sha256Bytes(bytes),
    stateRef: metadata.stateRef,
    stateKind: metadata.stateKind,
    triggerKinds: metadata.triggerKinds,
    viewportRef: metadata.viewportRef,
    viewport: metadata.viewport,
    mediaType: metadata.mediaType,
    width: metadata.width,
    height: metadata.height,
    imageBase64: Buffer.from(bytes).toString("base64"),
  }));

  return DesignModelInput.parse({
    schemaVersion: 1,
    intent: artifacts.intent,
    references: {
      schemaVersion: artifacts.references.schemaVersion,
      id: artifacts.references.id,
      intentRef: artifacts.references.intentRef,
      references: artifacts.references.references.map(({ label: _sourceLabel, sourceId: _sourceId, ...reference }) => reference),
    },
    evidence: {
      ...perceptualInput.evidence,
      captures: perceptualInput.evidence.captures.map(({ path: _quarantineRelativePath, ...metadata }) => metadata),
    },
    captures,
    systemModel: artifacts.systemModel,
  });
}

const Directions = z.array(DesignDirection).length(3);
const Critiques = z.array(CritiqueReport).length(3);

export type IntentionalityDiagnostic = {
  directionRef: string;
  choiceCount: number;
  citationCompleteCount: number;
  criticSupportedCount: number;
  weaklySupportedCount: number;
  unsupportedDefaultLikeCount: number;
  unsupportedChoiceRate: number;
};

export type DirectionStageResult = {
  status: "direction-gate-failed";
  runId: z.infer<typeof DesignRunId>;
  inputSha256: string;
  modelInvocations: ModelInvocationArtifact[];
  modelRelationship: "not-compared";
  promptVersions: { directions: string; critique: string };
  directions: DesignDirection[];
  diversity: DirectionDiversityReport;
};

export type CritiquedStageResult = {
  status: "critiqued";
  runId: z.infer<typeof DesignRunId>;
  inputSha256: string;
  modelInvocations: ModelInvocationArtifact[];
  modelRelationship: "same-model" | "different-model";
  promptVersions: { directions: string; critique: string };
  directions: DesignDirection[];
  diversity: DirectionDiversityReport;
  critiques: CritiqueReport[];
  intentionality: IntentionalityDiagnostic[];
};

export type DesignProcessResult = DirectionStageResult | CritiquedStageResult;

function requireReferences(valid: boolean, message: string): void {
  if (!valid) throw new Error(message);
}

function parseModelOutput<T>(rawOutput: string, schema: z.ZodType<T>, outputKey: string): T {
  let output: unknown;
  try {
    output = JSON.parse(rawOutput);
  } catch {
    throw new Error("Model response must be strict JSON");
  }
  if (!Array.isArray(output) && output !== null && typeof output === "object" &&
      Object.keys(output).length === 1 && Object.hasOwn(output, outputKey)) {
    output = (output as Record<string, unknown>)[outputKey];
  }
  return schema.parse(output);
}

function recordInvocation(
  role: ModelInvocationRole,
  request: DirectionRequest | CritiqueRequest,
  input: unknown,
  response: ModelCallResponse,
): ModelInvocationArtifact {
  const { rawOutput, ...metadata } = response;
  const validatedMetadata = ModelInvocationMetadata.parse(metadata);
  requireReferences(
    !validatedMetadata.toolPermissions.enabled && validatedMetadata.toolPermissions.allowedTools.length === 0,
    "B2-B4 model calls must not have tools enabled",
  );
  return ModelInvocation.parse({
    schemaVersion: 1,
    id: `inv_${randomBytes(16).toString("hex")}`,
    role,
    ...validatedMetadata,
    promptVersion: request.promptVersion,
    promptSha256: sha256Text(stableJson({ instructions: request.instructions, responseSchema: request.responseSchema })),
    inputSha256: sha256Text(JSON.stringify(input)),
    outputSha256: sha256Text(rawOutput),
  });
}

function compareModels(
  directions: ModelInvocationArtifact,
  critique: ModelInvocationArtifact,
): "same-model" | "different-model" {
  return directions.provider === critique.provider &&
    directions.model === critique.model &&
    directions.modelVersion === critique.modelVersion
    ? "same-model"
    : "different-model";
}

function validateModelImages(input: DesignModelInput): void {
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (const capture of input.captures) {
    const bytes = Buffer.from(capture.imageBase64, "base64");
    requireReferences(sha256Bytes(bytes) === capture.sha256, `Model image hash mismatch for ${capture.id}`);
    requireReferences(
      bytes.length >= 24 && pngSignature.every((value, index) => bytes[index] === value),
      `Model capture is not a PNG image: ${capture.id}`,
    );
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    requireReferences(
      view.getUint32(16) === capture.width && view.getUint32(20) === capture.height,
      `Model image dimensions do not match evidence for ${capture.id}`,
    );
  }
}

function checkModelRefs(input: DesignModelInput, ids: readonly string[]): void {
  const known = input.systemModel ? new Set([input.systemModel.id]) : new Set<string>();
  requireReferences(ids.every((id) => known.has(id)), "Direction cites a system model not supplied to inference");
}

function validateDirections(input: DesignModelInput, directions: DesignDirection[]): void {
  const intentIds = new Set(input.intent.statements.map((statement) => statement.id));
  const referenceAspectIds = new Set<string>(input.references.references.flatMap((reference) =>
    [...reference.use, ...reference.doNotUse].map((aspect) => aspect.id),
  ));
  const evidenceIds = new Set([input.evidence.id]);
  const captureIds = new Set(input.evidence.captures.map((capture) => capture.id));
  const choiceIds = new Set<string>();

  for (const direction of directions) {
    requireReferences(
      direction.intentRefs.every((id) => intentIds.has(id)),
      `Direction ${direction.id} cites an intent statement not supplied to inference`,
    );
    requireReferences(
      direction.evidenceRefs.every((id) => evidenceIds.has(id)),
      `Direction ${direction.id} cites evidence not supplied to inference`,
    );
    requireReferences(direction.decisionRefs.length === 0, "B2-B4 directions cannot cite human decisions before review");
    checkModelRefs(input, direction.systemModelRefs);

    for (const choice of direction.choices) {
      requireReferences(
        choice.intentRefs.every((id) => intentIds.has(id)),
        `Choice ${choice.id} cites an intent statement not supplied to inference`,
      );
      requireReferences(
        choice.referenceAspectRefs.every((id) => referenceAspectIds.has(id)),
        `Choice ${choice.id} cites a reference aspect not supplied to inference`,
      );
      requireReferences(
        choice.evidenceRefs.every((id) => evidenceIds.has(id)),
        `Choice ${choice.id} cites evidence not supplied to inference`,
      );
      requireReferences(
        choice.captureRefs.every((id) => captureIds.has(id)),
        `Choice ${choice.id} cites a capture not supplied to inference`,
      );
      requireReferences(!choiceIds.has(choice.id), `Choice IDs must be unique across directions: ${choice.id}`);
      choiceIds.add(choice.id);
    }
  }
}

function validateSupportRefs(
  refs: CritiqueReport["findings"][number]["supportRefs"],
  input: DesignModelInput,
  choiceIds: ReadonlySet<string>,
): void {
  const intentIds = new Set(input.intent.statements.map((statement) => statement.id));
  const referenceAspectIds = new Set(input.references.references.flatMap((reference) =>
    [...reference.use, ...reference.doNotUse].map((aspect) => aspect.id),
  ));
  const tokenIds = new Set(input.systemModel?.tokens.map((token) => token.id) ?? []);

  for (const ref of refs) {
    const known = ref.kind === "intent-statement" ? intentIds.has(ref.id)
      : ref.kind === "reference-aspect" ? referenceAspectIds.has(ref.id)
        : ref.kind === "state-evidence" ? input.evidence.captures.some((capture) => capture.id === ref.id)
          : ref.kind === "system-model" ? input.systemModel?.id === ref.id
            : ref.kind === "system-token" ? tokenIds.has(ref.id)
              : ref.kind === "direction-choice" ? choiceIds.has(ref.id)
                : false; // Human decisions do not exist until B5.
    requireReferences(known, `Critique cites unavailable ${ref.kind} evidence: ${ref.id}`);
  }
}

function validateCritiques(
  input: DesignModelInput,
  directions: DesignDirection[],
  critiques: CritiqueReport[],
): void {
  const intentIds = new Set(input.intent.statements.map((statement) => statement.id));
  const choiceIds = new Set(directions.flatMap((direction) => direction.choices.map((choice) => choice.id)));
  const directionById = new Map(directions.map((direction) => [direction.id, direction]));
  const seenDirections = new Set<string>();

  for (const critique of critiques) {
    const direction = directionById.get(critique.directionRef);
    if (!direction) throw new Error(`Critique targets a direction not returned by inference: ${critique.directionRef}`);
    requireReferences(!seenDirections.has(critique.directionRef), `Duplicate critique for direction ${critique.directionRef}`);
    seenDirections.add(critique.directionRef);
    requireReferences(
      critique.intentRefs.every((id) => intentIds.has(id)),
      `Critique ${critique.id} cites an intent statement not supplied to inference`,
    );
    requireReferences(
      critique.evidenceRefs.every((id) => id === input.evidence.id),
      `Critique ${critique.id} cites evidence not supplied to inference`,
    );

    const expectedChoiceIds = new Set(direction.choices.map((choice) => choice.id));
    const assessmentIds = critique.choiceAssessments.map((assessment) => assessment.choiceRef);
    requireReferences(
      new Set(assessmentIds).size === assessmentIds.length &&
        assessmentIds.length === expectedChoiceIds.size &&
        assessmentIds.every((id) => expectedChoiceIds.has(id)),
      `Critique ${critique.id} must assess every direction choice exactly once`,
    );

    for (const finding of critique.findings) {
      validateSupportRefs(finding.supportRefs, input, choiceIds);
    }
    for (const assessment of critique.choiceAssessments) {
      validateSupportRefs(assessment.supportRefs, input, choiceIds);
    }
  }
  requireReferences(seenDirections.size === directions.length, "Exactly one critique is required for each direction");
}

function summarizeIntentionality(direction: DesignDirection, critique: CritiqueReport): IntentionalityDiagnostic {
  const assessmentByChoice = new Map(critique.choiceAssessments.map((item) => [item.choiceRef, item]));
  const assessmentCount = (assessment: ChoiceSupportAssessment["assessment"]) =>
    [...assessmentByChoice.values()].filter((item) => item.assessment === assessment).length;
  const choiceCount = direction.choices.length;
  const unsupportedDefaultLikeCount = assessmentCount("unsupported-default-like");
  return {
    directionRef: direction.id,
    choiceCount,
    citationCompleteCount: choiceCount,
    criticSupportedCount: assessmentCount("supported"),
    weaklySupportedCount: assessmentCount("weakly-supported"),
    unsupportedDefaultLikeCount,
    unsupportedChoiceRate: choiceCount === 0 ? 0 : unsupportedDefaultLikeCount / choiceCount,
  };
}

/** Runs B2-B4 without giving a model access to source, quarantine, or untrusted original pixels. */
export async function runDirectionCritiqueSlice(
  artifacts: DesignProcessArtifacts,
  model: DesignProcessModel,
): Promise<DesignProcessResult> {
  const runId = DesignRunId.parse(`run_${randomBytes(16).toString("hex")}`);
  const trustedInput = await createDesignModelInput(artifacts);
  validateModelImages(trustedInput);
  const inputSha256 = sha256Text(JSON.stringify(trustedInput));
  const directionsRequest: DirectionRequest = {
    promptVersion: DIRECTIONS_PROMPT_VERSION,
    instructions: DIRECTIONS_INSTRUCTIONS,
    responseShape: "three-design-directions",
    responseSchema: DIRECTIONS_RESPONSE_SCHEMA,
  };
  const directionsContext = { input: trustedInput, request: directionsRequest };
  const directionsResponse = await model.proposeDirections(trustedInput, directionsRequest);
  const directionInvocation = recordInvocation(
    "direction-generation",
    directionsRequest,
    directionsContext,
    directionsResponse,
  );
  const parsedDirections = parseModelOutput(directionsResponse.rawOutput, Directions, "directions");
  validateDirections(trustedInput, parsedDirections);

  const diversity = validateDirectionDiversity(parsedDirections);
  if (!diversity.passed) {
    return {
      status: "direction-gate-failed",
      runId,
      inputSha256,
      modelInvocations: [directionInvocation],
      modelRelationship: "not-compared",
      promptVersions: { directions: DIRECTIONS_PROMPT_VERSION, critique: CRITIQUE_PROMPT_VERSION },
      directions: parsedDirections,
      diversity,
    };
  }

  const critiqueInput = { context: trustedInput, directions: parsedDirections };
  const critiqueRequest: CritiqueRequest = {
    promptVersion: CRITIQUE_PROMPT_VERSION,
    instructions: CRITIQUE_INSTRUCTIONS,
    responseShape: "three-critique-reports",
    responseSchema: CRITIQUES_RESPONSE_SCHEMA,
  };
  const critiqueResponse = await model.critiqueDirections(critiqueInput, critiqueRequest);
  const critiqueInvocation = recordInvocation(
    "critique",
    critiqueRequest,
    { input: critiqueInput, request: critiqueRequest },
    critiqueResponse,
  );
  const critiques = parseModelOutput(critiqueResponse.rawOutput, Critiques, "critiques");
  validateCritiques(trustedInput, parsedDirections, critiques);

  return {
    status: "critiqued",
    runId,
    inputSha256,
    modelInvocations: [directionInvocation, critiqueInvocation],
    modelRelationship: compareModels(directionInvocation, critiqueInvocation),
    promptVersions: { directions: DIRECTIONS_PROMPT_VERSION, critique: CRITIQUE_PROMPT_VERSION },
    directions: parsedDirections,
    diversity,
    critiques,
    intentionality: parsedDirections.map((direction) => {
      const critique = critiques.find((item) => item.directionRef === direction.id)!;
      return summarizeIntentionality(direction, critique);
    }),
  };
}
