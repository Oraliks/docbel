import DOMPurify from "dompurify";

/**
 * Sanitiseur HTML partagé pour le contenu rendu via `dangerouslySetInnerHTML`
 * (blocs du page-builder, articles d'actualité, etc.).
 *
 * Ces composants sont des Client Components ("use client") MAIS sont rendus
 * aussi côté serveur (SSR) pour les pages publiques. Or `dompurify` est un
 * no-op quand `window` est absent : utilisé seul, il laisserait passer du HTML
 * hostile dans la réponse serveur (un `<img onerror>` s'exécute avant même
 * l'hydratation). On applique donc une défense en profondeur en DEUX passes :
 *
 *   1. `stripDangerousHtml` — passe regex ISOMORPHE (serveur + client) qui
 *      retire `<script>/<iframe>/...`, les gestionnaires d'événements inline
 *      (`on*`) et les protocoles dangereux (`javascript:`, `data:` non-image).
 *      Garantit que le HTML émis en SSR ne contient aucun vecteur exécutable.
 *   2. DOMPurify — allowlist stricte de balises/attributs, effective côté
 *      client (à l'hydratation). Sans jsdom : on ne veut pas alourdir le bundle
 *      serveur (même choix que `lib/changelog/sanitize.ts`).
 */

const DANGEROUS_TAGS = [
  "script", "iframe", "object", "embed", "style", "link", "meta", "form",
  "input", "button", "select", "textarea", "video", "audio", "source",
  "track", "applet", "base", "noscript", "template",
];

