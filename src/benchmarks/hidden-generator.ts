import { randomBytes, createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BundleManifest } from "../contracts/bundle.ts";
import { GroundTruthDataset } from "../contracts/ground-truth.ts";
import { HoldoutRecord } from "../contracts/lifecycle.ts";
import { assertExternalSealedStore, assertSealedBenchmarkPathAvailable, writeSealedInput } from "../boundary/sealed-store.ts";
import { identityHash } from "../environment/hash.ts";
import { filesUnder } from "./files.ts";

type HiddenRole = "development" | "sealed-holdout";

type GeneratedSystem = {
  seed: string;
  benchmarkId: string;
  benchmarkVersion: string;
  identifiers: Record<string, string>;
  tokenDefinitions: Record<string, unknown>;
  pages: Record<string, string>;
  css: string;
  runtime: string;
  groundTruth: GroundTruthDataset;
};

function digest(seed: string, label: string): string {
  return createHash("sha256").update(`${seed}|${label}`).digest("hex");
}

function fraction(seed: string, label: string): number {
  return Number.parseInt(digest(seed, label).slice(0, 8), 16) / 0xffffffff;
}

function integer(seed: string, label: string, minimum: number, maximum: number): number {
  return Math.floor(minimum + fraction(seed, label) * (maximum - minimum + 1));
}

