import { access, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import {
  CaptureId,
  CapturePurpose,
  DesignRunId,
  PerceptualEvidence,
  StateMatrix,
  type PerceptualEvidence as PerceptualEvidenceArtifact,
  type StateDefinition,
  type StateMatrix as StateMatrixArtifact,
} from "../contracts/design/index.ts";
import { RenderingEnvironment } from "../contracts/environment.ts";
import { applyPerceptualSanitizer, PERCEPTUAL_SANITIZER_CSS, PERCEPTUAL_SANITIZER_SHA256, PERCEPTUAL_SANITIZER_VERSION } from "./perceptual-sanitizer.ts";
import { captureEnvironment } from "../environment/capture.ts";
import { identityHash, sha256Bytes, sha256Text, stableJson } from "../environment/hash.ts";

export type CaptureTrustMode = "trusted-project" | "sanitized-external" | "generated";

export type CaptureStateRecord = {
  captureId: string;
  stateRef: string;
  viewportRef: string;
  quarantinePath: string;
  quarantineSha256: string;
  perceptualPath: string;
  perceptualSha256: string;
  pinnedFontRequests: { stylesheet: number; font: number } | null;
};

export type StateMatrixCaptureResult = {
  evidence: PerceptualEvidenceArtifact;
  records: CaptureStateRecord[];
  matrixSha256: string;
  environmentSha256: string;
  sanitizerVersion: string | null;
  sanitizerSha256: string | null;
};

type CaptureOptions = {
  baseUrl: string;
  matrix: StateMatrixArtifact | unknown;
  runDirectory: string;
  environment: unknown;
  fontDirectory?: string;
  pinnedLatoFontPath?: string;
  trustMode: CaptureTrustMode;
  purpose: string;
  approveOriginalPixels?: boolean;
  allowedOrigins?: string[];
};

const repositoryRoot = resolve(import.meta.dirname, "../..");
const defaultFontDirectory = join(repositoryRoot, "benchmarks/calibration/uswds-v3.14.0/source/package/dist/fonts");
const MAX_CAPTURE_PIXELS = 25_000_000;
const MAX_SCREENSHOT_BYTES = 50 * 1024 * 1024;
const CAPTURE_ENGINE_VERSION = "phase-b-state-capture-v4-pinned-lato-evidence-identity";
const EXPECTED_PINNED_LATO_SHA256 = "d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251";

type PinnedLatoAsset = {
  bytes: Buffer;
  relativeName: string;
  sha256: string;
};

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function assertBaseUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Capture base URL must be an HTTP(S) URL without embedded credentials");
  }
  if (!isLoopback(url.hostname)) {
    throw new Error("B1 capture currently requires a loopback server; remote references need a network-isolated crawler first");
  }
  return url;
}

