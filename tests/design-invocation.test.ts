import { describe, expect, test } from "bun:test";
import { DesignProcessManifest, ModelInvocation } from "../src/contracts/design/invocation.ts";

const digest = "a".repeat(64);
const invocation = {
  schemaVersion: 1,
  id: "inv_1234567890abcdef",
  role: "direction-generation",
  provider: "test-provider",
  model: "test-model",
  modelVersion: "snapshot-1",
  promptVersion: "dorkflow-directions-v3",
  promptSha256: digest,
  inputSha256: digest,
  outputSha256: digest,
  sampling: { temperature: 0.2, topP: 0.9, seed: 12, maxOutputTokens: 4000 },
  tokenUsage: { inputTokens: 500, outputTokens: 300, totalTokens: 800 },
  toolPermissions: { enabled: false, allowedTools: [] },
  startedAt: "2026-09-28T12:00:00.000Z",
  finishedAt: "2026-09-28T12:00:01.000Z",
};

describe("model invocation and process manifest", () => {
  test("records reproducibility metadata for one model call", () => {
    expect(ModelInvocation.parse(invocation)).toEqual(invocation);
  });

  test("rejects negative usage, time ranges, and tool claims", () => {
    expect(() => ModelInvocation.parse({
      ...invocation,
      tokenUsage: { inputTokens: -1, outputTokens: 300, totalTokens: 900 },
    })).toThrow();
    expect(() => ModelInvocation.parse({ ...invocation, finishedAt: "2026-09-28T11:59:59.000Z" })).toThrow();
    expect(() => ModelInvocation.parse({
      ...invocation,
      toolPermissions: { enabled: false, allowedTools: ["filesystem"] },
    })).toThrow("cannot list allowed tools");
  });

  test("manifest paths are relative, unique, and cannot traverse upward", () => {
    const manifest = {
      schemaVersion: 1,
      id: "run_1234567890abcdef",
      status: "critiqued",
      createdAt: "2026-09-28T12:00:00.000Z",
      updatedAt: "2026-09-28T12:00:02.000Z",
      modelInputSha256: digest,
      renderingEnvironmentSha256: digest,
      promptVersions: { directions: "directions-v2", critique: "critique-v2" },
      modelRelationship: "same-model",
      invocationRefs: ["inv_1234567890abcdef", "inv_abcdef1234567890"],
      artifactDigests: [{ path: "directions.json", sha256: digest }],
    };
    expect(DesignProcessManifest.parse(manifest)).toEqual(manifest);
    expect(() => DesignProcessManifest.parse({
      ...manifest,
      artifactDigests: [{ path: "../../quarantine/raw.json", sha256: digest }],
    })).toThrow();
    expect(() => DesignProcessManifest.parse({
      ...manifest,
      artifactDigests: [
        { path: "directions.json", sha256: digest },
        { path: "directions.json", sha256: digest },
      ],
    })).toThrow("unique");
  });
});
