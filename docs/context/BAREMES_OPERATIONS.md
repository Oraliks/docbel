# Barèmes — exploitation et garanties

Le module Barèmes importe et consulte les classeurs ONEM sans raccorder ni
modifier les calculateurs, formulaires ou autres consommateurs existants.

## Cycle administrateur

1. Importer un `.xlsx` ONEM depuis `/admin/baremes/import`.
2. Vérifier les diagnostics, les correspondances et le fichier source téléchargeable.
   Un nouvel import n'est créé que si l'original a été conservé dans le stockage
   privé, avec son SHA-256 et sa taille.
3. Corriger toute alerte `error` ou `critical`. Une publication ne contourne pas
   ces alertes, une date d'effet absente, une date future, ou une provenance
   manquante.
4. Si le contrôle à quatre yeux est demandé, deux administrateurs distincts
   approuvent le même brouillon avant publication.
5. Publier lorsque la date d'effet est arrivée. La publication archive seulement
   le publié de la même famille de fichiers, de façon transactionnelle.

Les imports historiques dépourvus d'original restent consultables, mais sont
signalés comme tels et ne constituent pas une preuve de provenance.

## Consultation et contrôle ONEM

La consultation publique ne lit que la famille `onem-rates` publiée dont la date
d'effet est arrivée. Après une publication ou un rollback, l'API publique relit
la version active et exige une revalidation HTTP : elle ne sert pas une version
obsolète depuis un cache CDN.

Le contrôle ONEM est strictement manuel. Il compare le classeur original interne
à la référence ONEM, avec destinations HTTPS ONEM validées, redirections
contrôlées, délais et plafonds de taille. Il distingue une concordance de contenu
normalisé, une date externe plus récente, un contenu différent à date égale, une
référence interne plus récente, et les contrôles non concluants. Une date ou un
original manquant, ou un réseau indisponible, ne produit jamais un statut positif.

La comparaison normalisée ne prouve pas l'identité binaire du fichier XLSX ni ses
métadonnées ou formules non calculées ; sa portée est affichée dans la réponse.

## Recette authentique du 17/10/2026

