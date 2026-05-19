/// Extraction des "click targets" depuis une page PDF.
///
/// Un ClickTarget est une zone visuelle du PDF que l'admin peut cliquer pour
/// la transformer en champ de formulaire. Contrairement à la détection auto
/// classique, on **n'écarte pas** les zones douteuses : on les expose toutes,
/// et c'est l'admin qui décide en cliquant.
///
/// Sources :
///   - Text items native (via `getTextContent`)
///   - Shapes (rectangles + lignes horizontales) via `getOperatorList`
///   - Patterns dans le texte : fillers `____`, dates `__/__/__`, glyphes checkbox
///
/// Toutes les coords sont en **PDF user-space** (origine bas-gauche), cohérent
/// avec `transform[5]` des text items.

import { inferFromLabel } from "./label-hints";
import { cleanOcrLabel } from "./label-cleanup";
import type { DocumentFieldType } from "./types";

export interface ClickTarget {
  /// Identifiant stable basé sur la position : permet de re-créer les targets
  /// au re-render sans changer l'identité React.
  id: string;
  /// Nature du target — informatif pour debug / icône UI.
  kind: "filler" | "date-pattern" | "checkbox-glyph" | "rect" | "line" | "text-block";
  /// bbox en PDF user-space (origine bas-gauche).
  x: number;
  y: number;
  w: number;
  h: number;
  /// Texte natif (mot/groupe) si le target vient du texte, "" sinon.
  text: string;
  /// Label voisin (à gauche sur même ligne, ou au-dessus) — sert de label par
  /// défaut quand l'admin valide.
  nearbyLabel: string;
  /// Type suggéré (calculé via `inferFromLabel(nearbyLabel)` ou via la nature du target).
  suggestedType: DocumentFieldType;
  /// Nom canonique de preset suggéré (matchera `FieldValidationPreset.name`).
  suggestedPresetName: string | null;
}

interface NativeTextItem {
  str: string;
  x: number; // baseline x (transform[4])
  y: number; // baseline y (transform[5])
  w: number;
  h: number;
}

interface NativeRect {
  x: number;
  y: number; // bottom of rect in PDF user-space
  w: number;
  h: number;
}

interface NativeLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PdfPageLike {
  getTextContent: () => Promise<{
    items: { str: string; transform: number[]; width: number; height: number }[];
  }>;
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  getViewport: (opts: { scale: number }) => { width: number; height: number };
}

const OP_CONSTRUCT_PATH = 91;
const SUB_OP_RECT = 19;
const SUB_OP_MOVE = 13;
const SUB_OP_LINE = 14;

/// Glyphes Unicode qui représentent visuellement une case à cocher dans une font
/// (ZapfDingbats, custom forms fonts). Le user-experience est : si je clique
/// dessus, ça doit devenir un `checkbox`.
const CHECKBOX_GLYPHS = /^[☐☒☑■□◯○⬛⬜▢▣▤▥▦▧▨▩]+$/;

/// Pattern date `__/__/____` (avec variations).
const DATE_PATTERN = /^[_.]+\s*\/\s*[_.]+\s*\/\s*[_.]+$/;

/// Pattern filler (underscores ou dots consécutifs, ≥3 chars).
function isFiller(s: string): boolean {
  const compact = s.replace(/\s/g, "");
  if (compact.length < 3) return false;
  if (/^[._]+$/.test(compact)) return true;
  // Tolérance : ≥70% de filler chars (tesseract peut glisser une lettre)
  const fillerCount = (compact.match(/[._]/g) || []).length;
  return compact.length >= 5 && fillerCount / compact.length > 0.7;
}

/// Petit utilitaire pour générer un id stable depuis la position.
function targetId(kind: string, x: number, y: number): string {
  return `${kind}-${Math.round(x)}-${Math.round(y)}`;
}

