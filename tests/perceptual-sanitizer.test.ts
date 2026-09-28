import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";
import {
  applyPerceptualSanitizer,
  PERCEPTUAL_SANITIZER_CSS,
} from "../src/capture/perceptual-sanitizer.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
});

afterAll(async () => {
  await browser?.close();
});

describe("perceptual capture sanitizer", () => {
  test("keeps geometry text while suppressing rendered untrusted copy and media", async () => {
    await page.setContent(`
      <style>
        #copy { color: rgb(200, 0, 0) !important; font: 20px/1.5 sans-serif; }
        #copy::after { content: "pseudo-injection"; }
      </style>
      <main>
        <p id="copy" title="tooltip-injection">Visible instruction-like content stays quarantined</p>
        <svg id="icon"><text>svg-injection</text></svg>
        <img id="image" alt="alt-injection" src="data:image/png;base64,invalid">
        <input id="field" value="input-injection">
        <textarea id="memo">textarea-injection</textarea>
      </main>
    `);

    await applyPerceptualSanitizer(page);
    await page.addStyleTag({ content: PERCEPTUAL_SANITIZER_CSS });

    const result = await page.evaluate(() => {
      const copy = document.querySelector("#copy")!;
      const placeholder = copy.querySelector<HTMLElement>("[data-dorkflow-placeholder='true']")!;
      const pseudo = getComputedStyle(copy, "::after");
      return {
        textWasRetained: placeholder.textContent === "Visible instruction-like content stays quarantined",
        placeholderColor: getComputedStyle(placeholder).color,
        placeholderBackground: getComputedStyle(placeholder).backgroundColor,
        pseudoOpacity: pseudo.opacity,
        svgOpacity: getComputedStyle(document.querySelector("#icon")!).opacity,
        imageOpacity: getComputedStyle(document.querySelector("#image")!).opacity,
        formTextColor: getComputedStyle(document.querySelector("#field")!).color,
        titleRemoved: !copy.hasAttribute("title"),
        formTextNodesRemainSafe: document.querySelector("textarea")!.textContent === "textarea-injection",
      };
    });

    expect(result.textWasRetained).toBe(true);
    expect(result.placeholderColor).toBe("rgba(0, 0, 0, 0)");
    expect(result.placeholderBackground).toContain("0.16");
    expect(result.pseudoOpacity).toBe("0");
    expect(result.svgOpacity).toBe("0");
    expect(result.imageOpacity).toBe("0");
    expect(result.formTextColor).toBe("rgba(0, 0, 0, 0)");
    expect(result.titleRemoved).toBe(true);
    expect(result.formTextNodesRemainSafe).toBe(true);
  });

  test("does not attempt to wrap SVG or raw-text control nodes", async () => {
    await page.setContent(`<svg><text>vector words</text></svg><textarea>field words</textarea>`);
    await expect(applyPerceptualSanitizer(page)).resolves.toBeUndefined();
    expect(await page.locator("svg text").textContent()).toBe("vector words");
    expect(await page.locator("textarea").textContent()).toBe("field words");
  });
});
