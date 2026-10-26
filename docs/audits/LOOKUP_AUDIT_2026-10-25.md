# DocBel — Audit ciblé Lookup ONEM

Date : 25 octobre 2026
Périmètre : audit statique ciblé, sans raccordement ni changement de code métier.

## Synthèse

Le checkout audité n'est pas le `main`/HEAD du cadrage joint : il est sur
`codex/article-110-consolidation`, HEAD `b67024bdf1ba75f08ed09f8865fce7c558e8742a`
(23 octobre 2026). Il contient de nombreux changements non committés, dont le
chantier barèmes et des documents familiaux. Ils ont été laissés intacts. Les
constats ci-dessous concernent exclusivement le code lisible à ce HEAD local;
ils devront être comparés au HEAD de l'intervention avant toute implémentation.

Le Lookup est déjà un référentiel opérationnel de catégories, tables et entrées
ONEM, avec recherche, consultation paginée, historique, favoris, import CSV et
deep-links. Il n'est pas encore un service de résolution historique et traçable
au sens métier. Trois points sont à traiter avant un usage métier étendu :

1. **Confidentialité** : les routes de lecture sans contrôle d'accès exposent
   potentiellement notes internes, approbations nominatives et métadonnées de
   tables. Le contenu effectif et les gardes globales restent à vérifier.
2. **Publication d'import** : les approbations ne sont attachées ni au fichier,
   ni à un comparatif immuable; l'import tolère des erreurs partielles et les
   approbations sont quand même effacées.
3. **Temps et trace** : les services de résolution utilisent aujourd'hui la
   date courante et ne rendent ni identifiant stable de l'entrée, ni révision
   publiée, ni provenance exploitable.

Le code montre déjà un pont éditorial RioLex → Lookup sous forme de liens. Il ne
résout pas encore la définition courante/datée dans la fiche juridique. Le
moteur familial n'appelle pas le Lookup dans le code examiné; conserver cette
séparation est la bonne base.

## Carte des données et flux

```mermaid
flowchart LR
  CSV[CSV ONEM / fichier administrateur] --> IMPORT[importLookupCsv]
  IMPORT --> DB[(LookupCategory / LookupTable / LookupEntry)]
  DB --> SEARCH[/api/lookup/search et browse/]
  DB --> RESOLVE[/api/lookup/resolve]
  DB --> TABLE[/api/lookup/tables et détail/historique/]
  DB --> BUNDLE[/api/lookup/bundle export/]
  ADMIN[Admin Lookup] --> IMPORT
  REG[legalMeta.lookupRefs RioLex] --> LINK[ArticleSidebar : deep-link seulement]
  DOSSIER[LookupCodeRef des procédures] --> LINK2[lookupUrl : deep-link seulement]
  DB --> BUREAU[lib/bureaus/resolve : lecture Prisma directe]
  FACTS[Faits + date + seuils] --> FAMILY[evaluateFamilySituation]
  FAMILY -. aucun appel Lookup observé .- DB
```

**Données présentes** : `LookupCategory`, `LookupTable` et `LookupEntry` dans
`prisma/schema.prisma:600-710`; l'entrée porte `id`, code, labels, dates, JSON
`metadata`, `notes`, `createdAt` et `updatedAt`. La table conserve source du
dernier import et date de mise à jour saisie, mais aucun identifiant d'export
officiel, hash de publication ou numéro de révision. `LookupApproval` a un champ
`changeset`, mais le handler d'approbation ne le renseigne pas.

**Consommateurs identifiés** :

- Recherche et pages de consultation partenaires :
  `components/partenaire/lookup-onem-search.tsx`,
  `components/partenaire/lookup/table-view.tsx`,
  `app/outils/lookup-onem/**`.
- Administration : pages `/admin/chomage/lookup` et composants
  `components/admin/lookup/**`, via `/api/lookup/**`.
- Résolution applicative : `lib/bureaus/resolve.ts:373` lit directement
  `LookupEntry`; plusieurs scripts de synchronisation bureaux/communes et
  d'import s'adressent aussi directement aux modèles.
