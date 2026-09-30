import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import {
  B9EvidenceArtifact,
  B9HumanReviewItem,
  B9RequirementResult,
  B9VerificationReport,
  completeB9RequirementResults,
  summarizeB9Requirements,
} from "../../src/design/b9-verification.ts";
import { ImplementationContract } from "../../src/contracts/design/implementation-contract.ts";
import { EvidenceId } from "../../src/contracts/ids.ts";

const root = resolve(import.meta.dir, "../..");
const experimentRoot = join(root, "artifacts/phase-b-expense-tracker");
const runId = "run_aadad7d73a62536be1d6f2d415979ea7";
const runRoot = join(experimentRoot, "agent-runs", runId);
const implementationRoot = join(runRoot, "implementation");
const implementationSource = join(implementationRoot, "source");
const controlSource = join(experimentRoot, "control-copy");
const b6Root = join(experimentRoot, "hybrid-prototype");
const contractPath = join(implementationRoot, "implementation-contract.json");
const receiptPath = join(root, "docs/experiments/phase-b-expense-tracker-b8-receipt.json");
const envPath = join(experimentRoot, "rendering-environment-phase-b-review.json");
const b8Commit = "2400196c9a7d3a64554b517d5364fc739d4acf49";
const b9StyleRevisionCommit = "ee7e2167a1f85200c57136defda3a2e79ef791b9";
const baseCommit = "5e5ad9ad6f0929f80e1c9f6667b08870f87e7743";
const b8EnvironmentSha256 = "a9215d1eea25dcbe7111011395f5cfc41a62b8b177fbcb2e13d14da28405d361";
const latoSha256 = "d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251";
const widths = [320, 375, 699, 700, 701, 719, 720, 721, 768, 1280];
const expectedValues = {
  balance: "$ 245,658.77",
  income: "$ 1,234,567.89",
  expense: "$ 988,909.12",
};
const transactions = [
  {
    text: "Annual equipment reimbursement, including monitor arms, keyboards, travel docks, and facilities supplies",
    amount: "1234567.89",
  },
  {
    text: "Regional conference lodging, airfare, ground transit, and registration",
    amount: "-987654.32",
  },
  { text: "Coffee", amount: "-4.80" },
  { text: "Quarter-end bookkeeping subscription renewal", amount: "-1250.00" },
];

const requirementMethods: Record<string, "browser-dom" | "browser-interaction" | "copy-inventory" | "contrast-measurement" | "combined"> = {
  req_b7layout01: "browser-dom",
  req_b7entry01: "browser-dom",
  req_b7summary1: "combined",
  req_b7row0001: "combined",
  req_b7state01: "browser-dom",
  req_b7state02: "browser-dom",
  req_b7state03: "browser-interaction",
  req_b7state04: "browser-interaction",
  req_b7state05: "browser-interaction",
  req_b7state06: "browser-interaction",
  req_b7state07: "browser-interaction",
  req_b7wide001: "browser-dom",
  req_b7narrow1: "browser-dom",
  req_b7bound01: "browser-dom",
  req_b7a11y01: "combined",
  req_b7a11y02: "browser-dom",
  req_b7a11y03: "browser-dom",
  req_b7a11y04: "contrast-measurement",
  req_b7copy01: "copy-inventory",
  req_b7func01: "browser-interaction",
  req_b7pres01: "combined",
  req_b7resp01: "browser-dom",
};

const pendingHumanReview = new Set([
  "req_b7summary1",
  "req_b7row0001",
  "req_b7state04",
  "req_b7state06",
]);

const failures = new Map<string, string[]>();
const successes = new Map<string, string[]>();
const measurements: Record<string, unknown> = {
  schemaVersion: 1,
  experiment: "phase-b-expense-tracker-b9",
  contentFixture: transactions,
  expectedValues,
  viewportWidths: widths,
};
const capturedScreenshots: Array<{ path: string; kind: "screenshot"; description: string; sha256: string }> = [];
const blockedExternalRequests = new Set<string>();
let fontStylesheetRouted = 0;
let currentEvidenceDir = "";
let reviewBaseUrl = "";
let implementationBaseUrl = "";

function record(requirementId: string, label: string, passed: boolean, observation: unknown): void {
  const target = passed ? successes : failures;
  const entries = target.get(requirementId) ?? [];
  entries.push(label);
  target.set(requirementId, entries);
  const assertions = (measurements.assertions ??= []) as Array<Record<string, unknown>>;
  assertions.push({ requirementId, label, passed, observation });
}

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk: Buffer) => hash.update(chunk));
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function git(path: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", "-C", path, ...args], { cwd: root });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed in ${path}: ${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
}

async function listTreeFiles(path: string, current = path): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries) {
    if (["node_modules", "build", ".git"].includes(entry.name)) continue;
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in frozen B6 bundle: ${join(current, entry.name)}`);
    const child = join(current, entry.name);
    if (entry.isDirectory()) output.push(...await listTreeFiles(path, child));
    else if (entry.isFile()) output.push(relative(path, child).split(sep).join("/"));
  }
  return output.sort();
}

async function verifyB6Tree(manifest: {
  treeSha256: string;
  files: Array<{ path: string; sha256: string }>;
}): Promise<void> {
  const actualPaths = await listTreeFiles(b6Root);
  const expectedPaths = manifest.files.map(({ path }) => path).sort();
  assert.deepEqual(actualPaths, expectedPaths, "B6 candidate bundle file set matches its frozen manifest");
  const records: string[] = [];
  for (const entry of manifest.files) {
    const actualHash = await hashFile(join(b6Root, entry.path));
    assert.equal(actualHash, entry.sha256, `B6 candidate file hash matches: ${entry.path}`);
    records.push(`${entry.path}\0${actualHash}\n`);
  }
  assert.equal(digest(records.join("")), manifest.treeSha256, "B6 candidate tree hash matches its frozen manifest");
}

function readCommand(command: string, ...args: string[]): string {
  const result = Bun.spawnSync([command, ...args], { cwd: root });
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

async function preflight(): Promise<{
  contract: ReturnType<typeof ImplementationContract.parse>;
  contractSha256: string;
  b6TreeSha256: string;
  renderEnvironment: Record<string, any>;
}> {
  const receipt = await readJson<any>(receiptPath);
  const contractBytes = await readFile(contractPath);
  const contractSha256 = digest(contractBytes);
  assert.equal(contractSha256, receipt.contract.sha256, "B7 contract bytes match the B8 receipt");
  assert.equal(receipt.source.baseCommit, baseCommit, "B8 receipt identifies the frozen upstream commit");
  assert.equal(receipt.source.implementationCommit, b8Commit, "B8 receipt identifies the implementation commit");
  assert.equal(receipt.source.workingTreeClean, true, "B8 receipt says implementation tree was clean");

  const contract = ImplementationContract.parse(JSON.parse(contractBytes.toString("utf8")));
  assert.equal(git(controlSource, "rev-parse", "HEAD"), baseCommit, "frozen control checkout is at the recorded commit");
  assert.equal(git(controlSource, "status", "--porcelain", "--untracked-files=all"), "", "frozen control checkout is clean");
  assert.equal(git(implementationSource, "rev-parse", "HEAD"), b9StyleRevisionCommit, "B9 styling refinement is at its recorded source commit");
  assert.equal(git(implementationSource, "status", "--porcelain", "--untracked-files=all"), "", "B9 implementation checkout is clean");
  assert.equal(git(implementationSource, "rev-parse", "HEAD^"), b8Commit, "B9 refinement is a child of the frozen B8 implementation");
  assert.equal(git(implementationSource, "rev-parse", "HEAD~3"), baseCommit, "B9 implementation retains the frozen control as its base");

  const b6Manifest = await readJson<any>(join(implementationRoot, "candidate-preview-tree-manifest.json"));
  assert.equal(b6Manifest.treeSha256, receipt.approvedReference.candidatePreviewTreeSha256, "B6 candidate hash in the receipt matches its frozen manifest");
  await verifyB6Tree(b6Manifest);
  assert.equal(await hashFile(join(implementationSource, "public/fonts/Lato-Regular.ttf")), latoSha256, "B8 uses the pinned Lato bytes");
  assert.equal(await hashFile(join(b6Root, "public/fonts/Lato-Regular.ttf")), latoSha256, "B6 uses the same pinned Lato bytes");

  const renderEnvironment = await readJson<Record<string, any>>(envPath);
  assert.equal(renderEnvironment.environmentSha256, b8EnvironmentSha256, "frozen rendering environment is the B8 environment");
  assert.equal(renderEnvironment.browser.browserVersion, "151.0.7922.34");
  assert.equal(renderEnvironment.browser.playwrightVersion, "1.62.1");
  assert.equal(renderEnvironment.host.platform, process.platform);
  assert.equal(renderEnvironment.host.architecture, process.arch);
  assert.equal(renderEnvironment.host.osRelease, readCommand("uname", "-r"));
  assert.equal(renderEnvironment.host.osVersion, readCommand("sw_vers", "-productVersion"));
  assert.equal(renderEnvironment.host.osBuild, readCommand("sw_vers", "-buildVersion"));
  assert.equal(renderEnvironment.context.locale, "en-US");
  assert.equal(renderEnvironment.context.timezoneId, "America/Chicago");
  assert.equal(renderEnvironment.context.deviceScaleFactor, 1);
  assert.equal(renderEnvironment.context.colorScheme, "light");
  assert.equal(renderEnvironment.context.reducedMotion, "no-preference");
  const nodeVersion = readCommand("node", "--version");
  assert.equal(nodeVersion, "v24.21.0", "Node version matches the frozen B8 environment");
  const packageJson = await readJson<any>(join(root, "package.json"));
  assert.equal(packageJson.dependencies.playwright, renderEnvironment.browser.playwrightVersion, "Playwright package matches the frozen environment");
  assert.equal(await hashFile(chromium.executablePath()), renderEnvironment.browser.executableSha256, "Chromium executable bytes match the frozen environment");
  return { contract, contractSha256, b6TreeSha256: b6Manifest.treeSha256, renderEnvironment: { ...renderEnvironment, nodeVersion } };
}

async function drain(stream: ReadableStream<Uint8Array> | null): Promise<() => string> {
  let recent = "";
  if (!stream) return () => recent;
  const reading = (async () => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      recent = `${recent}${decoder.decode(next.value)}`.slice(-12000);
    }
  })();
  void reading.catch(() => undefined);
  return () => recent;
}

async function startCraServer(label: string, projectPath: string, port: number) {
  const origin = `http://127.0.0.1:${port}`;
  try {
    const existing = await fetch(origin, { signal: AbortSignal.timeout(400) });
    if (existing.ok) throw new Error(`Refusing to reuse an already-running server at ${origin}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
  }
  const proc = Bun.spawn([
    "node",
    join(root, "artifacts/phase-b-expense-tracker/runtime/node_modules/react-scripts/scripts/start.js"),
  ], {
    cwd: projectPath,
    env: {
      ...process.env,
      BROWSER: "none",
      CI: "true",
      HOST: "127.0.0.1",
      NODE_OPTIONS: "--openssl-legacy-provider",
      PORT: String(port),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await drain(proc.stdout);
  const stderr = await drain(proc.stderr);
  for (let attempt = 0; attempt < 120; attempt++) {
    if (proc.exitCode !== null) throw new Error(`${label} server exited early:\n${stdout()}\n${stderr()}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return { proc, origin, logs: () => `${stdout()}\n${stderr()}` };
    } catch {
      // Continue until the dev server becomes ready.
    }
    await Bun.sleep(500);
  }
  proc.kill("SIGTERM");
  throw new Error(`${label} server did not start at ${origin}:\n${stdout()}\n${stderr()}`);
}

