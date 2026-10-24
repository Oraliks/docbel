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

## Lecture et limites explicites

Le seul original fourni est `barema20260901-new.xlsx`, conservé strictement comme
fixture de test, jamais importé automatiquement au runtime ni seedé en production.
SHA-256 : `a237c1a2a26f05249f8177700844a375ac5508e256e1db82e2279964226151f0`.

Lecture limitée à `A_N_B_vol_plein`, `A_N_B_half_demi`, `Basisbedragen` :
2 685 valeurs (1 300 entières, 1 300 demi-allocations, 75 bases, 10 paramètres
d'indexation). Les neuf autres feuilles sont explicitement non couvertes.
La publication active une version complète de ce périmètre, sans assembler des
cellules de versions différentes. Une perte de couverture ou une lecture ambiguë
bloque ; une absence ne remplace jamais une valeur par zéro.

Identités sémantiques par code/catégorie/période/tranche ou article/libellé.
Sources : feuille, cellule, valeur brute, formule. Les résultats enregistrés des
formules sont lus, sans recalcul Excel. Une formule sans résultat, une erreur
Excel, une cellule requise manquante ou une collision bloque. Les décimales sont
conservées en chaînes ; les bases à quatre décimales ne deviennent pas des centimes.
Les unités et fréquences distinguent notamment base/indexé, jour/mois, entier/demi,
facteur/pourcentage source. Aucun montant n'est présenté comme un droit individuel.

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
avant/après. Des pièges de modules interdisent aussi les anciens services.

La CI `Autonomous rates isolation` recrée cet environnement, puis lance la recette
Playwright à `localhost:3010`. `setup-autonomous-rates-local.ts` refuse toute autre
base et crée un administrateur local avec mot de passe aléatoire dans
`private/backups/autonomous-rates-test/` ignoré. Placer aussi les données PostgreSQL
hors de `test-results/`, que Playwright peut nettoyer. Les variantes synthétiques
et comptes de recette restent dans cette base.
L'option de reset de ce script ne vise que les trois tables nouvelles, en test.

## Retrait ultérieur : aucune bascule autorisée ici

Preuves locales : suite complète 3 355 tests réussis, 1 ignoré ; recette PostgreSQL
du nouveau domaine 11 tests réussis ; Playwright sous Edge 1 parcours complet
réussi (original puis variante synthétique, deux publications et rechargements).
Captures réelles : `docs/evidence/baremes-autonome/`. Le nom synthétique apparaît
dans la capture de comparaison ; les deux premières captures montrent le premier
import de l'original sans ancienne référence. Aucun second original n'est inventé.

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
4 conforme · 0 écart · 1 non couvert — import documentaire administratif, sans
nouvelle règle d'orientation ni promesse d'allocation.

### Constats
- ✅ CONFORME — A/N/B proviennent des en-têtes du classeur, recoupés avec T201 et
  `situation_familiale_categories` ; aucune déduction universelle par préfixe.
- ✅ CONFORME — Entier/demi, base/indexé et fréquences restent distincts.
- ✅ CONFORME — Dates et sources conservées, absence/inconnu distincts de zéro.
- ✅ CONFORME — Aucun verdict individuel, lien consommateur ou règle familiale ajouté.
- ❓ NON COUVERT — La validité juridique exhaustive de toutes les valeurs et formules
  Excel n'est pas certifiée par ce lecteur. Les neuf feuilles non lues sont annoncées.
  À valider par Oraliks pour tout élargissement ou future bascule.

### Fraîcheur
RAS : aucun rule_id n'est câblé dans un nouveau moteur d'orientation par ce lot.
