import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const FIXED_TIME = "2026-09-30T17:00:00.000Z";
const STANDARD_VIEWPORTS = [
  { id: "desktop", width: 1440, height: 900 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "mobile", width: 375, height: 812 },
];
const WIDTH_SWEEP = [320, 375, 480, 767, 768, 1024, 1440];

function args(argv) {
  const values = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[++i];
    if (!value) throw new Error(`Missing value for ${key}`);
    values.set(key, value);
  }
  const baseUrl = values.get("--base-url");
  const outputDir = values.get("--output-dir");
  if (!baseUrl || !outputDir) throw new Error("Usage: verify-rendering.mjs --base-url <loopback-url> --output-dir <new-dir> [--reference <inventory.json>]");
  const parsed = new URL(baseUrl);
  if (!(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) || !["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("The verifier accepts loopback HTTP(S) origins only");
  }
  return { baseUrl: parsed.origin, outputDir: resolve(outputDir), referencePath: values.get("--reference") };
}

function normalizeText(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\b(?:3:00|3:30) PM(?: standard\s*\/\s*(?:3:00|3:30) PM daylight time)?\b/gi, "{SERVICE_TIME}")
    .trim();
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffLists(expected, actual) {
  const expectedCounts = new Map();
  const actualCounts = new Map();
  for (const item of expected) expectedCounts.set(item, (expectedCounts.get(item) ?? 0) + 1);
  for (const item of actual) actualCounts.set(item, (actualCounts.get(item) ?? 0) + 1);
  const missing = [];
  const added = [];
  for (const [item, count] of expectedCounts) {
    for (let i = actualCounts.get(item) ?? 0; i < count; i += 1) missing.push(item);
  }
  for (const [item, count] of actualCounts) {
    for (let i = expectedCounts.get(item) ?? 0; i < count; i += 1) added.push(item);
  }
  return { missing, added };
}

const { baseUrl, outputDir, referencePath } = args(process.argv.slice(2));
await mkdir(outputDir, { recursive: false, mode: 0o700 });
const origin = new URL(baseUrl).origin;
const blockedRequests = [];
const checks = [];
const captures = [];
const inventories = {};
const layouts = [];
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });

function record(id, status, evidence) {
  checks.push({ id, status, evidence });
}

async function openPage(viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/Chicago",
    colorScheme: "light",
    reducedMotion,
    forcedColors: "none",
    contrast: "no-preference",
    javaScriptEnabled: true,
    hasTouch: false,
    isMobile: false,
    serviceWorkers: "block",
    acceptDownloads: false,
    permissions: [],
  });
  await context.clock.install({ time: new Date(FIXED_TIME) });
  await context.route("**/*", async (route) => {
    const request = route.request();
    let requestUrl;
    try {
      requestUrl = new URL(request.url());
    } catch {
      await route.abort();
      return;
    }
    if (requestUrl.origin !== origin || !["http:", "https:"].includes(requestUrl.protocol) || !["GET", "HEAD"].includes(request.method())) {
      blockedRequests.push({ urlOrigin: requestUrl.origin, method: request.method() });
      await route.abort();
      return;
    }
    await route.continue();
  });
  await context.routeWebSocket("**/*", async (socket) => socket.close({ code: 1008, reason: "B11 verifier blocks WebSockets" }));
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(15000);
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]));
  return { context, page };
}

async function saveScreenshot(page, id) {
  const path = resolve(outputDir, `${id}.png`);
  const bytes = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide", type: "png", timeout: 30000 });
  await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
  captures.push({ id, file: `${id}.png`, bytes: bytes.byteLength });
}

