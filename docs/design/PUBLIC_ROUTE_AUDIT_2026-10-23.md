# Couverture des pages publiques — 23/10/2026

## Résultat

Le défaut de mise en page du panneau « Aa » est corrigé dans la règle mobile commune du shell public. Sur la preview du commit `709a33bfea4c9991f0b529c81c5ec4df6833ce7e`, le panneau reste dans le viewport à 320 × 844 (314,4 × 616 px) et à 390 × 844 (384,8 × 580 px), avec `translate: 0px` et sans débordement horizontal. La page familiale garde un seul `.glass-root` et son en-tête à 1440 px. Le correctif partagé s’applique aux pages qui utilisent ce shell.

La couverture n’autorise pas à affirmer que chaque combinaison de page, thème, langue, taille et contenu CMS a été testée. L’inventaire source comporte 192 fichiers `app/**/page.tsx` : 146 sont classés privés, protégés, d’administration ou d’espace personnel selon leur route/garde; 46 motifs publics candidats sont listés ci-dessous. Les routes privées ne font pas partie de la recette publique. Au début de cette passe, 29 motifs avaient été ouverts et 17 restaient à qualifier. Les 17 motifs restants ont été vérifiés en production sur un exemple réel lorsqu’il en existe un; les résultats distinguent rendu, alias, pause, protection et indisponibilité. Aucun slug dynamique n’a été inventé.

## Inventaire des 46 motifs candidats

| Motif App Router | Couverture / résultat observé |
|---|---|
| `/` | Vérifié en production et preview; shell et page d’accueil présents. |
| `/[slug]` | Vérifié avec `/davy` et `/pourquoi-docbel`; rendu CMS présent. `/davy` utilise un hero sombre inline provenant du contenu CMS, identique dans les deux environnements; contenu/chiffres propres à chaque environnement. |
| `/[slug]/rendez-vous` | Pause temporaire confirmée en production sur `/davy/rendez-vous`; aucun formulaire ni réservation soumis. |
| `/actualites` | Vérifié; liste et shell présents. |
| `/actualites/[slug]` | Vérifié avec `/actualites/nouveaute-onem-ec32`; article présent. |
| `/aide` | Vérifié; shell présent. |
| `/auth/confirm` | Rendu d’état sans jeton vérifié : « Activation impossible — Lien d’activation manquant ». Aucun jeton créé ni soumis. |
| `/changelog` | Vérifié; shell présent. |
| `/chomage` | Vérifié; shell présent. Les affirmations réglementaires n’ont pas été modifiées. |
| `/contact` | Vérifié; formulaire/page et shell présents, aucune donnée soumise. |
| `/creer-ma-demande` | Vérifié comme alias/redirection vers `/mon-dossier`; destination chargée après son skeleton. |
| `/d` | Vérifié comme redirection vers `/mes-demarches`; parcours public en pause observé. |
| `/d/[slug]` | Vérifié avec `/d/chomage-complet`; dossier public et shell présents. |
| `/document/[...path]` | Les 8 URL canoniques du sitemap ont un titre de formulaire et un shell en production : `/document/onem/c1`, `c47`, `c1-partenaire`, `c1c`, `c1a`, `c1b`, `c46`, `annexe-regis`. Aucun formulaire soumis. |
| `/formations` | 404 en production et preview car le module est masqué. Les liens de navigation vers cette destination sont retirés dans cette livraison. |
| `/formations/[slug]` | Module masqué par `getTrainingAccess`; la route répond 404 avant de chercher une formation. Aucun slug inexistant n’a été utilisé pour prétendre tester un détail valide. |
| `/formations/boussole` | 404 en production; module masqué. |
| `/formations/proposer` | 404 en production, cohérente avec le module masqué; aucune soumission. |
| `/glossaire` | Vérifié; shell présent. |
| `/inscription` | Rendu de suspension temporaire vérifié en production; aucun compte créé. |
| `/inscription/employeur` | Rendu de suspension temporaire vérifié en production; aucun compte créé. |
| `/inscription/partenaire` | Rendu de suspension temporaire vérifié en production; aucun compte créé. |
| `/login` | Formulaire de connexion public rendu en production; aucun identifiant saisi ni connexion tentée. |
| `/mon-dossier` | Vérifié après attente du rendu complet; avis de suspension et parcours existant présents. Le premier constat « vide » était un faux positif de skeleton. |
| `/mot-de-passe-oublie` | Formulaire public rendu en production; aucune adresse saisie et aucune demande envoyée. |
| `/onem/ec32` | Vérifié; page de simulation eC3.2 et shell présents. |
| `/outils` | Vérifié; catalogue public présent. |
| `/outils/[slug]` | Vérifié avec des outils publiés (`preavis`, `allocations-familiales`, `indemnite-rupture`, `brut-net`, `pension-estimation`); shell et contenu présents. `/outils/pension-legale` était un slug erroné, pas une page publiée. |
| `/outils/bareme-chomage` | Vérifié; shell présent. |
| `/outils/bareme-chomage/[sheet]` | Rendu valide en production avec la feuille déclarée `chomage-complet`; tableau chargé. Aucun calcul ni filtre appliqué. |
| `/outils/bundles/[slug]` | Alias vérifié avec le slug connu `chomage-complet`; redirection vers `/mon-dossier`, qui charge son parcours après le skeleton. |
| `/outils/bureaux` | Vérifié; contenu et shell présents. |
| `/outils/calcul-agr` | Vérifié comme redirection vers `/partenaire/outils/calcul-agr`; cible privée, exclue de la couverture publique. |
| `/outils/commissions-paritaires` | Vérifié; contenu et shell présents. |
| `/outils/lookup-onem` | Route protégée vérifiée sans session : réponse 404 attendue du garde; aucune donnée Lookup consultée. |
| `/outils/lookup-onem/[tableSlug]` | Garde vérifié sans session avec le slug de seed `s01-allocations-familiales` : réponse 404; accès privé non contourné et données non consultées. |
| `/outils/lookup-onem/recherche` | Route protégée vérifiée sans session : réponse 404 attendue du garde; aucune recherche lancée. |
| `/outils/ma-situation-familiale` | Vérifié en production et preview; affichage responsive familial corrigé. |
| `/outils/u1` | Vérifié; contenu et shell présents. |
| `/p/employeur` | Vérifié; page d’audience et shell présents. |
| `/p/partenaire` | Vérifié; page d’audience et shell présents. |
| `/pdf/[slug]` | Alias vérifié avec le slug réel `c1-changement-situation`; redirection finale vers `/document/onem/c1`, dont le formulaire s’affiche. Aucune donnée saisie. |
| `/reforme-chomage-2026` | Vérifié; shell présent, contenu réglementaire non modifié. |
| `/reinitialiser-mot-de-passe` | État sans jeton rendu en production : « Lien invalide ou expiré ». Aucun mot de passe modifié. |
| `/rendez-vous` | Vérifié; page d’interruption temporaire affichée. |
| `/rendez-vous/guichets` | Vérifié; page d’interruption temporaire affichée. |

