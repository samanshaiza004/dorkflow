import { constants } from "node:fs";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ReviewPacket } from "../contracts/design/review.ts";
import { reviewPacketSha256 } from "../design/review.ts";
import { renderReviewSummary } from "../design/review-summary.ts";

async function readRegularFile(path: string, maxBytes: number): Promise<Buffer> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maxBytes) {
    throw new Error(`Expected a bounded regular file: ${path}`);
  }
  return readFile(path);
}

const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  throw new Error("Usage: bun run src/cli/render-review-summary.ts <run-directory>");
}

const requestedRoot = resolve(input);
const rootInfo = await lstat(requestedRoot);
if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error("Run path must be a regular directory, not a symlink");
const runRoot = await realpath(requestedRoot);
const reviewRoot = join(runRoot, "review");
const reviewInfo = await lstat(reviewRoot);
if (!reviewInfo.isDirectory() || reviewInfo.isSymbolicLink()) throw new Error("Review path must be a regular directory, not a symlink");

const packetPath = join(reviewRoot, "packet.json");
const hashPath = join(reviewRoot, "packet.sha256");
const packetBytes = await readRegularFile(packetPath, 10 * 1024 * 1024);
const packet = ReviewPacket.parse(JSON.parse(packetBytes.toString("utf8")));
const expectedHash = (await readRegularFile(hashPath, 128)).toString("utf8").trim();
const actualHash = reviewPacketSha256(packet);
if (expectedHash !== actualHash) throw new Error("Review packet does not match its authoritative packet.sha256 sidecar");

const summaryPath = join(reviewRoot, "summary.md");
try {
  const summaryInfo = await lstat(summaryPath);
  if (!summaryInfo.isFile() || summaryInfo.isSymbolicLink()) throw new Error("Refusing to replace a non-regular review summary");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
await writeFile(summaryPath, renderReviewSummary(packet), {
  encoding: "utf8",
  mode: 0o600,
  flag: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
});
console.log(JSON.stringify({ summaryPath, packetSha256: actualHash }, null, 2));
