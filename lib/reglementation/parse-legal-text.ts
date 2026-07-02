export type LegalBlock = {
  type: "section" | "paragraph" | "list-item" | "abroge";
  marker?: string;
  text: string;
};

const SECTION_RE = /^(§\s*\d+(?:er)?)\s*\.?\s*/;
const NUM_ITEM_RE = /^(\d+°(?:\/\d+)?|[a-z]\))\s+/;
const DASH_ITEM_RE = /^[-–]\s+/;

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
    const sec = SECTION_RE.exec(line);
    if (sec) {
      blocks.push({ type: "section", marker: sec[1].replace(/\s+/g, " ").trim(), text: line.slice(sec[0].length).trim() });
      continue;
    }
    const num = NUM_ITEM_RE.exec(line);
    if (num) {
      blocks.push({ type: "list-item", marker: num[1], text: line.slice(num[0].length).trim() });
      continue;
    }
    if (DASH_ITEM_RE.test(line)) {
      blocks.push({ type: "list-item", marker: "–", text: line.replace(DASH_ITEM_RE, "").trim() });
      continue;
    }
    blocks.push({ type: "paragraph", text: line });
  }
  return blocks;
}

export type OnemComment = {
  index: number;
  date: string | null;
  institution: string | null;
  text: string;
};

const COMMENT_SPLIT_RE = /^Commentaire\s+(\d+)\s*$/im;

export function splitOnemCommentary(raw: string): OnemComment[] {
  const src = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!src) return [];
  // Découpe en gardant les entêtes "Commentaire N".
  const parts = src.split(/(?=^Commentaire\s+\d+\s*$)/im).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length === 1 && !COMMENT_SPLIT_RE.test(parts[0])) {
    return [{ index: 1, date: null, institution: null, text: parts[0] }];
  }
  return parts.map((part, i) => {
    const m = /^Commentaire\s+(\d+)\s*/i.exec(part);
    const index = m ? parseInt(m[1], 10) : i + 1;
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
    return { index, date, institution, text: rest };
  });
}