function generatedId(seed: string, label: string, prefix = "x"): string {
  return `${prefix}${digest(seed, label).slice(0, 10)}`;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const match = lightness - chroma / 2;
  const rgb = section < 1 ? [chroma, x, 0] : section < 2 ? [x, chroma, 0] : section < 3 ? [0, chroma, x] : section < 4 ? [0, x, chroma] : section < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${rgb.map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function truthId(seed: string, label: string): string {
  return `gt_${digest(seed, `truth:${label}`).slice(0, 16)}`;
}

function createTruth(seed: string, definitions: Record<string, any>, benchmarkRole: "development" | "sealed-holdout", benchmarkVersion: string): GroundTruthDataset {
  const concepts = [
    ["primitive.primary", "primitive", "intentional", "color", definitions.colors.primary, "action.primary", null, null, 3, true, "high-reuse"],
    ["primitive.ink", "primitive", "intentional", "color", definitions.colors.ink, "text.primary", null, null, 3, true, "high-reuse"],
    ["primitive.surface", "primitive", "intentional", "color", definitions.colors.surface, "surface.page", null, null, 3, true, "high-reuse"],
    ["primitive.border", "primitive", "intentional", "color", definitions.colors.border, "border.default", null, null, 2, false, "repeated"],
    ["primitive.spacing-unit", "primitive", "intentional", "spacing", definitions.spacing.unit, "space.unit", null, null, 3, true, "high-reuse"],
    ["primitive.radius-small", "primitive", "intentional", "radius", definitions.radii.small, "radius.small", null, null, 2, false, "repeated"],
    ["primitive.shadow-card", "primitive", "intentional", "shadow", definitions.shadows.card, "shadow.card", null, null, 2, false, "repeated"],
    ["semantic.surface-raised", "semantic", "intentional", "color", definitions.colors.raised, "surface.raised", null, null, 2, false, "repeated"],
    ["semantic.text-quiet-singleton", "semantic", "intentional", "color", definitions.colors.quiet, "text.quiet", null, null, 2, false, "legitimate-singleton"],
    ["semantic.mobile-gutter", "semantic", "intentional", "spacing", definitions.spacing.mobileGutter, "layout.mobile-gutter", null, null, 2, false, "responsive-only"],
    ["semantic.focus-ring", "semantic", "intentional", "color", definitions.colors.focus, "focus.ring", null, null, 2, false, "state-only"],
    ["component.card-feature-radius", "component", "intentional", "radius", definitions.radii.feature, "card.feature", "card", "radius", 2, false, "legitimate-singleton"],
    ["component.button-primary-background", "component", "intentional", "color", definitions.colors.primary, "button.primary", "button", "background", 3, true, "repeated"],
    ["incidental.singleton-color", "primitive", "incidental", "color", definitions.colors.debrisSingleton, "unknown", null, null, 1, false, "accidental-singleton"],
    ["incidental.repeated-color", "primitive", "incidental", "color", definitions.colors.debrisRepeated, "unknown", null, null, 1, false, "repeated-accident"],
    ["incidental.local-padding", "component", "incidental", "spacing", definitions.spacing.localOverride, "unknown", "card", "padding", 1, false, "local-override"],
    ["incidental.near-spacing", "primitive", "incidental", "spacing", definitions.spacing.nearDuplicate, "unknown", null, null, 1, false, "near-duplicate"],
    ["incidental.near-color", "primitive", "incidental", "color", definitions.colors.nearDuplicate, "unknown", null, null, 1, false, "near-duplicate"],
    ["incidental.oneoff-shadow", "component", "incidental", "shadow", definitions.shadows.oneOff, "unknown", "badge", "shadow", 1, false, "one-off-shadow"],
    ["incidental.inherited-default", "primitive", "incidental", "font-family", "browser-default", "unknown", null, null, 1, false, "inherited-default"],
  ] as const;

  return GroundTruthDataset.parse({
    schemaVersion: 1,
    benchmarkRole,
    benchmarkVersion,
    concepts: concepts.map(([label, layer, classification, valueKind, canonicalValue, semanticRole, componentRole, componentSlot, importanceWeight, major, evidence]) => ({
      id: truthId(seed, label),
      layer,
      classification,
      valueKind,
      canonicalValue,
      semanticRole,
      componentRole,
      componentSlot,
      importanceWeight,
      major,
      exercisedEvidenceIds: [`authoring:${evidence}:${label}`],
    })),
  });
}

function createSystem(seed: string, benchmarkId: string, role: HiddenRole): GeneratedSystem {
  const hue = integer(seed, "primary-hue", 175, 245);
  const secondaryHue = (hue + integer(seed, "secondary-hue-offset", 55, 135)) % 360;
  const unit = integer(seed, "spacing-unit", 4, 8);
  const names = {
    page: generatedId(seed, "page-class"),
    shell: generatedId(seed, "shell-class"),
    header: generatedId(seed, "header-class"),
    nav: generatedId(seed, "nav-class"),
    hero: generatedId(seed, "hero-class"),
    grid: generatedId(seed, "grid-class"),
    card: generatedId(seed, "card-class"),
    featureCard: generatedId(seed, "feature-card-class"),
    primary: generatedId(seed, "primary-class"),
    quiet: generatedId(seed, "quiet-class"),
    debrisOne: generatedId(seed, "debris-one-class"),
    debrisTwo: generatedId(seed, "debris-two-class"),
    badge: generatedId(seed, "badge-class"),
    localOverride: generatedId(seed, "local-override-class"),
  };
  const cssVariables = Object.fromEntries(["ink", "surface", "raised", "primary", "primaryHover", "border", "focus", "quiet", "unit", "mobileGutter", "radiusSmall", "radiusFeature", "shadowCard"].map((key) => [key, `--${generatedId(seed, `css-var:${key}`)}`]));
  const colors = {
    ink: hslToHex(integer(seed, "ink-hue", 205, 230), 0.28, 0.16),
    surface: hslToHex(integer(seed, "surface-hue", 205, 230), 0.24, 0.98),
    raised: hslToHex(integer(seed, "raised-hue", 205, 230), 0.22, 0.94),
    border: hslToHex(integer(seed, "border-hue", 205, 230), 0.25, 0.82),
    primary: hslToHex(hue, 0.73, 0.36),
    primaryHover: hslToHex(hue, 0.73, 0.29),
    focus: hslToHex(secondaryHue, 0.84, 0.45),
    quiet: hslToHex(integer(seed, "quiet-hue", 205, 230), 0.22, 0.44),
    debrisSingleton: hslToHex(integer(seed, "debris-singleton-hue", 0, 359), 0.42, 0.48),
    debrisRepeated: hslToHex(integer(seed, "debris-repeated-hue", 0, 359), 0.16, 0.78),
    nearDuplicate: hslToHex(integer(seed, "near-color-hue", 205, 230), 0.27, 0.81),
  };
  const spacing = {
    unit,
    small: unit * 2,
    medium: unit * 3,
    large: unit * 5,
    section: unit * 8,
    mobileGutter: unit * 3,
    localOverride: unit * 3 + 1,
    nearDuplicate: unit * 4 + 1,
  };
  const radii = { small: integer(seed, "radius-small", 4, 8), feature: integer(seed, "radius-feature", 12, 18), pill: 999 };
  const shadows = {
    card: `0 ${integer(seed, "card-shadow-y", 2, 4)}px ${integer(seed, "card-shadow-blur", 10, 18)}px rgba(20, 35, 60, 0.12)`,
    oneOff: "0 7px 13px rgba(18, 25, 45, 0.27)",
  };
  const definitions = { colors, spacing, radii, shadows, typography: { body: "Public Sans", heading: "Public Sans", bodySize: 16, headingSize: 36 } };
  const v = cssVariables;
  const css = `
@font-face { font-family: "Hidden Public Sans"; src: url("../assets/fonts/public-sans/PublicSans-Regular.woff2") format("woff2"); font-weight: 400; font-style: normal; }
@font-face { font-family: "Hidden Public Sans"; src: url("../assets/fonts/public-sans/PublicSans-Bold.woff2") format("woff2"); font-weight: 700; font-style: normal; }
:root { ${v.ink}: ${colors.ink}; ${v.surface}: ${colors.surface}; ${v.raised}: ${colors.raised}; ${v.primary}: ${colors.primary}; ${v.primaryHover}: ${colors.primaryHover}; ${v.border}: ${colors.border}; ${v.focus}: ${colors.focus}; ${v.quiet}: ${colors.quiet}; ${v.unit}: ${spacing.unit}px; ${v.mobileGutter}: ${spacing.mobileGutter}px; ${v.radiusSmall}: ${radii.small}px; ${v.radiusFeature}: ${radii.feature}px; ${v.shadowCard}: ${shadows.card}; }
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; color: var(${v.ink}); background: var(${v.surface}); font-family: "Hidden Public Sans", sans-serif; font-size: 16px; line-height: 1.5; }
a { color: var(${v.primary}); }
a:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid var(${v.focus}); outline-offset: 3px; }
.${names.shell} { width: min(1120px, calc(100% - 48px)); margin: 0 auto; }
.${names.header} { border-bottom: 1px solid var(${v.border}); background: var(${v.raised}); }
.${names.header} .${names.shell} { display: flex; align-items: center; justify-content: space-between; min-height: 76px; gap: ${spacing.medium}px; }
.${names.nav} { display: flex; align-items: center; gap: ${spacing.large}px; }
.${names.nav} a { text-decoration: none; font-weight: 700; }
.${names.hero} { padding: ${spacing.section}px 0; background: var(${v.raised}); }
.${names.hero} h1 { max-width: 680px; margin: 0 0 ${spacing.medium}px; font-size: clamp(2.2rem, 5vw, 4rem); line-height: 1.08; }
.${names.hero} p { max-width: 610px; margin: 0 0 ${spacing.large}px; font-size: 1.2rem; }
.${names.primary} { display: inline-block; padding: ${spacing.medium}px ${spacing.large}px; border: 0; border-radius: var(${v.radiusSmall}); background: var(${v.primary}); color: #ffffff; font-weight: 700; text-decoration: none; box-shadow: var(${v.shadowCard}); }
.${names.primary}:hover { background: var(${v.primaryHover}); }
.${names.grid} { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: ${spacing.large}px; padding: ${spacing.section}px 0; }
.${names.card} { display: flex; flex-direction: column; min-height: 250px; padding: ${spacing.large}px; border: 1px solid var(${v.border}); border-radius: var(${v.radiusSmall}); background: #ffffff; box-shadow: var(${v.shadowCard}); }
.${names.card} h2 { margin: 0 0 ${spacing.medium}px; font-size: 1.4rem; line-height: 1.2; }
.${names.card} p { flex: 1; margin: 0 0 ${spacing.large}px; }
.${names.featureCard} { border-radius: var(${v.radiusFeature}); background: var(${v.raised}); }
.${names.quiet} { color: var(${v.quiet}); }
.${names.badge} { display: inline-block; padding: 3px 9px; border-radius: var(${v.radiusSmall}); background: ${colors.debrisSingleton}; color: #fff; box-shadow: ${shadows.oneOff}; }
.${names.debrisOne}, .${names.debrisTwo} { background: ${colors.debrisRepeated}; }
.${names.localOverride} { padding: ${spacing.localOverride}px; border-color: ${colors.nearDuplicate}; }
footer { margin-top: ${spacing.section}px; padding: ${spacing.large}px 0; border-top: 1px solid var(${v.border}); background: var(${v.raised}); }
@media (max-width: 767px) { .${names.shell} { width: calc(100% - var(${v.mobileGutter}) * 2); } .${names.header} .${names.shell} { align-items: flex-start; flex-direction: column; padding: ${spacing.medium}px 0; } .${names.nav} { flex-wrap: wrap; gap: ${spacing.medium}px; } .${names.grid} { grid-template-columns: 1fr; gap: ${spacing.medium}px; } }
`;
  const card = (title: string, body: string, extra = "") => `<article class="${names.card} ${extra}"><h2>${title}</h2><p>${body}</p><a class="${names.primary}" href="#">Open details</a></article>`;
  const shell = (body: string, title: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="../assets/system.css"></head><body><header class="${names.header}"><div class="${names.shell}"><a href="home.html"><strong>Northstar</strong></a><nav class="${names.nav}" aria-label="Primary navigation"><a href="home.html">Overview</a><a href="library.html">Library</a><a href="contact.html">Contact</a></nav></div></header>${body}<footer><div class="${names.shell}"><span class="${names.quiet}">A small public information service.</span></div></footer></body></html>`;
  const pages = {
    "home.html": shell(`<main><section class="${names.hero}"><div class="${names.shell}"><h1>Useful information, clearly presented.</h1><p>Explore practical resources, compare options, and choose the next step that fits your needs.</p><a class="${names.primary}" href="#services">Explore resources</a></div></section><section class="${names.shell}" id="services"><div class="${names.grid}">${card("Plan a visit", "Prepare with a short checklist and a clear timeline.")}${card("Compare options", "Review the details that matter before making a decision.", names.featureCard)}${card("Get assistance", "Find a contact path when the self-service route is not enough.", names.localOverride)}</div><p class="${names.debrisOne}">This repeated accent is a local decorative treatment.</p><p class="${names.debrisTwo}">This repeated accent is intentionally unrelated.</p></section></main>`, "Northstar overview"),
    "library.html": shell(`<main class="${names.shell}"><section class="${names.hero}"><div><h1>Resource library</h1><p>Browse a focused collection of guides and reference material.</p><span class="${names.badge}">Updated weekly</span></div></section><section class="${names.grid}">${card("Getting started", "A concise guide for first-time visitors.")}${card("Eligibility", "A checklist for understanding requirements.")}${card("Next steps", "A path from research to action.")}</section></main>`, "Northstar library"),
    "contact.html": shell(`<main class="${names.shell}"><section class="${names.hero}"><div><h1>Contact the team</h1><p class="${names.quiet}">Use the form below when you need help with a specific question.</p><form><label for="email">Email address</label><input id="email" type="email"><button class="${names.primary}" type="submit">Send request</button></form></div></section><section class="${names.grid}"><article class="${names.card}"><h2>Phone</h2><p>Call during weekday support hours.</p><a href="#">View hours</a></article><article class="${names.card}"><h2>Message</h2><p>Send a question and expect a response soon.</p><a href="#">Start a message</a></article></section></main>`, "Northstar contact"),
  };
  const benchmarkVersion = role === "development" ? "coherent-system-v1-development" : "coherent-system-v1-holdout";
  return {
    seed,
    benchmarkId,
    benchmarkVersion,
    identifiers: names,
    tokenDefinitions: { cssVariables, ...definitions },
    pages,
    css,
    runtime: "document.documentElement.dataset.runtimeReady = 'true';\n",
    groundTruth: createTruth(seed, definitions, role, benchmarkVersion),
  };
}

async function writeRendered(system: GeneratedSystem, renderedRoot: string, environmentSha256: string, sourcePackage: BundleManifest["sourcePackage"], privateInputsOutsideWorkspace: boolean): Promise<BundleManifest> {
  await mkdir(join(renderedRoot, "pages"), { recursive: true });
  await mkdir(join(renderedRoot, "assets", "fonts"), { recursive: true });
  const calibrationFonts = resolve(import.meta.dirname, "../..", "benchmarks/calibration/uswds-v3.14.0/rendered/assets/uswds/fonts");
  await cp(calibrationFonts, join(renderedRoot, "assets", "fonts"), { recursive: true });
  await writeFile(join(renderedRoot, "assets", "system.css"), system.css, "utf8");
  await writeFile(join(renderedRoot, "assets", "runtime.js"), system.runtime, "utf8");
  for (const [name, html] of Object.entries(system.pages)) await writeFile(join(renderedRoot, "pages", name), html, "utf8");
  const files = await filesUnder(renderedRoot);
  const manifest = BundleManifest.parse({
    schemaVersion: 1,
    benchmarkId: system.benchmarkId,
    benchmarkRole: system.groundTruth.benchmarkRole,
    benchmarkVersion: system.benchmarkVersion,
    createdAt: new Date().toISOString(),
    renderingEnvironmentSha256: environmentSha256,
    files,
    bundleSha256: identityHash(files),
    sourcePackage,
    privateInputsOutsideWorkspace,
  });
  await writeFile(join(renderedRoot, "bundle-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function generateHiddenBenchmark(role: HiddenRole, options: { seed?: string; benchmarkId: string; renderedRoot: string; privateStore?: string; environmentSha256: string }): Promise<BundleManifest> {
  if (role === "sealed-holdout" && !options.privateStore) throw new Error("A sealed holdout requires DORKFLOW_SEALED_STORE outside the workspace");
  if (role === "sealed-holdout") {
    await assertSealedBenchmarkPathAvailable(options.privateStore!, options.benchmarkId);
    assertExternalSealedStore(options.renderedRoot);
  }
  const seed = role === "development" ? options.seed ?? "development-seed-v1" : randomBytes(16).toString("hex");
  const system = createSystem(seed, options.benchmarkId, role);
  const manifest = await writeRendered(system, options.renderedRoot, options.environmentSha256, null, role === "sealed-holdout");
  const sourceRecord = { schemaVersion: 1, benchmarkId: system.benchmarkId, benchmarkVersion: system.benchmarkVersion, generatorVersion: "hidden-recipe-v1", seed: system.seed, identifiers: system.identifiers, tokenDefinitions: system.tokenDefinitions, pages: Object.keys(system.pages), groundTruthIds: system.groundTruth.concepts.map((concept) => concept.id) };
  const seedRecord = { schemaVersion: 1, benchmarkId: system.benchmarkId, benchmarkVersion: system.benchmarkVersion, seed: system.seed };
  if (role === "sealed-holdout") {
    await writeSealedInput(options.privateStore!, system.benchmarkId, "seed", `${JSON.stringify(seedRecord, null, 2)}\n`);
    await writeSealedInput(options.privateStore!, system.benchmarkId, "source", `${JSON.stringify(sourceRecord, null, 2)}\n`);
    await writeSealedInput(options.privateStore!, system.benchmarkId, "ground-truth", `${JSON.stringify(system.groundTruth, null, 2)}\n`);
  } else {
    const developmentRoot = resolve(import.meta.dirname, "../..", "benchmarks/development/coherent-system-v1");
    await writeFile(join(developmentRoot, "seed.json"), `${JSON.stringify(seedRecord, null, 2)}\n`, "utf8");
    await writeFile(join(developmentRoot, "source.json"), `${JSON.stringify(sourceRecord, null, 2)}\n`, "utf8");
    await writeFile(join(developmentRoot, "ground-truth.json"), `${JSON.stringify(system.groundTruth, null, 2)}\n`, "utf8");
  }
  return manifest;
}

export function makePublicHoldoutRecord(manifest: BundleManifest): HoldoutRecord {
  return HoldoutRecord.parse({
    schemaVersion: 1,
    benchmarkId: manifest.benchmarkId,
    role: manifest.benchmarkRole,
    state: manifest.benchmarkRole === "sealed-holdout" ? "SEALED" : "CREATED",
    benchmarkVersion: manifest.benchmarkVersion,
    createdAt: manifest.createdAt,
    seedRecordPath: manifest.benchmarkRole === "sealed-holdout" ? `${manifest.benchmarkId}/seed.json` : `benchmarks/development/coherent-system-v1/seed.json`,
    sourceRecordPath: manifest.benchmarkRole === "sealed-holdout" ? `${manifest.benchmarkId}/source.json` : `benchmarks/development/coherent-system-v1/source.json`,
    groundTruthPath: manifest.benchmarkRole === "sealed-holdout" ? `${manifest.benchmarkId}/ground-truth.json` : `benchmarks/development/coherent-system-v1/ground-truth.json`,
    bundleHash: manifest.bundleSha256,
    evaluationLockHash: null,
    resultHash: null,
  });
}