async function stopServer(proc: ReturnType<typeof Bun.spawn> | undefined): Promise<void> {
  if (!proc || proc.exitCode !== null) return;
  proc.kill("SIGTERM");
  await Promise.race([proc.exited, Bun.sleep(4000)]);
  if (proc.exitCode === null) proc.kill("SIGKILL");
}

type Variant = "control" | "candidate" | "implementation";
const variants: Variant[] = ["control", "candidate", "implementation"];

function variantUrl(variant: Variant): string {
  if (variant === "implementation") return `${implementationBaseUrl}/`;
  return `${reviewBaseUrl}/${variant === "control" ? "control" : "candidate"}/`;
}

async function newPage(
  browser: Browser,
  variant: Variant,
  width: number,
  height: number,
  reducedMotion: "no-preference" | "reduce" = "no-preference",
): Promise<{ context: import("playwright").BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/Chicago",
    colorScheme: "light",
    reducedMotion,
    forcedColors: "none",
    contrast: "no-preference",
    isMobile: false,
    hasTouch: false,
  });
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(reviewBaseUrl) || url.startsWith(implementationBaseUrl)) {
      await route.continue();
      return;
    }
    if (url.startsWith("https://fonts.googleapis.com/")) {
      fontStylesheetRouted++;
      await route.fulfill({
        status: 200,
        contentType: "text/css",
        body: `@font-face{font-family:Lato;font-style:normal;font-weight:400;font-display:swap;src:url('${reviewBaseUrl}/fonts/Lato-Regular.ttf') format('truetype')}`,
      });
      return;
    }
    blockedExternalRequests.add(url);
    await route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(variantUrl(variant), { waitUntil: "domcontentloaded" });
  await page.locator(".container").waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.fonts.check("400 16px Lato")), true, `${variant} loaded pinned Lato`);
  return { context, page };
}

async function addTransaction(page: Page, entry: { text: string; amount: string }): Promise<void> {
  await page.getByPlaceholder("Enter text...").fill(entry.text);
  await page.getByPlaceholder("Enter amount...").fill(entry.amount);
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.locator(".transaction-row, .list li").first().waitFor({ state: "visible" });
}

async function seedTransactions(page: Page): Promise<void> {
  for (const transaction of transactions) await addTransaction(page, transaction);
}

async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const chunks: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest("button.delete-btn")) continue;
      if (!parent.getClientRects().length) continue;
      const text = node.textContent?.replace(/\s+/g, " ").trim();
      if (text) chunks.push(text);
    }
    return chunks.join(" ").replace(/\s+/g, " ").trim();
  });
}

