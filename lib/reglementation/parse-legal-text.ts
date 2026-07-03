export type LegalBlock = {
  type: "section" | "paragraph" | "list-item" | "abroge";
  marker?: string;
  text: string;
  /** Profondeur d'indentation d'un list-item : 1 (« 1° », tiret) ou 2 (« a) »). */
  level?: number;
  /** Alinéa abrogé « en ligne » (ex. « 9°: abrogé (AM …) ») → barré mais lisible. */
  struck?: boolean;
};

const SECTION_RE = /^(§\s*\d+(?:er|bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies)?)\s*\.?\s*/;
const NUM_ITEM_RE = /^(\d+°(?:\/\d+)?|[a-z]\))\s+/;
const DASH_ITEM_RE = /^[-–]\s+/;
/** Détecte un alinéa abrogé non encadré par des crochets (« 9°: abrogé (…) »). */
const INLINE_ABROGE_RE = /^\s*(?:\d+°(?:\/\d+)?[:.)]?\s*|[a-z]\)\s*)?abrog[ée]/i;

/** Niveau d'indentation déduit du marqueur (source plate → heuristique simple). */
function levelFor(marker: string): number {
  return /^[a-z]\)$/.test(marker) ? 2 : 1;
}

export function parseLegalText(raw: string): LegalBlock[] {
  const src = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!src) return [];
  const blocks: LegalBlock[] = [];
  for (const rawLine of src.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^\[Abrogé/i.test(line)) {
      blocks.push({ type: "abroge", text: line });
      continue;
    }
    const struck = INLINE_ABROGE_RE.test(line);
    const sec = SECTION_RE.exec(line);
    if (sec) {
      blocks.push({ type: "section", marker: sec[1].replace(/\s+/g, " ").trim(), text: line.slice(sec[0].length).trim() });
      continue;
    }
    const num = NUM_ITEM_RE.exec(line);
    if (num) {
      blocks.push({ type: "list-item", marker: num[1], text: line.slice(num[0].length).trim(), level: levelFor(num[1]), struck });
      continue;
    }
    if (DASH_ITEM_RE.test(line)) {
      blocks.push({ type: "list-item", marker: "–", text: line.replace(DASH_ITEM_RE, "").trim(), level: 1, struck });
      continue;
    }
    blocks.push({ type: "paragraph", text: line, struck });
  }
  return blocks;
}

/** Type de section d'un commentaire ONEM. */
export type OnemSectionKind = "commentaire" | "schema" | "references";

export type OnemComment = {
  kind: OnemSectionKind;
  index: number;
  date: string | null;
  institution: string | null;
  text: string;
};

/** Entête de section : « Commentaire N », « Schéma N », « Références N ». */
const HEADER_RE =
  /^\s*(Commentaires?|Sch[ée]mas?|R[ée]f[ée]rences?)\s+(\d+)\b[ \t]*/i;
const SPLIT_RE =
  /(?=^\s*(?:Commentaires?|Sch[ée]mas?|R[ée]f[ée]rences?)\s+\d+\b)/im;

function kindOf(headerWord: string): OnemSectionKind {
  const w = headerWord.toLowerCase();
  if (w.startsWith("sch")) return "schema";
  if (w.startsWith("réf") || w.startsWith("ref")) return "references";
  return "commentaire";
}

export function splitOnemCommentary(raw: string): OnemComment[] {
  const src = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!src) return [];
  // Découpe en gardant les entêtes (Commentaire / Schéma / Références N).
  const parts = src.split(SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length === 1 && !HEADER_RE.test(parts[0])) {
    return [{ kind: "commentaire", index: 1, date: null, institution: null, text: parts[0] }];
  }
  return parts.map((part, i) => {
    const m = HEADER_RE.exec(part);
    const kind = m ? kindOf(m[1]) : "commentaire";
    const index = m ? parseInt(m[2], 10) : i + 1;
    let rest = m ? part.slice(m[0].length).trim() : part;
    const dateM = /\((\d{2}\/\d{2}\/\d{4})\)/.exec(rest);
    const date = dateM ? dateM[1] : null;
    // 1re parenthèse non-date en tête = institution.
    const instM = /\(([^)]+)\)/g;
    let institution: string | null = null;
    let g: RegExpExecArray | null;
    while ((g = instM.exec(rest.slice(0, 120)))) {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(g[1].trim())) { institution = g[1].trim(); break; }
    }
    // Strip the header line "(date) (institution)" from text if present.
    const lines = rest.split("\n");
    const firstNonEmpty = lines.findIndex((l) => l.trim() !== "");
    if (firstNonEmpty !== -1 && /^\s*(?:\([^)]*\)\s*)+$/.test(lines[firstNonEmpty])) {
      lines.splice(firstNonEmpty, 1);
      rest = lines.join("\n").trim();
    }
    return { kind, index, date, institution, text: rest };
  });
}
