import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const fixtureRoot = resolve(import.meta.dirname, "../../fixtures/phase-b-demo");
const portText = process.argv[2] ?? "4179";
const port = Number(portText);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Port must be an integer from 1 to 65535");
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(url.pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
    const filePath = resolve(fixtureRoot, relativePath);
    const fromRoot = relative(fixtureRoot, filePath);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || fromRoot.startsWith(sep)) {
      return new Response(null, { status: 403 });
    }
    try {
      const contents = await readFile(filePath);
      return new Response(request.method === "HEAD" ? null : contents, {
        headers: {
          "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  },
});

console.log(`Phase B demo available at http://${server.hostname}:${server.port}/`);
