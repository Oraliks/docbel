/**
 * Sanitizer HTML léger pour les descriptions de changelog.
 *
 * On accepte que l'éditeur Tiptap produit déjà un HTML très restreint
 * (StarterKit + Link + Table + Image), donc cette passe sert surtout de
 * défense en profondeur côté serveur contre :
 *   - les balises dangereuses (`<script>`, `<iframe>`, `<object>`, …)
 *   - les gestionnaires d'événements inline (`onclick`, `onerror`, …)
 *   - les protocoles dangereux dans `href`/`src` (`javascript:`, `vbscript:`,
 *     `data:` non-image)
 *
 * Pas de dépendance jsdom — regex strictes seulement. C'est intentionnel
 * pour éviter d'alourdir le bundle serveur.
 */

const DANGEROUS_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "style",
  "link",
  "meta",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "video",
  "audio",
  "source",
  "track",
  "applet",
  "base",
];

// Capture <tag …>…</tag> (avec contenu) et <tag …/> (auto-fermants)
const dangerousPairRegex = new RegExp(
  `<\\s*(${DANGEROUS_TAGS.join("|")})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`,
  "gi"
);
const dangerousSelfClosingRegex = new RegExp(
  `<\\s*(${DANGEROUS_TAGS.join("|")})\\b[^>]*\\/?>`,
  "gi"
);

// Attributs gestionnaires d'événements (onclick, onerror, …) — guillemets simples, doubles, ou sans
const eventHandlerRegex = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// Protocoles dangereux dans href / src (on autorise data:image/* pour les images Tiptap)
const dangerousUrlRegex =
  /\s+(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data(?!:image\/)):[^"']*\2/gi;

/**
 * Nettoie un HTML produit par notre éditeur avant stockage. Pas destiné
 * à un HTML « inconnu » provenant d'Internet — pour ce cas il faut un vrai
 * sanitizer DOM (cf. `lib/inbox/sanitize.ts`).
 */
export function sanitizeChangelogHtml(input: string): string {
  if (!input) return "";
  let out = input;
  // 1) Strip toutes les balises dangereuses (paires d'abord pour bien retirer le contenu)
  out = out.replace(dangerousPairRegex, "");
  out = out.replace(dangerousSelfClosingRegex, "");
  // 2) Strip gestionnaires d'événements
  out = out.replace(eventHandlerRegex, "");
  // 3) Strip protocoles dangereux dans href/src
  out = out.replace(dangerousUrlRegex, "");
  return out.trim();
}
