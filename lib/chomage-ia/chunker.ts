/**
 * Découpage d'un texte en chunks pour l'indexation RAG.
 *
 * Stratégie :
 *   - Cible ~1000 caractères par chunk avec un overlap de 200 chars pour
 *     préserver le contexte entre chunks adjacents (utile pour les phrases
 *     coupées).
 *   - Préserve les frontières naturelles dans l'ordre : `\n\n` (paragraphes),
 *     puis `\n` (lignes), puis `. ` (phrases), puis fallback caractère.
 *   - Ignore les chunks plus courts que `minChars` (50 par défaut) SAUF le
 *     dernier — sinon on perdrait la fin du texte sur un résidu court.
 *
 * Cette implémentation est volontairement sans dépendance pour rester rapide
 * et déterministe (le `contentHash` doit être stable entre runs).
 */
export interface ChunkOptions {
  /** Taille cible d'un chunk en caractères. Défaut 1000. */
  maxChars?: number;
  /** Overlap entre 2 chunks consécutifs en caractères. Défaut 200. */
  overlap?: number;
  /** Taille minimale d'un chunk (sauf le dernier). Défaut 50. */
  minChars?: number;
}

export interface TextChunk {
  /** Index 0-based dans la source originale. */
  index: number;
  /** Contenu textuel du chunk. */
  content: string;
}

/**
 * Découpe `text` en chunks selon les options fournies.
 *
 * @example
 *   chunkText("Long texte…", { maxChars: 1000, overlap: 200 })
 *   // → [{index:0, content:"…"}, {index:1, content:"…"}, …]
 */
export function chunkText(
  text: string,
  opts: ChunkOptions = {},
): TextChunk[] {
  const maxChars = Math.max(100, opts.maxChars ?? 1000);
  const overlap = Math.max(0, Math.min(opts.overlap ?? 200, maxChars - 50));
  const minChars = Math.max(1, opts.minChars ?? 50);

  const trimmed = (text ?? "").trim();
  if (trimmed.length === 0) return [];

  // Si le texte tient entièrement dans un chunk → un seul.
  if (trimmed.length <= maxChars) {
    return [{ index: 0, content: trimmed }];
  }

  const chunks: TextChunk[] = [];
  let cursor = 0;
  let index = 0;
  const len = trimmed.length;

  while (cursor < len) {
    const remaining = len - cursor;
    // Si ce qui reste tient en un chunk, on prend tout (pas d'overlap final).
    if (remaining <= maxChars) {
      const piece = trimmed.slice(cursor).trim();
      if (piece.length > 0) {
        chunks.push({ index, content: piece });
        index++;
      }
      break;
    }

    // Cherche la meilleure frontière dans la fenêtre [cursor, cursor + maxChars].
    const windowEnd = cursor + maxChars;
    const splitPos = findBestSplit(trimmed, cursor, windowEnd);

    const piece = trimmed.slice(cursor, splitPos).trim();
    if (piece.length >= minChars) {
      chunks.push({ index, content: piece });
      index++;
    } else if (piece.length > 0 && chunks.length === 0) {
      // Cas dégénéré : tout début de doc est trop court — on garde quand même.
      chunks.push({ index, content: piece });
      index++;
    }

    // Avance le curseur en gardant `overlap` chars de recouvrement.
    // On veille à toujours progresser d'au moins 1 char pour éviter la boucle infinie.
    const advance = Math.max(1, splitPos - cursor - overlap);
    cursor += advance;
  }

  return chunks;
}

/**
 * Trouve la meilleure position pour couper `text` entre `start` et `end`.
 *
 * Préférence (dans l'ordre, on cherche la plus tardive dans la fenêtre) :
 *   1. `\n\n` (paragraphe) — la plus naturelle pour un texte rédigé
 *   2. `\n` (ligne)        — utile pour les listes, code, structures
 *   3. `. ` ou `! ` ou `? ` (fin de phrase)
 *   4. ` ` (espace, fallback)
 *   5. `end` (couper en plein milieu d'un mot — dernier recours)
 *
 * On cherche dans une fenêtre [start + minSlice, end] pour éviter de retourner
 * un chunk trop petit quand le séparateur naturel est trop proche du début.
 */
function findBestSplit(text: string, start: number, end: number): number {
  const minSlice = Math.floor((end - start) * 0.5); // au moins 50% du chunk
  const minSearch = start + minSlice;
  const realEnd = Math.min(end, text.length);

  // 1. Paragraphe `\n\n`
  const lastParagraph = text.lastIndexOf("\n\n", realEnd);
  if (lastParagraph >= minSearch) return lastParagraph + 2;

  // 2. Ligne `\n`
  const lastLine = text.lastIndexOf("\n", realEnd);
  if (lastLine >= minSearch) return lastLine + 1;

  // 3. Fin de phrase — on cherche `. `, `! `, `? ` (les plus tardifs)
  let lastSentence = -1;
  for (const seq of [". ", "! ", "? ", ".\n", "!\n", "?\n"]) {
    const p = text.lastIndexOf(seq, realEnd);
    if (p >= minSearch && p > lastSentence) lastSentence = p + 2;
  }
  if (lastSentence > 0) return lastSentence;

  // 4. Espace simple
  const lastSpace = text.lastIndexOf(" ", realEnd);
  if (lastSpace >= minSearch) return lastSpace + 1;

  // 5. Fallback brutal : couper en plein milieu (rare sur du français).
  return realEnd;
}

/**
 * Helper : calcule un sha256 hex tronqué à 32 chars pour identifier un chunk.
 * 32 chars suffisent largement pour skip la ré-indexation (collision quasi nulle).
 *
 * Importable depuis l'indexer sans dépendre de crypto côté chunker pur.
 */
export async function chunkContentHash(content: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}