/// Construit un ClickTarget à partir d'un texte natif filler/date/checkbox.
function makeTextTarget(
  kind: ClickTarget["kind"],
  item: NativeTextItem,
  nearbyLabel: string,
  suggestedType: DocumentFieldType,
  suggestedPresetName: string | null
): ClickTarget {
  return {
    id: targetId(kind, item.x, item.y),
    kind,
    x: item.x,
    y: item.y,
    w: Math.max(item.w, 30),
    h: Math.max(item.h, 12),
    text: item.str,
    nearbyLabel,
    suggestedType,
    suggestedPresetName,
  };
}

/// Construit un ClickTarget à partir d'un rectangle ou ligne dessinés.
function makeShapeTarget(
  kind: ClickTarget["kind"],
  shape: { x: number; y: number; w: number; h: number },
  nearbyLabel: string,
  suggestedType: DocumentFieldType,
  suggestedPresetName: string | null
): ClickTarget {
  return {
    id: targetId(kind, shape.x, shape.y),
    kind,
    ...shape,
    text: "",
    nearbyLabel,
    suggestedType,
    suggestedPresetName,
  };
}

/// Cherche un label "à gauche, même ligne" pour un point cible.
/// Retourne "" si rien de pertinent.
function findLabelLeftOf(
  targetX: number,
  targetBaseline: number,
  textItems: NativeTextItem[]
): string {
  const onLine = textItems
    .filter((it) => {
      if (Math.abs(it.y - targetBaseline) > 6) return false;
      if (it.x + it.w > targetX + 5) return false;
      if (it.x < targetX - 250) return false;
      const trimmed = it.str.trim();
      if (trimmed.length === 0) return false;
      if (CHECKBOX_GLYPHS.test(trimmed)) return false;
      if (isFiller(trimmed)) return false;
      return true;
    })
    .sort((a, b) => a.x - b.x);

  if (onLine.length === 0) return "";

  const text = onLine.map((it) => it.str).join(" ").trim();
  // Coupe avant ":", retire fillers trailing, limite à 80 chars
  const colonIdx = text.lastIndexOf(":");
  const cleaned = (colonIdx >= 0 ? text.slice(0, colonIdx) : text)
    .replace(/[._\s]+$/, "")
    .trim();
  return cleanOcrLabel(cleaned).slice(0, 80);
}

/// Cherche un label "à droite, même ligne" (cas checkbox + label après case).
function findLabelRightOf(
  targetX: number,
  targetRight: number,
  targetBaseline: number,
  textItems: NativeTextItem[]
): string {
  const onLine = textItems
    .filter((it) => {
      if (Math.abs(it.y - targetBaseline) > 6) return false;
      if (it.x < targetRight - 2) return false;
      if (it.x > targetX + 200) return false;
      const trimmed = it.str.trim();
      if (trimmed.length === 0) return false;
      if (CHECKBOX_GLYPHS.test(trimmed)) return false;
      if (isFiller(trimmed)) return false;
      return true;
    })
    .sort((a, b) => a.x - b.x);

  if (onLine.length === 0) return "";
  const text = onLine.map((it) => it.str).join(" ").trim();
  return cleanOcrLabel(text).slice(0, 80);
}

/// Heuristique type à partir d'un label + nature du target.
function inferTypeAndPreset(
  nearbyLabel: string,
  kind: ClickTarget["kind"],
  fillerText?: string
): { type: DocumentFieldType; presetName: string | null } {
  // Cas explicites par nature
  if (kind === "checkbox-glyph") {
    return { type: "checkbox", presetName: null };
  }
  if (kind === "date-pattern") {
    const fromLabel = inferFromLabel(nearbyLabel);
    return {
      type: "date",
      presetName: fromLabel?.presetName ?? null,
    };
  }
  if (kind === "line") {
    // Une ligne longue isolée près d'un mot "Signature" → signature
    if (/signature/i.test(nearbyLabel)) {
      const sig = inferFromLabel(nearbyLabel);
      return { type: "signature", presetName: sig?.presetName ?? null };
    }
    return { type: "text", presetName: null };
  }

  // Sinon on infère depuis le label
  const fromLabel = inferFromLabel(nearbyLabel);
  if (fromLabel) {
    return { type: fromLabel.type, presetName: fromLabel.presetName ?? null };
  }
  // Pattern date dans le filler ?
  if (fillerText && DATE_PATTERN.test(fillerText.trim())) {
    return { type: "date", presetName: null };
  }
  return { type: "text", presetName: null };
}

