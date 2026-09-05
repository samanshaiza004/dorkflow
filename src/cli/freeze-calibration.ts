import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { BundleManifest } from "../contracts/bundle.ts";
import { RenderingEnvironment } from "../contracts/environment.ts";
import { identityHash, sha256File } from "../environment/hash.ts";

const repository = resolve(import.meta.dirname, "../..");
const benchmarkRoot = join(repository, "benchmarks", "calibration", "uswds-v3.14.0");
const sourceRoot = join(benchmarkRoot, "source");
const renderedRoot = join(benchmarkRoot, "rendered");
const packagePath = join(sourceRoot, "uswds-uswds-3.14.0.tgz");
const expectedPackageSha256 = "da91c65e6fc736fa397f0daf6ca2c2c95711506d85c7ad2537a4570725401e1c";
const packageUrl = "https://github.com/uswds/uswds/releases/download/v3.14.0/uswds-uswds-3.14.0.tgz";

async function filesUnder(directory: string, prefix = ""): Promise<Array<{ path: string; sha256: string; bytes: number }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const result: Array<{ path: string; sha256: string; bytes: number }> = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = join(directory, entry.name);
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await filesUnder(absolute, path));
    else if (entry.isFile()) result.push({ path, sha256: await sha256File(absolute), bytes: (await stat(absolute)).size });
  }
  return result;
}

const packageSha256 = await sha256File(packagePath);
if (packageSha256 !== expectedPackageSha256) throw new Error(`USWDS package checksum mismatch: ${packageSha256}`);

const environmentPath = join(repository, "benchmarks", "rendering-environment.json");
const environment = RenderingEnvironment.parse(JSON.parse(await readFile(environmentPath, "utf8")));
const temporary = await mkdtemp(join(tmpdir(), "dorkflow-uswds-"));

try {
  const extraction = Bun.spawn(["tar", "-xzf", packagePath, "-C", temporary], { stdout: "ignore", stderr: "pipe" });
  const exitCode = await extraction.exited;
  if (exitCode !== 0) throw new Error("Could not extract the verified USWDS package");

  await rm(renderedRoot, { recursive: true, force: true });
  await mkdir(renderedRoot, { recursive: true });
  await cp(join(sourceRoot, "pages"), join(renderedRoot, "pages"), { recursive: true });
  await cp(join(temporary, "package", "dist"), join(renderedRoot, "assets", "uswds"), { recursive: true });

  const files = await filesUnder(renderedRoot);
  const manifest = BundleManifest.parse({
    schemaVersion: 1,
    benchmarkId: "bench_uswds_calibration",
    benchmarkRole: "calibration",
    benchmarkVersion: "uswds-v3.14.0",
    createdAt: new Date().toISOString(),
    renderingEnvironmentSha256: environment.environmentSha256,
    files,
    bundleSha256: identityHash(files),
    sourcePackage: { name: "uswds", version: "3.14.0", url: packageUrl, sha256: packageSha256 },
    privateInputsOutsideWorkspace: false,
  });
  await writeFile(join(benchmarkRoot, "bundle-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Frozen USWDS calibration bundle ${manifest.bundleSha256}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