## URL présentes au sitemap public

Les 15 URL publiées dans `sitemap.xml` ont été ouvertes en production le 23/10/2026. Aucune n’a rendu un état 404 : accueil, actualités, contact, `/onem-ec32`, `/davy`, `/pourquoi-docbel`, l’article eC3.2 et les huit formulaires canoniques répertoriés dans le tableau. Cela couvre l’accès et le rendu initial, sans soumettre de données aux formulaires.

## Anomalies ou limites distinctes du défaut CSS

- `/accessibilite`, `/mentions-legales` et `/politique-confidentialite` répondent 404 en production. Le lot courant retire leurs liens du pied de page et de la bannière cookies, remplace le lien de préférences d’affichage par un bouton qui ouvre Aa, et masque ces destinations dans le bloc CMS GDPR réutilisable. Aucun contenu légal n’a été inventé ni publié.
- `/formations` répond 404 car la fonctionnalité est masquée. Ses liens d’annonce dans l’en-tête et le pied de page ont été retirés. Les pages directes demeurent indisponibles tant que le module reste masqué.
- `/davy` rend un hero sombre CMS en inline style sur production et preview. C’est une variante de contenu existante, pas une régression du CSS partagé; les chiffres de contenu diffèrent selon l’environnement.
- La première observation d’une page `/mon-dossier` vide et l’alerte « Outil introuvable » pour `/outils/pension-legale` étaient des faux positifs : chargement différé dans le premier cas, slug inexistant dans le second.

Les 17 routes restantes ont été qualifiées en production : les 16 motifs ci-dessus, ainsi que `/formations/certificats`, qui répond 404 « Formation introuvable » alors que le module Formations demeure masqué. Les routes Lookup restent protégées. Les parcours de compte sans jeton affichent leur état public attendu; aucune donnée personnelle n’a été saisie ou transmise.

La présente couverture vérifie les routes listées et les variantes citées. Elle ne garantit pas toutes les pages CMS non publiées, les états après saisie, toutes les locales, les sessions authentifiées ni les données de production variables.