La recette hors production a utilisé le classeur téléchargé manuellement depuis
le [hub officiel ONEM](https://www.onem.be/documentation/montants), sans import,
publication ni écriture en base :

- fichier : `barema20260901-new.xlsx` ; 201 084 octets ; SHA-256
  `A237C1A2A26F05249F8177700844A375AC5508E256E1DB82E2279964226151F0` ;
  conservé temporairement hors dépôt ;
- 12 feuilles et 6 600 montants extraits ; date d'effet de fichier
  `01/09/2026` ;
- round-trip : 6 600 contrôlés, 6 489 directs, 111 dérivés, aucun mismatch ;
- couverture inverse des cinq matrices denses : aucune cellule orpheline ;
- `Basisbedragen` : 75 montants, notamment `D13` = valeur XLSX numérique
  `2189.81`, affichée `2,189.81`, article `28, § 2 (5 MB)`, unité mensuelle.

Cette recette a révélé et corrigé trois incompatibilités de structure : le nom
officiel `baremaYYYYMMDD-new.xlsx` n'était pas daté, l'en-tête
`Basisbedragen!A11` `Artikel KB WLH` n'était pas reconnu, et le contrat
historique de la matrice mi-temps attendait à tort 1 501 montants au lieu de
1 500. Les tests de parseur et de contrat couvrent ces régressions.

Le classeur actuel ne contient aucune cellule affichée exactement `2,189`.
La valeur voisine `2,189.81` est une cellule numérique Excel non ambiguë et est
correctement normalisée à `2189.81`. Cela ne vérifie pas les imports historiques
dont l'original manquerait.

## Limites connues à vérifier en environnement réel

- Les anciens imports stockés seulement sur un disque de déploiement peuvent ne
  plus avoir d'original téléchargeable ; ils ne sont pas réassociés automatiquement.
- Une contrainte unique partielle en base sur un publié par `fileType` reste à
  appliquer après inventaire de la base de production. La préparation additive,
  l'inventaire préalable et le rollback sont dans
  [`prisma/baremes-publication-unique-index.sql`](../../prisma/baremes-publication-unique-index.sql).
  Elle compléterait la transaction applicative contre les écritures hors
  application ; elle n'est jamais exécutée automatiquement.
- Les formats numériques ambigus tels que `2,189` restent à vérifier si un
  classeur source les contient effectivement ; le classeur du 01/09/2026 ne
  fournit pas ce cas.
- Le pipeline complet a été exécuté sur PostgreSQL local jetable avec stockage
  mémoire simulé : import, publication, consultation, export de route et
  rollback. L'infrastructure Blob réelle n'a pas été validée; la Neon configurée
  est partagée et n'est jamais utilisée pour cette recette.
- La concurrence PostgreSQL à deux connexions et l'index unique partiel ont été
  exécutés dans cette base locale. L'index reste une préparation additive à
  appliquer séparément après inventaire de production.

## Validation technique du 17/10/2026

Les contrôles globaux ne se terminaient pas parce que le checkout contenait un
worktree temporaire sous `.worktrees/`. ESLint le parcourait comme une seconde
copie du dépôt (408 265 diagnostics) et TypeScript l'incluait via
`**/*.ts(x)`. Les configurations ESLint et TypeScript excluent désormais ce
répertoire ainsi que les journaux locaux `.validation-logs/`; les configurations
TypeScript dérivées répètent cette exclusion car leur propriété `exclude` écrase
celle du parent.

Après cette correction, ESLint termine réellement (113,44 s, code 1) avec
119 erreurs et 51 avertissements du checkout principal, hors module Barèmes.
Le build Next.js termine aussi réellement (164,91 s, code 1) : Turbopack compile
en 48 s, puis le typecheck signale une erreur existante dans
`lib/regulatory-decision/personal-situation-change.ts:135`. Aucun contrôle n'est
désactivé et cette logique hors Barèmes n'est pas modifiée par ce lot.

### Prérequis de recette PostgreSQL et Blob

La recette crée elle-même un PostgreSQL local jetable hors dépôt, sur boucle
locale, depuis les binaires officiels temporaires. Les variables Blob présentes
ne sont pas qualifiées comme destination de test et aucune variable
`*BLOB*TEST*` n'est fournie : elles ne sont donc jamais utilisées.

Pour exécuter la recette persistante, fournir une base PostgreSQL locale vide
dont le nom et le chemin d'URL sont exactement
`docbel_baremes_test_<suffixe>` et créer le marqueur
`_DocbelAuditIsolation` avec le but `baremes-concurrency-20261017`. Les variables
à fournir séparément sont `DOCBEL_BAREMES_TEST_DATABASE_URL` et
`DOCBEL_BAREMES_TEST_DATABASE_NAME`; le runner doit refuser toute autre forme de
nom avant d'initialiser le schéma. Une destination Blob privée de test explicitement
identifiée est nécessaire pour tester le stockage réel ; à défaut, la preuve doit
rester libellée « Persistance PostgreSQL testée ; infrastructure Blob réelle non
testée. »

### Intégration PostgreSQL locale du 17/10/2026

Une recette réelle a ensuite été exécutée sur PostgreSQL 17.11 démarré depuis
l'archive binaire x64 EDB référencée par PostgreSQL.org, dans un cluster neuf
hors dépôt. Le serveur écoutait uniquement `127.0.0.1:55432`; la base jetable
était `docbel_baremes_test_20261017`, avec le rôle dédié `baremes_test` et le
marqueur `_DocbelAuditIsolation` `baremes-concurrency-20261017` vérifié avant
le schéma applicatif et les fixtures.

Le runner [`scripts/verify-baremes-postgres-integration.ts`](../../scripts/verify-baremes-postgres-integration.ts)
refuse les noms non conformes, une URL non locale, ou un marqueur absent. Il a
exercé avec Prisma et les services applicatifs réels : publication nominale,
approbation à deux administrateurs, refus de date future, publication concurrente
de deux brouillons (un seul publié final), publication puis rollback, ainsi que
l'index unique partiel `BaremeFile_one_published_per_fileType`. L'index autorise
les familles distinctes et refuse deux publiés de la même famille; il est retiré
par le runner à la fin.

La combinaison testée est : **PostgreSQL réel + stockage simulé**. Le runner
injecte au seul point de frontière un store mémoire qui conserve et relit les
octets exacts du classeur; le reste du pipeline (`importBaremeFile`, parseurs,
hash, transactions, publication et lecteur actif) est réel. Le classeur
authentique de 201 084 octets a créé 12 feuilles et 6 600 montants, puis a été
publié et relu par `getActiveBaremeData`.

Le Blob réel reste non validé : aucun token ou store de test explicitement
autorisé n'était fourni.

### Complément persistant du 17/10/2026

Le même runner a ensuite été exécuté avec le comportement Blob de production
par défaut, remplacé uniquement par un adaptateur mémoire installé par du code
serveur sous `NODE_ENV=test`. Aucun paramètre HTTP, JSON ou query string ne
peut sélectionner cet adaptateur. La route de source et la route CSV ont appelé
leurs handlers réels; l'authentification a été simulée par la couture de test
interne de `requireAdminAuth` (admin, anonyme puis non-admin), sans contourner
les handlers ni leur ordre de contrôle.

| Scénario | Exécuté | Résultat | Preuve compacte |
| --- | --- | --- | --- |
| Import nominal authentique | Oui | OK | 201 084 octets, SHA-256 attendu, 12 feuilles, 6 600 montants et lecteur actif |
| Échec stockage | Oui | OK | upload mémoire atteint puis erreur de conservation; aucune ligne DB ou source partielle |
| Échec DB après upload et nettoyage | Oui | OK | trigger PostgreSQL `BEFORE INSERT`, transaction annulée et orphelin supprimé |
| Échec de suppression | Oui | OK | trigger DB + suppression mémoire forcée en erreur; diagnostic conservé, cause DB restituée, orphelin nettoyé explicitement après assertion |
| Téléchargement source et refus | Oui | OK | handler réel : hash/taille/headers/cache; 404 absent, 409 court ou altéré, 401 et 403 avant toute lecture |
| Export par les routes | Oui | OK | `sheetId` et `fileId`, 12 sections, BOM vérifié sur octets, échappement formule et absence de chemin Blob |
| Rollback vers le fichier authentique | Oui | OK | A authentique publié, B synthétique identifié publié, A restauré : un publié, 6 600 montants, hash/source/export/événements cohérents |
| Non-régression PostgreSQL existante | Oui | OK | publication, double approbation, date future, index partiel, concurrence et rollback séquentiel |

La panne DB est injectée seulement dans cette base par un trigger retiré par le
runner. Le cluster, la base et le store mémoire sont jetables; aucun Blob réel,
Neon, déploiement ou consommateur n'est impliqué.

### Périmètre de tests et coutures de recette

La commande courte précédemment employée a exécuté seulement les 20 fichiers
de `lib/baremes/__tests__` (122 tests) : sous PowerShell, le glob transmis à
Vitest pour les routes était littéral. Les cinq fichiers suivants, déjà présents
et non supprimés, expliquent les 19 tests manquants du précédent total 25/141 :

- `baremes-export-security.test.ts` (6), `baremes-list-route.test.ts` (3),
  `baremes-onem-check-route.test.ts` (4), `baremes-parser.test.ts` (1) et
  `baremes-source-download.test.ts` (5), tous sous `lib/__tests__/`.

Le périmètre Barèmes reproductible est désormais la commande PowerShell
suivante; elle découvre explicitement les deux emplacements et a exécuté
**26 fichiers / 144 tests** le 17/10/2026. Les trois tests supplémentaires
viennent de `baremes-recipe-isolation.test.ts`, ajouté pour les coutures de
recette.

```powershell
$tests = @(
  (Get-ChildItem -LiteralPath 'lib\baremes\__tests__' -Filter '*.test.ts' | ForEach-Object FullName) +
  (Get-ChildItem -LiteralPath 'lib\__tests__' -Filter 'baremes-*.test.ts' | ForEach-Object FullName)
)
pnpm exec vitest run @tests --reporter=dot
```

`withAdminAuthTestOverride` et `withBlobStorageTestAdapter` sont disponibles
uniquement sous `NODE_ENV=test`. Ils utilisent chacun un `AsyncLocalStorage` :
l'override est limité au callback asynchrone appelant, est restauré même si ce
callback échoue et n'est pas partagé par deux recettes parallèles. Aucune route,
cookie, header, JSON ou query string ne les active. Hors de ce contexte, les
fonctions Blob suivent leur chemin Vercel normal et `requireAdminAuth` relit la
session, l'utilisateur, son statut et son rôle en base.

Dans le runner persistant, les réponses 401/403 de la route Barèmes sont des
résultats explicitement fournis à `requireAdminAuth`. Elles prouvent que le
handler bloque avant toute lecture de provenance, mais ne constituent pas une
recette Better Auth/session complète. Cette dernière demeure couverte séparément
par les tests d'authentification et de téléchargement privé.

### Cas `2,189` — constat de validation

La recette du 17/10/2026 ne trouve aucune cellule affichée exactement `2,189`.
`Basisbedragen!D13` est une cellule numérique `2189.81` au format Excel
`#,##0.00`, affichée `2,189.81` : le pipeline conserve correctement cette valeur.

La règle actuelle de `parseCellNumber` traite une valeur qui contient seulement
une virgule suivie de un à quatre chiffres comme décimale : le littéral brut
`2,189` devient donc `2.189`. Cette interprétation peut être erronée si la
cellule est en réalité une notation US de milliers (`2189`) : l'impact potentiel
est alors d'un facteur mille, selon l'unité de la colonne. Le parseur n'est pas
modifié sans preuve de classeur source.

Avant toute correction, relever dans le Blob source de l'import concerné : son
identifiant et SHA-256, le nom de feuille, l'adresse de cellule, les valeurs
SheetJS brutes `v` et formatées `w` (ainsi que le format `z`), l'en-tête et
l'unité de la colonne, les lignes voisines et la trace persistée de l'import.
Comparer ensuite le montant normalisé actuel, les catégories affectées et le
montant affiché avant de choisir une règle explicite et testée.

## Revue visuelle avant/après (17/10/2026)

L’onglet **Changements** de la fiche `/admin/baremes/import/[id]` est la seule
interface de revue. Il ne télécharge plus le classeur entier dans React : la
route administrateur `GET /api/baremes/import/[id]/comparison` retourne une
page (50 lignes), les compteurs globaux et le total filtré. La pagination est
déterministe; les états primaires sont `modified`, `unchanged`, `added`,
`disappeared` et `ambiguous`. Une collision de `comparisonKey` reste donc une
limite visible et n’est jamais rapprochée par montant, libellé ou position Excel.

La comparaison utilise uniquement les données normalisées persistées. Elle
compare la candidate au dernier publié applicable de la **même** `fileType`,
avec une date d’effet antérieure ou égale. Les détails de chaque ligne donnent
les deux unités, les attributs modifiés, les valeurs sans arrondi forcé et les
traces disponibles (feuille, cellule, valeur source et mapping). `0`, une
valeur absente et une variation relative non calculable restent distincts.

À la création d’un import, `diagnostics.comparison` conserve la paire fixe,
l’état (`computed`, `first_import` ou `reference_unavailable`) et deux
empreintes SHA-256 des données normalisées. Ce champ JSON additif évite une
migration et ne réécrit pas les imports historiques. Un ancien import sans ce
contexte reste consultable, mais l’outil annonce qu’aucune preuve de comparaison
historique n’est disponible. Le premier import demande une revue explicite de
la source et de sa couverture, sans inventer de pourcentage avant/après.

Avant publication, l’administrateur sélectionne **Marquer la revue examinée**.
`POST /api/baremes/import/[id]/review` journalise alors l’acteur, l’instant, la
paire et les révisions dans `BaremePublicationLog`. La transaction de
publication, y compris celle déclenchée après deux approbations, exige cette
entrée et vérifie que le publié courant est toujours la référence mémorisée.
Une référence remplacée ou une révision différente bloque la publication; il
faut actualiser puis refaire la revue. Une valeur ajoutée, disparue ou inchangée
n’est pas à elle seule bloquante.

L’export administrateur `type=comparison` fournit un CSV complet (`scope=all`)
ou l’ensemble correspondant aux filtres visibles (`scope=filtered`). Il contient
les identifiants/révisions des deux versions, valeurs et unités avant/après,
écarts, attributs et provenances disponibles. Il réutilise `buildCsv`, son BOM
et sa protection contre les formules. Il n’exporte ni chemin Blob privé ni URL
signée.

### Mise en service (sans exécution automatique)

1. Déployer le code applicatif; aucune migration Prisma ni `db push` n’est
   requise car le snapshot est rangé dans le JSON `diagnostics` existant.
2. Importer un nouveau brouillon de chaque famille : seul ce nouveau brouillon
   possède une paire persistée. Ne pas réécrire massivement les archives.
3. Ouvrir **Changements**, contrôler les cinq états, les collisions et la
   couverture dans **Diagnostic** / **Conformité**, puis exporter le CSV si une
   preuve hors interface est nécessaire.
4. Enregistrer la revue explicite, puis appliquer le workflow normal de
   publication ou de double approbation. Le verrou serveur refuse les paires
   absentes, périmées ou non relues.

Cette amélioration ne valide ni Blob réel, ni Neon partagée, ni les changements
réglementaires attendus. Elle rend les différences observées et les limites de
couverture traçables avant publication.

### Corrections après revue indépendante (17/10/2026)

- Un premier import sans référence peut être examiné et publié. Une référence
  explicitement absente reste absente dans la consultation historique, même si
  une version est publiée ultérieurement.
- Si le publié a changé, utiliser **Renouveler la comparaison** sur la fiche du
  brouillon, puis examiner à nouveau le résultat et enregistrer sa revue. Le
  renouvellement conserve l'ancienne paire dans un événement
  `comparison_refreshed` ; il ne réimporte pas le fichier et ne réécrit pas les
  archives. Snapshot et événement sont atomiques, en transaction serializable.
  Même un renouvellement vers les mêmes données invalide la revue précédente.
- Deux approbations antérieures à la revue restent conservées. Après la revue,
  l'un des deux administrateurs peut cliquer à nouveau sur **Approuver** pour
  retenter la publication, sans troisième approbation. Un refus de publication
  est affiché avec son motif. Les gardes de publication restent applicables.
- L'export filtré reprend les quatre filtres visibles : état, recherche, feuille
  et catégorie. Revue et renouvellement respectent le garde de lecture seule.
- La suppression est limitée aux brouillons/refusés et aux suppressions à
  reprendre ; les versions publiées/archivées conservent leur provenance. Une
  transition durable vers `deleting` précède l'appel au stockage. En cas d'échec
  Blob ou DB, la fiche garde sa référence et reste non publiable avec le libellé
  **Suppression à terminer** ; réessayer la suppression après résolution de la
  panne. Un Blob n'est jamais passé à `unlink`. Les chemins legacy sont bornés
  aux répertoires de sources Barèmes ; seule l'absence du fichier est tolérée.

Le runner persistant prépare ses snapshots avec le comparateur applicatif et
enregistre les revues via le service réel. Il couvre aussi les approbations avant
revue et la reprise d'une paire périmée. Il exige une base locale **vide** avec
le marqueur exact avant toute écriture, y compris le nettoyage. Ses objets SQL
portent des noms propres à l'exécution ; seules les fiches créées par celle-ci
sont retirées, jamais un ensemble trouvé par hash. Un refus d'isolation ne
démarre ni recette ni nettoyage. Le chemin du classeur peut être fourni via
`DOCBEL_BAREMES_TEST_WORKBOOK` ; son hash et sa taille restent vérifiés.

Validation ciblée après corrections : 33 fichiers / 172 tests Barèmes verts,
incluant routes review/comparison/export/delete, garde d'isolation, premier
import, renouvellement et reprise d'approbation. Recette PostgreSQL réelle sur
le cluster neuf `127.0.0.1:55434`, base
`docbel_baremes_test_review_fixes_20261017`, stockage mémoire : succès. Une base
distincte `docbel_baremes_test_review_refused_20261017` avec marqueur erroné a
produit le refus attendu (code 1), sans altérer sa fiche sentinelle ni son index.
Ces preuves n'impliquent ni écriture Neon/Blob réel, ni recette navigateur.
