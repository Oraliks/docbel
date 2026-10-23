# Couverture des pages publiques — 23/10/2026

## Résultat

Le défaut de mise en page du panneau « Aa » est corrigé dans la règle mobile commune du shell public. Sur la preview du commit `709a33bfea4c9991f0b529c81c5ec4df6833ce7e`, le panneau reste dans le viewport à 320 × 844 (314,4 × 616 px) et à 390 × 844 (384,8 × 580 px), avec `translate: 0px` et sans débordement horizontal. La page familiale garde un seul `.glass-root` et son en-tête à 1440 px. Le correctif partagé s’applique aux pages qui utilisent ce shell.

La couverture n’autorise pas à affirmer que chaque combinaison de page, thème, langue, taille et contenu CMS a été testée. L’inventaire source comporte 192 fichiers `app/**/page.tsx` : 146 sont classés privés, protégés, d’administration ou d’espace personnel selon leur route/garde; 46 sont des candidates publiques ci-dessous. Les routes privées ne font pas partie de la recette publique. Parmi les 46 candidates, 29 motifs ont été rendus au moins une fois en production ou preview; les 17 autres sont explicitement laissés à vérifier ou n’ont pas d’exemple public valide. Les motifs dynamiques ne comptent comme couverts que lorsqu’un exemple réel est indiqué.

## Inventaire des 46 motifs candidats

| Motif App Router | Couverture / résultat observé |
|---|---|
| `/` | Vérifié en production et preview; shell et page d’accueil présents. |
| `/[slug]` | Vérifié avec `/davy` et `/pourquoi-docbel`; rendu CMS présent. `/davy` utilise un hero sombre inline provenant du contenu CMS, identique dans les deux environnements; contenu/chiffres propres à chaque environnement. |
| `/[slug]/rendez-vous` | Non vérifié; aucun exemple CMS publié établi. |
| `/actualites` | Vérifié; liste et shell présents. |
| `/actualites/[slug]` | Vérifié avec `/actualites/nouveaute-onem-ec32`; article présent. |
| `/aide` | Vérifié; shell présent. |
| `/auth/confirm` | Lien à jeton; non testé sans jeton de test autorisé. |
| `/changelog` | Vérifié; shell présent. |
| `/chomage` | Vérifié; shell présent. Les affirmations réglementaires n’ont pas été modifiées. |
| `/contact` | Vérifié; formulaire/page et shell présents, aucune donnée soumise. |
| `/creer-ma-demande` | Vérifié comme alias/redirection vers `/mon-dossier`; destination chargée après son skeleton. |
| `/d` | Vérifié comme redirection vers `/mes-demarches`; parcours public en pause observé. |
| `/d/[slug]` | Vérifié avec `/d/chomage-complet`; dossier public et shell présents. |
| `/document/[...path]` | Les 8 URL canoniques du sitemap ont un titre de formulaire et un shell en production : `/document/onem/c1`, `c47`, `c1-partenaire`, `c1c`, `c1a`, `c1b`, `c46`, `annexe-regis`. Aucun formulaire soumis. |
| `/formations` | 404 en production et preview car le module est masqué. Les liens de navigation vers cette destination sont retirés dans cette livraison. |
| `/formations/[slug]` | Non vérifié : aucun slug de formation publié valide identifié; accès conditionné au module masqué. |
| `/formations/boussole` | 404 en production; module masqué. |
| `/formations/proposer` | Non vérifié; module masqué, aucun parcours public actif établi. |
| `/glossaire` | Vérifié; shell présent. |
| `/inscription` | Non vérifié; formulaire de compte hors couverture des pages de contenu. |
| `/inscription/employeur` | Non vérifié; parcours de compte. |
| `/inscription/partenaire` | Non vérifié; parcours de compte. |
| `/login` | Non vérifié dans cette couverture. |
| `/mon-dossier` | Vérifié après attente du rendu complet; avis de suspension et parcours existant présents. Le premier constat « vide » était un faux positif de skeleton. |
| `/mot-de-passe-oublie` | Non vérifié; parcours de compte. |
| `/onem/ec32` | Vérifié; page de simulation eC3.2 et shell présents. |
| `/outils` | Vérifié; catalogue public présent. |
| `/outils/[slug]` | Vérifié avec des outils publiés (`preavis`, `allocations-familiales`, `indemnite-rupture`, `brut-net`, `pension-estimation`); shell et contenu présents. `/outils/pension-legale` était un slug erroné, pas une page publiée. |
| `/outils/bareme-chomage` | Vérifié; shell présent. |
| `/outils/bareme-chomage/[sheet]` | Non vérifié avec un identifiant de feuille publié. |
| `/outils/bundles/[slug]` | Non vérifié; aucun bundle public représentatif identifié. |
| `/outils/bureaux` | Vérifié; contenu et shell présents. |
| `/outils/calcul-agr` | Vérifié comme redirection vers `/partenaire/outils/calcul-agr`; cible privée, exclue de la couverture publique. |
| `/outils/commissions-paritaires` | Vérifié; contenu et shell présents. |
| `/outils/lookup-onem` | Non vérifié. |
| `/outils/lookup-onem/[tableSlug]` | Non vérifié avec une table publiée représentative. |
| `/outils/lookup-onem/recherche` | Non vérifié. |
| `/outils/ma-situation-familiale` | Vérifié en production et preview; affichage responsive familial corrigé. |
| `/outils/u1` | Vérifié; contenu et shell présents. |
| `/p/employeur` | Vérifié; page d’audience et shell présents. |
| `/p/partenaire` | Vérifié; page d’audience et shell présents. |
| `/pdf/[slug]` | Non vérifié comme page canonique; le chemin historique `/pdf/c1` redirige vers le document public canonique. |
| `/reforme-chomage-2026` | Vérifié; shell présent, contenu réglementaire non modifié. |
| `/reinitialiser-mot-de-passe` | Non vérifié; parcours de compte. |
| `/rendez-vous` | Vérifié; page d’interruption temporaire affichée. |
| `/rendez-vous/guichets` | Vérifié; page d’interruption temporaire affichée. |

