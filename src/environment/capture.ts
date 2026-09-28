import { mkdir, readdir, writeFile } from "node:fs/promises";
import { arch, platform, release, version } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { RenderingEnvironment } from "../contracts/environment.ts";
import { RENDERING_CONTEXT, RENDERING_VIEWPORTS, PLAYWRIGHT_BROWSER } from "./constants.ts";
import { identityHash, sha256File } from "./hash.ts";

type FontFile = { name: string; sha256: string };

function commandOutput(command: string, args: string[], fallback: string): string {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim() || fallback;
  } catch {
    return fallback;
  }
}

async function fontFiles(directory: string, prefix = ""): Promise<FontFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.sort((left, right) => left.name.localeCompare(right.name)).map(async (entry) => {
    const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return fontFiles(join(directory, entry.name), relativeName);
    if (!entry.isFile()) return [];
    return [{ name: relativeName, sha256: await sha256File(join(directory, entry.name)) }];
  }));
  return files.flat();
}

export async function captureEnvironment(fontDirectory: string): Promise<RenderingEnvironment> {
  const executablePath = chromium.executablePath();
  const files = await fontFiles(resolve(fontDirectory));
  const fonts = {
    directory: "fonts",
    files,
    manifestSha256: identityHash(files),
  };
  const withoutIdentity = {
    schemaVersion: 1 as const,
    packageManager: "bun@1.3.14" as const,
    bunVersion: Bun.version,
    nodeVersion: process.version,
    host: {
      platform: platform(),
      architecture: arch(),
      osRelease: release(),
      osVersion: platform() === "darwin" ? commandOutput("sw_vers", ["-productVersion"], version()) : version(),
      osBuild: platform() === "darwin" ? commandOutput("sw_vers", ["-buildVersion"], release()) : release(),
      containerRuntime: "host" as const,
      containerImageDigest: null,
    },
    browser: {
      ...PLAYWRIGHT_BROWSER,
      executableSha256: await sha256File(executablePath),
    },
    context: RENDERING_CONTEXT,
    viewports: RENDERING_VIEWPORTS,
    fonts,
  };
  return RenderingEnvironment.parse({ ...withoutIdentity, environmentSha256: identityHash(withoutIdentity) });
}

export async function writeEnvironment(path: string, fontDirectory: string): Promise<RenderingEnvironment> {
  const environment = await captureEnvironment(fontDirectory);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(environment, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return environment;
}
