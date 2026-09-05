import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { sha256File } from "../environment/hash.ts";

export type BundleFile = { path: string; sha256: string; bytes: number };

export async function filesUnder(directory: string, prefix = ""): Promise<BundleFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const result: BundleFile[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = join(directory, entry.name);
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await filesUnder(absolute, path));
    else if (entry.isFile()) result.push({ path, sha256: await sha256File(absolute), bytes: (await stat(absolute)).size });
  }
  return result;
}
