import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { writeEnvironment } from "../src/environment/capture.ts";

const fonts = resolve(import.meta.dirname, "../benchmarks/calibration/uswds-v3.14.0/source/package/dist/fonts");

describe("rendering-environment freeze", () => {
  test("refuses to overwrite an existing rendering fingerprint", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dorkflow-environment-freeze-"));
    const path = join(directory, "environment.json");
    try {
      const first = await writeEnvironment(path, fonts);
      const original = await readFile(path, "utf8");
      expect(JSON.parse(original).environmentSha256).toBe(first.environmentSha256);
      await expect(writeEnvironment(path, fonts)).rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(path, "utf8")).toBe(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