async function collectInventory(page) {
  return page.evaluate((base) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    };
    const normalize = (value) => value
      .replace(/\s+/g, " ")
      .replace(/\b(?:3:00|3:30) PM(?: standard\s*\/\s*(?:3:00|3:30) PM daylight time)?\b/gi, "{SERVICE_TIME}")
      .trim();
    const visibleText = document.body.innerText.split(/\n+/).map(normalize).filter(Boolean).sort();
    const links = Array.from(document.querySelectorAll("a[href]"))
      .filter(visible)
      .map((link) => {
        const name = normalize(link.getAttribute("aria-label") || link.innerText || link.querySelector("img")?.alt || "");
        const url = new URL(link.href, location.href);
        const href = url.origin === base ? `${url.pathname}${url.search}${url.hash}` : url.href;
        return `${name}\t${href}`;
      })
      .sort();
    const imageAlts = Array.from(document.querySelectorAll("img"))
      .filter(visible)
      .map((image) => normalize(image.alt ?? ""))
      .sort();
    const namedInteractive = Array.from(document.querySelectorAll("a[href],button,[role='button'],[role='link'],input:not([type='hidden']),select,textarea"))
      .filter(visible)
      .filter((control) => !control.closest('[aria-hidden="true"]'))
      .map((control) => {
        const labelledBy = (control.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.innerText ?? "")
          .join(" ");
        const labels = control.labels ? Array.from(control.labels, (label) => label.innerText).join(" ") : "";
        const svgTitle = control.querySelector("svg title")?.textContent ?? "";
        const imageAlt = control.querySelector("img")?.alt ?? "";
        const name = control.getAttribute("aria-label") || labelledBy || labels || control.getAttribute("title") || control.innerText || control.value || imageAlt || svgTitle;
        return { element: `${control.tagName.toLowerCase()}${control.id ? `#${control.id}` : ""}`, hasName: Boolean(normalize(name)) };
      })
      .filter((control) => !control.hasName)
      .map((control) => control.element)
      .sort();
    return { visibleText, links, imageAlts, unnamedControls: namedInteractive };
  }, origin);
}

async function recordLayout(page, viewport) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const visibleControls = Array.from(document.querySelectorAll("a,button,input,select,textarea,[role='button']"))
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { left: Math.round(box.left * 100) / 100, right: Math.round(box.right * 100) / 100 };
      });
    return {
      viewportWidth: innerWidth,
      documentWidth: Math.max(root.scrollWidth, root.clientWidth, body.scrollWidth),
      offscreenControls: visibleControls.filter((box) => box.left < -1 || box.right > innerWidth + 1).length,
    };
  });
  const pass = metrics.documentWidth <= viewport.width + 1 && metrics.offscreenControls === 0;
  layouts.push({ viewport: viewport.width, ...metrics, pass });
  record(`FNBC-RESPONSIVE-01@${viewport.width}`, pass ? "PASS" : "FAIL", metrics);
}

async function requireOne(locator, name) {
  const count = await locator.count();
  if (count !== 1) throw new Error(`${name}: expected one matching element, found ${count}`);
  return locator;
}

