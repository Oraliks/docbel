export function buildFeaturedImagePrompt(summary: string): string {
  const template = `Crée une image à la une 16:9 pour un article Docbel.
Style : bannière éditoriale moderne, claire, administrative, premium et rassurante.
Palette : orange doux, blanc, beige clair, gris très léger, touches bleu nuit.
Composition : grande zone propre à gauche pour ajouter le titre en code, illustration principale à droite.
Ne génère pas de long texte dans l'image. Ne mets pas de faux mots illisibles.
Le rendu doit évoquer une plateforme belge d'aide administrative, sérieuse, accessible et moderne.
Créer une illustration liée au sujet de l'article, avec des formes arrondies, des cartes UI, des documents, des icônes simples et une profondeur légère.
Si une image de référence est fournie, l'intégrer naturellement comme élément visuel, par exemple dans une carte flottante, un badge, un logo ou une vignette.
Éviter : style cartoon enfantin, surcharge, captures d'écran réalistes, texte illisible, design froid ou trop corporate.

Résumé de l'article :
${summary}`;

  return template;
}
