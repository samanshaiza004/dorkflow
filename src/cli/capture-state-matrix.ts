import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureStateMatrix, type CaptureTrustMode } from "../capture/state-matrix.ts";
import type { CapturePurpose, StateMatrix } from "../contracts/design/index.ts";
import type { RenderingEnvironment } from "../contracts/environment.ts";

type CliOptions = {
  baseUrl?: string;
  matrixPath?: string;
  environmentPath?: string;
  runDirectory?: string;
  fontDirectory?: string;
  pinnedLatoFontPath?: string;
  trustMode?: CaptureTrustMode;
  purpose?: CapturePurpose;
  allowedOrigins: string[];
  approveOriginalPixels: boolean;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { allowedOrigins: [], approveOriginalPixels: false };
  const stringFlags = new Map<string, keyof Omit<CliOptions, "allowedOrigins" | "approveOriginalPixels">>([
    ["--base-url", "baseUrl"],
    ["--matrix", "matrixPath"],
    ["--environment", "environmentPath"],
    ["--run-dir", "runDirectory"],
    ["--fonts", "fontDirectory"],
    ["--pinned-lato-font", "pinnedLatoFontPath"],
    ["--trust-mode", "trustMode"],
    ["--purpose", "purpose"],
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!flag) throw new Error("Unexpected end of command-line arguments");
    if (flag === "--allow-original-pixels") {
      options.approveOriginalPixels = true;
      continue;
    }
    if (flag === "--allowed-origin") {
      const value = args[++index];
      if (!value) throw new Error("--allowed-origin requires a value");
      options.allowedOrigins.push(value);
      continue;
    }
    const key = stringFlags.get(flag);
    if (!key) throw new Error(`Unknown option: ${flag}`);
    const value = args[++index];
    if (!value) throw new Error(`${flag} requires a value`);
    (options as Record<string, unknown>)[key] = value;
  }
  for (const required of ["baseUrl", "matrixPath", "environmentPath", "runDirectory", "trustMode", "purpose"] as const) {
    if (!options[required]) throw new Error(`Missing required option: --${required.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  return options;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const result = await captureStateMatrix({
    baseUrl: options.baseUrl!,
    matrix: await readJson<StateMatrix>(options.matrixPath!),
    runDirectory: options.runDirectory!,
    environment: await readJson<RenderingEnvironment>(options.environmentPath!),
    ...(options.fontDirectory ? { fontDirectory: options.fontDirectory } : {}),
    ...(options.pinnedLatoFontPath ? { pinnedLatoFontPath: options.pinnedLatoFontPath } : {}),
    trustMode: options.trustMode!,
    purpose: options.purpose!,
    approveOriginalPixels: options.approveOriginalPixels,
    allowedOrigins: options.allowedOrigins,
  });
  console.log(JSON.stringify({
    captures: result.records.length,
    evidenceId: result.evidence.id,
    trustMode: result.evidence.trustMode,
    environmentSha256: result.environmentSha256,
    matrixSha256: result.matrixSha256,
    sanitizerVersion: result.sanitizerVersion,
    sanitizerSha256: result.sanitizerSha256,
  }, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : "State capture failed";
  console.error(`State capture failed: ${message}`);
  process.exitCode = 1;
}
