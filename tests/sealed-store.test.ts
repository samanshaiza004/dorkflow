import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { assertExternalSealedStore, assertSealedBenchmarkPathAvailable, writeSealedInput } from "../src/boundary/sealed-store.ts";

describe("physical sealed-store boundary", () => {
  test("rejects a store inside the coding-agent workspace", () => {
    expect(() => assertExternalSealedStore(resolve("/workspace/dorkflow/sealed-store"), "/workspace/dorkflow")).toThrow();
  });

  test("accepts an external store", () => {
    expect(assertExternalSealedStore("/private/tmp/dorkflow-sealed-store", "/workspace/dorkflow")).toBe("/private/tmp/dorkflow-sealed-store");
  });

  test("refuses to reuse an existing sealed benchmark directory", async () => {
    const store = await mkdtemp(join(tmpdir(), "dorkflow-sealed-store-"));
    try {
      await assertSealedBenchmarkPathAvailable(store, "bench_test_001");
      await writeSealedInput(store, "bench_test_001", "seed", "sealed");
      await expect(assertSealedBenchmarkPathAvailable(store, "bench_test_001")).rejects.toThrow("already exists");
      await expect(writeSealedInput(store, "bench_test_001", "seed", "replacement")).rejects.toThrow();
    } finally {
      await rm(store, { recursive: true, force: true });
    }
  });
});
