// Helper « image à la une générée » — construit l'URL du générateur
// /api/featured et résout l'image effective d'un article.
//
// Pas de `import "server-only"` : ce module est importé par des Server
// Components ET peut l'être par des scripts/tests ; il ne fait aucun accès
// DB (pur), la résolution catégorie→couleur/illustration est faite par
// l'appelant (qui interroge la table Category) et passée en argument.

export interface FeaturedImageParams {
  /** Titre de l'article (gros texte de l'image). */
  title: string;
  /** Libellé court en haut à gauche (catégorie). */
  kicker?: string | null;
  /** Couleur du thème (hex) — pilote tout le rendu. Défaut : violet marque. */
  color?: string | null;
  /** Sous-titre optionnel sous le filet d'accent. */
  subtitle?: string | null;
  /** URL ABSOLUE d'une illustration 3D (PNG). Sinon, scène vectorielle de repli. */
  illus?: string | null;
}

/** Construit l'URL (relative) de l'image à la une générée. */
export function buildFeaturedImageUrl(p: FeaturedImageParams): string {
  const q = new URLSearchParams();
  q.set("title", p.title);
  if (p.kicker) q.set("kicker", p.kicker);
  if (p.color) q.set("color", p.color);
  if (p.subtitle) q.set("subtitle", p.subtitle);
  if (p.illus) q.set("illus", p.illus);
  return `/api/featured?${q.toString()}`;
}

export interface ResolveArticleImageArgs {
  /**
   * Illustration UNIQUE de l'article (champ `News.heroIllustration`) — sert à
   * la fois au hero, aux vignettes/listes et à l'aperçu de partage. Prioritaire
   * sur tout le reste.
   */
  heroIllustration?: string | null;
  /** Image « présentation » héritée (legacy) — repli si pas d'illustration. */
  manualImage?: string | null;
  title: string;
  category?: string | null;
  /** Couleur de la catégorie (table Category). */
  categoryColor?: string | null;
  /** Illustration de la catégorie (table Category). */
  categoryIllustration?: string | null;
  subtitle?: string | null;
  /**
   * Base absolue (ex. https://docbel.be) — si fournie, l'URL générée est
   * renvoyée en ABSOLU (nécessaire pour les balises Open Graph). Pour un
   * `<img>` côté page, laisser vide (relatif suffit, même origine).
   */
  base?: string;
}

/**
 * Image effective d'un article (UNE seule image partout) :
 * - illustration unique (hero) définie → elle gagne,
 * - sinon image « présentation » héritée (legacy) → elle gagne,
 * - sinon (rare : brouillon sans illustration) → carte brandée générée.
 */
export function resolveArticleImage(args: ResolveArticleImageArgs): string {
  // URL directe : l'illustration (hero) prime, puis l'image héritée.
  const single = args.heroIllustration?.trim() || args.manualImage?.trim();
  if (single) {
    if (args.base && !/^https?:\/\//i.test(single)) return `${args.base}${single}`;
    return single;
  }
  const rel = buildFeaturedImageUrl({
    title: args.title,
    kicker: args.category,
    color: args.categoryColor,
    illus: args.categoryIllustration,
    subtitle: args.subtitle,
  });
  return args.base ? `${args.base}${rel}` : rel;
}