function copyInventory(value: string): string[] {
  // CSS text-transform and harmless inline spacing are presentation, not copy
  // changes. Preserve words, signs, punctuation, and occurrences while ignoring
  // DOM order, which intentionally differs between the control and redesign.
  return (value.normalize("NFKC").toLocaleLowerCase("en-US").match(/[a-z0-9]+(?:['’][a-z0-9]+)*|[+$-]|[^\s\p{L}\p{N}]/gu) ?? []).sort();
}

async function pageStructure(page: Page): Promise<any> {
  return page.evaluate(() => {
    const rect = (element: Element | null) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const scroll = element as HTMLElement;
      return {
        x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom,
        scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth,
      };
    };
    const by = (selector: string) => rect(document.querySelector(selector));
    const controls = [...document.querySelectorAll("input, .btn")].map((element) => ({
      tag: element.tagName.toLowerCase(),
      id: (element as HTMLElement).id,
      rect: rect(element),
      scrollWidth: (element as HTMLElement).scrollWidth,
      clientWidth: (element as HTMLElement).clientWidth,
    }));
    const rows = [...document.querySelectorAll(".list li")].map((row) => {
      const button = row.querySelector("button.delete-btn");
      const icon = button?.querySelector("svg");
      const descriptionNode = row.querySelector(".transaction-description");
      const amountNode = row.querySelector(".transaction-amount");
      const rowRect = row.getBoundingClientRect();
      const descriptionRect = descriptionNode?.getBoundingClientRect();
      const amountRect = amountNode?.getBoundingClientRect();
      return {
        text: row.textContent?.replace(/\s+/g, " ").trim(),
        polarity: row.classList.contains("minus") ? "expense" : "income",
        accent: {
          width: Number.parseFloat(getComputedStyle(row).borderRightWidth),
          color: getComputedStyle(row).borderRightColor,
        },
        rect: rect(row),
        scrollWidth: (row as HTMLElement).scrollWidth,
        clientWidth: (row as HTMLElement).clientWidth,
        description: rect(descriptionNode),
        amount: rect(amountNode),
        scanUnitTogether: !!descriptionRect && !!amountRect && amountRect.x >= descriptionRect.x && amountRect.right <= rowRect.right,
        delete: rect(button ?? null),
        icon: rect(icon ?? null),
        accessibleName: button?.getAttribute("aria-label") ?? button?.textContent ?? "",
      };
    });
    const regions = {
      page: by(".page-shell, .candidate-root, .container"),
      container: by(".container"),
      entry: by(".entry"),
      summary: by(".summary"),
      history: by(".history"),
    };
    const summaryCells = [...document.querySelectorAll(".inc-exp-container > div")];
    const summarySeparators = [
      { edge: "income.right", width: getComputedStyle(summaryCells[0]!).borderRightWidth },
      { edge: "expense.left", width: getComputedStyle(summaryCells[1]!).borderLeftWidth },
    ];
    return {
      viewportWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      regions,
      controls,
      rows,
      summarySeparators,
      rowCount: rows.length,
      labels: [...document.querySelectorAll("label")].map((label) => ({
        text: (label as HTMLLabelElement).innerText.replace(/\s+/g, " ").trim(),
        htmlFor: (label as HTMLLabelElement).htmlFor,
        inputId: document.getElementById((label as HTMLLabelElement).htmlFor)?.id ?? null,
      })),
      headings: [...document.querySelectorAll("h1,h2,h3")].map((heading) => (heading as HTMLElement).innerText.replace(/\s+/g, " ").trim()),
      placeholders: [...document.querySelectorAll("input")].map((input) => input.getAttribute("placeholder")),
      balance: document.querySelector(".balance-value")?.textContent?.trim() ?? null,
      income: document.querySelector(".money.plus")?.textContent?.trim() ?? null,
      expense: document.querySelector(".money.minus")?.textContent?.trim() ?? null,
      summaryNumericStyle: [
        ...document.querySelectorAll(".balance-value, .money"),
      ].map((element) => getComputedStyle(element).fontVariantNumeric),
    };
  });
}

async function saveScreenshot(page: Page, variant: Variant, state: string, width: number, height: number): Promise<void> {
  const path = `captures/${state}-${variant}-${width}.png`;
  const bytes = await page.screenshot({ path: join(currentEvidenceDir, path), fullPage: true, animations: "disabled" });
  capturedScreenshots.push({ path, kind: "screenshot", description: `${variant} · ${state} · ${width} CSS px`, sha256: digest(bytes) });
}

async function captureComparison(browser: Awaited<ReturnType<typeof chromium.launch>>, state: "desktop-populated" | "mobile-populated" | "delete-hover" | "delete-active" | "delete-focus" | "post-submit-mobile"): Promise<void> {
  const width = state === "mobile-populated" || state === "post-submit-mobile" ? 375 : state === "delete-hover" || state === "delete-active" || state === "delete-focus" ? 768 : 1280;
  const height = width === 375 ? 812 : width === 768 ? 1024 : 900;
  for (const variant of variants) {
    const { context, page } = await newPage(browser, variant, width, height);
    try {
      if (state === "post-submit-mobile") {
        await addTransaction(page, { text: "Coffee", amount: "-4.80" });
      } else {
        await seedTransactions(page);
      }
      if (state === "delete-hover" || state === "delete-active") {
        const button = page.locator("button.delete-btn").first();
        await button.hover();
        await page.waitForTimeout(350);
        if (state === "delete-active") {
          await page.mouse.down();
          await page.waitForTimeout(130);
        }
      } else if (state === "delete-focus") {
        for (let tab = 0; tab < 8; tab++) {
          if (await page.evaluate(() => document.activeElement?.matches("button.delete-btn"))) break;
          await page.keyboard.press("Tab");
        }
      }
      await saveScreenshot(page, variant, state, width, height);
      if (state === "delete-active") await page.mouse.up();
    } finally {
      await context.close();
    }
  }
}

function parseRgb(color: string): [number, number, number, number] {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  assert.ok(match, `unsupported computed CSS color: ${color}`);
  const values = match[1]!.split(/[,\s/]+/).filter(Boolean).map(Number);
  assert.ok(values.length >= 3 && values.slice(0, 3).every(Number.isFinite), `invalid computed CSS color: ${color}`);
  return [values[0]!, values[1]!, values[2]!, values[3] ?? 1];
}

function luminance(color: string): number {
  const [red, green, blue] = parseRgb(color).slice(0, 3).map((component) => {
    const normalized = component / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

async function computedContrast(page: Page): Promise<any> {
  return page.evaluate(() => {
    const backgroundFor = (element: Element): string => {
      let current: Element | null = element;
      while (current) {
        const color = getComputedStyle(current).backgroundColor;
        const alpha = Number(color.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/)?.[1] ?? 1);
        if (!color.includes("rgba") || alpha > 0) return color;
        current = current.parentElement;
      }
      return getComputedStyle(document.documentElement).backgroundColor;
    };
    const specs: Array<[string, string]> = [
      ["page-title", ".page-title, h1"],
      ["section-headings", ".entry h2, .history h2, h3"],
      ["labels", "label"],
      ["balance-label", ".balance-label"],
      ["balance-value", ".balance-value"],
      ["financial-values", ".money"],
      ["transaction-description", ".transaction-description, .list li"],
      ["transaction-amount", ".transaction-amount, .list li span"],
      ["delete-icon", "button.delete-btn"],
      ["add-action", "button.btn"],
      ["inputs", "input"],
    ];
    const texts: Array<{ role: string; selector: string; color: string; background: string; fontSize: string; fontWeight: string }> = [];
    for (const [role, selector] of specs) {
      for (const element of [...document.querySelectorAll(selector)]) {
        const style = getComputedStyle(element);
        texts.push({ role, selector, color: style.color, background: backgroundFor(element), fontSize: style.fontSize, fontWeight: style.fontWeight });
      }
    }
    const placeholders = [...document.querySelectorAll("input")].map((element) => ({
      role: `placeholder:${element.id}`,
      color: getComputedStyle(element, "::placeholder").color,
      background: backgroundFor(element),
      fontSize: getComputedStyle(element).fontSize,
      fontWeight: getComputedStyle(element).fontWeight,
    }));
    const border = (element: Element | null, property: "borderColor" | "outlineColor", outline = false) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        color: outline ? style.outlineColor : style.borderColor,
        background: backgroundFor(element),
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        property,
      };
    };
    return {
      texts,
      placeholders,
      inputBorders: [...document.querySelectorAll("input")].map((element) => border(element, "borderColor")),
      decorativeDividers: [...document.querySelectorAll(".summary, h2, .inc-exp-container")].map((element) => ({
        color: getComputedStyle(element).borderTopColor,
        background: backgroundFor(element),
        classification: "decorative section grouping; not the sole identifier of an interactive control or state",
      })),
      transactionAccents: [...document.querySelectorAll(".transaction-row.plus, .transaction-row.minus")].map((element) => ({
        polarity: element.classList.contains("minus") ? "expense" : "income",
        color: getComputedStyle(element).borderRightColor,
        width: getComputedStyle(element).borderRightWidth,
        background: backgroundFor(element),
        classification: "redundant cue; signed values and explicit Income/Expense labels also convey meaning",
      })),
      focusedDelete: border(document.querySelector("button.delete-btn:focus-visible"), "outlineColor", true),
    };
  });
}

async function main(): Promise<void> {
  const preflightResult = await preflight();
  const verificationHarnessSha256 = await hashFile(import.meta.path);
  const allRequirementIds = [
    ...preflightResult.contract.componentRequirements,
    ...preflightResult.contract.stateRequirements,
    ...preflightResult.contract.motionRequirements,
    ...preflightResult.contract.responsiveRequirements,
    ...preflightResult.contract.accessibilityRequirements,
    ...preflightResult.contract.preservationRequirements,
  ].map(({ id }) => id);
  assert.equal(new Set(allRequirementIds).size, allRequirementIds.length, "frozen B7 requirement IDs are unique");

  const now = new Date();
  const runStamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  currentEvidenceDir = join(implementationRoot, "verification", `b9-${runStamp}`);
  await mkdir(join(currentEvidenceDir, "captures"), { recursive: true });

  let reviewServer: Awaited<ReturnType<typeof startCraServer>> | undefined;
  let implementationServer: Awaited<ReturnType<typeof startCraServer>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    reviewServer = await startCraServer("B6 review", b6Root, 4174);
    implementationServer = await startCraServer("B9 refined implementation", implementationSource, 4175);
    reviewBaseUrl = reviewServer.origin;
    implementationBaseUrl = implementationServer.origin;
    browser = await chromium.launch({ headless: true });
    assert.equal(browser.version(), preflightResult.renderEnvironment.browser.browserVersion, "Playwright Chromium version matches the frozen environment");

    measurements.source = {
      controlCommit: baseCommit,
      controlWorkingTreeClean: true,
      priorB8ImplementationCommit: b8Commit,
      implementationCommit: b9StyleRevisionCommit,
      implementationWorkingTreeClean: true,
      b6CandidateTreeSha256: preflightResult.b6TreeSha256,
      contractSha256: preflightResult.contractSha256,
    };
    measurements.runtime = {
      nodeVersion: preflightResult.renderEnvironment.nodeVersion,
      osRelease: preflightResult.renderEnvironment.host.osRelease,
      osVersion: preflightResult.renderEnvironment.host.osVersion,
      osBuild: preflightResult.renderEnvironment.host.osBuild,
      browserVersion: browser.version(),
      playwrightVersion: preflightResult.renderEnvironment.browser.playwrightVersion,
      renderingEnvironmentSha256: b8EnvironmentSha256,
      fontSha256: latoSha256,
      locale: "en-US",
      timezoneId: "America/Chicago",
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "no-preference",
    };

    const emptyStates: Record<Variant, { copy: string; placeholders: string[]; balance: string | null; rowCount: number }> = {} as any;
    for (const variant of variants) {
      const { context, page } = await newPage(browser, variant, 1280, 900);
      try {
        const structure = await pageStructure(page);
        emptyStates[variant] = {
          copy: await visibleText(page),
          placeholders: structure.placeholders,
          balance: structure.balance,
          rowCount: structure.rowCount,
        };
        await saveScreenshot(page, variant, "empty", 1280, 900);
      } finally {
        await context.close();
      }
    }
    const baselineCopyMatches = JSON.stringify(copyInventory(emptyStates.control.copy)) === JSON.stringify(copyInventory(emptyStates.candidate.copy))
      && JSON.stringify(copyInventory(emptyStates.control.copy)) === JSON.stringify(copyInventory(emptyStates.implementation.copy))
      && JSON.stringify(emptyStates.control.placeholders) === JSON.stringify(emptyStates.implementation.placeholders);
    record("req_b7copy01", "empty visible-copy and placeholder inventory matches the frozen control", baselineCopyMatches, emptyStates);
    record("req_b7state03", "empty B8 implementation keeps zero balance and no transaction rows", emptyStates.implementation.balance === "$ 0.00" && emptyStates.implementation.rowCount === 0, emptyStates);

    await captureComparison(browser, "desktop-populated");
    await captureComparison(browser, "mobile-populated");
    await captureComparison(browser, "post-submit-mobile");
    await captureComparison(browser, "delete-hover");
    await captureComparison(browser, "delete-active");
    await captureComparison(browser, "delete-focus");

    const implementationContext = await browser.newContext({
      viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "America/Chicago",
      colorScheme: "light", reducedMotion: "no-preference", forcedColors: "none", contrast: "no-preference",
    });
    await implementationContext.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.startsWith(implementationBaseUrl)) return route.continue();
      blockedExternalRequests.add(url);
      await route.abort("blockedbyclient");
    });
    const page = await implementationContext.newPage();
    page.setDefaultTimeout(8000);
    await page.goto(`${implementationBaseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.locator(".container").waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await seedTransactions(page);
    record("req_b7func01", "four positive/negative transaction entries are accepted", await page.locator(".list li").count() === 4, await pageStructure(page));

    const startingValues = await pageStructure(page);
    record("req_b7func01", "balance, income, and expense totals match independent expected values", startingValues.balance === expectedValues.balance && startingValues.income === expectedValues.income && startingValues.expense === expectedValues.expense, {
      actual: { balance: startingValues.balance, income: startingValues.income, expense: startingValues.expense },
      expected: expectedValues,
    });
    record("req_b7summary1", "financial values use tabular numerals and expose separate labels", startingValues.summaryNumericStyle.every((style: string) => style.includes("tabular-nums")) && startingValues.headings.some((heading: string) => heading.toLowerCase() === "income") && startingValues.headings.some((heading: string) => heading.toLowerCase() === "expense"), {
      summaryNumericStyle: startingValues.summaryNumericStyle,
      headings: startingValues.headings,
    });
    const summarySeparatorsAbsent = startingValues.summarySeparators.length === 2
      && startingValues.summarySeparators.every((separator: any) => Number.parseFloat(separator.width) === 0);
    record("req_b7summary1", "B9 review revision removes the redundant vertical Income/Expense separator", summarySeparatorsAbsent, startingValues.summarySeparators);
    record("req_b7a11y03", "financial meaning includes explicit labels and signed transaction values", startingValues.headings.some((heading: string) => heading.toLowerCase() === "income") && startingValues.headings.some((heading: string) => heading.toLowerCase() === "expense") && startingValues.rows.some((row: any) => row.text.includes("+") ) && startingValues.rows.some((row: any) => row.text.includes("-")), startingValues.rows.map((row: any) => row.text));
    record("req_b7entry01", "labels, sign explanation, fields, and submit action remain associated in the entry region", startingValues.labels.length >= 2 && startingValues.labels.every((label: any) => label.inputId === label.htmlFor) && startingValues.labels.some((label: any) => label.text.includes("negative - expense, positive - income")) && startingValues.controls.filter((control: any) => control.id === "text" || control.id === "amount").every((control: any) => control.rect && control.rect.x >= startingValues.regions.entry.x && control.rect.right <= startingValues.regions.entry.right) && startingValues.headings.some((heading: string) => heading.toLowerCase() === "add new transaction"), {
      labels: startingValues.labels,
      controls: startingValues.controls,
      entry: startingValues.regions.entry,
      headings: startingValues.headings,
    });

    let copyAfterData: Record<Variant, string> = {} as any;
    for (const variant of variants) {
      const { context: copyContext, page: copyPage } = await newPage(browser, variant, 1280, 900);
      try {
        await seedTransactions(copyPage);
        copyAfterData[variant] = await visibleText(copyPage);
      } finally {
        await copyContext.close();
      }
    }
    const populatedCopyMatches = JSON.stringify(copyInventory(copyAfterData.control)) === JSON.stringify(copyInventory(copyAfterData.candidate))
      && JSON.stringify(copyInventory(copyAfterData.control)) === JSON.stringify(copyInventory(copyAfterData.implementation));
    record("req_b7copy01", "populated visible text and values match the frozen control", populatedCopyMatches, copyAfterData);

    const responsive: Record<number, any> = {};
    for (const width of widths) {
      const height = width === 375 ? 812 : 900;
      await page.setViewportSize({ width, height });
      const structure = await pageStructure(page);
      responsive[width] = structure;
      const noOverflow = structure.documentScrollWidth <= width
        && structure.regions.container.scrollWidth <= structure.regions.container.clientWidth + 1
        && structure.rows.every((row: any) => row.scrollWidth <= row.clientWidth + 1)
        // A text input with a long current value scrolls internally by design;
        // its box must remain visible, but input.scrollWidth is not page clipping.
        && structure.controls.every((control: any) => control.rect.width > 0 && control.rect.x >= -0.5 && control.rect.right <= width + 0.5)
        && structure.rows.every((row: any) => row.delete.x >= row.rect.x - 0.5 && row.delete.right <= row.rect.right + 0.5);
      record("req_b7bound01", `populated geometry has no overflow/clipping at ${width}px`, noOverflow, {
        width,
        documentScrollWidth: structure.documentScrollWidth,
        container: structure.regions.container,
        rows: structure.rows.map((row: any) => ({ text: row.text, rect: row.rect, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth })),
        controls: structure.controls,
      });
      record("req_b7resp01", `all visible inputs/actions/rows remain within ${width}px`, noOverflow, { width, noOverflow });

      if (width <= 700) {
        const { entry, summary, history } = structure.regions;
        const ordered = entry.y < summary.y && summary.y < history.y;
        record("req_b7layout01", `narrow region order is entry → summary → history at ${width}px`, ordered, { width, entry, summary, history });
      } else {
        const { entry, summary, history } = structure.regions;
        const arranged = history.x < entry.x && history.width > entry.width && Math.abs(entry.x - summary.x) <= 1 && entry.bottom <= summary.y + 1 && history.right <= entry.x + 1;
        record("req_b7layout01", `wide history and secondary column relationship at ${width}px`, arranged, { width, entry, summary, history });
      }
      if (width === 375) {
        const { entry, summary, history } = structure.regions;
        record("req_b7narrow1", "approved 375px mobile ordering and no horizontal clipping", entry.y < summary.y && summary.y < history.y && noOverflow, { entry, summary, history, noOverflow });
        record("req_b7state02", "populated 375px mobile contains signed rows without clipping", structure.rowCount === transactions.length && noOverflow && structure.rows.every((row: any) => row.amount.width > 0), { rowCount: structure.rowCount, rows: structure.rows, noOverflow });
      }
      if (width === 768) {
        const { entry, summary, history } = structure.regions;
        const arranged = structure.rowCount === transactions.length && history.x < entry.x && history.width > entry.width && Math.abs(entry.x - summary.x) <= 1 && history.right <= entry.x + 1;
        record("req_b7wide001", "768px populated state keeps history broad with entry and summary nearby", arranged, { entry, summary, history, rowCount: structure.rowCount });
        record("req_b7state01", "768px populated history is the broad working region and form controls are usable", arranged && structure.controls.every((control: any) => control.rect.width > 0 && control.rect.height > 0), { entry, summary, history, controls: structure.controls });
      }
    }
    measurements.responsiveSweep = responsive;
    measurements.copy = { emptyStates, populatedCopyMatches, copyAfterData };

    const formTargets = await page.locator("#text, #amount, button.btn").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const region = document.querySelector(".entry")!.getBoundingClientRect();
      return { tag: element.tagName, id: (element as HTMLElement).id, insideEntry: rect.x >= region.x && rect.right <= region.right && rect.y >= region.y && rect.bottom <= region.bottom };
    }));
    record("req_b7entry01", "form action and fields are contained in one entry component", formTargets.every((target: any) => target.insideEntry), formTargets);

    const rowMetrics = await page.locator(".list li").evaluateAll((rows) => rows.map((row) => {
      const button = row.querySelector("button.delete-btn") as HTMLButtonElement;
      const icon = button.querySelector("svg")!;
      const description = row.querySelector(".transaction-description")?.getBoundingClientRect();
      const amount = row.querySelector(".transaction-amount")?.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return {
        text: row.textContent?.replace(/\s+/g, " ").trim() ?? "",
        width: buttonRect.width,
        height: buttonRect.height,
        insideRow: buttonRect.x >= rowRect.x && buttonRect.right <= rowRect.right && buttonRect.y >= rowRect.y && buttonRect.bottom <= rowRect.bottom,
        centered: Math.abs(iconRect.x + iconRect.width / 2 - (buttonRect.x + buttonRect.width / 2)) <= 0.5
          && Math.abs(iconRect.y + iconRect.height / 2 - (buttonRect.y + buttonRect.height / 2)) <= 0.5,
        scanUnitTogether: !!description && !!amount && amount.x >= description.x && amount.right <= rowRect.right,
        accessibleName: button.getAttribute("aria-label"),
      };
    }));
    const rowTargetsPass = rowMetrics.every((metric) => metric.width === 32 && metric.height === 32 && metric.insideRow && metric.centered && metric.accessibleName === "Delete transaction");
    const scanUnitsPass = rowMetrics.every((metric) => metric.scanUnitTogether && /[+-]/.test(metric.text));
    record("req_b7row0001", "transaction description and signed amount form a scan unit; delete targets satisfy geometry/name rules", rowTargetsPass && scanUnitsPass && rowMetrics.length === transactions.length, rowMetrics);
    record("req_b7a11y02", "each delete target is 32×32, row-contained, and its icon is centered", rowTargetsPass && rowMetrics.length === transactions.length, rowMetrics);

    await page.setViewportSize({ width: 768, height: 1024 });
    const firstDelete = page.getByRole("button", { name: "Delete transaction" }).first();
    const restStyle = await firstDelete.evaluate((button) => {
      const style = getComputedStyle(button);
      const row = button.closest("li")!;
      return { background: style.backgroundColor, color: style.color, border: style.borderColor, opacity: style.opacity, expenseAccent: getComputedStyle(row).borderRightColor };
    });
    await firstDelete.hover();
    await page.waitForTimeout(150);
    const hoverStyle = await firstDelete.evaluate((button) => {
      const style = getComputedStyle(button);
      const row = button.closest("li")!;
      return { hovered: button.matches(":hover"), background: style.backgroundColor, color: style.color, border: style.borderColor, expenseAccent: getComputedStyle(row).borderRightColor };
    });
    record("req_b7state06", "delete hover differs from rest and keeps expense accent unchanged", hoverStyle.hovered && hoverStyle.background !== restStyle.background && hoverStyle.color !== restStyle.color && hoverStyle.expenseAccent === restStyle.expenseAccent, { rest: restStyle, hover: hoverStyle });
    await saveScreenshot(page, "implementation", "delete-hover-assertion", 768, 1024);
    await page.mouse.down();
    await page.waitForTimeout(140);
    const activeStyle = await firstDelete.evaluate((button) => {
      const style = getComputedStyle(button);
      return { active: button.matches(":active"), background: style.backgroundColor, color: style.color, border: style.borderColor };
    });
    const activeDistinct = activeStyle.active && activeStyle.background !== hoverStyle.background && activeStyle.border !== hoverStyle.border;
    record("req_b7state07", "active feedback differs from hover before existing delete action", activeDistinct, { hover: hoverStyle, active: activeStyle });
    await saveScreenshot(page, "implementation", "delete-active-assertion", 768, 1024);
    await page.mouse.up();
    const afterPointerDelete = await pageStructure(page);
    const expectedAfterDelete = { balance: "$ 246,908.77", income: expectedValues.income, expense: "$ 987,659.12" };
    const pointerDeleteWorked = afterPointerDelete.rowCount === 3
      && afterPointerDelete.balance === expectedAfterDelete.balance
      && afterPointerDelete.income === expectedAfterDelete.income
      && afterPointerDelete.expense === expectedAfterDelete.expense
      && !afterPointerDelete.rows.some((row: any) => row.text.includes("Quarter-end bookkeeping subscription renewal"));
    record("req_b7state07", "pointer release deletes only the selected transaction and recalculates totals", pointerDeleteWorked, { actual: afterPointerDelete, expected: expectedAfterDelete });
    record("req_b7func01", "pointer deletion preserves existing targeted-delete and recalculation behavior", pointerDeleteWorked, { actual: afterPointerDelete, expected: expectedAfterDelete });

    const postSubmitContext = await browser.newContext({
      viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "America/Chicago",
      colorScheme: "light", reducedMotion: "no-preference", forcedColors: "none", contrast: "no-preference",
    });
    await postSubmitContext.route("**/*", async (route) => {
      if (route.request().url().startsWith(implementationBaseUrl)) return route.continue();
      blockedExternalRequests.add(route.request().url());
      await route.abort("blockedbyclient");
    });
    const postSubmitPage = await postSubmitContext.newPage();
    await postSubmitPage.goto(`${implementationBaseUrl}/`, { waitUntil: "domcontentloaded" });
    await postSubmitPage.locator(".container").waitFor({ state: "visible" });
    await postSubmitPage.evaluate(() => document.fonts.ready);
    await addTransaction(postSubmitPage, { text: "Coffee", amount: "-4.80" });
    const afterSubmit = await pageStructure(postSubmitPage);
    const regions = afterSubmit.regions;
    const confirmationInFlow = afterSubmit.rows.some((row: any) => row.text.includes("Coffee"))
      && afterSubmit.balance === "$ -4.80"
      && afterSubmit.expense === "$ 4.80"
      && regions.entry.y < regions.summary.y && regions.summary.y < regions.history.y;
    record("req_b7state04", "after mobile submit, changed balance and new row appear in the same ordered flow", confirmationInFlow, { balance: afterSubmit.balance, expense: afterSubmit.expense, rows: afterSubmit.rows, regions });
    await saveScreenshot(postSubmitPage, "implementation", "post-submit-mobile-assertion", 375, 812);
    await postSubmitContext.close();

    // Reset the page by opening a fresh populated tab for the 1280px keyboard sequence.
    const keyboardContext = await browser.newContext({
      viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "America/Chicago",
      colorScheme: "light", reducedMotion: "no-preference", forcedColors: "none", contrast: "no-preference",
    });
    await keyboardContext.route("**/*", async (route) => {
      if (route.request().url().startsWith(implementationBaseUrl)) return route.continue();
      blockedExternalRequests.add(route.request().url());
      await route.abort("blockedbyclient");
    });
    const keyboardPage = await keyboardContext.newPage();
    keyboardPage.setDefaultTimeout(8000);
    await keyboardPage.goto(`${implementationBaseUrl}/`, { waitUntil: "domcontentloaded" });
    await keyboardPage.locator(".container").waitFor({ state: "visible" });
    await keyboardPage.evaluate(() => document.fonts.ready);
    await seedTransactions(keyboardPage);
    // Pin the sequence origin to the first field. Adding rows leaves the last
    // activated submit button as the browser's sequential-focus history point.
    await keyboardPage.locator("#text").focus();
    const focusSequence: any[] = [await keyboardPage.evaluate(() => {
      const active = document.activeElement as HTMLElement;
      const box = active.getBoundingClientRect();
      return { tag: active.tagName.toLowerCase(), id: active.id || null, label: active.getAttribute("aria-label") || active.innerText || null, x: box.x, y: box.y, focusVisible: active.matches(":focus-visible") };
    })];
    for (let tab = 0; tab < 3; tab++) {
      await keyboardPage.keyboard.press("Tab");
      focusSequence.push(await keyboardPage.evaluate(() => {
        const active = document.activeElement as HTMLElement;
        const box = active.getBoundingClientRect();
        return { tag: active.tagName.toLowerCase(), id: active.id || null, label: active.getAttribute("aria-label") || active.innerText || null, x: box.x, y: box.y, focusVisible: active.matches(":focus-visible") };
      }));
    }
    const expectedFocusSequence = ["text", "amount", "button", "button"];
    const sequenceMatches = focusSequence.map((entry) => entry.id ?? entry.tag).every((value, index) => value === expectedFocusSequence[index]);
    const finalDelete = keyboardPage.getByRole("button", { name: "Delete transaction" }).first();
    const focusStyles = await finalDelete.evaluate((button) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return {
        focused: button === document.activeElement,
        focusVisible: button.matches(":focus-visible"),
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
        outlineOffset: style.outlineOffset,
        x: rect.x,
        y: rect.y,
        insideViewport: rect.x >= 0 && rect.right <= window.innerWidth && rect.y >= 0 && rect.bottom <= window.innerHeight,
        notObscuredAtTargetCenter: hit === button || button.contains(hit),
      };
    });
    const focusPass = sequenceMatches && focusStyles.focused && focusStyles.focusVisible && focusStyles.outlineWidth === "3px" && focusStyles.outlineStyle !== "none" && focusStyles.outlineOffset === "3px" && focusStyles.insideViewport && focusStyles.notObscuredAtTargetCenter;
    record("req_b7state05", "keyboard reaches delete without pointer hover and renders a distinct 3px focus-visible outline", focusPass, { sequence: focusSequence, focusStyles });
    record("req_b7a11y01", "delete is a named semantic button reachable by keyboard with the approved visible focus treatment", focusPass && await finalDelete.getAttribute("type") === "button" && await finalDelete.getAttribute("aria-label") === "Delete transaction", { sequence: focusSequence, focusStyles });
    await saveScreenshot(keyboardPage, "implementation", "wide-focus-order", 1280, 900);
    await keyboardPage.keyboard.press("Enter");
    const afterKeyboardDelete = await pageStructure(keyboardPage);
    record("req_b7func01", "keyboard activation invokes the existing delete action", afterKeyboardDelete.rowCount === 3 && !afterKeyboardDelete.rows.some((row: any) => row.text.includes("Quarter-end bookkeeping subscription renewal")), { focusStyles, afterKeyboardDelete });
    await keyboardContext.close();

    const mobileKeyboardContext = await browser.newContext({
      viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "America/Chicago",
      colorScheme: "light", reducedMotion: "no-preference", forcedColors: "none", contrast: "no-preference",
    });
    await mobileKeyboardContext.route("**/*", async (route) => {
      if (route.request().url().startsWith(implementationBaseUrl)) return route.continue();
      blockedExternalRequests.add(route.request().url());
      await route.abort("blockedbyclient");
    });
    const mobileKeyboardPage = await mobileKeyboardContext.newPage();
    await mobileKeyboardPage.goto(`${implementationBaseUrl}/`, { waitUntil: "domcontentloaded" });
    await mobileKeyboardPage.locator(".container").waitFor({ state: "visible" });
    await mobileKeyboardPage.keyboard.press("Tab");
    const mobileFirstFocus = await mobileKeyboardPage.evaluate(() => (document.activeElement as HTMLElement).id);
    record("req_b7narrow1", "mobile keyboard begins in the transaction-entry region", mobileFirstFocus === "text", { firstFocusedElement: mobileFirstFocus });
    await mobileKeyboardContext.close();

    // Use a fresh populated page for rendered computed-style and contrast measurements.
    const contrastContext = await browser.newContext({
      viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "America/Chicago",
      colorScheme: "light", reducedMotion: "no-preference", forcedColors: "none", contrast: "no-preference",
    });
    await contrastContext.route("**/*", async (route) => {
      if (route.request().url().startsWith(implementationBaseUrl)) return route.continue();
      blockedExternalRequests.add(route.request().url());
      await route.abort("blockedbyclient");
    });
    const contrastPage = await contrastContext.newPage();
    await contrastPage.goto(`${implementationBaseUrl}/`, { waitUntil: "domcontentloaded" });
    await contrastPage.locator(".container").waitFor({ state: "visible" });
    await contrastPage.evaluate(() => document.fonts.ready);
    await seedTransactions(contrastPage);
    for (let tab = 0; tab < 4; tab++) await contrastPage.keyboard.press("Tab");
    const textMetrics = await computedContrast(contrastPage);
    const textRatios = [...textMetrics.texts, ...textMetrics.placeholders].map((entry: any) => ({
      role: entry.role,
      selector: entry.selector,
      color: entry.color,
      background: entry.background,
      ratio: contrastRatio(entry.color, entry.background),
    }));
    const textContrastPass = textRatios.every((entry: any) => entry.ratio >= 4.5);
    const inputBorderRatios = textMetrics.inputBorders.map((entry: any) => ({ color: entry.color, background: entry.background, ratio: contrastRatio(entry.color, entry.background) }));
    const inputBoundaryPass = inputBorderRatios.every((entry: any) => entry.ratio >= 3);
    const transactionAccentRatios = textMetrics.transactionAccents.map((entry: any) => ({
      ...entry,
      width: Number.parseFloat(entry.width),
      ratio: contrastRatio(entry.color, entry.background),
    }));
    const accentRoles = new Set(transactionAccentRatios.map((entry: any) => entry.polarity));
    const accentPass = transactionAccentRatios.length === transactions.length
      && accentRoles.has("income") && accentRoles.has("expense")
      && transactionAccentRatios.every((entry: any) => entry.width >= 4 && entry.ratio >= 3);
    record("req_b7row0001", "income/expense edge cues are present, at least 4px wide, and contrast at least 3:1", accentPass, transactionAccentRatios);
    await contrastPage.getByRole("button", { name: "Delete transaction" }).first().focus();
    const focusedContrast = await computedContrast(contrastPage);
    const focusMetric = focusedContrast.focusedDelete;
    const focusContrastPass = !!focusMetric && focusMetric.outlineWidth === "3px" && focusMetric.outlineStyle !== "none" && contrastRatio(focusMetric.color, focusMetric.background) >= 3;
    await contrastPage.getByRole("button", { name: "Delete transaction" }).first().hover();
    const hoverContrastData = { border: hoverStyle.border, fill: hoverStyle.background, icon: hoverStyle.color, adjacent: "rgb(246, 246, 243)" };
    const hoverBoundaryRatio = contrastRatio(hoverContrastData.border, hoverContrastData.fill);
    const hoverIconRatio = contrastRatio(hoverContrastData.icon, hoverContrastData.fill);
    const activeContrastData = { border: activeStyle.border, fill: activeStyle.background, icon: activeStyle.color };
    const activeBoundaryRatio = contrastRatio(activeContrastData.border, activeContrastData.fill);
    const activeIconRatio = contrastRatio(activeContrastData.icon, activeContrastData.fill);
    const restIconRatio = contrastRatio(restStyle.color, textMetrics.texts.find((entry: any) => entry.role === "delete-icon")?.background ?? "rgb(246, 246, 243)");
    const controlContrastPass = inputBoundaryPass && accentPass && hoverBoundaryRatio >= 3 && activeBoundaryRatio >= 3 && hoverIconRatio >= 3 && activeIconRatio >= 3 && restIconRatio >= 3;
    measurements.contrast = {
      text: textRatios,
      inputBorders: inputBorderRatios,
      hover: { ...hoverContrastData, borderToFillRatio: hoverBoundaryRatio },
      active: { ...activeContrastData, borderToFillRatio: activeBoundaryRatio },
      deleteIconRatios: { rest: restIconRatio, hover: hoverIconRatio, active: activeIconRatio },
      focus: focusMetric ? { ...focusMetric, ratio: contrastRatio(focusMetric.color, focusMetric.background) } : null,
      decorativeDividers: textMetrics.decorativeDividers,
      transactionAccents: transactionAccentRatios,
      thresholds: { normalTextMinimum: 4.5, essentialNonTextMinimum: 3, focusVisibleAA: "visible and non-obscured; contrast measurement recorded separately" },
      axe: "Not run: @axe-core/playwright is not installed in the frozen experiment dependencies; these results are not a complete WCAG conformance claim.",
    };
    record("req_b7a11y04", "rendered text, placeholders, essential input/delete boundaries, focus contrast, and state contrast meet the recorded thresholds", textContrastPass && controlContrastPass && focusContrastPass, {
      textContrastPass,
      textRatios,
      inputBoundaryPass,
      inputBorderRatios,
      hoverBoundaryRatio,
      activeBoundaryRatio,
      restIconRatio,
      hoverIconRatio,
      activeIconRatio,
      focusContrastPass,
      focusMetric,
      decorativeDividers: textMetrics.decorativeDividers,
      transactionAccents: transactionAccentRatios,
      accentPass,
      summarySeparators: startingValues.summarySeparators,
      summarySeparatorsAbsent,
    });
    record("req_b7pres01", "measured preservation checks include usable semantic controls and applicable contrast", textContrastPass && controlContrastPass && focusContrastPass, {
      textContrastPass, inputBoundaryPass, hoverBoundaryRatio, activeBoundaryRatio, focusContrastPass,
    });
    await contrastContext.close();

    const reducedContext = await browser.newContext({
      viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "America/Chicago",
      colorScheme: "light", reducedMotion: "reduce", forcedColors: "none", contrast: "no-preference",
    });
    await reducedContext.route("**/*", async (route) => {
      if (route.request().url().startsWith(implementationBaseUrl)) return route.continue();
      blockedExternalRequests.add(route.request().url());
      await route.abort("blockedbyclient");
    });
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto(`${implementationBaseUrl}/`, { waitUntil: "domcontentloaded" });
    await reducedPage.locator(".container").waitFor({ state: "visible" });
    await reducedPage.evaluate(() => document.fonts.ready);
    await addTransaction(reducedPage, { text: "Coffee", amount: "-4.80" });
    const reducedButton = reducedPage.getByRole("button", { name: "Delete transaction" }).first();
    const reducedMotion = await reducedButton.evaluate((button) => ({
      requested: matchMedia("(prefers-reduced-motion: reduce)").matches,
      transitionDuration: getComputedStyle(button).transitionDuration,
      restBackground: getComputedStyle(button).backgroundColor,
    }));
    await reducedButton.hover();
    const reducedButtonRect = await reducedButton.boundingBox();
    assert.ok(reducedButtonRect, "reduced-motion delete target has a rendered box");
    await reducedPage.mouse.move(reducedButtonRect.x + reducedButtonRect.width / 2, reducedButtonRect.y + reducedButtonRect.height / 2);
    await reducedPage.waitForTimeout(50);
    const reducedHover = await reducedButton.evaluate((button) => ({
      hovered: button.matches(":hover"),
      hoverBackground: getComputedStyle(button).backgroundColor,
      hoverColor: getComputedStyle(button).color,
      focusVisible: button.matches(":focus-visible"),
    }));
    record("req_b7a11y04", "reduced motion removes transition while retaining hover state feedback", reducedMotion.requested && reducedMotion.transitionDuration.split(",").every((duration) => parseFloat(duration) <= 0.00001) && reducedHover.hovered && reducedHover.hoverBackground !== reducedMotion.restBackground, { reducedMotion, reducedHover });
    measurements.reducedMotion = { reducedMotion, reducedHover };
    await reducedContext.close();

    const blockedList = [...blockedExternalRequests].sort();
    record("req_b7pres01", "B9 browser contexts made no unapproved external requests", blockedList.length === 0, { blockedExternalRequests: blockedList, fontStylesheetRouted });
    measurements.blockedExternalRequests = blockedList;
    measurements.fontStylesheetRoutedToPinnedLocalAsset = fontStylesheetRouted;
    measurements.pointerAfterClick = afterPointerDelete;
    measurements.wideKeyboardSequence = focusSequence;
    measurements.mobileFirstFocus = mobileFirstFocus;
    measurements.axeScan = "not-run: optional @axe-core/playwright package was not present; human and deterministic checks remain necessary.";
  } finally {
    if (browser) await browser.close();
    await stopServer(implementationServer?.proc);
    await stopServer(reviewServer?.proc);
  }

  const measurementBytes = Buffer.from(`${JSON.stringify(measurements, null, 2)}\n`);
  const measurementEvidenceId = EvidenceId.parse(`ev_${digest(measurementBytes).slice(0, 16)}`);
  await writeFile(join(currentEvidenceDir, "measurements.json"), measurementBytes, { flag: "wx" });
  const evidenceArtifacts = [B9EvidenceArtifact.parse({
    id: measurementEvidenceId,
    path: "measurements.json",
    sha256: digest(measurementBytes),
    kind: "measurement",
    description: "Raw B9 browser observations and deterministic assertion details.",
  })];
  const screenshotEvidence = new Map<string, string>();
  for (const capture of capturedScreenshots) {
    const id = EvidenceId.parse(`ev_${digest(`${capture.path}\0${capture.sha256}`).slice(0, 16)}`);
    screenshotEvidence.set(capture.path, id);
    evidenceArtifacts.push(B9EvidenceArtifact.parse({
      id,
      path: capture.path,
      sha256: capture.sha256,
      kind: "screenshot",
      description: capture.description,
    }));
  }
  const screenshotsForRequirement: Record<string, string[]> = {
    req_b7layout01: ["desktop-populated-implementation-1280.png", "mobile-populated-implementation-375.png"],
    req_b7summary1: ["desktop-populated-implementation-1280.png", "mobile-populated-implementation-375.png"],
    req_b7row0001: ["mobile-populated-implementation-375.png", "delete-hover-implementation-768.png", "delete-active-implementation-768.png", "delete-focus-implementation-768.png"],
    req_b7state02: ["mobile-populated-implementation-375.png"],
    req_b7state04: ["post-submit-mobile-implementation-375.png"],
    req_b7state05: ["delete-focus-implementation-768.png"],
    req_b7state06: ["delete-hover-implementation-768.png"],
    req_b7state07: ["delete-active-implementation-768.png"],
    req_b7wide001: ["desktop-populated-implementation-1280.png"],
    req_b7narrow1: ["mobile-populated-implementation-375.png"],
    req_b7a11y01: ["delete-focus-implementation-768.png", "wide-focus-order-implementation-1280.png"],
    req_b7resp01: ["mobile-populated-implementation-375.png", "desktop-populated-implementation-1280.png"],
    req_b7copy01: ["empty-control-1280.png", "empty-implementation-1280.png"],
  };

  const resultObjects = allRequirementIds.map((requirementId) => {
    const passedChecks = successes.get(requirementId) ?? [];
    const failedChecks = failures.get(requirementId) ?? [];
    const status = failedChecks.length > 0 ? "FAIL" : pendingHumanReview.has(requirementId) ? "HUMAN-REVIEW" : "PASS";
    const screenshotRefs = (screenshotsForRequirement[requirementId] ?? [])
      .map((path) => screenshotEvidence.get(`captures/${path}`))
      .filter((value): value is string => !!value);
    const detail = failedChecks.length > 0
      ? `${failedChecks.length} deterministic assertion(s) failed. ${failedChecks.join(" | ")}`
      : `${passedChecks.length} deterministic assertion(s) passed.${status === "HUMAN-REVIEW" ? " Required qualitative judgment remains pending; automated checks do not imply approval." : ""} ${passedChecks.join(" | ")}`;
    return B9RequirementResult.parse({
      requirementId,
      status,
      method: requirementMethods[requirementId] ?? "combined",
      evidenceRefs: [measurementEvidenceId, ...screenshotRefs],
      rationale: detail,
    });
  });
  const requirements = completeB9RequirementResults(allRequirementIds, resultObjects);
  const status = summarizeB9Requirements(requirements);
  const humanReview = [
    {
      id: "b9review_threeway01",
      status: "COMPLETED",
      disposition: "PASS",
      rationale: "The human reviewer confirmed that the implementation preserved the approved wide history-led relationship and narrow entry → summary → history order, while using B7's provisional visual freedoms rather than copying the prototype mechanically.",
      question: "Did the implementation preserve the approved desktop and mobile relationships?",
      evidenceRefs: ["desktop-populated-control-1280.png", "desktop-populated-candidate-1280.png", "desktop-populated-implementation-1280.png", "mobile-populated-control-375.png", "mobile-populated-candidate-375.png", "mobile-populated-implementation-375.png"].map((path) => screenshotEvidence.get(`captures/${path}`)).filter(Boolean),
    },
    {
      id: "b9review_widefocus01",
      status: "COMPLETED",
      disposition: "PASS",
      rationale: "The human reviewer found the form-to-history focus progression spatially noticeable but logical and operable; history remains the visual focal area without needing to be the first keyboard interaction.",
      question: "At 1280px, does focus moving from the right-side entry form to the left-side history feel logical?",
      evidenceRefs: [screenshotEvidence.get("captures/wide-focus-order-implementation-1280.png")].filter(Boolean),
    },
    {
      id: "b9review_mobilecontent01",
      status: "COMPLETED",
      disposition: "PASS",
      rationale: "The human reviewer found long descriptions and large signed amounts legible at narrow width. Rapid income/expense classification was a separate localized concern and remains pending after strengthening the redundant color cue.",
      question: "At 375px, are long descriptions and large signed amounts legible?",
      evidenceRefs: ["mobile-populated-control-375.png", "mobile-populated-candidate-375.png", "mobile-populated-implementation-375.png"].map((path) => screenshotEvidence.get(`captures/${path}`)).filter(Boolean),
    },
    {
      id: "b9review_postsubmit01",
      status: "PENDING",
      question: "After adding a transaction at 375px, is the changed balance and new row immediately understandable together in the same flow?",
      evidenceRefs: ["post-submit-mobile-control-375.png", "post-submit-mobile-candidate-375.png", "post-submit-mobile-implementation-375.png"].map((path) => screenshotEvidence.get(`captures/${path}`)).filter(Boolean),
    },
    {
      id: "b9review_deletevisual01",
      status: "COMPLETED",
      disposition: "PASS",
      rationale: "The human reviewer approved the delete target's optical centering, 32×32 target, subordinate rest state, restrained hover, and distinct active/focus treatment. The newly strengthened ledger cue still needs review for visual competition with delete.",
      question: "Does the delete control retain its approved hierarchy and state treatment?",
      evidenceRefs: ["delete-hover-control-768.png", "delete-hover-candidate-768.png", "delete-hover-implementation-768.png", "delete-active-control-768.png", "delete-active-candidate-768.png", "delete-active-implementation-768.png", "delete-focus-control-768.png", "delete-focus-candidate-768.png", "delete-focus-implementation-768.png"].map((path) => screenshotEvidence.get(`captures/${path}`)).filter(Boolean),
    },
    {
      id: "b9review_polarity01",
      status: "PENDING",
      question: "Do the stronger 5px income/expense edge cues improve rapid classification while remaining redundant with signed values/labels and not competing with the delete control?",
      evidenceRefs: ["mobile-populated-implementation-375.png", "desktop-populated-implementation-1280.png", "delete-hover-implementation-768.png", "delete-active-implementation-768.png"].map((path) => screenshotEvidence.get(`captures/${path}`)).filter(Boolean),
    },
    {
      id: "b9review_summarydivider01",
      status: "PENDING",
      question: "Does the two-column Income/Expense summary remain clear and balanced after removing its vertical separator?",
      evidenceRefs: ["desktop-populated-implementation-1280.png", "mobile-populated-implementation-375.png"].map((path) => screenshotEvidence.get(`captures/${path}`)).filter(Boolean),
    },
  ].map((item) => B9HumanReviewItem.parse(item));
  const deviation = {
    id: "deviation_mobiletab01",
    requirementRefs: ["req_b7narrow1", "req_b7a11y01", "req_b7pres01"],
    detectedAt: "B8 browser smoke, before the final B8 implementation commit",
    disposition: "The initial DOM order made mobile keyboard navigation differ from the approved entry → summary → history sequence. The smoke caught it; the implementation changed source order, retained the wide CSS placement, and committed the correction before 2400196. B9 retests both narrow and wide sequences.",
  };
  const styleReviewDeviation = {
    id: "deviation_b9style01",
    requirementRefs: ["req_b7summary1", "req_b7row0001", "req_b7a11y04"],
    detectedAt: "Human review after the first B9 verification result",
    disposition: "The human reviewer approved the implemented layout, focus sequence, mobile text legibility, and delete treatment, while requesting two changes within B7's provisional styling freedom: strengthen the redundant transaction-polarity edge cue and remove the unnecessary Income/Expense divider. Only these local styling changes were made; no B6/B7 decision was reopened.",
  };
  const reportId = `verify_b9${digest(`${runId}\0${preflightResult.contractSha256}\0${b9StyleRevisionCommit}`).slice(0, 12)}`;
  const report = B9VerificationReport.parse({
    schemaVersion: 1,
    id: reportId,
    runRef: runId,
    contractRef: preflightResult.contract.id,
    checkedAt: new Date().toISOString(),
    status,
    frozenInputs: {
      contractSha256: preflightResult.contractSha256,
      verificationHarnessSha256,
      controlCommit: baseCommit,
      b6CandidateTreeSha256: preflightResult.b6TreeSha256,
      implementationBaseCommit: baseCommit,
      implementationCommit: b9StyleRevisionCommit,
      renderingEnvironmentSha256: b8EnvironmentSha256,
      fontSha256: latoSha256,
    },
    runtime: {
      browser: "Chromium",
      browserVersion: preflightResult.renderEnvironment.browser.browserVersion,
      nodeVersion: preflightResult.renderEnvironment.nodeVersion,
      platform: process.platform,
      architecture: process.arch,
      locale: "en-US",
      timezoneId: "America/Chicago",
      deviceScaleFactor: 1,
      viewportWidths: widths,
    },
    requirements,
    evidenceArtifacts,
    humanReview,
    deviations: [deviation, styleReviewDeviation],
  });

  await writeFile(join(currentEvidenceDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  const reviewMarkdown = [
    "# Expense Tracker B9 human review",
    "",
    `Report status: **${status}**`,
    "",
    "The exact control, approved B6 candidate, and B9-refined implementation are shown under the same pinned browser, Lato bytes, locale, timezone, and device scale factor. These are direct captures, not pixel-diff verdicts.",
    "",
    "## Desktop · 1280px · populated",
    "",
    ...variants.map((variant) => `- [${variant}](captures/desktop-populated-${variant}-1280.png)`),
    "",
    "## Mobile · 375px · populated",
    "",
    ...variants.map((variant) => `- [${variant}](captures/mobile-populated-${variant}-375.png)`),
    "",
    "## B9 localized revision review",
    "",
    "- [Revised summary and ledger cues · desktop](captures/desktop-populated-implementation-1280.png)",
    "- [Revised summary and ledger cues · mobile](captures/mobile-populated-implementation-375.png)",
    "- [Delete hover with revised expense cue](captures/delete-hover-implementation-768.png)",
    "",
    "## Mobile · 375px · post-submit",
    "",
    ...variants.map((variant) => `- [${variant}](captures/post-submit-mobile-${variant}-375.png)`),
    "",
    "## Delete states · 768px",
    "",
    ...["hover", "active", "focus"].flatMap((state) => [
      `### ${state}`,
      ...variants.map((variant) => `- [${variant}](captures/delete-${state}-${variant}-768.png)`),
      "",
    ]),
    "## Keyboard order · B8 at 1280px",
    "",
    "- [Wide focus order capture](captures/wide-focus-order-implementation-1280.png)",
    "",
    "Review the pending post-submit and localized revision questions in `report.json`; do not infer approval from the automated status.",
  ].join("\n");
  await writeFile(join(currentEvidenceDir, "human-review.md"), `${reviewMarkdown}\n`, { flag: "wx" });
  await writeFile(join(currentEvidenceDir, "evidence-index.json"), `${JSON.stringify(evidenceArtifacts, null, 2)}\n`, { flag: "wx" });

  const summary = {
    reportPath: relative(root, join(currentEvidenceDir, "report.json")),
    reportSha256: await hashFile(join(currentEvidenceDir, "report.json")),
    humanReviewPath: relative(root, join(currentEvidenceDir, "human-review.md")),
    status,
    requirements: requirements.map(({ requirementId, status, rationale }) => ({ requirementId, status, rationale })),
    viewportWidths: widths,
    captureCount: capturedScreenshots.length,
    blockedExternalRequests: [...blockedExternalRequests],
  };
  console.log(JSON.stringify(summary, null, 2));
  if (status === "FAIL") process.exitCode = 1;
}

await main();
