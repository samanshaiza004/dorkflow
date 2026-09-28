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

  test("screenshots suppress shadow text but cannot replace it with geometry placeholders", async () => {
    await page.setContent(`
      <style>html, body { margin: 0; background: white; } #host { position: absolute; left: 20px; top: 20px; }</style>
      <div id="host"></div>
    `);
    await page.evaluate(() => {
      const root = document.querySelector("#host")!.attachShadow({ mode: "open" });
      root.innerHTML = `<span style="display:block;width:280px;height:36px;background:white;color:black;font:24px/36px monospace">SHADOW INSTRUCTION TEXT</span>`;
    });
    const shadowText = page.locator("#host").locator("span");
    const box = await shadowText.boundingBox();
    if (!box) throw new Error("Shadow text did not render");
    const before = await page.screenshot({ type: "png" });

    await applyPerceptualSanitizer(page);
    const after = await page.screenshot({
      type: "png",
      style: PERCEPTUAL_SANITIZER_CSS,
    });
    const containsDarkPixels = async (png: Buffer) => page.evaluate(async ({ base64, box }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const x = Math.floor(box.x);
      const y = Math.floor(box.y);
      const pixels = context.getImageData(x, y, Math.ceil(box.width), Math.ceil(box.height)).data;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index]! < 150 && pixels[index + 1]! < 150 && pixels[index + 2]! < 150) return true;
      }
      return false;
    }, { base64: png.toString("base64"), box });

    const placeholderExists = await page.locator("#host").locator("[data-dorkflow-placeholder='true']").count();
    expect(await containsDarkPixels(before)).toBe(true);
    expect(await containsDarkPixels(after)).toBe(false);
    expect(placeholderExists).toBe(0);
  });
});
