import { ModelInput, type ModelInput as ModelInputType } from "../contracts/observation.ts";

const forbiddenKeys = new Set([
  "text",
  "textContent",
  "innerText",
  "html",
  "dom",
  "source",
  "stylesheet",
  "css",
  "class",
  "className",
  "idAttribute",
  "url",
  "href",
  "src",
  "alt",
  "title",
  "ariaLabel",
  "attribute",
  "screenshot",
  "seed",
  "groundTruth",
  "tokenName",
  "variableName",
]);

function findForbiddenKey(value: unknown, path = "$" ): string | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findForbiddenKey(item, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return `${path}.${key}`;
    const found = findForbiddenKey(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

export function parseModelInput(value: unknown): ModelInputType {
  const forbiddenPath = findForbiddenKey(value);
  if (forbiddenPath) throw new Error(`Forbidden model-input field: ${forbiddenPath}`);
  return ModelInput.parse(value);
}

export function serializeModelInput(value: unknown): string {
  return JSON.stringify(parseModelInput(value));
}
