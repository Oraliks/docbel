// Enrichissement automatique du HTML rich-text avec les sigles du glossaire.
//
// Pourquoi ce fichier existe :
//   Les actualités, blocs de texte et cartes du page-builder sont saisis
//   par les admins dans un éditeur Tiptap et stockés en base sous forme
//   de HTML. Plutôt que de demander aux rédacteurs de balader manuellement
//   des <abbr> dans leur texte, on enrichit l'HTML au moment du rendu —
//   les sigles connus deviennent des <abbr class="acronym-tip" …> et le
//   navigateur affiche une infobulle native (avec en plus le style glass
//   donné par globals.css).
//
// Sécurité :
//   On n'ajoute QUE des attributs `class`, `data-acronym`, `title` et
//   `tabindex` à un élément <abbr>. Aucun script, aucun style inline, donc
//   pas de surface d'injection XSS introduite par cette fonction.
//   Le `title` est échappé proprement (`escapeHtmlAttr`).
//
// Idempotence :
//   Les <abbr> déjà présents sont laissés intacts (ancêtre dans la liste
//   `SKIP_ANCESTORS`), donc rejouer la fonction n'imbrique pas.

import { ACRONYM_REGEX, lookupAcronym } from "./acronyms";

/**
 * Ancêtres dans lesquels on n'enrichit PAS le texte :
 *   - <a>      : un sigle dans un lien doit rester un lien, pas un sigle
 *                cliquable ambigu (et imbriquer <abbr> dans <a> est moche).
 *   - <abbr>   : déjà annoté, on ne ré-enveloppe pas.
 *   - <code>, <pre>, <kbd>, <samp> : zone de code, on ne touche pas.
 *   - <script>, <style> : évidemment.
 *   - <textarea>, <title> : contenu textuel non rendu en arborescence.
 */
const SKIP_ANCESTORS = new Set([
  "a",
  "abbr",
  "code",
  "pre",
  "kbd",
  "samp",
  "script",
  "style",
  "textarea",
  "title",
]);

/** Balises auto-fermantes en HTML — pas à empiler. */
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Wrap automatiquement chaque sigle du glossaire dans l'HTML donné.
 * Retourne l'HTML enrichi, prêt à être injecté via `dangerouslySetInnerHTML`.
 *
 * Si la chaîne ne contient aucun sigle connu, on renvoie le HTML inchangé
 * (court-circuit pour éviter de tout retokeniser pour rien).
 */
export function enrichHtmlWithAcronyms(html: string): string {
  if (!html) return html;
  // Court-circuit : si la regex ne matche rien sur la string brute, on
  // gagne tout le coût de tokenisation. On reset lastIndex juste après.
  ACRONYM_REGEX.lastIndex = 0;
  if (!ACRONYM_REGEX.test(html)) {
    ACRONYM_REGEX.lastIndex = 0;
    return html;
  }
  ACRONYM_REGEX.lastIndex = 0;

  const stack: string[] = [];
  let out = "";
  let i = 0;

  while (i < html.length) {
    const ch = html[i];

    if (ch === "<") {
      // Commentaires HTML : on les saute en bloc, sinon "<!--" plante le
      // parseur de tags qu'on a fait à la main.
      if (html.startsWith("<!--", i)) {
        const endComment = html.indexOf("-->", i + 4);
        const stop = endComment < 0 ? html.length : endComment + 3;
        out += html.slice(i, stop);
        i = stop;
        continue;
      }

      const close = html.indexOf(">", i);
      if (close < 0) {
        // Tag mal formé : on dump le reste tel quel.
        out += html.slice(i);
        break;
      }
      const tag = html.slice(i, close + 1);
      out += tag;

      const nameMatch = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag);
      if (nameMatch) {
        const name = nameMatch[1].toLowerCase();
        if (tag.startsWith("</")) {
          // Closing tag : on pop jusqu'au dernier match.
          const idx = stack.lastIndexOf(name);
          if (idx >= 0) stack.length = idx;
        } else if (!tag.endsWith("/>") && !VOID_TAGS.has(name)) {
          stack.push(name);
        }
      }
      i = close + 1;
      continue;
    }

    // Segment texte jusqu'au prochain "<".
    const next = html.indexOf("<", i);
    const end = next < 0 ? html.length : next;
    const text = html.slice(i, end);

    if (stack.some((s) => SKIP_ANCESTORS.has(s))) {
      out += text;
    } else {
      out += enrichTextChunk(text);
    }
    i = end;
  }

  return out;
}

/**
 * Remplace chaque sigle connu dans un segment de texte par un <abbr>.
 * Les sigles n'ayant pas de caractères HTML-spéciaux (uniquement
 * `[A-Za-z0-9]`), pas besoin d'échapper leur contenu.
 */
function enrichTextChunk(text: string): string {
  ACRONYM_REGEX.lastIndex = 0;
  let out = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = ACRONYM_REGEX.exec(text)) !== null) {
    const matched = match[0];
    const entry = lookupAcronym(matched);
    if (!entry) continue;
    out += text.slice(cursor, match.index);
    const title = `${entry.label} — ${entry.definition}`;
    out += `<abbr class="acronym-tip" data-acronym="${escapeHtmlAttr(entry.code)}" title="${escapeHtmlAttr(
      title,
    )}" tabindex="0">${matched}</abbr>`;
    cursor = match.index + matched.length;
  }
  if (cursor === 0) return text;
  out += text.slice(cursor);
  return out;
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