- Lectures/écritures d'entretien repérées par recherche des accès Prisma :
  `scripts/bureaux-assign.ts`, `bureaux-sync-sections-paiement.ts`,
  `bureaux-sync-onem.ts`, `communes-import-postal-codes.ts`,
  `postal-codes-from-bestaddress.ts`, `lookup-onem-freshness-audit.ts`,
  `i18n-lookup-coverage.ts`, `i18n-volume-audit.ts`,
  `generate-lookup-refs.ts`, `attach-lookup-refs.ts`, `seed-lookup-onem.ts` et
  `import-lookup-bulk.ts`. Ce sont des scripts d'administration/maintenance,
  pas tous des consommateurs runtime. `scripts/import-bestaddress-streets.ts`
  écrit les entrées et contient un `deleteMany` préalable ciblé sur sa table;
  il n'a pas été lancé. `/api/admin/lookup/freshness` lit les métadonnées de
  tables directement.
- Formulaires : l'autocomplétion des rues appelle `/api/lookup/search` pour la
  table `code-rue`; les suggestions PDF consomment ce format.
- RioLex : `legalMeta.lookupRefs` est normalisé, puis affiché comme lien dans
  `components/reglementation/article-sidebar.tsx:83-117`. La carte éditoriale
  `lib/data/riolex-lookup-refs.json` est appliquée par
  `scripts/attach-lookup-refs.ts`; le générateur produit des candidats
  structurels à partir de numéros d'articles et de titres. Ce mapping ne prouve
  pas à lui seul une correspondance juridique validée.
- Dossiers : `LookupCodeRef` dans `lib/dossiers/types.ts:204-221` et
  `lookupUrl` dans `lib/dossiers/procedures.ts` fournissent des deep-links
  éditoriaux. Pas de résolution de libellé ou de version dans les parcours
  examinés.
- Vérificateur familial : les recherches dans `lib/regulatory-decision`,
  `lib/family-situation-tree` et le parcours familial n'ont pas trouvé d'appel
  Lookup. L'évaluateur reçoit faits/date/seuils séparément. La référence
  familiale verrouillée a été lue intégralement et n'a pas été modifiée.
- **Bundle** : `/api/lookup/bundle` exporte le référentiel en JSON; ce n'est pas
  un `DocumentBundle`/`BundleRun` ni un raccordement aux dossiers citoyens.

## Constats A à G

### A — Approbation détachée du contenu (haute)

`approve/route.ts:23-33,52-60` enregistre table, email, nom et commentaire;
`changeset` n'est pas fourni. `import/route.ts:37-68` compte les approbateurs,
puis lit le fichier de cette requête sans comparer son contenu, son hash, la
version de référence ou un comparatif à l'objet approuvé. Les écritures admin
de table/entrée ne retirent pas non plus ces approbations.

**Risque déduit** : deux approbations valides pour la table peuvent autoriser un
autre fichier ou un contenu modifié après approbation. Aucun incident n'a été
observé. **Correction minimale** : proposition immuable d'import contenant hash,
cible, révision de base, diff et version de parseur; approbations sur son ID;
invalidation à toute variation; contrôle transactionnel au moment de publier.
**Test attendu** : changer un octet du CSV, la référence ou le parseur après
approbation doit empêcher la publication.

### B — Écriture partielle et état de succès ambigu (haute)

`importLookupCsv.ts:264-317` insère par lots de 500 et poursuit après erreurs
de lots ou d'updates. `:319-339` met quand même à jour le compteur et les champs
`lastImported*`, puis retourne `errors`. `import/route.ts:70-84` efface les
approbations sans vérifier `result.errors` et renvoie le résultat en HTTP 200.
Les lignes absentes du CSV sont uniquement placées dans `diff.expired`
(`importLookupCsv.ts:251-262`); elles ne sont pas expirées, ce qui préserve
l'historique mais confond l'absence de l'export avec une expiration dans le nom
du diff.

**Risque déduit** : données mixtes et date d'import récente après une publication
incomplète; approbation consommée malgré les erreurs. **Correction minimale** :
préparer/valider un jeu complet hors lecture active, puis activation atomique
d'une révision; statut d'échec explicite; séparer « absent de l'export » de
« officiellement expiré ». **Test attendu** : échec d'une ligne/transaction ne
change ni la révision consommée ni la date de dernière publication.

