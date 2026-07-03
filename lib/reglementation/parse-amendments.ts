/**
 * Analyse des références de modification (« amendements ») et des marqueurs
 * RioLex inline présents dans le texte consolidé du corpus.
 *
 * Deux gisements exploités :
 *  1. Les références d'actes modificateurs, ex. `(AR 30.7.2022 - MB 23.8 - EV 1.10)`
 *     → rendues cliquables (popover « Modifié par… ») et agrégées en timeline.
 *  2. Les ancres RioLex `{n}` et l'icône `❌` :
 *     - `{n} ❌` = fragment supprimé (texte retiré sans remplacement) ;
 *     - `{n}` seul = fragment modifié (le contenu historique du popup RioLex
 *       n'a pas été capturé à l'extraction — on le signale honnêtement).
 *
 * 100 % pur (aucun accès réseau/DB), testé unitairement.
 */

/** Natures d'actes reconnues en tête de parenthèse (ordre = priorité de match). */
const NATURE_ALT =
  "Loi-programme|Arrêté-loi|Arrete-loi|Arr\\.-loi|AR|AM|Loi|L\\.";

/**
 * Motif d'un amendement : une parenthèse commençant par une nature + une date
 * j.m.aaaa. Exposé en CHAÎNE (pas en RegExp partagée) car une RegExp `g` porte
 * un `lastIndex` mutable : la partager entre une boucle `exec` et un appel
 * réentrant (parseAmendmentRef) corromprait l'état → boucle infinie. Chaque
 * consommateur construit donc sa propre instance.
 */
const AMENDMENT_PATTERN = `\\((${NATURE_ALT})\\s+(\\d{1,2}\\.\\d{1,2}(?:\\.\\d{2,4})?)([^)]*)\\)`;

/** Nouvelle RegExp non-globale (match unique) ou globale (balayage). */
function amendmentRe(global: boolean): RegExp {
  return new RegExp(AMENDMENT_PATTERN, global ? "g" : "");
}

/** Normalise une nature brute vers une clé stable. */
function normNature(raw: string): string {
  const r = raw.trim();
  if (/^Loi-programme$/i.test(r)) return "Loi-programme";
  if (/^(Arrêté-loi|Arrete-loi|Arr\.-loi)$/i.test(r)) return "Arrete-loi";
  if (/^AR$/i.test(r)) return "AR";
  if (/^AM$/i.test(r)) return "AM";
  if (/^(Loi|L\.)$/i.test(r)) return "Loi";
  return r;
}

/**
 * Normalise une date `j.m[.aaaa]` en `JJ/MM/AAAA` (année héritée de `fallbackYear`
 * si absente). Renvoie `{ display, year }` ou null si non parsable.
 */
function normDate(
  raw: string,
  fallbackYear: number | null,
): { display: string; year: number } | null {
  const m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/.exec(raw.trim());
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  let year: number;
  if (m[3]) {
    const y = parseInt(m[3], 10);
    // Année à 2 chiffres → heuristique siècle (rare dans le corpus).
    year = m[3].length <= 2 ? (y >= 50 ? 1900 + y : 2000 + y) : y;
  } else if (fallbackYear !== null) {
    year = fallbackYear;
  } else {
    return null;
  }
  return { display: `${day}/${month}/${String(year).padStart(4, "0")}`, year };
}

export interface AmendmentRef {
  raw: string;
  nature: string | null;
  dateActe: string | null;
  dateMB: string | null;
  dateEV: string | null;
  evYear: number | null;
}

/** Parse une seule référence `(NATURE date - MB … - EV …)`. Null si non-amendement. */
export function parseAmendmentRef(raw: string): AmendmentRef | null {
  const m = amendmentRe(false).exec(raw);
  if (!m) return null;

  const nature = normNature(m[1]);
  const acte = normDate(m[2], null);
  const tail = m[3] ?? "";

  let dateMB: string | null = null;
  const mbM = /MB\s+(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)/i.exec(tail);
  if (mbM) dateMB = normDate(mbM[1], acte?.year ?? null)?.display ?? null;

  let dateEV: string | null = null;
  let evYear: number | null = null;
  const evM = /EV\s+([^,)]+)/i.exec(tail);
  if (evM) {
    const evRaw = evM[1].trim();
    const evDate = /^\d{1,2}\.\d{1,2}(?:\.\d{2,4})?$/.exec(evRaw)
      ? normDate(evRaw, acte?.year ?? null)
      : null;
    if (evDate) {
      dateEV = evDate.display;
      evYear = evDate.year;
    } else {
      dateEV = evRaw; // ex. « à déterminer »
    }
  }

  return {
    raw: m[0],
    nature,
    dateActe: acte?.display ?? null,
    dateMB,
    dateEV,
    evYear,
  };
}

