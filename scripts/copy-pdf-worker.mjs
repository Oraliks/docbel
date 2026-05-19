import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "..", "public", "pdf.worker.min.mjs");

let src;
try {
  src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
} catch {
  // pdfjs-dist not installed yet (e.g. early in a Vercel install) — skip silently.
  console.warn("[copy-pdf-worker] pdfjs-dist not resolvable, skipping.");
  process.exit(0);
}

if (!existsSync(src)) {
  console.warn(`[copy-pdf-worker] Source missing: ${src}`);
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${src} -> ${dest}`);