### C — Temporalité incohérente (haute avant raccordement métier)

`entryFilters.ts:18-20,97-111` et `/api/lookup/tables/[id]` acceptent
`validOn`; la page conserve aussi filtre, historique et favoris. En revanche,
`getLookupEntry.ts:45-74` et `getLookupEntriesByCodes:100-118` prennent `new Date()`;
`search/route.ts:49,75-79,198-204` filtre « aujourd'hui » ou désactive le filtre
avec `validOnly=false`, sans date d'effet paramétrable. Le chemin de détail
compare inclusivement `validFrom <= date <= validUntil`. Les liens `?code=` ne
transportent pas de date (`table-view.tsx:114-115`; landing donne le code seul).

**Risque** : un dossier ancien résolu maintenant reçoit potentiellement le code
actuel. Les chevauchements sont départagés par le plus récent `validFrom` sans
statut d'ambiguïté explicite. **Correction minimale** : contrat commun
`asOf` optionnel, jour civil et frontières centralisés; défaut de consultation
documenté; inclure date et révision dans liens/snapshots des dossiers. Distinguer
validité, date de publication/import et consultation. **Test attendu** : frontières,
chevauchements et même date/révision cohérents sur toutes les surfaces.

### D — Contrat de résolution insuffisant pour audit (moyenne/haute)

`ResolvedLookupEntry` (`getLookupEntry.ts:3-15`) renvoie le code, labels,
table/catégorie, dates et notes, mais pas `id`, révision, langue effectivement
servie ni provenance. `getLookupEntry` retourne `null` aussi bien lorsqu'il n'y
a pas d'entrée valide que quand aucune entrée correspondante n'existe
(`:39-44,76-93`). `/api/lookup/resolve` transforme cela en 404
(`resolve/route.ts:32-38`); une panne DB reste une exception de route, sans
contrat de statut métier distinct.

**Correction minimale** : faire évoluer le service existant vers un statut
explicite (résolu/absent/ambigu/indisponible), ID d'entrée, révision publiée,
langue réellement servie et source/version vérifiable. Garder la recherche fuzzy
comme découverte de candidats, jamais comme résolution automatique.
**Test attendu** : stabilité pour une même clé/date/révision et distinction
entre absence et erreur technique.

### E — Visibilité des données à établir (risque prioritaire, fuite non prouvée)

Les pages Lookup appellent `requirePartnerOrAdminAuth` (`guard.ts:15-18`), mais
les routes `/api/lookup/resolve`, `search`, `bundle` et `tables/[id]` n'ont pas de
garde locale dans le code lu. Elles définissent un cache HTTP public (`resolve`
et `search`) ou `bundle` le fait explicitement. `search/route.ts:11-21,153-165`
renvoie `notes` et `metadata`; `tables/[id]/route.ts:40-50,63-80` renvoie la
table complète, dont notes, champs d'import et approbations contenant emails,
noms/commentaires, ainsi que les entrées (notes et metadata); cette lecture
n'exige pas de session dans le handler. `bundle/route.ts:17-18,70-79` n'inclut
les notes que sur option `includeNotes=true`, sans garde dans le handler. Le
schéma décrit metadata comme pouvant contenir téléphone, IBAN, adresse ou code
INS (`schema.prisma:695-702`).

**Risque** : exposition d'annotations internes, données opérationnelles ou
éventuellement personnelles via routes publiques et caches. Le contenu de la
base et middleware global, cache effectif et rate-limit n'ont pas été vérifiés;
ceci est un risque statique, pas la preuve d'une fuite en production.
**Correction minimale** : séparer les projections publiques/interne; retirer
notes, approbations et métadonnées sensibles des routes publiques; réserver
l'admin au contrôle admin; définir le public/partenaire/interne par surface;
vérifier middleware, cache et rate-limit. Ne pas recopier ces notes dans un
assistant citoyen. **Tests attendus** : requêtes anonymes/partenaire/admin,
vérification du cache partagé et absence des champs internes dans toutes les
réponses publiques.

### F — Cache et ETag incomplets (moyenne)