## URL présentes au sitemap public

Les 15 URL publiées dans `sitemap.xml` ont été ouvertes en production le 23/10/2026. Aucune n’a rendu un état 404 : accueil, actualités, contact, `/onem-ec32`, `/davy`, `/pourquoi-docbel`, l’article eC3.2 et les huit formulaires canoniques répertoriés dans le tableau. La vérification porte sur l’accès, le titre et le rendu initial; elle ne renseigne ni n’envoie les formulaires.

## Anomalies ou limites distinctes du défaut CSS

- `/accessibilite`, `/mentions-legales` et `/politique-confidentialite` répondent 404 en production et preview bien que les deux dernières soient liées dans le pied de page et l’accessibilité apparaisse comme lien. Aucun contenu source autorisé n’a été fourni; aucun texte légal n’a été inventé ni publié.
- `/formations` répond 404 car la fonctionnalité est masquée. Ses liens d’annonce dans l’en-tête et le pied de page ont été retirés. Les pages directes demeurent indisponibles tant que le module reste masqué.
- `/davy` rend un hero sombre CMS en inline style sur production et preview. C’est une variante de contenu existante, pas une régression du CSS partagé; les chiffres de contenu diffèrent selon l’environnement.
- La première observation d’une page `/mon-dossier` vide et l’alerte « Outil introuvable » pour `/outils/pension-legale` étaient des faux positifs : chargement différé dans le premier cas, slug inexistant dans le second.

La présente couverture vérifie les routes listées et les variantes citées. Elle ne garantit pas toutes les pages CMS non publiées, les états après saisie, toutes les locales, les sessions authentifiées ni les données de production variables.
