import { AcroFieldRaw, PdfFormField } from "./types";

export interface SchemaDiff {
  added: string[]; // pdfFieldName ajoutés
  removed: string[]; // pdfFieldName disparus
  renamed: Array<{ from: string; to: string }>; // heuristique
  unchanged: string[];
}

/// Similarité simple (Dice sur bigrammes) pour détecter un renommage probable.
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string) => {
    const g = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
    return g;
  };
  const ga = grams(a.toLowerCase());
  const gb = grams(b.toLowerCase());
  let inter = 0;
  for (const x of ga) if (gb.has(x)) inter++;
  return (2 * inter) / (ga.size + gb.size);
}

/// Compare l'ancien schéma technique au nouveau (après ré-upload d'un PDF).
/// Détecte ajouts / suppressions / renommages probables pour guider la
/// migration des enrichissements.
export function computeTechnicalDiff(
  oldFields: AcroFieldRaw[],
  newFields: AcroFieldRaw[]
): SchemaDiff {
  const oldNames = oldFields.map((f) => f.pdfFieldName);
  const newNames = newFields.map((f) => f.pdfFieldName);
  const oldSet = new Set(oldNames);
  const newSet = new Set(newNames);

  const added = newNames.filter((n) => !oldSet.has(n));
  const removed = oldNames.filter((n) => !newSet.has(n));
  const unchanged = newNames.filter((n) => oldSet.has(n));

  // Renommages : pour chaque "removed", chercher un "added" très similaire.
  const renamed: Array<{ from: string; to: string }> = [];
  const usedAdded = new Set<string>();
  for (const from of removed) {
    let best: { to: string; score: number } | null = null;
    for (const to of added) {
      if (usedAdded.has(to)) continue;
      const score = similarity(from, to);
      if (score >= 0.6 && (!best || score > best.score)) best = { to, score };
    }
    if (best) {
      renamed.push({ from, to: best.to });
      usedAdded.add(best.to);
    }
  }

  return {
    added: added.filter((n) => !usedAdded.has(n)),
    removed: removed.filter((n) => !renamed.some((r) => r.from === n)),
    renamed,
    unchanged,
  };
}

/// Applique un diff à l'enrichissement existant : conserve les champs inchangés
/// et renommés (en mettant à jour pdfFieldName), retire les supprimés, et
/// renvoie les `pdfFieldName` ajoutés (à enrichir, fournis séparément).
export function migrateEnrichment(
  oldEnriched: PdfFormField[],
  diff: SchemaDiff
): { kept: PdfFormField[]; addedNames: string[] } {
  const renameMap = new Map(diff.renamed.map((r) => [r.from, r.to]));
  const removedSet = new Set(diff.removed);

  const kept = oldEnriched
    .filter((f) => !removedSet.has(f.pdfFieldName))
    .map((f) => {
      const to = renameMap.get(f.pdfFieldName);
      return to ? { ...f, pdfFieldName: to } : f;
    });

  return { kept, addedNames: diff.added };
}