`getLookupEntry.ts:17-37` garde une `Map` de processus pendant cinq minutes;
les mutations appellent `invalidateLookupCache` dans le processus courant. Ce
n'est pas une invalidation commune à plusieurs instances. La recherche ajoute un
cache `memoCache` 60 s (`search/route.ts:144-150`) sans invalidation par import.
L'ETag du bundle (`bundle/route.ts:108-116`) n'est pas un hash du contenu : il
combine le nombre d'entrées, catégories et `updatedAt` de la dernière entrée
triée. Changer une autre entrée peut laisser le même ETag; `validOnly` et
`includeNotes` n'y sont pas inclus non plus, bien qu'ils changent la représentation.

**Correction minimale** : révision de publication commune aux instances et
validateurs calculés par représentation/variante. Pas de nouvelle dépendance
avant d'établir le besoin. **Test attendu** : modifier n'importe quelle entrée,
notes comprises, ou changer les paramètres doit invalider le cache/ETag approprié.

### G — Consultation et erreurs (moyenne)

La vue table dispose de filtres de validité, d'historique, favoris/récents et
deep-link code (`table-view.tsx:90-115,156-195,763-789`). Mais le `catch` du
chargement vide `rows` et affiche ensuite le même message que « aucun résultat »
(`:177-190,489-494`). La panne est donc présentée comme absence. Les erreurs de
l'historique sont également converties en liste vide (`:777-784`). Le parseur
`parseOnemCode` est appelé dans l'UI et documenté comme anatomie pédagogique;
ne pas en faire une catégorisation de droits ou d'organisme.

**Correction minimale** : état d'erreur séparé de l'état vide; préserver la
date dans les liens directs; conserver favoris/historique et signalétique.
**Test attendu** : panne API affichée comme panne; zéro résultat uniquement sur
réponse réussie vide. La date et le code d'un lien direct doivent se répercuter
dans la requête.

### Point complémentaire — lectures non bornées

La règle dépôt impose `take` à tout `findMany`. `importLookupCsv.ts:164-173`
charge toutes les entrées existantes de la table pour comparer un import; le
bundle `bundle/route.ts:57-63` charge tout le référentiel pour fournir un export
complet. Ces usages sont intentionnels fonctionnellement mais violent la règle
locale et peuvent croître sans borne. **Correction minimale** : comparaison et
export par lots/cursor, sans perdre la sémantique complète. Prévoir un test sur
plusieurs pages et une volumétrie représentative.

## Raccordements et proposition de lots

### Lot 0 — Confidentialité et état de publication

Établir les projections autorisées pour chaque route; vérifier middleware,
cache et rate-limit sur environnement de recette; corriger les réponses
publiques avant d'exposer le contrat à un nouveau consommateur. Pas de test
contre la DB partagée.

### Lot 1 — Service Lookup daté et traçable

Étendre `getLookupEntry` et le résolveur par lots (pas de « Lookup V2 ») avec
`asOf`, statut, ID d'entrée, révision et provenance. Centraliser règles de date
et chevauchements. Unité de jour civil explicite. Définir les versions publiques
et l'invalidation/cache par révision.

### Lot 2 — RioLex, premier consommateur de lecture

Le pont RioLex existe déjà comme deep-link éditorial; compléter ensuite un
seul parcours : la sidebar de `app/partenaire/reglementation/[riolexId]` peut
résoudre les références via service côté serveur et afficher côte à côte le
label ONEM daté, la provenance, la paraphrase DocBel, le contexte et le lien
vers la règle/source. Associer une source/article seulement après revue experte;
un numéro d'article extrait automatiquement n'est pas validation. Ce lot ne
change ni règles ni résultats du moteur familial.

### Lot 3 — Un consommateur de dossiers, séparé

Après validation du contrat et d'une référence métier précise, choisir une
procédure unique avec `LookupCodeRef`; conserver ID/date/révision résolus à
l'événement. La mise à jour du catalogue ne réécrit pas les historiques.
N'effectuer aucun préremplissage depuis une simple ressemblance de code.

**À différer** : tout lien aux barèmes, AGR ou à leur refonte; aucun montant dans
Lookup. Bureaux : remplacer les lectures directes seulement si le contrat de
traçabilité le justifie, avec correspondances validées et sans heuristique de
code postal. Assistant : aucun accès aux notes internes; pas de publication
automatique ni de décision de droit.

## Critères d'acceptation des futurs lots