async function ensureAbsent(path: string): Promise<void> {
  try {
    await access(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Refusing to overwrite existing capture artifact: ${path}`);
}

function viewportKey(state: StateDefinition): string {
  return `vp_${sha256Text(`${state.viewport.label}:${state.viewport.width}x${state.viewport.height}`).slice(0, 16)}`;
}

function captureKey(
  state: StateDefinition,
  matrixSha256: string,
  environmentSha256: string,
  trustMode: CaptureTrustMode,
  pinnedFontSha256: string | null,
): string {
  const captureProfile = stableJson({
    engine: CAPTURE_ENGINE_VERSION,
    pinnedFontSha256,
    trustMode,
  });
  return CaptureId.parse(`cap_${sha256Text(`${state.id}|${matrixSha256}|${environmentSha256}|${captureProfile}`).slice(0, 16)}`);
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) {
    throw new Error("Playwright returned an invalid PNG screenshot");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function uniqueLocator(page: Page, selector: string): Promise<Locator> {
  const locator = page.locator(selector);
  const count = await locator.count();
  if (count !== 1) throw new Error(`Capture selector must resolve to exactly one element (count=${count})`);
  return locator;
}

async function executeAction(page: Page, state: StateDefinition, action: StateDefinition["setupActions"][number]): Promise<void> {
  if (action.type === "mouse-up") {
    await page.mouse.up();
    return;
  }
  const locator = await uniqueLocator(page, action.selector);
  switch (action.type) {
    case "click":
      await locator.click();
      break;
    case "hover":
      await locator.hover();
      break;
    case "mouse-down": {
      await locator.scrollIntoViewIfNeeded();
      const bounds = await locator.boundingBox();
      if (!bounds) throw new Error(`Cannot press pointer on an element without visible bounds in ${state.id}`);
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      break;
    }
    case "focus":
      await locator.focus();
      break;
    case "fill":
      await locator.fill(action.value);
      break;
    case "press":
      await locator.press(action.key);
      break;
    case "check":
      await locator.check();
      break;
    case "uncheck":
      await locator.uncheck();
      break;
    case "select-option":
      await locator.selectOption(action.value);
      break;
    case "tab":
      await locator.focus();
      await page.keyboard.press(action.key);
      break;
    default: {
      const exhaustive: never = action;
      throw new Error(`Unsupported capture action in ${state.id}: ${String(exhaustive)}`);
    }
  }
}

async function verifyAssertions(page: Page, state: StateDefinition): Promise<void> {
  for (const assertion of state.assertions) {
    const locator = await uniqueLocator(page, assertion.selector);
    switch (assertion.condition) {
      case "visible":
        if (!(await locator.isVisible())) throw new Error(`Expected visible state in ${state.id}`);
        break;
      case "hidden":
        if (await locator.isVisible()) throw new Error(`Expected hidden state in ${state.id}`);
        break;
      case "enabled":
        if (!(await locator.isEnabled())) throw new Error(`Expected enabled state in ${state.id}`);
        break;
      case "disabled":
        if (await locator.isEnabled()) throw new Error(`Expected disabled state in ${state.id}`);
        break;
      case "checked":
        if (!(await locator.isChecked())) throw new Error(`Expected checked state in ${state.id}`);
        break;
      case "unchecked":
        if (await locator.isChecked()) throw new Error(`Expected unchecked state in ${state.id}`);
        break;
      case "hovered":
        if (!(await locator.evaluate((element) => element.matches(":hover")))) throw new Error(`Expected hovered state in ${state.id}`);
        break;
      case "focused":
        if (!(await locator.evaluate((element) => element.matches(":focus")))) throw new Error(`Expected focused state in ${state.id}`);
        break;
      case "focus-visible":
        if (!(await locator.evaluate((element) => element.matches(":focus-visible")))) throw new Error(`Expected focus-visible state in ${state.id}`);
        break;
      case "active":
        if (!(await locator.evaluate((element) => element.matches(":active")))) throw new Error(`Expected active state in ${state.id}`);
        break;
      case "attribute": {
        const actual = await locator.getAttribute(assertion.name);
        if (actual === null || sha256Text(actual) !== assertion.value) {
          throw new Error(`Expected attribute assertion failed in ${state.id}`);
        }
        break;
      }
      default: {
        const exhaustive: never = assertion;
        throw new Error(`Unsupported state assertion: ${String(exhaustive)}`);
      }
    }
  }
}

async function verifyRenderingEnvironment(
  environment: ReturnType<typeof RenderingEnvironment.parse>,
  fontDirectory: string,
): Promise<void> {
  const actual = await captureEnvironment(fontDirectory);
  if (actual.environmentSha256 !== environment.environmentSha256) {
    throw new Error(`Rendering environment mismatch: expected ${environment.environmentSha256}, got ${actual.environmentSha256}`);
  }
}

async function loadPinnedLatoAsset(
  path: string | undefined,
  fontDirectory: string,
  environment: ReturnType<typeof RenderingEnvironment.parse>,
): Promise<PinnedLatoAsset | null> {
  if (path === undefined) return null;
  const resolvedPath = resolve(path);
  const relativePath = relative(fontDirectory, resolvedPath);
  if (relativePath === "" || relativePath.startsWith(`..${sep}`) || relativePath === ".." || isAbsolute(relativePath)) {
    throw new Error("Pinned Lato font must be inside the fingerprinted font directory");
  }
  const info = await lstat(resolvedPath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error("Pinned Lato font must be a regular, non-symlink file");
  }
  const bytes = await readFile(resolvedPath);
  const sha256 = sha256Bytes(bytes);
  const relativeName = relativePath.split(sep).join("/");
  if (sha256 !== EXPECTED_PINNED_LATO_SHA256) {
    throw new Error("Pinned Lato font does not match the frozen Lato Regular asset");
  }
  if (!environment.fonts.files.some((font) => font.name === relativeName && font.sha256 === sha256)) {
    throw new Error("Pinned Lato font bytes are not present in the frozen rendering-environment fingerprint");
  }
  return { bytes, relativeName, sha256 };
}

async function setupBrowser(baseUrl: URL, allowedOrigins: Set<string>): Promise<Browser> {
  for (const origin of allowedOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Invalid allowed origin: ${origin}`);
    }
  }
  if (!allowedOrigins.has(baseUrl.origin)) throw new Error("The base origin must be in the network allowlist");
  return chromium.launch({ headless: true, chromiumSandbox: true });
}

