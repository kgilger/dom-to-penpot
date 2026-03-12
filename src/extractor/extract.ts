/**
 * DOM Extractor — Uses Playwright to navigate to a URL,
 * recursively extract the DOM tree with computed styles,
 * and output a JSON file consumable by the Penpot plugin.
 *
 * Usage: npm run extract -- --url https://example.com [--output output.json] [--viewport 1920x1080]
 */

import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DomNode, ExtractionResult } from "../shared/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the browser-side extraction script as a string (plain JS, not processed by tsx).
// We inject it via page.evaluate(string) which uses CDP and bypasses CSP entirely.
const BROWSER_SCRIPT = readFileSync(
  join(__dirname, "browser-extract.js"),
  "utf-8",
);

// ── CLI args ────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let url = "";
  let output = "extraction.json";
  let viewportWidth = 1920;
  let viewportHeight = 1080;
  let selector: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--url":
        url = args[++i];
        break;
      case "--output":
        output = args[++i];
        break;
      case "--viewport": {
        const [w, h] = args[++i].split("x").map(Number);
        viewportWidth = w;
        viewportHeight = h;
        break;
      }
      case "--selector":
        selector = args[++i];
        break;
    }
  }

  if (!url) {
    console.error(
      "Usage: npm run extract -- --url <URL> [--output file.json] [--viewport 1920x1080] [--selector 'body > main']",
    );
    process.exit(1);
  }

  return { url, output, viewportWidth, viewportHeight, selector };
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  const { url, output, viewportWidth, viewportHeight, selector } = parseArgs();

  console.log(`Extracting DOM from: ${url}`);
  console.log(`Viewport: ${viewportWidth}x${viewportHeight}`);

  const browser = await chromium.launch({
    headless: true,
    channel: "msedge", // Use system-installed Edge — no extra download needed
  });
  const page = await browser.newPage({
    viewport: { width: viewportWidth, height: viewportHeight },
  });

  await page.goto(url, { waitUntil: "networkidle" });

  // Wait a bit for any animations/transitions to settle
  await page.waitForTimeout(500);

  // Inject the browser-side extraction code via evaluate (bypasses CSP)
  await page.evaluate(BROWSER_SCRIPT);

  // Call the injected function
  const tree = await page.evaluate(
    (rootSelector) => (window as any).__extractDOM(rootSelector),
    selector ?? null,
  );

  await browser.close();

  if (!tree) {
    console.error(
      "Failed to extract DOM tree (root element not found or not visible)",
    );
    process.exit(1);
  }

  const result: ExtractionResult = {
    url,
    viewport: { width: viewportWidth, height: viewportHeight },
    timestamp: new Date().toISOString(),
    tree: tree as DomNode,
  };

  const outputPath = resolve(process.cwd(), output);
  writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`Extraction saved to: ${outputPath}`);
  console.log(
    `Tree root: <${tree.tag}> with ${tree.children?.length || 0} children`,
  );
}

main().catch((err) => {
  console.error("Extraction failed:", err);
  process.exit(1);
});