- Même ID/date/révision ⇒ mêmes définition, langue et provenance; frontières et
  chevauchements explicites.
- Un import partiellement échoué ne publie pas de version partielle; changement
  de fichier/référence/parser invalide les approbations.
- Une modification de n'importe quelle entrée invalide toutes les représentations
  et caches concernés.
- Réponses publiques sans notes internes, approbateurs, données personnelles ou
  metadata non publiable; panne distincte de l'absence.
- La couche d'explication ne modifie pas l'évaluateur familial; les dates,
  documents et décisions historiques restent stables.
- Aucune règle/montant/association juridique nouvelle sans validation experte
  et vérification réglementaire applicable.

Tests existants repérés : parseur/import (`lib/lookup/__tests__`) et normalisation
des références RioLex (`lib/reglementation/__tests__/lookup-refs.test.ts`). Je
n'ai pas exécuté de tests ni interrogé la base; il manque notamment des tests
de routes/auth, d'approbation liée au contenu, d'import atomique, de cache/ETag,
des frontières de validité et de l'erreur UI.

## Limites de preuve

Audit statique du checkout local uniquement. Aucun middleware global, session
réelle, cache CDN, contenu DB, import, runtime déployé, fiche ONEM officielle
actuelle ou environnement production n'a été vérifié. Aucun nouveau lien
juridique n'a été certifié. Les risques sont qualifiés comme déductions de code
où indiqué. Aucun sous-agent n'a été utilisé. Aucun import, migration, écriture
DB, raccordement, changement au contrat familial ou au chantier barèmes n'a été
effectué.

## Addendum — correction ciblée du 25 octobre 2026

Intervention sur `codex/article-110-consolidation`, HEAD de départ
`b67024bdf1ba75f08ed09f8865fce7c558e8742a`. Les modifications préexistantes
du chantier barèmes et des documents familiaux ont été préservées. La migration
`prisma/migrations/60_lookup_import_proposals/migration.sql` est additive et
n'a pas été appliquée.

### Corrigé et testé

- Les routes de lecture des tables, entrées, historiques et résolutions exigent
  un partenaire rattaché à une organisation ou un administrateur. La recherche
  publique reste disponible uniquement pour `code-rue`, avec rate-limit et
  projection sans notes/métadonnées; le bundle ne livre jamais notes ou
  métadonnées et refuse `includeNotes=true`. Les réponses protégées sont
  `private, no-store`.
- Les projections partenaires omettent notes, metadata, approbations et champs
  d'import. L'écran partenaire sépare panne et résultat vide, avec réessai
  conservant les filtres. L'écran admin affiche les propositions, leur diff,
  les approbations et distingue la revue de la publication effective.
- Les imports préparent un comparatif/payload hachés avant écriture. La
  publication verrouille la table, revérifie source, parseur, transformation,
  révision et approbateurs distincts puis écrit dans une transaction
  sérialisable. Une entrée absente de l'export n'est pas expirée; les doublons
  contradictoires et dates impossibles sont rejetés. Le chargeur BeStAddress
  direct utilise également une transaction atomique; il n'a pas été exécuté.
- La résolution unitaire et par lots accepte `asOf` au format date civile
  `AAAA-MM-JJ`; bornes inclusives au jour UTC. La réponse restitue l'id d'entrée,
  la date effective, la révision publiée et les provenance disponibles. Les
  chevauchements sont `ambiguous`; les pannes ne sont pas cachées comme absences.
  Le cache unitaire est indexé par date/révision et le bundle calcule son ETag
  sur le SHA-256 de sa représentation exacte.
- Tests ciblés Lookup : **73 réussis sur 8 fichiers**, couvrant profils visiteur,
  utilisateur sans permission, partenaire, admin et compte désactivé; champs
  sérialisés; fichier modifié; référence obsolète; approbateurs dupliqués;
  erreur d'écriture; double publication; dates frontières, chevauchements,
  révisions, erreur technique, doublons CSV et date impossible.

### Modifié mais validation incomplète

- `prisma validate` et `prisma generate` réussissent avec des URL PostgreSQL
  factices; aucune connexion à une base n'a eu lieu. ESLint ciblé est propre et
  `i18n:check` réussit.