export type Inline =
  | { t: "text"; text: string }
  | { t: "amendment"; ref: AmendmentRef }
  | { t: "deleted" }
  | { t: "modified"; n: number };

/** `{n} ❌` (fragment supprimé) ou `{n}` seul (fragment modifié). */
const MARKER_PATTERN = "\\{(\\d+)\\}\\s*(❌)?";

/**
 * Découpe un texte en segments : texte / amendement cliquable / marqueur
 * supprimé / marqueur modifié. Les amendements ont priorité sur les marqueurs
 * quand ils se chevauchent (ordre de balayage par position croissante).
 */
export function parseInline(text: string): Inline[] {
  const src = text ?? "";
  if (!src) return [];

  // Collecte toutes les correspondances (amendements + marqueurs) avec positions.
  // Regexes locales (jamais partagées) : lastIndex propre à chaque balayage.
  type Hit = { start: number; end: number; seg: Inline };
  const hits: Hit[] = [];

  const are = amendmentRe(true);
  let a: RegExpExecArray | null;
  while ((a = are.exec(src))) {
    const ref = parseAmendmentRef(a[0]);
    if (ref) hits.push({ start: a.index, end: a.index + a[0].length, seg: { t: "amendment", ref } });
  }

  const mre = new RegExp(MARKER_PATTERN, "g");
  let mk: RegExpExecArray | null;
  while ((mk = mre.exec(src))) {
    hits.push({
      start: mk.index,
      end: mk.index + mk[0].length,
      seg: mk[2] ? { t: "deleted" } : { t: "modified", n: parseInt(mk[1], 10) },
    });
  }

  hits.sort((x, y) => x.start - y.start);

  const out: Inline[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue; // chevauchement : on ignore le second
    if (h.start > cursor) {
      const chunk = src.slice(cursor, h.start);
      if (chunk) out.push({ t: "text", text: chunk });
    }
    out.push(h.seg);
    cursor = h.end;
  }
  if (cursor < src.length) {
    const rest = src.slice(cursor);
    if (rest) out.push({ t: "text", text: rest });
  }
  return out;
}

/** Toutes les refs d'amendement d'un texte (multi-lignes), dédupliquées par `raw`. */
export function extractAmendments(text: string): AmendmentRef[] {
  const src = text ?? "";
  const seen = new Set<string>();
  const out: AmendmentRef[] = [];
  const are = amendmentRe(true);
  let m: RegExpExecArray | null;
  while ((m = are.exec(src))) {
    const ref = parseAmendmentRef(m[0]);
    if (ref && !seen.has(ref.raw)) {
      seen.add(ref.raw);
      out.push(ref);
    }
  }
  return out;
}

/** Convertit `JJ/MM/AAAA` en clé triable AAAAMMJJ (ou -1 si non daté). */
function evSortKey(ref: AmendmentRef): number {
  if (!ref.dateEV || !/^\d{2}\/\d{2}\/\d{4}$/.test(ref.dateEV)) return -1;
  const [d, m, y] = ref.dateEV.split("/");
  return parseInt(`${y}${m}${d}`, 10);
}

/** Date d'entrée en vigueur la plus récente parmi des refs (ou null). */
export function latestEV(refs: AmendmentRef[]): string | null {
  let best: AmendmentRef | null = null;
  let bestKey = -1;
  for (const r of refs) {
    const k = evSortKey(r);
    if (k > bestKey) {
      bestKey = k;
      best = r;
    }
  }
  return best && bestKey >= 0 ? best.dateEV : null;
}

/** Tri chronologique des refs par date EV croissante (non datées en fin). */
export function sortAmendmentsByEV(refs: AmendmentRef[]): AmendmentRef[] {
  return [...refs].sort((a, b) => {
    const ka = evSortKey(a);
    const kb = evSortKey(b);
    if (ka === -1 && kb === -1) return 0;
    if (ka === -1) return 1;
    if (kb === -1) return -1;
    return ka - kb;
  });
}
