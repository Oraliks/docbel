/**
 * Helpers partagés pour le command palette `/<shortcut>` dans la textarea
 * chat / prompt brief.
 *
 * Pattern : l'utilisateur tape `/` (au début d'une ligne ou après un espace),
 * suivi d'un fragment de shortcut (a-z, 0-9, tiret, underscore). On détecte
 * le token "actif" autour du curseur, on filtre la liste des snippets sur
 * `shortcut` et `title`, et au choix on remplace le `/query` par le contenu.
 *
 * Pour rester côté client uniquement (pas de dep sur prisma), tout est pur ici.
 */

export interface SnippetLike {
  id: string;
  shortcut: string;
  title: string;
  content: string;
}

/**
 * Forme du token détecté dans la textarea (autour du curseur).
 *
 * - `start` / `end` : positions absolues dans `value` du `/` jusqu'à la fin du
 *   token (où on doit remplacer si on insère un snippet).
 * - `query` : ce qui suit le `/` (peut être vide juste après la frappe du `/`).
 */
export interface SlashToken {
  start: number;
  end: number;
  query: string;
}

/**
 * Détecte si le curseur est dans un token `/...` actif et le renvoie.
 *
 * Conditions d'activation :
 *   1. Il existe un `/` quelque part avant le curseur sur la ligne courante,
 *      ou plus généralement précédé d'un caractère whitespace / début de chaîne.
 *   2. Entre le `/` et le curseur, on n'a vu que des chars `[a-zA-Z0-9_-]`
 *      (donc pas d'espace, pas de retour à la ligne, pas de ponctuation).
 *   3. Le `/` n'est PAS précédé d'un autre `/` collé (évite `//doc` qui ressemble
 *      à un commentaire / chemin).
 *
 * Renvoie `null` si aucun token actif (donc la palette ne doit pas s'ouvrir).
 *
 * @param value La valeur courante de la textarea.
 * @param cursor La position du curseur (0-based, valeur de `selectionStart`).
 */
export function detectSlashToken(
  value: string,
  cursor: number
): SlashToken | null {
  if (cursor < 0 || cursor > value.length) return null;

  // Cherche le dernier `/` avant le curseur en remontant.
  let i = cursor - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === "/") break;
    // Si on rencontre un char non-shortcut, le token est invalide.
    if (!/[a-zA-Z0-9_-]/.test(ch)) return null;
    i--;
  }
  if (i < 0 || value[i] !== "/") return null;

  // Vérifie le contexte gauche du `/` : début de chaîne, whitespace ou retour
  // à la ligne. On REFUSE si précédé par un autre `/` (cas `//path`).
  const left = i === 0 ? "" : value[i - 1];
  if (left && !/\s/.test(left)) return null;

  // Extrait la query : chars [a-zA-Z0-9_-]* après le `/` jusqu'au curseur.
  const query = value.slice(i + 1, cursor);
  if (!/^[a-zA-Z0-9_-]*$/.test(query)) return null;

  // Étend la fin du token au-delà du curseur tant qu'on est sur des chars
  // valides (pour que le remplacement écrase aussi ce qui suit le curseur si
  // l'utilisateur a tapé `/calc<cursor>pat` par exemple).
  let endExclusive = cursor;
  while (endExclusive < value.length && /[a-zA-Z0-9_-]/.test(value[endExclusive])) {
    endExclusive++;
  }

  return { start: i, end: endExclusive, query };
}

/**
 * Filtre les snippets sur la query d'un `SlashToken`. Algo simple :
 *   - 1) Match exact sur `shortcut` → top du résultat.
 *   - 2) Match au début de `shortcut` (preserve l'ordre original).
 *   - 3) Match dans `shortcut` ou `title` (case-insensitive).
 *
 * Si `query` est vide, renvoie la liste complète (utile juste après la frappe
 * du `/` pour afficher tout).
 */
export function filterSnippets<T extends SnippetLike>(
  snippets: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return snippets;

  const exact: T[] = [];
  const prefix: T[] = [];
  const contains: T[] = [];
  const seen = new Set<string>();

  for (const s of snippets) {
    const sc = s.shortcut.toLowerCase();
    const tt = s.title.toLowerCase();
    if (sc === q) {
      exact.push(s);
      seen.add(s.id);
    } else if (sc.startsWith(q)) {
      prefix.push(s);
      seen.add(s.id);
    } else if (sc.includes(q) || tt.includes(q)) {
      contains.push(s);
      seen.add(s.id);
    }
  }

  return [...exact, ...prefix, ...contains].filter(
    (s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx && seen.has(s.id)
  );
}

/**
 * Remplace le token `/query` par `content` dans la textarea et renvoie :
 *   - la nouvelle valeur
 *   - la position du curseur APRÈS le contenu inséré (pour qu'on puisse
 *     `setSelectionRange(newPos, newPos)`).
 *
 * Si `addTrailingSpace` est true, on ajoute un espace après le contenu sauf
 * si le contenu se termine déjà par un whitespace ou si le char suivant dans
 * la textarea est déjà un espace.
 */
export function insertSnippetContent(
  value: string,
  token: SlashToken,
  content: string,
  options: { addTrailingSpace?: boolean } = {}
): { value: string; cursor: number } {
  const before = value.slice(0, token.start);
  const after = value.slice(token.end);

  let inserted = content;
  if (options.addTrailingSpace) {
    const endsWithSpace = /\s$/.test(inserted);
    const nextIsSpace = after.length > 0 && /\s/.test(after[0]);
    if (!endsWithSpace && !nextIsSpace) inserted += " ";
  }

  const nextValue = before + inserted + after;
  const nextCursor = (before + inserted).length;
  return { value: nextValue, cursor: nextCursor };
}

/**
 * Échappe les chars HTML d'un texte court pour l'afficher dans la palette
 * sans risque XSS (utilisé pour mettre en gras la partie matchée).
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