async function verifyCaptureBounds(page: Page, state: StateDefinition): Promise<void> {
  const bounds = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      width: Math.max(root.scrollWidth, root.clientWidth, body?.scrollWidth ?? 0),
      height: Math.max(root.scrollHeight, root.clientHeight, body?.scrollHeight ?? 0),
    };
  });
  if (bounds.width * bounds.height > MAX_CAPTURE_PIXELS) {
    throw new Error(`State ${state.id} exceeds the safe full-page capture area limit`);
  }
}

export async function captureStateMatrix(options: CaptureOptions): Promise<StateMatrixCaptureResult> {
  const matrix = StateMatrix.parse(options.matrix);
  const environment = RenderingEnvironment.parse(options.environment);
  const purpose = CapturePurpose.parse(options.purpose);
  const baseUrl = assertBaseUrl(options.baseUrl);
  if (options.trustMode !== "sanitized-external" && options.approveOriginalPixels !== true) {
    throw new Error(`${options.trustMode} captures require explicit approval to expose original pixels`);
  }
  if (options.trustMode === "sanitized-external" && purpose === "imagery") {
    throw new Error("sanitized-external captures hide source imagery and cannot be used for imagery critique");
  }
  const runDirectory = resolve(options.runDirectory);
  const fontDirectory = resolve(options.fontDirectory ?? defaultFontDirectory);
  const pinnedLato = await loadPinnedLatoAsset(options.pinnedLatoFontPath, fontDirectory, environment);
  const allowedOrigins = new Set([baseUrl.origin, ...(options.allowedOrigins ?? [])]);
  for (const origin of allowedOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol) || !isLoopback(parsed.hostname)) {
      throw new Error("Capture allowlist entries must be canonical loopback HTTP(S) origins");
    }
  }
  await ensureAbsent(runDirectory);
  await verifyRenderingEnvironment(environment, fontDirectory);
  await mkdir(runDirectory, { recursive: true, mode: 0o700 });

  const viewportSpecs = new Set(environment.viewports.map((viewport) => `${viewport.label}:${viewport.width}x${viewport.height}`));
  const seenStateIds = new Set<string>();
  for (const state of matrix.states) {
    if (seenStateIds.has(state.id)) throw new Error(`State IDs must be unique: ${state.id}`);
    seenStateIds.add(state.id);
    if (!viewportSpecs.has(`${state.viewport.label}:${state.viewport.width}x${state.viewport.height}`)) {
      throw new Error(`State ${state.id} uses a viewport absent from the frozen rendering environment`);
    }
  }

  const matrixSha256 = identityHash(matrix);
  const runId = DesignRunId.parse(`run_${randomUUID().replaceAll("-", "").slice(0, 16)}`);
  const quarantineRoot = join(runDirectory, "quarantine");
  const quarantineDirectory = join(runDirectory, "quarantine", "captures");
  await mkdir(quarantineDirectory, { recursive: true, mode: 0o700 });
  await writeFile(join(runDirectory, "quarantine", "state-matrix.json"), `${JSON.stringify(matrix, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(join(quarantineRoot, "rendering-environment.json"), `${JSON.stringify(environment, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(join(quarantineRoot, "manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    runId,
    createdAt: new Date().toISOString(),
    captureEngineVersion: CAPTURE_ENGINE_VERSION,
    chromiumSandbox: true,
    networkPolicy: "origin-allowlist; GET/HEAD only; websockets blocked",
    pinnedFontInjection: pinnedLato === null ? null : {
      family: "Lato",
      path: pinnedLato.relativeName,
      sha256: pinnedLato.sha256,
      sourceStylesheet: "https://fonts.googleapis.com/css?family=Lato&display=swap",
      strategy: "capture-only stylesheet interception; font bytes served from a same-origin route",
    },
    sourceOrigin: baseUrl.origin,
    allowedOrigins: [...allowedOrigins].sort(),
    purpose,
    trustMode: options.trustMode,
    originalPixelsApproved: options.approveOriginalPixels === true,
    stateMatrixSha256: matrixSha256,
    renderingEnvironmentSha256: environment.environmentSha256,
    renderingEnvironmentPath: "rendering-environment.json",
    sanitizerVersion: options.trustMode === "sanitized-external" ? PERCEPTUAL_SANITIZER_VERSION : null,
    sanitizerSha256: options.trustMode === "sanitized-external" ? PERCEPTUAL_SANITIZER_SHA256 : null,
  }, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  const browser = await setupBrowser(baseUrl, allowedOrigins);
  const captureFiles: unknown[] = [];
  const records: CaptureStateRecord[] = [];
  const perceptualDirectory = join(runDirectory, "perceptual", "captures");
  await mkdir(quarantineDirectory, { recursive: true });
  await mkdir(perceptualDirectory, { recursive: true });

  try {
    for (const state of matrix.states) {
      const captureId = captureKey(
        state,
        matrixSha256,
        environment.environmentSha256,
        options.trustMode,
        pinnedLato?.sha256 ?? null,
      );
      const viewportRef = viewportKey(state);
      const fileName = `${captureId}.png`;
      const quarantinePath = join(quarantineDirectory, fileName);
      const perceptualPath = join(perceptualDirectory, fileName);
      await Promise.all([ensureAbsent(quarantinePath), ensureAbsent(perceptualPath)]);

      const context = await browser.newContext({
        viewport: { width: state.viewport.width, height: state.viewport.height },
        deviceScaleFactor: environment.context.deviceScaleFactor,
        locale: environment.context.locale,
        timezoneId: environment.context.timezoneId,
        colorScheme: environment.context.colorScheme,
        reducedMotion: environment.context.reducedMotion,
        forcedColors: environment.context.forcedColors,
        contrast: environment.context.contrast,
        javaScriptEnabled: environment.context.javaScriptEnabled,
        hasTouch: environment.context.hasTouch,
        isMobile: environment.context.isMobile,
        acceptDownloads: false,
        serviceWorkers: "block",
        permissions: [],
      });
      try {
        const fontRequests = { stylesheet: 0, font: 0 };
        const localFontUrl = new URL("/__dorkflow/pinned-fonts/Lato-Regular.ttf", baseUrl).toString();
        await context.route("**/*", async (route) => {
          const request = route.request();
          let requestUrl: URL;
          try {
            requestUrl = new URL(request.url());
          } catch {
            await route.abort();
            return;
          }
          if (pinnedLato !== null && request.method() === "GET" &&
              requestUrl.origin === "https://fonts.googleapis.com" && requestUrl.pathname === "/css" &&
              requestUrl.searchParams.get("family") === "Lato" && requestUrl.searchParams.get("display") === "swap") {
            fontRequests.stylesheet += 1;
            const css = `@font-face{font-family:'Lato';font-style:normal;font-weight:400;font-display:swap;src:url('${localFontUrl}') format('truetype');}`;
            await route.fulfill({
              status: 200,
              contentType: "text/css; charset=utf-8",
              headers: { "access-control-allow-origin": "*" },
              body: css,
            });
            return;
          }
          if (pinnedLato !== null && request.method() === "GET" &&
              requestUrl.href === localFontUrl) {
            fontRequests.font += 1;
            await route.fulfill({
              status: 200,
              contentType: "font/ttf",
              body: pinnedLato.bytes,
            });
            return;
          }
          if (!allowedOrigins.has(requestUrl.origin) || !["http:", "https:"].includes(requestUrl.protocol) || !["GET", "HEAD"].includes(request.method())) {
            await route.abort();
            return;
          }
          await route.continue();
        });
        await context.routeWebSocket("**/*", async (webSocket) => {
          await webSocket.close({ code: 1008, reason: "Blocked by Dorkflow capture policy" });
        });
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        page.setDefaultNavigationTimeout(15000);
        page.on("dialog", (dialog) => dialog.dismiss());
        page.on("popup", (popup) => {
          void popup.close().catch(() => undefined);
        });
        const targetUrl = new URL(state.pagePath, baseUrl);
        if (targetUrl.origin !== baseUrl.origin) throw new Error(`State ${state.id} escaped the configured base origin`);
        await page.goto(targetUrl.toString(), { waitUntil: "domcontentloaded" });
        for (const action of state.setupActions) await executeAction(page, state, action);
        if (state.settleMs > 0) await page.waitForTimeout(state.settleMs);
        if (state.targetSelector !== null) await uniqueLocator(page, state.targetSelector);
        await verifyAssertions(page, state);
        await page.evaluate(() => document.fonts.ready);
        if (pinnedLato !== null) {
          const loaded = await page.evaluate(() => Array.from(document.fonts).some((face) =>
            face.family.replaceAll('"', "").replaceAll("'", "") === "Lato" && face.status === "loaded",
          ));
          if (!loaded || fontRequests.stylesheet !== 1 || fontRequests.font !== 1) {
            throw new Error(`Pinned Lato was not loaded exactly once in ${state.id}`);
          }
        }
        await verifyCaptureBounds(page, state);

        const rawBytes = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide", type: "png" });
        if (rawBytes.byteLength > MAX_SCREENSHOT_BYTES) {
          throw new Error(`State ${state.id} exceeds the safe screenshot byte limit`);
        }
        await writeFile(quarantinePath, rawBytes, { flag: "wx", mode: 0o600 });
        let perceptualBytes = rawBytes;
        if (options.trustMode === "sanitized-external") {
          await applyPerceptualSanitizer(page);
          perceptualBytes = await page.screenshot({
            fullPage: true,
            animations: "disabled",
            caret: "hide",
            style: PERCEPTUAL_SANITIZER_CSS,
            type: "png",
          });
        }
        if (perceptualBytes.byteLength > MAX_SCREENSHOT_BYTES) {
          throw new Error(`Sanitized state ${state.id} exceeds the safe screenshot byte limit`);
        }
        await writeFile(perceptualPath, perceptualBytes, { flag: "wx", mode: 0o600 });
        const dimensions = readPngDimensions(perceptualBytes);
        const perceptualSha256 = sha256Bytes(perceptualBytes);
        const relativePerceptualPath = `captures/${fileName}`;
        captureFiles.push({
          id: captureId,
          sha256: perceptualSha256,
          path: relativePerceptualPath,
          stateRef: state.id,
          stateKind: state.stateKind,
          triggerKinds: state.setupActions.length === 0 ? ["initial"] : state.setupActions.map((action) => action.type),
          viewportRef,
          viewport: {
            label: state.viewport.label,
            width: state.viewport.width,
            height: state.viewport.height,
          },
          mediaType: "image/png",
          width: dimensions.width,
          height: dimensions.height,
        });
        records.push({
          captureId,
          stateRef: state.id,
          viewportRef,
          quarantinePath: relative(runDirectory, quarantinePath),
          quarantineSha256: sha256Bytes(rawBytes),
          perceptualPath: relative(runDirectory, perceptualPath),
          perceptualSha256,
          pinnedFontRequests: pinnedLato === null ? null : fontRequests,
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const evidenceContent = {
    schemaVersion: 1,
    purpose,
    trustMode: options.trustMode,
    contentTreatment: options.trustMode === "sanitized-external"
      ? "light-dom-geometry-placeholders-shadow-dom-text-suppressed"
      : "original",
    originalPixelsApproved: options.approveOriginalPixels === true,
    renderingEnvironmentSha256: environment.environmentSha256,
    sanitizer: options.trustMode === "sanitized-external"
      ? { version: PERCEPTUAL_SANITIZER_VERSION, sha256: PERCEPTUAL_SANITIZER_SHA256 }
      : null,
    captures: captureFiles,
  };
  const evidence = PerceptualEvidence.parse({
    ...evidenceContent,
    id: `ev_${sha256Text(stableJson(evidenceContent)).slice(0, 16)}`,
  });
  const result: StateMatrixCaptureResult = {
    evidence,
    records,
    matrixSha256,
    environmentSha256: environment.environmentSha256,
    sanitizerVersion: options.trustMode === "sanitized-external" ? PERCEPTUAL_SANITIZER_VERSION : null,
    sanitizerSha256: options.trustMode === "sanitized-external" ? PERCEPTUAL_SANITIZER_SHA256 : null,
  };
  const evidencePath = join(runDirectory, "perceptual", "evidence.json");
  const recordPath = join(runDirectory, "quarantine", "capture-index.json");
  await Promise.all([ensureAbsent(evidencePath), ensureAbsent(recordPath)]);
  await mkdir(dirname(evidencePath), { recursive: true });
  await mkdir(dirname(recordPath), { recursive: true });
  await Promise.all([
    writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 }),
    writeFile(recordPath, `${JSON.stringify({
    schemaVersion: 1,
      runId,
      baseOriginSha256: sha256Text(baseUrl.origin),
      matrixSha256,
      environmentSha256: environment.environmentSha256,
      sanitizerVersion: result.sanitizerVersion,
      sanitizerSha256: result.sanitizerSha256,
      pinnedFont: pinnedLato === null ? null : {
        family: "Lato",
        path: pinnedLato.relativeName,
        sha256: pinnedLato.sha256,
        stylesheetRequests: records.reduce((sum, record) => sum + (record.pinnedFontRequests?.stylesheet ?? 0), 0),
        fontRequests: records.reduce((sum, record) => sum + (record.pinnedFontRequests?.font ?? 0), 0),
      },
      records,
    }, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 }),
  ]);
  return result;
}
