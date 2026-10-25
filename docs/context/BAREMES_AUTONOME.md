# Barèmes — nouveau : frontière et validation

Mandat propriétaire du 24/10/2026 : nouvel outil indépendant, ancien conservé.
Base de travail : `main` `10c70ebf`. Le checkout historique sale n'a pas été repris.

## Frontière livrée

| Responsabilité | Nouveau domaine |
| --- | --- |
| Écran | `/admin/baremes-autonome` |
| API privée | `/api/admin/baremes-autonome/versions/**` |
| Contrats, lecture, comparaison, publication | `lib/baremes-autonome/**` |
| Versions, montants normalisés et originaux | `AutonomousRateVersion` : JSONB dédié et original BYTEA |
| Référence publiée | `AutonomousRateRegistry` : pointeur et génération dédiés |
| Historique de publication | `AutonomousRatePublication` : acteur, date, référence antérieure, snapshot |

Pas de lecture/écriture des objets `Bareme*` / `BareSheet`, de leurs fichiers,
de leurs API, de leur cache ou de leurs événements. Aucun raccordement C1,
Vérificateur, arbre familial, calculateur, bundle ou export public.
Le stockage BYTEA transactionnel évite tout partage de chemin de fichier et tout
échec partiel entre fichier et enregistrement. Aucun cache métier ni tâche différée.

Ressources partagées : auth Better Auth + `requireAdminAuth`, client Prisma,
helpers API, shell et primitives shadcn, next-intl et formatage générique.
Le test `boundaries.test.ts` parcourt les imports résolus transitifs du nouveau
domaine, ainsi que les destinations SQL et effets de cache/stockage/API interdits.

Les imports sont immuables via l'API. Un nouveau fichier crée une nouvelle version.
La publication recontrôle original, normalisation, révisions et génération de la
référence dans une transaction sérialisable avec verrou dédié. Un retry identique
ne crée pas de seconde publication et ne réactive pas une ancienne version.
Une date future ou antérieure à la référence courante bloque la publication.

Lecteur courant v3 : les candidats v1/v2 doivent être réimportés pour bénéficier
des douze contrats de feuilles. Les références publiées v1/v2 restent vérifiées
avec leur lecteur autonome gelé (`readers/v1.ts`, `readers/v2.ts` et sa couverture),
leur SHA-256 et leur révision ; une
évolution du lecteur courant ne les rend donc pas illisibles. Une version de
lecteur inconnue ou un contrat d'identité incompatible bloque explicitement.
Une future normalisation doit ajouter une version au registre, sans modifier les
lecteurs historiques ni réécrire leurs snapshots.

## Lecture et limites explicites

Le seul original fourni est `barema20260901-new.xlsx`, conservé strictement comme
fixture de test, jamais importé automatiquement au runtime ni seedé en production.
SHA-256 : `a237c1a2a26f05249f8177700844a375ac5508e256e1db82e2279964226151f0`.

Les douze feuilles réelles sont lues : **6 059 valeurs**, dont 5 735 valeurs
monétaires (montants, bornes et seuils), 312 paramètres numériques et 12 expressions
textuelles. Les 503 cellules auxiliaires sont contrôlées séparément. Les compteurs
suivants sont issus de la fixture réelle, sans variante synthétique :

| Feuille | Valeurs monétaires | Paramètres | Expressions | Auxiliaires |
| --- | ---: | ---: | ---: | ---: |
| A_N_B_vol_plein | 1 300 | 0 | 0 | 0 |
| A_N_B_half_demi | 1 300 | 0 | 0 | 500 |
| TW-CT_JS | 1 000 | 0 | 0 | 3 |
| SpecCat | 984 | 0 | 0 | 0 |
| Loonschijven_Tranches salariale | 141 | 296 | 0 | 0 |
| Uurlonen_Salaires horaires | 781 | 0 | 0 | 0 |
| W (nom source avec espace final) | 50 | 0 | 0 | 0 |
| AndereBedrWLH_AutresMontCHOM | 63 | 0 | 0 | 0 |
| Activering_Activation | 2 | 0 | 12 | 0 |
| AndereUitk_AutresAlloc | 16 | 1 | 0 | 0 |
| Bonus | 24 | 4 | 0 | 0 |
| Basisbedragen | 74 | 11 | 0 | 0 |
| **Total** | **5 735** | **312** | **12** | **503** |

