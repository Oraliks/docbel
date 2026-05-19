/// Détection client-side de zones de saisie sur un PDF via OCR (tesseract.js)
/// ou extraction texte natif via pdfjs.
///
/// Stratégie :
/// 1. Pour chaque page, extraire les "words" avec position
/// 2. Heuristiques pattern-based pour identifier les zones de saisie (fillers, dates, cases)
/// 3. Inférence du type via le label (NISS, IBAN, date, email, etc.)
/// 4. Suggestion d'un preset de validation correspondant

import { inferFromLabel } from "./label-hints";
import { cleanOcrLabel } from "./label-cleanup";

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
  /// Type proposé pour le champ (peut être affiné par inférence du label)
  type: "text" | "date" | "checkbox" | "number" | "niss" | "iban" | "bce" | "tva_be" | "postal_be" | "phone_be" | "textarea" | "signature" | "select";
  /// Label détecté (texte avant la zone de saisie)
  label: string;
  /// Nom du preset suggéré (à matcher avec FieldValidationPreset.name)
  suggestedPresetName?: string;
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

/// Représente une zone de saisie détectée dans les opérations de dessin du PDF
/// (lignes pointillées, rectangles vides) — souvent invisible en extraction texte.
export interface GraphicShape {
  type: "line" | "rectangle";
  /// En points PDF (origine bas-gauche)
  x: number;
  y: number;
  w: number;
  h: number;
}

/// Convertit des shapes graphiques en DetectedField "candidat", à enrichir avec
/// les labels de texte voisins.
export function shapesToDetections(
  shapes: GraphicShape[],
  textWords: OCRWord[],
  pageIdx: number
): DetectedField[] {
  const detections: DetectedField[] = [];
  for (const s of shapes) {
    // Skip lignes trop courtes (probable séparateur de section, pas une ligne de saisie)
    if (s.type === "line" && s.w < 30) continue;
    // Skip rectangles trop petits (probable décoration)
    if (s.type === "rectangle" && (s.w < 8 || s.h < 8)) continue;

    // Trouver le label : texte juste à gauche sur la même ligne, ou au-dessus
    const label = findLabelNearShape(s, textWords);
    if (!label) continue; // pas de label trouvé → on ignore

    const isSmallSquare = s.type === "rectangle" && s.w < 25 && s.h < 25;
    const cleanedLabel = cleanOcrLabel(label);
    if (!cleanedLabel) continue; // si tout le label était du bruit, on ignore
    detections.push({
      type: isSmallSquare ? "checkbox" : "text",
      label: cleanedLabel,
      x: s.x,
      y: s.y,
      w: Math.max(s.w, 30),
      h: Math.max(s.h, 14),
      confidence: 80,
      page: pageIdx,
    });
  }
  return detections;
}

function findLabelNearShape(shape: GraphicShape, words: OCRWord[]): string {
  const target = { x: shape.x, y: shape.y };
  // 1. Chercher sur la même ligne, à gauche
  const sameLineLeft = words
    .filter((w) => Math.abs(w.y - target.y) < 6 && w.x < target.x && w.x + w.w >= target.x - 200)
    .sort((a, b) => a.x - b.x);
  if (sameLineLeft.length > 0) {
    const text = sameLineLeft.map((w) => w.text).join(" ").trim();
    const colonIdx = text.lastIndexOf(":");
    return (colonIdx >= 0 ? text.slice(0, colonIdx) : text)
      .replace(/[._]+\s*$/, "")
      .trim()
      .slice(0, 60);
  }
  // 2. Chercher au-dessus (ligne précédente)
  const above = words.find(
    (w) =>
      w.y > target.y + 5 &&
      w.y - target.y < 25 &&
      Math.abs(w.x - target.x) < 100
  );
  if (above) return above.text.trim().slice(0, 60);
  return "";
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
  const deduplicated = deduplicate(fields);

  // Regroupement : cases alignées (NISS box-array, oui/non, etc.)
  const grouped = groupAlignedFields(deduplicated, pageIdx);

  // Nettoyage des labels OCR (retire underscores/astérisques/(*)/etc. en lot)
  // PUIS inférence du type + preset depuis le label nettoyé.
  return grouped
    .map((f) => ({ ...f, label: cleanOcrLabel(f.label) }))
    .filter((f) => f.label.length > 0) // ignore les détections dont le label entier était du bruit
    .map((f) => {
      const inferred = inferFromLabel(f.label);
      if (!inferred) return f;
      // On garde le type "checkbox" tel quel s'il vient du visuel (case détectée)
      // mais on applique inférence sinon
      const preserveDetectedType = f.type === "checkbox" && inferred.type !== "select";
      return {
        ...f,
        type: preserveDetectedType ? f.type : inferred.type,
        suggestedPresetName: inferred.presetName,
      };
    });
}

