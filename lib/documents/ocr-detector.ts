/// Détection client-side de zones de saisie sur un PDF via OCR (tesseract.js).
///
/// Stratégie : on rend la page PDF à haute résolution dans un canvas, on lance
/// l'OCR tesseract.js, puis on applique des heuristiques sur le texte détecté
/// pour proposer des positions de champs.
///
/// Heuristiques :
/// - Séquences de underscores `_____` → champ texte (label = mot précédent)
/// - "Label :" ou "Label:" suivi d'espace → champ texte
/// - Patterns date `__/__/____` → champ date
/// - Petits carrés isolés `□` ou `[ ]` → checkbox

export interface OCRWord {
  text: string;
  /// Bounding box dans le système de coordonnées PDF (pas pixels canvas).
  /// x, y, w, h en points PDF (origine en bas-gauche, comme pdf-lib).
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
}

export interface DetectedField {
  /// Type proposé pour le champ
  type: "text" | "date" | "checkbox" | "number";
  /// Label détecté (texte avant la zone de saisie)
  label: string;
  /// Position en points PDF
  x: number;
  y: number;
  w: number;
  h: number;
  /// Confiance globale (0-100)
  confidence: number;
  /// Page sur laquelle se trouve le champ
  page: number;
}

/// Convertit les words OCR (en pixels canvas) vers le système de coordonnées PDF.
/// `pdfPageHeight` = hauteur de la page PDF en points (pour flip Y).
/// `scale` = ratio canvas/pdf (généralement 2-3 pour de l'OCR de qualité).
export function ocrWordsToPdfCoords(
  rawWords: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }[],
  pdfPageHeight: number,
  scale: number
): OCRWord[] {
  return rawWords.map((w) => {
    const x = w.bbox.x0 / scale;
    const w_pdf = (w.bbox.x1 - w.bbox.x0) / scale;
    const h_pdf = (w.bbox.y1 - w.bbox.y0) / scale;
    // Flip Y axis : canvas Y origin = top, PDF Y origin = bottom
    const y = pdfPageHeight - w.bbox.y1 / scale;
    return {
      text: w.text,
      x,
      y,
      w: w_pdf,
      h: h_pdf,
      confidence: w.confidence,
    };
  });
}

/// Trouve les zones de saisie dans une page OCRisée.
/// Retourne la liste de champs proposés.
export function detectFields(words: OCRWord[], pageIdx: number): DetectedField[] {
  const fields: DetectedField[] = [];

  // Trier par position (haut → bas, puis gauche → droite)
  const sorted = [...words].sort((a, b) => {
    // Plus haut = plus grand y en coords PDF
    if (Math.abs(a.y - b.y) > 5) return b.y - a.y;
    return a.x - b.x;
  });

  // Tesseract découpe parfois "........NOM" en plusieurs tokens. On fusionne
  // les séquences de fillers consécutives sur la même ligne avant détection.
  const merged = mergeAdjacentFillers(sorted);

  for (let i = 0; i < merged.length; i++) {
    const word = merged[i];
    const text = word.text.trim();

    // 1. Pattern date __/__/____ ou ../../....
    if (
      /^[_.]+[\s]*\/[\s]*[_.]+[\s]*\/[\s]*[_.]+$/.test(text) ||
      /^\d?[_.]{1,2}\s*\/\s*\d?[_.]{1,2}\s*\/\s*\d?[_.]{1,4}$/.test(text)
    ) {
      const label = findLabelBefore(merged, i);
      fields.push({
        type: "date",
        label: label || "Date",
        x: word.x,
        y: word.y,
        w: word.w,
        h: Math.max(word.h, 14),
        confidence: word.confidence,
        page: pageIdx,
      });
      continue;
    }

    // 2. Séquence de fillers (underscores OU points OU mixte) → texte libre
    // Ex: "_____", ".....", "_._._.", "............NOM"
    if (isFillerToken(text)) {
      const label = findLabelBefore(merged, i);
      fields.push({
        type: "text",
        label: label || "Champ",
        x: word.x,
        y: word.y,
        w: Math.max(word.w, 40),
        h: Math.max(word.h, 14),
        confidence: word.confidence,
        page: pageIdx,
      });
      continue;
    }

    // 3. Petits carrés / cases (□, [], ☐, ◯)
    if (/^[□☐◯○\[\]]+$/.test(text) || (text.length === 1 && /[□☐◯○]/.test(text))) {
      const label = findLabelAfter(merged, i) || findLabelBefore(merged, i);
      fields.push({
        type: "checkbox",
        label: label || "Case",
        x: word.x,
        y: word.y,
        w: Math.max(word.w, 12),
        h: Math.max(word.h, 12),
        confidence: word.confidence,
        page: pageIdx,
      });
      continue;
    }
  }

  // Déduplication : si deux champs détectés se chevauchent fortement, on garde le 1er
  return deduplicate(fields);
}

/// Fragment de filler : peut être 1 char ou plus, fait uniquement de _ ou .
function isFillerFragment(text: string): boolean {
  return /^[._]+$/.test(text);
}