const dangerousPairRegex = new RegExp(
  `<\\s*(${DANGEROUS_TAGS.join("|")})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`,
  "gi"
);
const dangerousSelfClosingRegex = new RegExp(
  `<\\s*(${DANGEROUS_TAGS.join("|")})\\b[^>]*\\/?>`,
  "gi"
);
const eventHandlerRegex = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const dangerousUrlRegex =
  /\s+(href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript|vbscript|data(?!:image\/)):[^"']*\2/gi;

// Sandbox forcé sur les <iframe> du bloc Embed (cf. forceIframeSandbox).
// `allow-scripts allow-same-origin` est requis pour les players (YouTube/Vimeo,
// cartes Google…) ; on n'accorde PAS top-navigation/pointer-lock/modals.
const FORCED_IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-popups";
const iframeOpenTagRegex = /<\s*iframe\b[^>]*>/gi;

/**
 * Force `sandbox` (s'il est absent) et `referrerpolicy="no-referrer"` sur chaque
 * balise `<iframe>` ouvrante. Isomorphe (regex) : garantit que le HTML émis en
 * SSR est déjà confiné, sans attendre l'hydratation côté client. Si l'auteur a
 * déjà mis un `sandbox`, on respecte sa valeur (potentiellement plus stricte).
 */
function forceIframeSandbox(input: string): string {
  return input.replace(iframeOpenTagRegex, (tag) => {
    let out = tag;
    if (!/\bsandbox\s*=/i.test(out)) {
      out = out.replace(/<\s*iframe\b/i, `$& sandbox="${FORCED_IFRAME_SANDBOX}"`);
    }
    if (!/\breferrerpolicy\s*=/i.test(out)) {
      out = out.replace(/<\s*iframe\b/i, `$& referrerpolicy="no-referrer"`);
    }
    return out;
  });
}

/**
 * Passe isomorphe (sûre côté serveur) qui neutralise les vecteurs XSS
 * exécutables avant tout rendu. Volontairement conservatrice : elle ne
 * remplace pas l'allowlist DOMPurify, elle la complète pour le SSR.
 */
export function stripDangerousHtml(
  input: string,
  opts: { allowIframe?: boolean } = {}
): string {
  if (!input) return "";
  let out = input;
  if (opts.allowIframe) {
    // Conserve <iframe> (bloc Embed) mais retire quand même script/on*/URLs dangereuses.
    const tags = DANGEROUS_TAGS.filter((t) => t !== "iframe");
    out = out
      .replace(
        new RegExp(`<\\s*(${tags.join("|")})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi"),
        ""
      )
      .replace(new RegExp(`<\\s*(${tags.join("|")})\\b[^>]*\\/?>`, "gi"), "");
    // Confine les iframes conservées DÈS le SSR (avant hydratation).
    out = forceIframeSandbox(out);
  } else {
    out = out.replace(dangerousPairRegex, "").replace(dangerousSelfClosingRegex, "");
  }
  return out.replace(eventHandlerRegex, "").replace(dangerousUrlRegex, "");
}

const ALLOWED_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "sub", "sup",
  "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  "caption", "img", "span", "div", "code", "pre", "abbr", "figure",
  "figcaption", "mark", "small",
];

const ALLOWED_ATTR = [
  "href", "title", "alt", "src", "class", "style", "target", "rel",
  "width", "height", "colspan", "rowspan",
  // attributs utilisés par l'enrichissement glossaire (<abbr>)
  "data-acronym", "tabindex",
];

/**
 * Assainit du HTML de contenu de confiance modérée (rich-text d'admin).
 * À utiliser pour envelopper toute valeur passée à `dangerouslySetInnerHTML`.
 */
/**
 * Hook DOMPurify : sur l'attribut `style`, ne conserve QUE
 * `text-align: left|right|center|justify` (alignements posés par l'éditeur).
 * Toute autre déclaration CSS inline est supprimée → pas de CSS arbitraire.
 */
function keepOnlyTextAlign(
  _node: Element,
  data: { attrName: string; attrValue: string; keepAttr: boolean }
): void {
  if (data.attrName !== "style") return;
  const match = /text-align\s*:\s*(left|right|center|justify)/i.exec(data.attrValue);
  if (match) {
    data.attrValue = `text-align: ${match[1].toLowerCase()}`;
  } else {
    data.keepAttr = false;
  }
}

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  const stripped = stripDangerousHtml(dirty);
  // DOMPurify exige le DOM du navigateur : indisponible en SSR (où `sanitize`
  // n'est même pas une fonction et lèverait). La passe regex isomorphe ci-dessus
  // sécurise déjà le rendu serveur ; DOMPurify affine l'allowlist à l'hydratation.
  if (typeof window === "undefined") return stripped;
  // `style` est autorisé par l'allowlist mais réduit à `text-align` par le hook
  // (scopé à cet appel pour ne pas contaminer sanitizeEmbed/Svg).
  DOMPurify.addHook("uponSanitizeAttribute", keepOnlyTextAlign);
  try {
    return DOMPurify.sanitize(stripped, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/|data:image\/)/i,
      ADD_ATTR: ["target"],
    });
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute");
  }
}

// Hook DOMPurify (côté client) : confine chaque <iframe> survivante. `sandbox`
// n'est qu'AUTORISÉ par l'allowlist ATTR — il faut le FORCER ici, sinon une
// iframe sans `sandbox` resterait non confinée. On préserve un `sandbox` déjà
// fourni par l'auteur (éventuellement plus strict).
function forceIframeSandboxHook(node: Element): void {
  if (node.nodeName !== "IFRAME") return;
  if (!node.hasAttribute("sandbox")) {
    node.setAttribute("sandbox", FORCED_IFRAME_SANDBOX);
  }
  if (!node.hasAttribute("referrerpolicy")) {
    node.setAttribute("referrerpolicy", "no-referrer");
  }
}

/**
 * Variante pour le bloc « Embed » dont l'usage explicite est d'intégrer des
 * `<iframe>` (vidéos, cartes, widgets). On autorise donc `iframe` MAIS on
 * retire `script`, les gestionnaires d'événements (`on*`) et les protocoles
 * dangereux. Le `sandbox` est FORCÉ sur chaque iframe (sans valeur explicite de
 * l'auteur) à la fois dans la passe regex SSR (`forceIframeSandbox`) et via un
 * hook DOMPurify côté client — `sandbox`/`referrerpolicy` ne sont pas seulement
 * autorisés, ils sont appliqués. À n'utiliser QUE pour ce bloc.
 */
export function sanitizeEmbedHtml(dirty: string): string {
  if (!dirty) return "";
  const stripped = stripDangerousHtml(dirty, { allowIframe: true });
  if (typeof window === "undefined") return stripped;
  // Hook scopé à CET appel : ajouté juste avant, retiré juste après, pour ne pas
  // contaminer les autres usages de DOMPurify (sanitizeHtml/sanitizeSvg).
  DOMPurify.addHook("afterSanitizeAttributes", forceIframeSandboxHook);
  try {
    return DOMPurify.sanitize(stripped, {
      ALLOWED_TAGS: [...ALLOWED_TAGS, "iframe"],
      ALLOWED_ATTR: [
        ...ALLOWED_ATTR,
        "allow", "allowfullscreen", "frameborder", "loading",
        "referrerpolicy", "sandbox", "srcdoc", "name",
      ],
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/|data:image\/)/i,
      ADD_ATTR: ["target", "allowfullscreen"],
    });
  } finally {
    DOMPurify.removeHook("afterSanitizeAttributes");
  }
}

/**
 * Assainit du SVG inline : autorise les balises/attributs SVG de base mais
 * retire `script`, les gestionnaires d'événements (`on*`) et tout HTML hostile.
 * S'appuie sur le profil SVG natif de DOMPurify.
 */
export function sanitizeSvg(dirty: string): string {
  if (!dirty) return "";
  // Passe isomorphe d'abord (retire script/on* même en SSR), puis profil SVG DOMPurify côté client.
  const stripped = stripDangerousHtml(dirty);
  if (typeof window === "undefined") return stripped;
  return DOMPurify.sanitize(stripped, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