La publication active la version de ce fichier, sans assembler des cellules de
versions différentes. Une feuille requise manquante, une nouvelle feuille non
reconnue, une perte de couverture ou une lecture ambiguë bloque ; une absence ne
remplace jamais une valeur par zéro. Les anciens imports v1/v2 restent consultables
avec leur couverture historique de trois feuilles, sans les présenter comme v3.

Le contrat interne exige les 13 colonnes codées dans leur contexte et les tranches
MIN puis 1 à 99 dans chaque matrice. Plusieurs tableaux concurrents, un taux
illisible, un montant de base manquant (y compris la section « Andere »), ou une
ligne d'indexation dont l'identité manque sont bloquants. Les 500 cellules
auxiliaires du fichier réel sont reconnues séparément : sans code, elles donnent
zéro par une formule de demi-allocation vers une cellule entière vide. Elles
restent dans l'original, ne constituent pas 500 montants et sont annoncées dans
l'écran avant publication. TW-CT_JS ajoute trois auxiliaires identifiés par leurs
relations de formules : une copie du minimum entier, sa demi-valeur et un zéro
vers une cellule entière vide. Les copies doivent concorder avec les montants
sources ; aucune formule voisine ou valeur égale arbitraire ne suffit à les accepter.
Une valeur sans code sortant de ces cas bloque.
Le taux source (p.ex. pourcentage du tableau) est distinct du multiplicateur
d'indexation : ce dernier conserve sa cellule et sa formule propres.

Identités sémantiques par code/catégorie/période/tranche ou article/libellé.
Sources : feuille, cellule, valeur brute, formule. Les résultats enregistrés des
formules sont lus, sans recalcul Excel. Une formule sans résultat, une erreur
Excel, une cellule requise manquante ou une collision bloque. Les décimales sont
conservées en chaînes ; les bases à quatre décimales ne deviennent pas des centimes.
Les unités et fréquences distinguent notamment base/indexé, heure/jour/mois/année,
entier/demi, facteur/pourcentage source. Une demi-allocation journalière reste en
EUR/jour ; EUR/demi-jour n'est utilisé que lorsque l'en-tête source le dit.
Aucun montant n'est présenté comme un droit individuel.

### Contrats des neuf feuilles ajoutées

- TW-CT_JS : dix séries identifiées par code(s), taux source et entier/demi,
  chacune MIN puis 1 à 99. L'en-tête combiné A0/N0/B0 ne devient pas une catégorie
  familiale unique. Un taux faisant partie d'une identité ambiguë est bloquant.
- SpecCat : port, pêche, RCC et arts, codes explicitement connus et douze séries.
  Les six séries RCC ont MIN puis 1 à 63 ; leurs cases 64 à 99 sont absentes dans
  la source, jamais des zéros. Les six autres séries ont chacune 100 montants.
- Tranches salariales : codes 29 à 99, 141 bornes journalières (pas de borne haute
  pour 99). Les 296 paramètres auxiliaires rangés 1 à 99 sont de vraies valeurs
  sources distinctes : borne basse, borne haute avant la suivante, référence de
  calcul. Leurs rôles sont attestés par les formules ; leur unité et leur libellé
  ne sont pas écrits dans le fichier. Ils restent donc des paramètres `number`,
  sans étiquette EUR inventée ni indexation appliquée par le lecteur.
- Salaires horaires : codes 29 à 99, onze durées hebdomadaires de 35 à 40 heures
  par pas de 0,5, soit 781 valeurs EUR/heure. Les deux axes sont vérifiés.
- W : 31 identités codes/âge, 31 montants pleins et 19 demi-montants journaliers.
  Les légendes W/D/I/T/S placées au milieu du dessin ne sont pas des frontières
  de sections ; elles ne servent pas à attribuer arbitrairement un type de droit.
- Autres montants chômage : 63 identités article/libellé/unité ; cinq fréquences
  lues dans leurs en-têtes. Les articles hérités, les variantes et les plafonds
  restent distincts ; une ligne entière disparue n'échappe pas au contrôle.
