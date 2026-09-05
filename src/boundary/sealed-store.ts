import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

function isWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export function assertExternalSealedStore(storePath: string, workspace = process.cwd()): string {
  const store = resolve(storePath);
  const root = resolve(workspace);
  if (isWithin(store, root)) {
    throw new Error("Sealed store must be outside the model/coding-agent workspace");
  }
  return store;
}

export async function assertSealedBenchmarkPathAvailable(storePath: string, benchmarkId: string): Promise<string> {
  const store = assertExternalSealedStore(storePath);
  const directory = resolve(store, benchmarkId);
  try {
    await access(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return directory;
    throw error;
  }
  throw new Error(`Sealed benchmark already exists at ${directory}; generate a new benchmark ID`);
}

export async function writeSealedInput(storePath: string, benchmarkId: string, name: "seed" | "source" | "ground-truth", contents: string): Promise<void> {
  const store = assertExternalSealedStore(storePath);
  const directory = resolve(store, benchmarkId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, `${name}.json`);
  await writeFile(path, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await chmod(path, 0o600);
}
