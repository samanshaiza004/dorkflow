import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPerceptualInput } from "../src/capture/perceptual-input.ts";
import { sha256Bytes } from "../src/environment/hash.ts";

const digest = "a".repeat(64);
const captureId = "cap_12345678";
const pngBytes = new Uint8Array(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9pAAAAABJRU5ErkJggg==",
  "base64",
));

function evidence(sha256: string = sha256Bytes(pngBytes)) {
  return {
    schemaVersion: 1,
    id: "ev_12345678",
    purpose: "hierarchy",
    trustMode: "sanitized-external",
    contentTreatment: "light-dom-geometry-placeholders-shadow-dom-text-suppressed",
    originalPixelsApproved: false,
    renderingEnvironmentSha256: digest,
    sanitizer: { version: "perceptual-sanitizer-v1", sha256: digest },
    captures: [{
      id: captureId,
      sha256,
      path: `captures/${captureId}.png`,
      stateRef: "st_12345678",
      stateKind: "open",
      triggerKinds: ["click"],
      viewportRef: "vp_12345678",
      viewport: { label: "mobile", width: 375, height: 812 },
      mediaType: "image/png",
      width: 1,
      height: 1,
    }],
  };
}

async function createModelFacingDirectory(): Promise<{ root: string; perceptual: string }> {
  const root = await mkdtemp(join(tmpdir(), "dorkflow-perceptual-input-"));
  const perceptual = join(root, "perceptual");
  await mkdir(join(perceptual, "captures"), { recursive: true });
  await writeFile(join(perceptual, "captures", `${captureId}.png`), pngBytes);
  await writeFile(join(perceptual, "evidence.json"), `${JSON.stringify(evidence())}\n`);
  return { root, perceptual };
}

describe("model-facing perceptual input boundary", () => {
  test("loads only schema-valid files under the perceptual folder and verifies hashes", async () => {
    const artifact = await createModelFacingDirectory();
    try {
      const input = await loadPerceptualInput(artifact.root);
      expect(input.evidence.trustMode).toBe("sanitized-external");
      expect(input.captures).toHaveLength(1);
      expect(input.captures[0]?.metadata.viewport).toEqual({ label: "mobile", width: 375, height: 812 });
      expect(input.captures[0]?.bytes).toEqual(pngBytes);
      expect(JSON.stringify(input.evidence)).not.toContain("quarantine");
    } finally {
      await rm(artifact.root, { recursive: true, force: true });
    }
  });

  test("refuses a model-facing path that aliases a quarantined original screenshot", async () => {
    const artifact = await createModelFacingDirectory();
    try {
      const quarantine = join(artifact.root, "quarantine");
      await mkdir(quarantine);
      const original = join(quarantine, "original.png");
      await writeFile(original, pngBytes);
      const modelCapture = join(artifact.perceptual, "captures", `${captureId}.png`);
      await rm(modelCapture);
      await symlink(original, modelCapture);
      await writeFile(join(artifact.perceptual, "evidence.json"), `${JSON.stringify(evidence())}\n`);

      await expect(loadPerceptualInput(artifact.root)).rejects.toThrow("escaped the model-facing capture directory");
    } finally {
      await rm(artifact.root, { recursive: true, force: true });
    }
  });

  test("rejects modified capture bytes and malformed or path-shaped evidence", async () => {
    const artifact = await createModelFacingDirectory();
    try {
      await writeFile(join(artifact.perceptual, "captures", `${captureId}.png`), new Uint8Array([1, 2, 3]));
      await expect(loadPerceptualInput(artifact.root)).rejects.toThrow("hash mismatch");

      await writeFile(join(artifact.perceptual, "evidence.json"), JSON.stringify({
        ...evidence(),
        captures: [{ ...evidence().captures[0], path: "../quarantine/original.png" }],
      }));
      await expect(loadPerceptualInput(artifact.root)).rejects.toThrow();
    } finally {
      await rm(artifact.root, { recursive: true, force: true });
    }
  });
});