/// Regroupe les champs alignés horizontalement avec espacement régulier.
/// Patterns détectés :
///   - 2-3 checkboxes côte à côte avec labels "oui/non" → fusionne en select binaire
///   - 8-15 petites cases vides identiques alignées → champ "char_array" (NISS, code postal)
///   - 4-12 mini-rectangles de saisie (date __/__/____) → date
function groupAlignedFields(fields: DetectedField[], pageIdx: number): DetectedField[] {
  if (fields.length < 2) return fields;

  // Trier par y (lignes) puis x
  const sorted = [...fields].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 5) return b.y - a.y;
    return a.x - b.x;
  });

  const used = new Set<number>();
  const result: DetectedField[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    const seed = sorted[i];

    // Chercher les voisins de droite alignés sur la même ligne avec espacement régulier
    const group: number[] = [i];
    const candidateIndexes: number[] = [];
    for (let j = 0; j < sorted.length; j++) {
      if (j === i || used.has(j)) continue;
      const w = sorted[j];
      if (Math.abs(w.y - seed.y) > 4) continue; // même ligne
      if (w.x < seed.x - 2) continue; // à droite uniquement
      // Tolérance type : on regroupe checkboxes ensemble, ou char_arrays ensemble
      if (w.type !== seed.type) continue;
      // Tolérance taille : dimensions similaires
      if (Math.abs(w.w - seed.w) / Math.max(w.w, seed.w) > 0.4) continue;
      if (Math.abs(w.h - seed.h) / Math.max(w.h, seed.h) > 0.4) continue;
      candidateIndexes.push(j);
    }

    candidateIndexes.sort((a, b) => sorted[a].x - sorted[b].x);
    let lastX = seed.x + seed.w;
    for (const ci of candidateIndexes) {
      const w = sorted[ci];
      const gap = w.x - lastX;
      if (gap < -2 || gap > 30) break; // si trop espacé, arrête le groupe
      group.push(ci);
      lastX = w.x + w.w;
    }

    if (group.length >= 3 && seed.type === "checkbox") {
      // 3+ cases alignées avec dim similaires → probable char-array (NISS/CP)
      group.forEach((g) => used.add(g));
      const first = sorted[group[0]];
      const last = sorted[group[group.length - 1]];
      const totalW = last.x + last.w - first.x;
      // Label = ce qui est à gauche du 1er ou au-dessus
      const label = first.label || "Champ groupé";
      result.push({
        type: "text", // sera affiné par inférence label (NISS/CP/etc.)
        label,
        x: first.x,
        y: first.y,
        w: totalW,
        h: Math.max(first.h, 14),
        confidence: first.confidence,
        page: pageIdx,
      });
    } else if (group.length === 2 && seed.type === "checkbox") {
      // 2 cases côte à côte (oui/non, M/F) → on garde séparé pour l'instant
      // (pourrait être un select mais on a besoin des labels précis)
      group.forEach((g) => used.add(g));
      group.forEach((g) => result.push(sorted[g]));
    } else {
      used.add(i);
      result.push(seed);
    }
  }

  return result;
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
