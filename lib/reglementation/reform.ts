/**
 * Extraction des passages modifiés par la réforme chômage (Loi-programme
 * 18/07/2025, EV 01/03/2026). Les passages insérés/modifiés sont dans les
 * crochets tagués : `[texte inséré (Loi-programme 18.7.2025 - MB 29.7 - EV 1.3.2026)]`.
 * On extrait le contenu du crochet (ref d'acte retirée pour l'affichage). Les
 * crochets déséquilibrés/multi-lignes sont ignorés (repli : « voir l'article »).
 * 100 % pur, testé.
 */

export const REFORM_MARKER = "Loi-programme 18.7.2025";

/** Vrai si le texte est touché par la réforme 2026. */
export function isReformArticle(text: string): boolean {
  return (text ?? "").includes(REFORM_MARKER);
}

/** Passages (crochets équilibrés) modifiés par la réforme, ref d'acte retirée. */
export function extractReformPassages(text: string): string[] {
  const src = text ?? "";
  const re = /\[([^[\]]*Loi-programme 18\.7\.2025[^[\]]*)\]/g;
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const passage = m[1]
      .replace(/\(Loi-programme 18\.7\.2025[^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (passage && !seen.has(passage)) {
      seen.add(passage);
      out.push(passage);
    }
  }
  return out;
}