/// Reconnaît un token "filler significatif" : ≥3 chars de remplissage (post-fusion).
/// Tolère les espaces internes (cas "_ _ _ _" tesseract).
function isFillerToken(text: string): boolean {
  const compact = text.replace(/\s/g, "");
  if (compact.length < 3) return false;
  // Au moins 3 chars de filler total (consécutifs ou non)
  if (!/^[._]+$/.test(compact)) {
    // Tolérance : tesseract peut glisser une ou deux lettres dans une longue ligne
    const fillerCount = (compact.match(/[._]/g) || []).length;
    return compact.length >= 5 && fillerCount / compact.length > 0.7;
  }
  return true;
}

/// Fusionne les fragments de fillers consécutifs sur la même ligne en un seul token.
/// Indispensable car tesseract découpe :
///   "_ _ _ _ _" en 5 tokens "_"
///   "...... NOM ......" en 3 tokens
function mergeAdjacentFillers(words: OCRWord[]): OCRWord[] {
  const out: OCRWord[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (!isFillerFragment(w.text.trim())) {
      out.push(w);
      i++;
      continue;
    }
    // Démarrer un merge à partir d'un fragment
    let mergedText = w.text;
    const xMin = w.x;
    let xMax = w.x + w.w;
    const yRef = w.y;
    let confSum = w.confidence;
    let count = 1;
    let j = i + 1;
    while (j < words.length) {
      const next = words[j];
      const sameLine = Math.abs(next.y - yRef) < 6;
      const closeBy = next.x - xMax < 40; // jusqu'à 40pt d'écart horizontal (espaces inclus)
      if (sameLine && closeBy && isFillerFragment(next.text.trim())) {
        mergedText += " " + next.text;
        xMax = Math.max(xMax, next.x + next.w);
        confSum += next.confidence;
        count++;
        j++;
      } else {
        break;
      }
    }
    // Si le merge produit un filler significatif, on le garde
    const mergedLen = mergedText.replace(/\s/g, "").length;
    if (mergedLen >= 3) {
      out.push({
        text: mergedText,
        x: xMin,
        y: yRef,
        w: xMax - xMin,
        h: w.h,
        confidence: confSum / count,
      });
    }
    // Sinon on jette (probablement bruit OCR)
    i = j;
  }
  return out;
}

function findLabelBefore(words: OCRWord[], index: number): string {
  const target = words[index];

  // 1. D'abord chercher sur la MÊME ligne, à gauche du filler.
  const sameLine: string[] = [];
  for (let i = index - 1; i >= Math.max(0, index - 8); i--) {
    const w = words[i];
    if (Math.abs(w.y - target.y) > 6) break;
    if (w.x >= target.x) continue;
    if (/^[._□☐◯○]+$/.test(w.text)) break; // autre filler à gauche
    sameLine.unshift(w.text);
    if (w.text.endsWith(":")) break;
  }
  const sameLineLabel = sameLine.join(" ").replace(/[:.\s]+$/, "").trim();
  if (sameLineLabel.length >= 2) return sameLineLabel;

  // 2. Sinon chercher la LIGNE AU-DESSUS qui contient un label (texte se terminant par ":")
  // PDF coords: y plus grand = plus haut sur la page
  const aboveCandidates: { y: number; words: { x: number; text: string }[] } | null = (() => {
    let bestY: number | null = null;
    for (const w of words) {
      if (w.y <= target.y + 5) continue; // doit être au-dessus
      if (w.y - target.y > 30) continue; // pas trop loin
      if (/^[._□☐◯○]+$/.test(w.text)) continue; // skip fillers
      if (bestY === null || Math.abs(w.y - target.y) < Math.abs(bestY - target.y)) {
        bestY = w.y;
      }
    }
    if (bestY === null) return null;
    const sameLineWords = words
      .filter((w) => Math.abs(w.y - bestY!) < 4 && !/^[._□☐◯○]+$/.test(w.text))
      .sort((a, b) => a.x - b.x)
      .map((w) => ({ x: w.x, text: w.text }));
    return { y: bestY, words: sameLineWords };
  })();

  if (aboveCandidates && aboveCandidates.words.length > 0) {
    // On prend toute la ligne (parfois c'est un titre entier)
    const text = aboveCandidates.words.map((w) => w.text).join(" ").trim();
    // Si la ligne contient ":", on coupe avant
    const colonIdx = text.indexOf(":");
    const label = colonIdx >= 0 ? text.slice(0, colonIdx).trim() : text;
    return label.replace(/[.\s]+$/, "").slice(0, 60);
  }

  return "";
}

function findLabelAfter(words: OCRWord[], index: number): string {
  const target = words[index];
  for (let i = index + 1; i < Math.min(words.length, index + 4); i++) {
    const w = words[i];
    if (Math.abs(w.y - target.y) > 8) break;
    if (w.x <= target.x) continue;
    if (w.text.length > 1 && !/^[_□☐]/.test(w.text)) {
      return w.text;
    }
  }
  return "";
}

function deduplicate(fields: DetectedField[]): DetectedField[] {
  const result: DetectedField[] = [];
  for (const f of fields) {
    const overlaps = result.some(
      (g) =>
        g.page === f.page &&
        Math.abs(g.x - f.x) < 10 &&
        Math.abs(g.y - f.y) < 10
    );
    if (!overlaps) result.push(f);
  }
  return result;
}
