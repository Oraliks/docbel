# Arbre de situation familiale — V0 visuelle

- **URL** : `/partenaire/outils/arbre-situation-familiale` (accès partenaire ou admin).
- **Description à modifier** : `lib/family-situation-tree/visual-tree.ts`. Chaque nœud a
  un identifiant stable, un type visuel, des clés de texte et une position fixe ; les liens
  sont listés séparément avec leurs étiquettes et leur éventuel état pointillé.
- **Libellés** : modifier les clés correspondantes dans
  `messages/fr.json` → `public.pro.familySituationTree`.

Cette V0 est un visualiseur en lecture seule : ni question, ni calcul, ni donnée personnelle,
ni moteur de décision ne sont raccordés. Les positions fixes et le renvoi hypothétique sont
volontaires ; les sous-arbres marqués « à détailler » doivent être validés avant toute suite.
