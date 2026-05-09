/// Helpers pour appliquer les corrections OCR mémorisées aux nouvelles détections.
/// Utilise une distance de Levenshtein normalisée pour le fuzzy match.

export interface StoredCorrection {
  id: string;
  templateId: string | null;
  rawLabel: string;
  cleanLabel: string;
  fieldType: string | null;
  presetId: string | null;
  occurrences: number;
}

/// Distance de Levenshtein entre deux chaînes.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Matrice 2D simple
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/// Normalise un label pour comparaison (enlève ponctuation, accents, casse).
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/// Cherche la meilleure correction pour un label brut.
/// Retourne null si aucun match suffisamment proche n'est trouvé.
/// Seuil par défaut : distance ≤ 20% de la longueur du label.
export function findBestCorrection(
  rawLabel: string,
  corrections: StoredCorrection[],
  threshold = 0.2
): StoredCorrection | null {
  if (!rawLabel || corrections.length === 0) return null;
  const normRaw = normalizeForMatch(rawLabel);
  if (!normRaw) return null;

  let best: { correction: StoredCorrection; distance: number } | null = null;
  for (const c of corrections) {
    const normStored = normalizeForMatch(c.rawLabel);
    if (!normStored) continue;
    const dist = levenshtein(normRaw, normStored);
    const maxLen = Math.max(normRaw.length, normStored.length);
    const ratio = dist / maxLen;
    if (ratio > threshold) continue;
    // Pondère par occurrences : une correction vue 10x est plus prioritaire qu'une vue 1x
    const score = dist - Math.log(c.occurrences + 1) * 0.5;
    if (!best || score < best.distance) {
      best = { correction: c, distance: score };
    }
  }
  return best?.correction ?? null;
}