/// Extrait tous les rectangles et lignes horizontales d'une page PDF.
async function extractShapes(
  page: PdfPageLike
): Promise<{ rects: NativeRect[]; lines: NativeLine[] }> {
  const rects: NativeRect[] = [];
  const lines: NativeLine[] = [];
  try {
    const opList = await page.getOperatorList();
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] !== OP_CONSTRUCT_PATH) continue;
      const args = opList.argsArray[i] as [number[], number[], unknown];
      if (!Array.isArray(args) || args.length < 2) continue;
      const subOps = args[0];
      const subArgs = args[1];
      if (!Array.isArray(subOps) || !Array.isArray(subArgs)) continue;

      let argIdx = 0;
      let lineStart: { x: number; y: number } | null = null;
      for (const sub of subOps) {
        if (sub === SUB_OP_RECT) {
          const [x, y, w, h] = subArgs.slice(argIdx, argIdx + 4) as number[];
          argIdx += 4;
          rects.push({ x, y, w, h });
        } else if (sub === SUB_OP_MOVE) {
          const [x, y] = subArgs.slice(argIdx, argIdx + 2) as number[];
          argIdx += 2;
          lineStart = { x, y };
        } else if (sub === SUB_OP_LINE) {
          const [x, y] = subArgs.slice(argIdx, argIdx + 2) as number[];
          argIdx += 2;
          if (lineStart && Math.abs(y - lineStart.y) < 1) {
            lines.push({ x1: lineStart.x, y1: lineStart.y, x2: x, y2: y });
          }
          lineStart = { x, y };
        }
      }
    }
  } catch (err) {
    console.warn("extractShapes failed:", err);
  }
  return { rects, lines };
}

/// Dédup les rectangles à positions identiques (±2pt).
function dedupRects(rects: NativeRect[]): NativeRect[] {
  const out: NativeRect[] = [];
  for (const r of rects) {
    if (
      !out.some(
        (o) =>
          Math.abs(o.x - r.x) <= 2 &&
          Math.abs(o.y - r.y) <= 2 &&
          Math.abs(o.w - r.w) <= 2 &&
          Math.abs(o.h - r.h) <= 2
      )
    ) {
      out.push(r);
    }
  }
  return out;
}

/// Vrai si le rect contient du texte dense (≥8 chars cumulés dans sa bbox).
/// Sert à exclure les bandeaux/fonds de paragraphe.
function rectHasDenseText(rect: NativeRect, items: NativeTextItem[]): boolean {
  const yTop = rect.y + rect.h;
  const yBot = rect.y;
  let total = 0;
  for (const it of items) {
    if (it.y < yBot - 2 || it.y > yTop + 2) continue;
    const xCenter = it.x + it.w / 2;
    if (xCenter < rect.x || xCenter > rect.x + rect.w) continue;
    total += it.str.replace(/[\s._\-/\\]/g, "").length;
    if (total >= 8) return true;
  }
  return false;
}

