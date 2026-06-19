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
  /** Image manuelle saisie en admin (prioritaire si présente). */
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
 * Image à la une effective d'un article :
 * - image manuelle définie → elle gagne (override),
 * - sinon → image générée (cadre brandé + illustration de la catégorie,
 *   ou scène vectorielle de repli si la catégorie n'a pas d'illustration).
 */
export function resolveArticleImage(args: ResolveArticleImageArgs): string {
  if (args.manualImage && args.manualImage.trim()) {
    const m = args.manualImage.trim();
    if (args.base && !/^https?:\/\//i.test(m)) return `${args.base}${m}`;
    return m;
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
