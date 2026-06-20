/**
 * Prompt OpenAI Images DÉDIÉ aux illustrations du HERO d'article.
 *
 * Distinct de `featured-image-prompt.ts`, qui produit la BANNIÈRE complète
 * (`News.image`, avec titre/cadre cuits) réservée à l'aperçu de partage OG et
 * aux vignettes de liste.
 *
 * Le hero utilise cette illustration comme VISUEL DE FOND fusionné (couche
 * `absolute inset-0`, opacité réduite, sous un voile clair, texte HTML
 * par-dessus). Il faut donc une illustration ÉDITORIALE PURE et VIVANTE :
 * des personnages, une scène administrative chaleureuse, AUCUN texte ni faux
 * layout, qui remplit tout le cadre.
 *
 * Le prompt reste STABLE (cohérence d'un thème à l'autre) ; seuls `subject`
 * et `variationHint` changent.
 */
export function buildHeroIllustrationPrompt(
  subject: string,
  /**
   * Indice de variation injecté pour DIVERSIFIER les générations d'un même
   * thème (mise en scène, personnages, cadrage). Sans ça, un prompt stable
   * produit des résultats quasi identiques d'un appel à l'autre.
   */
  variationHint?: string,
): string {
  const variationLine = variationHint
    ? `\n\nVariante (cette génération uniquement) : ${variationHint}. Change la mise en scène, les personnages et le cadrage par rapport à toute génération précédente du même thème.`
    : "";

  return `Illustration éditoriale 3D servant de VISUEL DE FOND au hero d'un article, sur Docbel — une plateforme belge d'aide aux démarches administratives.

Style : illustration 3D douce et VIVANTE, avec des PERSONNAGES stylisés (3D character art chaleureux, type clay premium), formes arrondies, lumineuse, humaine et rassurante ; lumière de studio douce, jolie profondeur, ambiance institutionnelle douce.

Palette : mauve / violet doux, lilas, crème et blanc cassé, avec quelques touches chaudes très légères.

Scène (le sujet) : une vraie scène administrative VIVANTE liée à « ${subject} » — par exemple des personnes dans un bureau ou à un guichet d'accueil, une personne qui en accompagne une autre dans ses démarches, des gens autour d'un bureau avec des documents et un ordinateur portable, un échange chaleureux. Montre des PERSONNAGES, du mouvement et de l'entraide. Éléments d'ambiance discrets bienvenus : plante, fenêtre lumineuse, dossiers, mug.

Composition : scène pleine et équilibrée qui REMPLIT tout le cadre (l'image sert de fond fondu, sous un voile clair). De la profondeur, quelques éléments doux légèrement flous en arrière-plan. Pas de petit sujet isolé sur fond vide.

INTERDICTIONS STRICTES :
- AUCUN texte, mot, lettre, chiffre, ni faux mot illisible — nulle part dans l'image ;
- AUCUN badge, étiquette, pastille ou bandeau ; n'écris JAMAIS « ONEM » ni aucun acronyme ou logo ;
- PAS de fausse interface / faux écran / faux layout d'application avec du faux texte ;
- PAS de répétition d'icônes de coche ou de validation ;
- PAS de miniature, de vignette, ni de carte/visuel autonome posé dans l'image ;
- pas de capture d'écran réaliste, pas de style cartoon enfantin, pas de surcharge ;
- pas de rendu plat, froid ou trop corporate.

Format : carré 1:1. Rendu chaleureux et éditorial, qui s'intègre comme texture de fond d'un hero pastel — jamais comme un visuel autonome avec du texte.${variationLine}`;
}