/// Point d'entrée principal. Charge tout ce qu'on peut cliquer sur la page.
export async function extractClickTargets(
  page: PdfPageLike
): Promise<ClickTarget[]> {
  const targets: ClickTarget[] = [];

  // 1. Texte natif
  const tc = await page.getTextContent();
  const items: NativeTextItem[] = tc.items
    .filter((it) => it.str && it.str.length > 0)
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
      h: it.height || Math.abs(it.transform[3]) || 10,
    }));

  // 2. Shapes
  const { rects: rawRects, lines } = await extractShapes(page);
  const rects = dedupRects(rawRects);

  // 3. ClickTargets depuis le texte
  for (const item of items) {
    const t = item.str.trim();
    if (!t) continue;

    // Date pattern `__/__/____`
    if (DATE_PATTERN.test(t)) {
      const label = findLabelLeftOf(item.x, item.y, items);
      const { type, presetName } = inferTypeAndPreset(label, "date-pattern", t);
      targets.push(makeTextTarget("date-pattern", item, label, type, presetName));
      continue;
    }

    // Filler `____` ou `....`
    if (isFiller(t)) {
      const label = findLabelLeftOf(item.x, item.y, items);
      const { type, presetName } = inferTypeAndPreset(label, "filler", t);
      targets.push(makeTextTarget("filler", item, label, type, presetName));
      continue;
    }

    // Glyphe checkbox isolé (☐ ☒ etc.)
    if (CHECKBOX_GLYPHS.test(t)) {
      const label = findLabelRightOf(item.x, item.x + item.w, item.y, items);
      const { type, presetName } = inferTypeAndPreset(label, "checkbox-glyph");
      targets.push(makeTextTarget("checkbox-glyph", item, label, type, presetName));
      continue;
    }

    // Petit text item vide (largeur de checkbox ~ 8-12, str minimal) → probable
    // checkbox encodée par un glyphe non-printable de la font du formulaire.
    if (t.length <= 2 && item.w >= 6 && item.w <= 15 && item.h >= 6 && item.h <= 15) {
      // Vérifier qu'on trouve un label à droite (pattern "case + label")
      const label = findLabelRightOf(item.x, item.x + item.w, item.y, items);
      if (label) {
        const { type, presetName } = inferTypeAndPreset(label, "checkbox-glyph");
        targets.push(makeTextTarget("checkbox-glyph", item, label, type, presetName));
        continue;
      }
    }
  }

  // 4. ClickTargets depuis les rectangles
  for (const r of rects) {
    // Filtres taille — on rejette les évidences (icônes minuscules, gros blocs)
    if (r.w < 12 || r.h < 6) continue;
    if (r.h > 50) continue;
    if (r.w > 540) continue;
    // Exclut les bandeaux pleins de texte (fonds de section / paragraphes)
    if (rectHasDenseText(r, items)) continue;

    const baseline = r.y + r.h / 2;
    const label = findLabelLeftOf(r.x, baseline, items);
    // Pour un rect, on ne propose comme target que s'il a un label OU s'il est
    // clairement isolé (pas de texte voisin du tout) — sinon trop de bruit.
    const isSmallSquare = r.w < 20 && r.h < 20;
    const kind: ClickTarget["kind"] = isSmallSquare ? "checkbox-glyph" : "rect";
    const { type, presetName } = inferTypeAndPreset(label, kind);
    // Dedup contre un target existant à la même position (text item collé sur le rect)
    if (
      !targets.some(
        (t) => Math.abs(t.x - r.x) < 6 && Math.abs(t.y - r.y) < 6
      )
    ) {
      targets.push(makeShapeTarget(kind, r, label, type, presetName));
    }
  }

  // 5. Lignes horizontales longues isolées → candidats signature
  for (const ln of lines) {
    const w = Math.abs(ln.x2 - ln.x1);
    if (w < 80 || w > 540) continue;
    const xMin = Math.min(ln.x1, ln.x2);
    const baseline = ln.y1;
    // Une "ligne signature" est typiquement précédée d'un mot "Signature" ou
    // isolée en bas de page sans texte dense au-dessus.
    const label = findLabelLeftOf(xMin, baseline + 5, items);
    if (label && /sign/i.test(label)) {
      const shape = { x: xMin, y: baseline - 1, w, h: 20 };
      const { type, presetName } = inferTypeAndPreset(label, "line");
      if (!targets.some((t) => Math.abs(t.y - shape.y) < 10 && Math.abs(t.x - shape.x) < 20)) {
        targets.push(makeShapeTarget("line", shape, label, type, presetName));
      }
    }
  }

  return targets;
}
