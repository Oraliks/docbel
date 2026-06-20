/**
 * Prompt OpenAI Images DÉDIÉ aux illustrations du HERO d'article.
 *
 * À NE PAS confondre avec `featured-image-prompt.ts`, qui produit la
 * BANNIÈRE complète stockée dans `News.image` (titre/cadre ajoutés en code
 * pour l'aperçu de partage OG et les vignettes de liste).
 *
 * Le hero d'article a besoin d'une illustration NETTE, sans texte, sujet
 * concentré à DROITE, fond doux compatible avec la carte hero — pour se
 * fondre via overlays (voile pastel, dégradé). Cette illustration finit
 * dans `Category.illustrationUrl` (ou un champ dédié par article si on en
 * ajoute un plus tard).
 *
 * Le prompt reste STABLE pour garder une cohérence visuelle de catégorie en
 * catégorie. Seul le `subject` (résumé court du thème) change.
 */
export function buildHeroIllustrationPrompt(
  subject: string,
  /**
   * Indice de variation à injecter (composition, angle, mise en scène) pour
   * forcer OpenAI à diversifier les générations d'un appel à l'autre — sans
   * ça, un prompt très contraint produit des résultats quasi identiques.
   */
  variationHint?: string,
): string {
  const variationLine = variationHint
    ? `\n\nVariante visuelle (cette génération uniquement) : ${variationHint}. Compose un cadrage, des objets ou un angle SENSIBLEMENT DIFFÉRENTS de toute génération précédente pour ce thème.`
    : "";

  return `Crée une illustration 3D pour la zone droite d'un hero d'article Docbel.

Style visuel (TRÈS IMPORTANT) :
- illustration 3D douce, type « clay / pâte à modeler », surfaces très arrondies, mates et légèrement brillantes ;
- objets qui flottent avec ombres douces et profondeur subtile ;
- qualité d'icônes 3D haut de gamme, rendu premium, moderne, épuré et rassurant.

Palette :
- mauve / violet doux, lilas, rose poudré très léger, blanc cassé et crème ;
- lumière de studio douce, dégradés subtils, reflets délicats.

Sujet : une scène 3D simple liée à « ${subject} », composée de quelques éléments seulement (carte ou document UI flottant, bouclier à coche, avatar de profil, stylo, petites icônes arrondies). Jamais surchargé.

Composition (IMPÉRATIF) :
- sujet CONCENTRÉ À DROITE du cadre ;
- TIERS GAUCHE LAISSÉ VIDE et très clair (zone d'air pour la fusion avec le hero) ;
- pas de cadre, pas de bordure, pas de carte autonome autour du sujet.

Fond :
- TRÈS DOUX et clair : pastel mauve très pâle, ou fond blanc / crème ;
- de préférence fond TRANSPARENT (PNG) pour que l'illustration se fonde naturellement dans le hero ;
- aucun motif fort qui ferait paraître l'illustration comme un visuel autonome.

À ÉVITER absolument :
- AUCUN texte, aucun mot, aucune lettre, aucun faux mot illisible ;
- pas de cadre dur, pas de bordure, pas de carte/badge contenant le sujet entier ;
- pas de capture d'écran réaliste, pas de style cartoon enfantin, pas de surcharge ;
- pas de rendu plat, froid ou trop corporate.

Format : carré 1:1, sujet à droite, marge gauche très claire.

Le rendu doit pouvoir se SUPERPOSER à une carte hero pastel via un voile horizontal (de gauche vers la droite) sans paraître être une vignette posée.${variationLine}`;
}