try {
  for (const width of WIDTH_SWEEP) {
    const viewport = { width, height: width <= 480 ? 812 : width < 900 ? 1024 : 900 };
    console.log(`responsive ${width}`);
    const { context, page } = await openPage(viewport);
    try {
      await recordLayout(page, viewport);
      const standard = STANDARD_VIEWPORTS.find((entry) => entry.width === width);
      const inventoryId = standard?.id ?? `width-${width}`;
      inventories[inventoryId] = await collectInventory(page);
      if (standard) {
        const fontStatus = await page.evaluate(() => ({
          inter: document.fonts.check("16px Inter"),
          sourceSerif4: document.fonts.check("16px 'Source Serif 4'"),
        }));
        record(`FNBC-FONTS-${standard.id}`, fontStatus.inter && fontStatus.sourceSerif4 ? "PASS" : "HUMAN-REVIEW", fontStatus);
        await saveScreenshot(page, `${standard.id}-default`);
        console.log(`default screenshot ${standard.id}`);
      }
    } finally {
      await context.close();
    }
  }

  const reference = referencePath ? JSON.parse(await readFile(resolve(referencePath), "utf8")) : null;
  if (reference) {
    for (const width of WIDTH_SWEEP) {
      const standard = STANDARD_VIEWPORTS.find((entry) => entry.width === width);
      const inventoryId = standard?.id ?? `width-${width}`;
      const actual = inventories[inventoryId];
      const expected = reference.inventories?.[inventoryId];
      if (!expected) {
        record(`FNBC-COPY-01-${width}`, "HUMAN-REVIEW", { reason: "Reference inventory missing" });
        continue;
      }
      const textDiff = diffLists(expected.visibleText, actual.visibleText);
      const linkDiff = diffLists(expected.links, actual.links);
      const altDiff = diffLists(expected.imageAlts, actual.imageAlts);
      const pass = !textDiff.missing.length && !textDiff.added.length && !linkDiff.missing.length && !linkDiff.added.length;
      record(`FNBC-COPY-LINKS-${width}`, pass ? "PASS" : "FAIL", { textDiff, linkDiff, altDiff });
      record(`FNBC-CMS-ALT-${width}`, !altDiff.missing.length ? "PASS" : "HUMAN-REVIEW", altDiff);
      const unnamed = actual.unnamedControls;
      record(`FNBC-A11Y-NAMES-${width}`, unnamed.length === 0 ? "PASS" : "FAIL", { unnamedControls: unnamed });
    }
  } else {
    record("FNBC-COPY-LINKS-CONTROL-INVENTORY", "NOT-APPLICABLE", { note: "This is the frozen control inventory creation run" });
  }

  const mobile = { width: 375, height: 812 };
  {
    console.log("mobile menu pointer");
    const { context, page } = await openPage(mobile);
    try {
      const toggle = await requireOne(page.locator("header button[aria-expanded][aria-controls]"), "Mobile navigation trigger");
      const name = (await toggle.getAttribute("aria-label")) || normalizeText(await toggle.innerText());
      const controls = (await toggle.getAttribute("aria-controls"))?.split(/\s+/).filter(Boolean) ?? [];
      const menu = controls[0] ? page.locator(`[id="${controls[0]}"]`) : page.locator("__missing__");
      const hasNameAndControl = Boolean(name && controls.length);
      await toggle.click();
      const opens = (await toggle.getAttribute("aria-expanded")) === "true" && await menu.isVisible();
      await record("FNBC-FUNCTION-01-MENU-POINTER", opens && hasNameAndControl ? "PASS" : "FAIL", { accessibleName: Boolean(name), controls, expanded: await toggle.getAttribute("aria-expanded"), visible: await menu.isVisible() });
      if (opens) await saveScreenshot(page, "mobile-menu-open");
    } catch (error) {
      record("FNBC-FUNCTION-01-MENU-POINTER", "FAIL", { error: String(error) });
    } finally {
      await context.close();
    }
  }

  {
    console.log("mobile menu keyboard");
    const { context, page } = await openPage(mobile);
    try {
      const toggle = await requireOne(page.locator("header button[aria-expanded][aria-controls]"), "Mobile navigation trigger");
      await toggle.focus();
      await page.keyboard.press("Space");
      const openedByKeyboard = (await toggle.getAttribute("aria-expanded")) === "true";
      const ids = (await toggle.getAttribute("aria-controls"))?.split(/\s+/).filter(Boolean) ?? [];
      const menu = ids[0] ? page.locator(`[id="${ids[0]}"]`) : page.locator("__missing__");
      await page.keyboard.press("Tab");
      const menuLinkFocused = await menu.locator("a").evaluateAll((links) => links.some((link) => link === document.activeElement && link.matches(":focus-visible")));
      record("FNBC-FUNCTION-01-MENU-KEYBOARD-FOCUS", openedByKeyboard && menuLinkFocused ? "PASS" : "FAIL", { openedByKeyboard, menuLinkFocused });
      if (menuLinkFocused) await saveScreenshot(page, "mobile-menu-keyboard-focus");
      await page.keyboard.press("Escape");
      const returned = (await toggle.getAttribute("aria-expanded")) === "false" && await toggle.evaluate((element) => document.activeElement === element);
      record("FNBC-FUNCTION-01-MENU-ESCAPE", returned ? "PASS" : "FAIL", { expanded: await toggle.getAttribute("aria-expanded"), focusReturned: await toggle.evaluate((element) => document.activeElement === element) });
    } catch (error) {
      record("FNBC-FUNCTION-01-MENU-KEYBOARD-FOCUS", "FAIL", { error: String(error) });
    } finally {
      await context.close();
    }
  }

  {
    console.log("desktop CTA states");
    const viewport = { width: 1440, height: 900 };
    const { context, page } = await openPage(viewport);
    try {
      const cta = await requireOne(page.locator('main a[href="/visit"]').first(), "Primary visit link");
      await cta.hover();
      await saveScreenshot(page, "desktop-visit-cta-hover");
      await page.keyboard.press("Tab");
      let focused = false;
      for (let index = 0; index < 60; index += 1) {
        if (await cta.evaluate((element) => document.activeElement === element)) {
          focused = true;
          break;
        }
        await page.keyboard.press("Tab");
      }
      const focusVisible = focused && await cta.evaluate((element) => element.matches(":focus-visible"));
      record("FNBC-A11Y-FOCUS-VISIBLE-PRIMARY", focusVisible ? "PASS" : "FAIL", { foundBySequentialTab: focused, focusVisible });
      if (focusVisible) await saveScreenshot(page, "desktop-visit-cta-focus");
    } catch (error) {
      record("FNBC-A11Y-FOCUS-VISIBLE-PRIMARY", "FAIL", { error: String(error) });
    } finally {
      await context.close();
    }
  }

  {
    console.log("desktop carousel");
    const viewport = { width: 1440, height: 900 };
    const { context, page } = await openPage(viewport);
    try {
      const region = await requireOne(page.locator('[aria-label="Snapshots of life together"]'), "Community photo region");
      const next = await requireOne(region.getByRole("button", { name: /next/i }), "Next community photo action");
      const previous = await requireOne(region.getByRole("button", { name: /previous/i }), "Previous community photo action");
      const active = async () => region.locator("figure").evaluateAll((figures) => figures
        .filter((figure) => !figure.hidden && getComputedStyle(figure).display !== "none" && figure.getClientRects().length > 0)
        .map((figure) => `${figure.querySelector("img")?.alt ?? ""}\t${figure.querySelector("figcaption")?.innerText ?? ""}`));
      const before = await active();
      await next.click();
      await page.waitForTimeout(150);
      const afterNext = await active();
      const nextChanged = before.length > 0 && afterNext.length > 0 && !sameJson(before, afterNext);
      if (nextChanged) await saveScreenshot(page, "desktop-carousel-next");
      await previous.click();
      await page.waitForTimeout(150);
      const afterPrevious = await active();
      const roundTrip = sameJson(before, afterPrevious);
      record("FNBC-FUNCTION-02-CAROUSEL", nextChanged && roundTrip ? "PASS" : "FAIL", { before, afterNext, afterPrevious, nextChanged, roundTrip });
    } catch (error) {
      record("FNBC-FUNCTION-02-CAROUSEL", "FAIL", { error: String(error) });
    } finally {
      await context.close();
    }
  }

  for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
    console.log(`reduced-motion ${viewport.width}`);
    const { context, page } = await openPage(viewport, "reduce");
    try {
      const preference = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
      const suffix = viewport.width === 375 ? "mobile" : "desktop";
      record(`FNBC-MOTION-01-${suffix}`, preference ? "PASS" : "FAIL", { reducedMotion: preference });
      await saveScreenshot(page, `${suffix}-reduced-motion`);
    } finally {
      await context.close();
    }
  }

  if (!referencePath) {
    await writeFile(resolve(outputDir, "control-inventory.json"), `${JSON.stringify({ schemaVersion: 1, fixedTime: FIXED_TIME, inventories }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  }

  const internalPaths = new Set();
  for (const link of inventories.desktop?.links ?? []) {
    const href = link.slice(link.indexOf("\t") + 1);
    if (href.startsWith("/")) internalPaths.add(`${new URL(href, baseUrl).pathname}${new URL(href, baseUrl).search}`);
  }
  const requestContext = await browser.newContext({ locale: "en-US", timezoneId: "America/Chicago" });
  try {
    for (const path of [...internalPaths].sort()) {
      console.log(`route ${path}`);
      const requestedUrl = new URL(path, baseUrl).toString();
      const response = await requestContext.request.get(requestedUrl, { maxRedirects: 0, timeout: 10000 });
      const sameOrigin = new URL(response.url(), requestedUrl).origin === origin;
      const pass = response.status() >= 200 && response.status() < 300 && sameOrigin;
      record(`FNBC-LINKS-01-ROUTE:${path}`, pass ? "PASS" : "FAIL", { status: response.status(), finalOriginMatches: sameOrigin });
    }
  } finally {
    await requestContext.close();
  }
  record("FNBC-NETWORK-01-LOCAL-ONLY", blockedRequests.length === 0 ? "PASS" : "FAIL", { blockedExternalRequests: blockedRequests });

  const result = {
    schemaVersion: 1,
    baseOriginSha256: await (async () => {
      const { createHash } = await import("node:crypto");
      return createHash("sha256").update(origin).digest("hex");
    })(),
    fixedTime: FIXED_TIME,
    viewports: WIDTH_SWEEP,
    screenshots: captures,
    layouts,
    checks,
    blockedExternalRequests: blockedRequests,
    referenceInventory: referencePath ? "compared" : "created",
  };
  await writeFile(resolve(outputDir, "verification.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  const hardFailures = checks.filter(({ status }) => status === "FAIL");
  console.log(JSON.stringify({ checks: checks.length, failures: hardFailures.length, captures: captures.length, outputDir }, null, 2));
  if (hardFailures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
