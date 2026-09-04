import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { parseModelInput, serializeModelInput } from "../src/boundary/model-input.ts";

const fixture = new URL("../fixtures/security-hostile/index.html", import.meta.url);
const styles = new URL("../fixtures/security-hostile/styles.css", import.meta.url);

describe("A0 trust boundary contracts", () => {
  test("hostile fixture contains all required adversarial surfaces", async () => {
    const html = await readFile(fixture, "utf8");
    const css = await readFile(styles, "utf8");
    for (const marker of [
      "IGNORE_PREVIOUS_INSTRUCTIONS_HTML_COMMENT",
      "IGNORE_PREVIOUS_INSTRUCTIONS_VISIBLE_HEADING",
      "IGNORE_PREVIOUS_INSTRUCTIONS_HIDDEN_TEXT",
      "IGNORE_PREVIOUS_INSTRUCTIONS_ARIA_LABEL",
      "IGNORE_PREVIOUS_INSTRUCTIONS_DATA_ATTRIBUTE",
      "IGNORE_PREVIOUS_INSTRUCTIONS_SVG_TEXT",
      "IGNORE_PREVIOUS_INSTRUCTIONS_PSEUDO_CONTENT",
      "IGNORE_PREVIOUS_INSTRUCTIONS_CSS_COMMENT",
    ]) {
      expect(`${html}\n${css}`).toContain(marker);
    }
  });

  test("model input rejects source-shaped keys", () => {
    expect(() => parseModelInput({ schemaVersion: 1, text: "hostile" })).toThrow("Forbidden model-input field");
    expect(() => parseModelInput({ schemaVersion: 1, screenshot: "quarantine/page.png" })).toThrow();
  });

  test("a safe model input serializes without fixture content", () => {
    const safe = {
      schemaVersion: 1,
      viewports: [{ id: "vp_12345678", width: 375, height: 812, deviceScaleFactor: 1, label: "mobile" }],
      elements: [],
      values: [],
      relationships: [],
      inventoryStats: { elementCount: 0, valueCount: 0, relationshipCount: 0, pageCount: 1, viewportCount: 1, stateCount: 1 },
    };
    const serialized = serializeModelInput(safe);
    expect(serialized).not.toContain("IGNORE_PREVIOUS_INSTRUCTIONS");
    expect(serialized).not.toContain("quarantine");
  });
});