- Activation : SINE ancien/nouveau, ACTIVA Wallonie/Bruxelles, quatorze codes.
  Deux montants mensuels et douze expressions textuelles, plafonds compris.
  Date propre **01/01/2023**, conservée sans la remplacer par celle des autres
  feuilles. Les expressions ne deviennent ni formules Excel ni montants calculés.
- Autres allocations : trois branches du supplément de change et ancien régime,
  facteur propre, garde entière/demi et revenu d'intégration mensuel/annuel.
  L'import documentaire du revenu d'intégration n'est pas un calcul CPAS.
- Bonus : deux populations, quatre bandes chacune ; 28 seuils S, bases R,
  coefficients et décalages. Les opérateurs stricts de la source sont conservés.
  Une base R n'est pas présentée comme le bonus net applicable à une personne.

Les dates des valeurs et de l'indexation sont conservées par source. Le multiplicateur
indiqué par une feuille n'est pas une preuve que tous ses montants en dépendent :
les formules et les paramètres restent consultables, sans nouvelle relation juridique.
Les déplacements et insertions vides dans les en-têtes/données ne changent pas les
identités. Des codes, colonnes ou sections inconnus demandent un nouveau contrat
de lecture ; ils ne sont pas rapprochés par leur position ou leur seul montant.

Les catégories A/N/B sont qualifiées dans ces tableaux par leurs en-têtes réels,
jamais par une première lettre universelle. Vérification croisée des libellés sur
[ONEM T201](https://www.onem.be/page/a-combien-seleve-votre-allocation-de-chomage-apres-une-occupation-situation-a-partir-du-01.03.2026-).
L'arbre familial verrouillé n'est ni modifié ni interprété par ce module.

## Recette reproductible isolée

PostgreSQL 17 : base `autonomous_rates_test`, hôte `127.0.0.1`, port `55433`.
Créer le schéma jetable avec `prisma migrate diff --from-empty`, puis appliquer
`scripts/autonomous-rates-test-db.sql` avec le rôle local `docbel_test`.
Ce SQL refuse tout autre nom de base ou rôle ; il crée un témoin historique et
retire tous les droits sur les tables historiques au rôle `autonomous_app`.

`AUTONOMOUS_RATES_TEST_DATABASE_URL` déclenche `postgres.test.ts` : import réel,
persistance, première publication, variante explicitement synthétique,
compteurs globaux, filtre source, concurrence, retries, révisions altérées,
fichier de référence endommagé, lecture partielle, collision et rollback forcé.
Les empreintes de toutes les tables historiques `Bareme*` et `BareSheet` sont comparées
avant/après, y compris le témoin historique publié. Des pièges de modules interdisent
aussi les anciens services. L'accès au stockage Blob partagé et les invalidations
de cache lèvent une erreur dans cette recette ; aucune de ces fonctions n'est appelée.
Le parcours inclut aussi un fichier corrompu rejeté sans création de version et les
références autonomes v1 puis v2, publiées sans réécrire leurs octets ni leur lecture.

La CI `Autonomous rates isolation` recrée cet environnement, puis lance la recette
Playwright à `localhost:3010`. `setup-autonomous-rates-local.ts` refuse toute autre
base et crée un administrateur local avec mot de passe aléatoire dans
`private/backups/autonomous-rates-test/` ignoré. Placer aussi les données PostgreSQL
hors de `test-results/`, que Playwright peut nettoyer. Les variantes synthétiques
et comptes de recette restent dans cette base.
L'option de reset de ce script ne vise que les trois tables nouvelles, en test.

## Retrait ultérieur : aucune bascule autorisée ici

Preuves locales après contre-revue v3 : suite complète 3 378 tests réussis,
2 ignorés (dont la recette PostgreSQL, exécutée séparément avec son URL isolée) ;
suite ciblée du nouveau domaine 35 tests réussis avec PostgreSQL ;
Playwright sous Edge : un parcours complet réussi, avec visite des douze feuilles,
compteurs globaux invariants sous filtre, espace final du nom `W ` conservé,
date/expression Activation et salaires horaires contrôlés, original puis variante
synthétique, deux publications et rechargements.
Captures réelles : `docs/evidence/baremes-autonome/`. Le nom synthétique apparaît
dans la capture de comparaison ; les deux premières captures montrent le premier
import de l'original sans ancienne référence. Deux captures supplémentaires montrent
l'expression Activation et la source horaire. Aucun second original n'est inventé.

À inventorier et migrer séparément avant tout retrait : affichage public
`app/outils/bareme-chomage/**`, API publiques lookup/export/c1-thresholds,
`getActiveBaremeData`, couches réglementaires et arbre familial, Vérificateur,
génération PDF et array-field, exports utilisateur, anciens écrans de revue et
publications. Les calculateurs et paramètres réglementaires ont aussi leurs
sources datées à rapprocher explicitement : aucune alimentation automatique
par le nouveau référentiel n'est annoncée.

Préserver originaux, versions, montants, diagnostics, approbations et journaux
historiques, ainsi que leurs sources et dates. Ce document n'est pas une preuve
que ces consommateurs sont migrés. Validation visuelle et CI verte n'autorisent
ni bascule, ni suppression, ni migration de production.

## Vérification réglementaire bornée — 25/10/2026

### Synthèse
**5 conforme · 0 écart · 2 non couvert** — l’extraction des données de chômage conserve les unités, les dates et les contextes source; elle n’établit pas de droits individuels ni la validité juridique exhaustive des autres régimes.

### Constats
- ✅ **CONFORME —** Le lecteur v3 prend en charge les douze feuilles attendues; une feuille non prévue ou manquante bloque la lecture (`v3.ts:7-15`). Sur la fixture lue avec SheetJS, il retourne 6 059 valeurs : 5 735 monétaires, 312 paramètres et 12 expressions, ainsi que 503 cellules auxiliaires. Aucune issue de lecture n’est remontée.
- ✅ **CONFORME —** Les dates restent attachées aux valeurs sources : 6 041 valeurs portent la date du 01/09/2026, les 14 valeurs d’Activation celle du 01/01/2023, et les entrées d’index conservent leurs dates propres. Le lecteur analyse les dates par feuille et `compareReadings` les prend en compte (`v3-common.ts:18-32, 43-55`; `v3.ts:26-29`; `compare.ts:13-17`).
- ✅ **CONFORME —** Les matrices journalières, y compris les demi-allocations, sont en EUR/jour. Les feuilles de chômage avec montants particuliers reprennent les fréquences de leurs en-têtes, dont cinq valeurs en EUR/demi-journée; les salaires horaires sont en EUR/heure (`v3-matrices.ts:87, 152, 215, 239, 272`; `v3-other-sections.ts:119-134`; `types.ts:11-13`).
- ✅ **CONFORME —** A/N/B est conservé pour les deux matrices historiques. Les nouvelles grilles conservent leurs codes et libellés source sans leur attribuer de catégorie familiale (`v3.ts:11-14`; `v3-matrices.ts:63-91, 116-159`). La règle `situation_familiale_categories` confirme les trois catégories, sans autoriser à déduire la situation d’une personne depuis ces codes.
- ✅ **CONFORME —** Les expressions ACTIVA/SINE sont conservées comme texte, sans calcul individuel; les valeurs de formule Excel utilisent leur résultat enregistré. Les paramètres Bonus sont exposés séparément comme seuils et paramètres de formule. La comparaison tient compte de la valeur, de l’unité, du contexte, de la date et du type expression (`v3-common.ts:72-77`; `v3-other-sections.ts:262-309, 312-383`; `fr.json:1300-02`; `compare.ts:13-30`).
- ❓ **NON COUVERT —** `v3-other-allowances.ts:56-63` importe des montants de revenu d’intégration (CPAS); les lignes SINE/ACTIVA et Bonus sont également hors des règles chômage documentées (`v3-other-sections.ts:254-309, 312-383`). L’import est descriptif et ne permet pas de certifier ces régimes. **À valider par Oraliks.**
- ❓ **NON COUVERT —** Les dates et la traçabilité du classeur ne certifient pas l’exhaustivité juridique ONEM de tous les montants ni leur applicabilité à une personne (`v3.ts:10-15`; `fr.json:1300-02`). **À valider par Oraliks.**

### Fraîcheur
**RAS** — aucun `rule_id` n’est référencé par la cible. La règle consultée pour les libellés A/N/B est vérifiée au 30/06/2026, moins de six mois avant cette revue. Aucun fichier modifié; aucune campagne de tests lancée.
