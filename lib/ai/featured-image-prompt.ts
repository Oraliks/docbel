export function buildFeaturedImagePrompt(summary: string): string {
  // Prompt CENTRALISÉ et stable → cohérence visuelle d'un article à l'autre.
  // Cible : illustration 3D douce « clay / pâte à modeler », palette violet/mauve
  // de marque Docbel. L'IA ne produit QUE l'illustration ; le titre, le logo et le
  // badge sont ajoutés ensuite en code (zone gauche laissée dégagée).
  const template = `Crée une image à la une 16:9 pour un article Docbel.

Style visuel (TRÈS IMPORTANT) : illustration 3D douce, type « clay / pâte à modeler », surfaces très arrondies, mates et légèrement brillantes, objets qui flottent avec des ombres douces et une profondeur subtile. Rendu premium, moderne, épuré et rassurant — qualité d'icônes 3D haut de gamme.
Palette : mauve / violet doux, lilas, rose poudré très léger, blanc cassé et crème, reflets délicats. Lumière de studio douce, dégradés subtils.
Sujet : une scène 3D liée au thème de l'article, composée d'éléments comme des cartes ou documents UI qui flottent, un bouclier avec une coche (validation), un avatar de profil, un stylo, de petites icônes simples — arrondis et aérés, jamais surchargés.
Composition : illustration 3D principale à DROITE ; garde une grande ZONE PROPRE et dégagée à GAUCHE (le titre y sera ajouté ensuite en code). Le centre de gravité visuel est à droite.
Si une image de référence est fournie, intègre-la naturellement comme élément de la scène (carte flottante, badge, logo, vignette ou petit écran).
À ÉVITER absolument : aucun texte ni faux mot dans l'image, pas de capture d'écran réaliste, pas de style cartoon enfantin, pas de surcharge, pas de rendu plat, froid ou trop corporate.
Le rendu doit évoquer une plateforme belge d'aide administrative : sérieuse, accessible, humaine et moderne.

Résumé de l'article :
${summary}`;

  return template;
}