- La suite complète donne **2 876 réussis, 2 échecs et 1 ignoré**. Les deux
  échecs sont dans les tests préexistants de seeds PDF C1 et de vouvoiement
  (`lib/pdf-forms/seed/__tests__/apply-c1-improvements-core.test.ts` et
  `voix-vouvoiement.test.ts`), dans des fichiers familiaux déjà modifiés avant
  ce lot. Aucun fichier familial n'a été modifié dans cette intervention.
- Le lint global et le build ont démarré sans diagnostic final, puis leurs
  processus se sont interrompus dans l'environnement. Ils restent à revalider
  dans un runner stable. Les tests de publication utilisent des mocks; aucun
  test d'intégration DB n'a été lancé. Aucun import réel ni déploiement.
- L'invalidation entre instances s'appuie sur `publishedRevision`; le code ne
  doit pas être activé sur la base cible avant application de la migration.

### RioLex et raccordement pilote proposé uniquement

RioLex conserve des références dans `legalMeta.lookupRefs`. La carte
`lib/data/riolex-lookup-refs.json` associe éditorialement codes ONEM et articles;
`scripts/generate-lookup-refs.ts` produit des candidats structurels par numéros
et titres, puis `scripts/attach-lookup-refs.ts` peut les rattacher. Le sens est
article RioLex → entrée/table Lookup, et
`components/reglementation/article-sidebar.tsx` affiche actuellement un
deep-link. Un mapping généré n'est pas une validation juridique. Il reste à
revoir les associations, afficher une définition datée avec sa provenance et
traiter explicitement les codes absents ou ambigus. Aucun mapping n'a été changé.

Premier pilote proposé : dans la sidebar d'un article déjà lié par un
`lookupRef` validé par un relecteur métier, afficher le libellé Lookup à la date
de l'article, la source et la révision, avec un lien vers la table. Valeur :
expliquer un code depuis son contexte légal sans inférer un droit. Fichiers à
examiner : `lib/data/riolex-lookup-refs.json`,
`components/reglementation/article-sidebar.tsx`,
`app/partenaire/reglementation/[riolexId]` et le service existant
`lib/lookup/getLookupEntry.ts`. Acceptation : association revue/sourcée,
date/révision/provenance visibles, absence et ambiguïté explicites, aucun choix
fuzzy automatique et aucun changement au moteur familial/résultat métier.

L'évaluateur familial pur demeure sans appel Lookup; toute explication future
doit rester dans une couche de restitution distincte. Aucun raccordement n'a
été implémenté.

## Reprise ciblée sur le `main` actuel — 25/10/2026

Le correctif a été repris depuis `7f3b18af` sur le `main` vérifié
`10c70ebf289a27365d40caf9d629f00c72162800`, dans le worktree isolé
`codex/lookup-hardening-prod`. Aucun fichier du checkout historique ni aucun
fichier familial/barèmes n'a été repris ou modifié. Une erreur TypeScript de
rendu des erreurs JSON de proposition dans la page admin a été corrigée avec
un test de présence booléen. Le contrôle des routes a aussi révélé quatre
réponses administratives protégées sans directive HTTP explicite et la
recherche publique par nom d'entreprise sans directive de cache; elles portent
maintenant `private, no-store`. La revue indépendante a détecté une limite
globale incorrecte en résolution par lots, une validation d'approbation
renvoyant 500 sur corps invalide, et des erreurs GET protégées sans no-store;
ces trois constats ont aussi été corrigés.
La seconde passe a signalé que Prisma exige `orderBy` avec `groupBy` et `take`;
un ordre explicite par code a été ajouté. La validation réelle de cette requête
reste à faire sur PostgreSQL isolé. La revue a ensuite relevé que la recherche
publique par rue pouvait exposer `lastImportSource`, y compris un nom de fichier
ou chemin interne; l'attribut est désormais omis côté public et inclus dans les
projections administrateur uniquement.

### Validations réellement exécutées dans ce worktree

- Tests Lookup ciblés : **35 réussis** sur 6 fichiers, dont résolution batch
  après de nombreux historiques, corps d'approbation invalide/malformé et
  retrait du nom de source interne dans la réponse publique.
