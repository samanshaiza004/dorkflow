import type { Page } from "playwright";
import { sha256Text } from "../environment/hash.ts";

export const PERCEPTUAL_SANITIZER_VERSION = "perceptual-sanitizer-v1";

export const PERCEPTUAL_SANITIZER_CSS = `
*, *::before, *::after {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  -webkit-text-stroke-color: transparent !important;
  text-emphasis-color: transparent !important;
  text-shadow: none !important;
  caret-color: transparent !important;
  background-image: none !important;
  mask-image: none !important;
  border-image-source: none !important;
  list-style-image: none !important;
}
*::before, *::after {
  opacity: 0 !important;
  text-decoration-color: transparent !important;
}
span[data-dorkflow-placeholder="true"] {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  background: rgba(40, 52, 68, 0.16) !important;
  background-image: none !important;
  border-radius: 2px !important;
  box-decoration-break: clone !important;
  -webkit-box-decoration-break: clone !important;
}
input::placeholder, textarea::placeholder { color: transparent !important; }
img, picture, svg, canvas, video, iframe, object, embed, input[type="image"] {
  opacity: 0 !important;
}
`;

const sanitizerScript = `(() => {
  const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "INPUT", "TEXTAREA", "SELECT", "OPTION"]);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!parent || skip.has(parent.tagName) || parent.namespaceURI !== "http://www.w3.org/1999/xhtml" || !node.nodeValue?.trim()) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent) continue;
    const placeholder = document.createElement("span");
    placeholder.dataset.dorkflowPlaceholder = "true";
    parent.replaceChild(placeholder, node);
    placeholder.appendChild(node);
  }
  for (const element of document.querySelectorAll("[title]")) element.removeAttribute("title");
})()`;

export const PERCEPTUAL_SANITIZER_SHA256 = sha256Text(`${PERCEPTUAL_SANITIZER_CSS}\n${sanitizerScript}`);

/** Wraps light-DOM text in geometry-preserving placeholder spans. */
export async function applyPerceptualSanitizer(page: Page): Promise<void> {
  await page.evaluate(sanitizerScript);
}
