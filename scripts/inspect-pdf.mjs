/// Inspection one-shot d'un PDF via pdfjs : dump des text items + opérateurs
/// (rectangles, lignes) de la page 1, pour comprendre ce que l'extracteur voit.
///
/// Usage : `node scripts/inspect-pdf.mjs <fileId>`
/// Fileid = SourceFile.id en DB (ex. cmp48um7q000a13p5mzrl0ewy)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pdfPath = process.argv[2] || join(__dirname, "..", "private/uploads/a_X84iv4gMlJ-20250219-c32-travailleur-fr.pdf");

console.log(`Reading ${pdfPath}…`);
const buf = readFileSync(pdfPath);
console.log(`PDF size : ${buf.byteLength} bytes\n`);

// pdfjs en mode Node
const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(buf);
const loadingTask = getDocument({ data, disableWorker: true });
const pdf = await loadingTask.promise;
console.log(`Pages : ${pdf.numPages}\n`);

const page = await pdf.getPage(1);
const viewport = page.getViewport({ scale: 1 });
console.log(`Page 1 : ${viewport.width} x ${viewport.height} pts (PDF coords, origine bas-gauche)\n`);

// 1. Text content
const txt = await page.getTextContent();
console.log(`=== TEXT ITEMS (${txt.items.length}) ===`);
const items = txt.items
  .map((it) => ({
    str: it.str,
    x: Math.round(it.transform[4]),
    y: Math.round(it.transform[5]),
    w: Math.round(it.width),
    h: Math.round(it.height),
  }))
  .filter((it) => it.str.trim().length > 0)
  .sort((a, b) => (Math.abs(a.y - b.y) > 5 ? b.y - a.y : a.x - b.x));

for (const it of items) {
  console.log(`  y=${it.y} x=${it.x} (${it.w}x${it.h}) "${it.str.replace(/\s+/g, " ").slice(0, 80)}"`);
}

// 2. Operator list
console.log(`\n=== OPERATOR LIST ===`);
const opList = await page.getOperatorList();
console.log(`Total ops: ${opList.fnArray.length}`);

const opCounts = {};
for (const op of opList.fnArray) {
  opCounts[op] = (opCounts[op] || 0) + 1;
}
console.log(`Op counts (numeric) :`, opCounts);

// Map numeric ops to names via OPS object
const OPS_NAME = {};
for (const [name, val] of Object.entries(OPS)) {
  OPS_NAME[val] = name;
}
console.log(`\nOps by name :`);
for (const [op, count] of Object.entries(opCounts)) {
  console.log(`  ${OPS_NAME[op] || op} = ${count}`);
}

// 3. Rectangles + lines from constructPath
console.log(`\n=== SHAPES (rectangles, lines) ===`);
let rectCount = 0;
let lineCount = 0;
const allRects = [];
const allLines = [];

for (let i = 0; i < opList.fnArray.length; i++) {
  if (opList.fnArray[i] !== OPS.constructPath) continue;
  const args = opList.argsArray[i];
  if (!Array.isArray(args) || args.length < 2) continue;
  const subOps = args[0];
  const subArgs = args[1];
  if (!Array.isArray(subOps) || !Array.isArray(subArgs)) continue;

  let argIdx = 0;
  let lineStart = null;
  for (const sub of subOps) {
    if (sub === OPS.rectangle) {
      const [x, y, w, h] = subArgs.slice(argIdx, argIdx + 4);
      argIdx += 4;
      rectCount++;
      allRects.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    } else if (sub === OPS.moveTo) {
      const [x, y] = subArgs.slice(argIdx, argIdx + 2);
      argIdx += 2;
      lineStart = { x, y };
    } else if (sub === OPS.lineTo) {
      const [x, y] = subArgs.slice(argIdx, argIdx + 2);
      argIdx += 2;
      if (lineStart) {
        lineCount++;
        allLines.push({
          x1: Math.round(lineStart.x),
          y1: Math.round(lineStart.y),
          x2: Math.round(x),
          y2: Math.round(y),
        });
        lineStart = { x, y };
      }
    } else if (sub === OPS.curveTo || sub === OPS.curveTo2 || sub === OPS.curveTo3) {
      argIdx += 6;
    } else if (sub === OPS.closePath) {
      // pas d'args
    }
  }
}

console.log(`Rectangles : ${rectCount}`);
console.log(`Lines : ${lineCount}`);

// Show rectangles around "Votre demande" baseline (y=552 in PDF user-space, both flipped and not)
const targetY = 552;
const tolerance = 30;
const allFlipped = allRects.map((r) => ({ ...r, yFlipped: 842 - r.y - r.h }));
console.log(`\nRectangles around y=${targetY} (PDF) ou y_flipped=${842 - targetY} (screen) ±${tolerance}pt :`);
for (const r of allFlipped) {
  if (Math.abs(r.y - targetY) < tolerance || Math.abs(r.yFlipped - targetY) < tolerance) {
    console.log(`  rect(x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h}) [y_flipped=${r.yFlipped}]`);
  }
}

// Tous les rects avec w < 480 (filtre actuel)
const passing = allRects.filter((r) => r.w >= 8 && r.h >= 6 && r.h <= 30 && r.w < 480);
console.log(`\nTous les rects passant les filtres taille (w∈[8,480), h∈[6,30]) : ${passing.length}`);
const uniq = [];
for (const r of passing) {
  if (!uniq.some((o) => Math.abs(o.x - r.x) < 2 && Math.abs(o.y - r.y) < 2 && Math.abs(o.w - r.w) < 2)) {
    uniq.push(r);
  }
}
console.log(`Après dedup : ${uniq.length}`);
for (const r of uniq) {
  console.log(`  rect(x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h})`);
}

// Show horizontal lines (signature, separators)
const horizontalLines = allLines.filter((l) => Math.abs(l.y1 - l.y2) < 1 && Math.abs(l.x2 - l.x1) > 30);
console.log(`\nLignes horizontales (w > 30) : ${horizontalLines.length}`);
for (const l of horizontalLines.slice(0, 30)) {
  console.log(`  line(x=${l.x1}→${l.x2}, y=${l.y1}) longueur=${Math.abs(l.x2 - l.x1)}`);
}

process.exit(0);
