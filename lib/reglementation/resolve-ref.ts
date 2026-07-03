/**
 * Résolution des renvois internes du texte de loi (« l'article 36 ») vers les
 * fiches du corpus. Le riolexId est un slug déterministe `JJ_MM_AAAA-1-art_<num>`
 * dérivé de la date de la loi → on peut relier mécaniquement un renvoi à sa fiche.
 *
 * Sûreté : on ne crée un lien QUE si (1) la loi cible est identifiable sans
 * ambiguïté et (2) la fiche existe réellement (`ctx.exists`). Un renvoi vers une
 * autre loi (« de la loi du 25 avril 1963 ») reste du texte brut — sinon on
 * pointerait par erreur vers l'article homonyme de la loi courante.
 *
 * 100 % pur, testé unitairement.
 */

import type { Inline } from "./parse-amendments";

/** L'ONEM définit « l'arrêté royal » = AR 25/11/1991, « l'arrêté ministériel » = AM 26/11/1991. */
const AR_MAIN = "25_11_1991";
const AM_MAIN = "26_11_1991";

const LATIN =
  "bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies|undecies|duodecies";
const ARTICLE_NUM = `\\d+(?:${LATIN})?(?:/\\d+)?`;
const ART_PATTERN = `\\barticles?\\s+(${ARTICLE_NUM})`;

/** « AR 25/11/1991 » → « 25_11_1991 » (préfixe du riolexId). */
export function loiToPrefix(loi: string | null | undefined): string | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(loi ?? "");
  if (!m) return null;
  return `${m[1].padStart(2, "0")}_${m[2].padStart(2, "0")}_${m[3]}`;
}

/** Construit le riolexId cible d'un article dans une loi donnée. */
export function articleToRiolexId(prefix: string, articleNumber: string): string {
  return `${prefix}-1-art_${articleNumber.toLowerCase()}`;
}

export interface RefContext {
  /** Préfixe de la loi de l'article courant (renvoi non qualifié → cette loi). */
  currentPrefix: string | null;
  /** Vrai si la fiche existe dans le corpus visible par l'utilisateur. */
  exists: (riolexId: string) => boolean;
}

/**
 * Détermine la loi cible d'après le texte qui SUIT le numéro d'article.
 * Renvoie null (= pas de lien) si le renvoi vise une autre loi non résoluble.
 */
function targetPrefix(after: string, ctx: RefContext): string | null {
  const a = after.slice(0, 70);
  if (/^\s*,?\s*de la loi\b/i.test(a)) return null;
  if (/^\s*,?\s*du décret\b/i.test(a)) return null;
  if (/^\s*,?\s*de l['’]ordonnance\b/i.test(a)) return null;
  if (/^\s*,?\s*de l['’]arrêté-loi\b/i.test(a)) return null;
  if (/^\s*,?\s*de l['’]arrêté royal\b/i.test(a)) {
    // « de l'arrêté royal » seul = AR 25/11/1991 ; daté différemment = autre AR.
    return /de l['’]arrêté royal du \d/i.test(a) ? null : AR_MAIN;
  }
  if (/^\s*,?\s*de l['’]arrêté ministériel\b/i.test(a)) {
    return /de l['’]arrêté ministériel du \d/i.test(a) ? null : AM_MAIN;
  }
  // Aucun qualificatif (ou « du présent arrêté ») → loi courante.
  return ctx.currentPrefix;
}

/** Transforme un texte brut en segments texte / renvoi cliquable. */
function linkifyText(text: string, ctx: RefContext): Inline[] {
  const re = new RegExp(ART_PATTERN, "gi");
  const out: Inline[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const num = m[1];
    const prefix = targetPrefix(text.slice(m.index + m[0].length), ctx);
    if (!prefix) continue;
    const rid = articleToRiolexId(prefix, num);
    if (!ctx.exists(rid)) continue;
    if (m.index > cursor) out.push({ t: "text", text: text.slice(cursor, m.index) });
    out.push({ t: "ref", text: m[0], riolexId: rid });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) out.push({ t: "text", text: text.slice(cursor) });
  return out;
}

/**
 * Post-traite des segments inline (issus de parseInline) en transformant les
 * renvois d'articles des segments TEXTE en liens. Les autres segments
 * (amendements, marqueurs) passent inchangés.
 */
export function linkifyRefs(segments: Inline[], ctx: RefContext): Inline[] {
  const out: Inline[] = [];
  for (const seg of segments) {
    if (seg.t !== "text") {
      out.push(seg);
      continue;
    }
    out.push(...linkifyText(seg.text, ctx));
  }
  return out;
}

/**
 * Linkifie les renvois croisés du format « VOIR AUSSI » des commentaires ONEM
 * (« AR art. 74bis », « AM art. 1 »). AR → AR 25/11/1991, AM → AM 26/11/1991.
 * Ne relie que ce qui existe ; le reste (ranges, sous-items) reste du texte.
 */
export function linkifyCrossRefs(
  text: string,
  exists: (id: string) => boolean,
): Inline[] {
  const re = new RegExp(`\\b(AR|AM)\\s+art\\.?\\s*(${ARTICLE_NUM})`, "gi");
  const out: Inline[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text ?? ""))) {
    const prefix = /^ar$/i.test(m[1]) ? AR_MAIN : AM_MAIN;
    const rid = articleToRiolexId(prefix, m[2]);
    if (!exists(rid)) continue;
    if (m.index > cursor) out.push({ t: "text", text: text.slice(cursor, m.index) });
    out.push({ t: "ref", text: m[0], riolexId: rid });
    cursor = m.index + m[0].length;
  }
  if (cursor < (text ?? "").length) out.push({ t: "text", text: text.slice(cursor) });
  return out;
}

/**
 * Ensemble des riolexId d'articles réellement cités par un texte (liens
 * sortants résolus). Utilisé pour construire le graphe « cité par ».
 */
export function collectRefTargets(text: string, ctx: RefContext): string[] {
  const re = new RegExp(ART_PATTERN, "gi");
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text ?? ""))) {
    const prefix = targetPrefix(text.slice(m.index + m[0].length), ctx);
    if (!prefix) continue;
    const rid = articleToRiolexId(prefix, m[1]);
    if (ctx.exists(rid)) out.add(rid);
  }
  return [...out];
}