- `pnpm test` seul : **3 370 réussis, 1 ignoré**, 329 fichiers réussis sur 330.
  La première exécution menée en parallèle du lint/build avait dépassé le délai
  d'un test de rate-limit; la relance seule a réussi.
- ESLint Lookup ciblé : succès.
- ESLint ciblé des routes et services touchés : succès.
- `pnpm i18n:check` : succès, avec les avertissements de couverture de langues
  du dépôt.
- L'inventaire Vercel (valeurs non déchiffrées) montre `DATABASE_URL` ciblée
  simultanément sur `preview` et `production`, sans variable de test distincte.
  Le preview n'est donc pas une base isolée identifiée; aucune connexion n'y a
  été tentée.
- `prisma validate` et `prisma generate` : succès avec URL PostgreSQL factices
  pointant vers localhost; aucune connexion n'a été faite.
- L'appel client Prisma `groupBy` ordonné a passé la validation locale du
  client puis échoué à la connexion attendue sur le port fermé; cela ne remplace
  pas l'exécution sur PostgreSQL.
- `pnpm lint` global : échec sur **119 erreurs / 58 warnings**, dispersés dans
  des fichiers hors du périmètre Lookup; la documentation courante signale une
  baseline d'erreurs lint préexistantes. Les fichiers Lookup ciblés passent.
- `pnpm build` : compilation Next réussie; le contrôle TypeScript a révélé puis
  permis de corriger l'erreur ci-dessus. Après correction, le worker de contrôle
  est resté sans sortie et sans processus Node actif; la commande a été
  interrompue, donc le build complet n'est pas attesté. La première build Vercel
  a ensuite révélé un appel de traduction absent dans la ligne de revue des
  imports batch puis un appel à `retryWithError` depuis le mauvais namespace
  dans la vue partenaire; les hooks et namespace ont été corrigés. Une nouvelle
  build a aussi révélé un `findUnique({slug})` invalide car le schéma ne rend
  `slug` unique qu'avec `categoryId`; les résolveurs unitaires et batch utilisent
  maintenant une recherche ordonnée et bornée à deux tables. ESLint ciblé et `i18n:check` réussissent;
  CI doit être relancée sur le nouveau SHA.
  Le schéma autorise des slugs identiques dans des catégories différentes:
  les résolveurs vérifient maintenant jusqu'à deux tables et signalent cette
  collision comme ambiguë au lieu de choisir silencieusement une table. Les
  tests unitaires couvrent les modes unitaire et batch. Sur le SHA final
  `1f934186`, le workflow GitHub CI n° 265 (lint, tests, i18n et build) et le
  contrôle Vercel sont verts. Le premier essai CI a échoué à la résolution du
  module interne `next/font` par Turbopack; la relance du job échoué a réussi.
  La build Vercel du code `8815e57c` reste également `READY`.
- Outils et port PostgreSQL local absents/inactifs (pas de `docker`, `psql`,
  `pg_isready`; ports 5432 et 55432 fermés). Aucun serveur PostgreSQL isolé ou
  environnement navigateur authentifié par rôles n'était disponible. Les tests
  d'intégration transactionnelle réels, la recette des profils dans le
  navigateur et les tests multi-instance ne sont donc pas exécutés.

### Statut de livraison

**Corrigé et testé :** protections et projections Lookup, préparation/import,
unicité des approbateurs, contrôles d'obsolescence, parsing, résolution datée,
tests unitaires et suite Vitest complète. Les batchs comptent les correspondances
par code dans une transaction Repeatable Read, empêchant un code historisé de
masquer les suivants. Les erreurs de corps d'approbation sont des 400. Aucun
raccordement produit ajouté. Les noms de fichiers source internes ne sont plus
exposés par la recherche publique.

**Modifié mais validation incomplète :** migration additive
`60_lookup_import_proposals` et publication transactionnelle. Migration non
appliquée. Aucun import réel, aucune donnée Lookup publiée et aucun déploiement.
La vérification sur PostgreSQL isolé, le build complet, le contrôle CI sur le
SHA final et la recette navigateur restent des prérequis avant publication.

**Proposé uniquement :** pilote éditorial RioLex décrit ci-dessus; aucune
association nouvelle n'a été activée. Le moteur familial n'a pas été touché.
