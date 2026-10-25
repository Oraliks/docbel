# Staging et publication DocBel

État de préparation au 25/10/2026. Ce guide est la documentation active unique du flux staging. Les sections « constaté » décrivent les ressources réellement vérifiées; les réglages « à appliquer » ne sont pas présentés comme déjà actifs.

## Version de départ et Lookup

- Base choisie pour le staging : `main` / `4ff84786b47d7da6fc6315c1b8aebdb76de68918`, commit de production vérifié dans Vercel.
- PR #96 Lookup : le SHA `621c832eb8c2057523f8578664f0ebe7011b5a3e` est remplacé par `72d4a16477da9a32fb2624bc8c19129a1b13c2b7`. La CI générale (run `40229483469`), Lookup PostgreSQL/navigateur (run `40229483450`) et isolation Barèmes (run `40229483478`) sont vertes pour ce SHA et le résultat de fusion simulé avec `main` `4ff84786`; revue indépendante sans défaut matériel. Le candidat combiné local intègre ce SHA exact. Un correctif local de reprise après erreur est en cours de vérification et n'est pas inclus dans la PR.
- Ancien candidat combiné local gelé : branche `codex/staging-lookup-candidate`, merge commit `239cd533` (PR #96 ancien SHA `621c832` + préparation staging basée sur `main` `4ff84786`). Fusion sans conflit, suite locale 3 435 réussis/2 ignorés et revue indépendante sans défaut confirmé à ce moment-là. Ce candidat est dépassé par `72d4a164` et ne doit pas être publié. Nouveau candidat `codex/staging-lookup-candidate-72d4`, merge commit `ee22a6a7`, intègre le SHA exact, passe 3 436 tests/2 ignorés après le correctif local de reprise (revue indépendante sans finding). Aucun staging distant n'a été déployé. Toute publication du lot exact reste soumise à l'autorisation humaine du propriétaire; aucune publication ni migration Lookup en production n'est autorisée par ce guide.

## Matrice des ressources constatées

| Ressource | Production constatée | Cible staging | Isolation attendue | État constaté |
| --- | --- | --- | --- | --- |
| Git | `main`, déploiement `READY` sur `4ff84786` | branche permanente `staging` | même dépôt, lots de fonctionnalité distincts | branche locale `staging` préparée sur le candidat; aucun push; branche distante et protection non vérifiées/créées |
| Vercel | équipe Docbel `team_QGE3ZmKTdwjFIVFmoO7W1u7f`, projet `docbel` `prj_6r3N3jyVPYTJjKTHcyTkgtfTgqcf`; `docbel.be` vérifié | projet `docbel-staging`, `staging.docbel.be` | projet, accès, variables et déploiements distincts | projet vide créé par CLI : `prj_C4kaNyfq7cZlzYecYvcUeapNdJTk`; aucun dépôt, domaine ni déploiement. Le connecteur API renvoie 404 pour ce projet nouvellement créé; CLI vérifie son existence. |
| Déploiements Preview | Preview partage des variables sensibles avec Production, dont `DATABASE_URL`, `DIRECT_URL`, auth, clés fournisseurs et Blob public | aucun secret de production | aperçus désactivés ou secrets Preview séparés et non productifs | risques existants confirmés sur `docbel`; Preview désactivé sur le projet staging, qui n'a aucun lien Git. Aucun changement Production/Preview appliqué. |
| Neon/PostgreSQL | connexions Vercel nommées, destinations vérifiées dans la console Neon | nouveau projet Neon et nouvelle base staging | projet distinct; URL poolée et directe même base; droits limités | console de l'organisation `Docbel` ouverte; seul le projet Production existe. Aucun projet staging créé car l'accord de dépense est refusé/en attente. |
| Stockage Blob | le store public existant est partagé Preview/Production | stores staging publics/privés dédiés | stores, jetons et droits différents des deux stores Production | deux stores vides créés en `fra1`, raccordés uniquement à `docbel-staging` / Production : public `store_7Q1bS0VUQaoDlb72`, privé `store_cXidGiuq49bznyXt`. Aucun objet, téléchargement ni test. La création compte comme opération avancée facturable; plan/crédit du team non vérifié, donc pas d'autre opération Blob avant vérification. Aucun store Production modifié. |
| Auth/cookies | Better Auth, base URL et origins configurés par variables; cookies ne fixent pas de domaine parent | URL, secrets, compte admin et membres fictifs propres au staging | hôte staging, secrets distincts, aucun cookie `.docbel.be` | séparation distante non configurée |
| Emails, IMAP, IA, paiements | Resend, IMAP OVH, clés IA et Stripe existent dans les variables Production/Preview | désactivés ou compte sandbox explicitement distinct | aucun secret fournisseur Production en staging | non neutralisés à distance; crons bloqués par le code staging |
| Crons | 12 horaires déclarés dans `vercel.json` | désactivés en staging | aucune purge, sync, ingestion ou notification réelle | le proxy staging renvoie `503`; la configuration Vercel dédiée n'existe pas encore |
| Accès/indexation | protections Vercel SSO observées sur le projet existant; domaines personnalisés publics | SSO des alias `*.vercel.app`, Basic Auth appliqué par le code à tous les chemins et `noindex` | contrôle d'accès avant branche/déploiement | protection SSO des alias activée sur le projet staging; Preview désactivé; secrets Basic Auth absents; aucun domaine ou déploiement. |

Les valeurs des secrets n'ont pas été lues ni copiées. Les lignes Vercel décrivent seulement les noms, cibles et identités non secrètes retournées par l'API.

## Préparation locale implémentée

- `APP_ENV` est centralisé et ses valeurs inconnues sont rejetées. La branche Vercel `staging` ne répond pas si `APP_ENV=staging` manque ou si des identifiants Basic Auth valides (mot de passe d'au moins 24 caractères) ne sont pas configurés.
- Toutes les pages, l'administration, les API et les alias de déploiement passent par l'accès Basic Auth; les réponses staging portent `X-Robots-Tag: noindex` et `private, no-store`.
- Les routes cron staging répondent `503` au lieu d'afficher un faux succès. Les quatre identités Blob et les identités de cible DB sont exigées et comparées avant une opération staging.
- La bannière « ENVIRONNEMENT DE TEST — Données fictives — Version [commit] » apparaît dans le shell racine, donc aussi dans l'administration. La métadonnée racine désactive l'indexation en staging.
- CI reçoit `APP_ENV=ci`; `.env.example` indique `APP_ENV=development`.

Ces contrôles applicatifs ne prouvent pas seuls l'isolation distante. Les identifiants attendus doivent être comparés aux métadonnées du projet Neon et aux `storeId` des tokens Blob dans leurs consoles/API, sans afficher les tokens.

## Mise en place distante avant le premier build

1. Le projet `docbel-staging` est déjà créé par CLI sans build, dépôt lié ni domaine. Conserver ce projet distinct; aucun accès Vercel additionnel n'est requis pour son propriétaire actuel.
2. Créer un projet Neon distinct et un rôle limité au staging. Vérifier l'ID projet, les deux URLs, la base, les rôles, les extensions, les index/colonnes hors Prisma et `_prisma_migrations`. Comparer explicitement les identités à la production, sans lire ni publier les valeurs d'URL.
3. Les stores Blob staging publics et privés sont déjà créés et liés uniquement au projet `docbel-staging` : public `store_7Q1bS0VUQaoDlb72` / variable `BLOB_READ_WRITE_TOKEN`; privé `store_cXidGiuq49bznyXt` / `BLOB_PRIVATE_READ_WRITE_TOKEN`. Stores vides, sans upload. Vérifier le quota/prix et les variables avant tout usage ou déploiement.
4. Dans l'environnement Vercel `Production` du projet staging, configurer `APP_ENV=staging`, Basic Auth, les deux URLs DB, `APP_DATABASE_TARGET`, `APP_PRODUCTION_DATABASE_TARGET`, les quatre identités Blob, les secrets Better Auth et les URLs `https://staging.docbel.be`. Les autres environnements du projet restent sans secrets ou utilisent uniquement des doublures.
5. Configurer l'accès de déploiement Vercel avant le raccordement Git. Vérifier l'accès au déploiement permanent et à ses domaines `*.vercel.app`; garder les crons inactifs.
6. Seulement après vérification des variables et des ressources, connecter le dépôt `Oraliks/docbel`, choisir `staging` comme branche de production du projet staging et ajouter `staging.docbel.be`. Confirmer équipe, projet, branche et SHA avant toute opération.
7. Vérifier sans secrets que les tokens Blob ont les `storeId` staging attendus, que les deux URLs DB ciblent le même environnement logique Neon, et que le projet Neon est distinct de Production. Puis seulement lancer le premier build.

L'API Vercel connectée n'a pas reconnu immédiatement le projet créé par CLI (404), mais `vercel project inspect` le confirme sous l'équipe Owner `Docbel`. Le projet staging n'a aucun lien Git, domaine ou déploiement (liste CLI : 0). Preview est désactivé sur ce projet et SSO protège ses alias `*.vercel.app` (`all_except_custom_domains`). `APP_ENV=staging` et les 4 identités Blob non secrètes sont configurés en Production du seul projet staging; les jetons Blob y sont liés uniquement à cette portée. Preview et Development ne contiennent aucune variable. Basic Auth applicatif et secrets Better Auth restent à configurer. La session Neon confirme l'organisation `Docbel` avec un seul projet existant; aucun projet staging n'a été créé, en attente de l'accord de dépense.

## Garde de coût Neon

- La console de l'organisation indique le plan Launch. Il n'existe pas de plan gratuit par projet dans cette organisation : « Free » est une option de changement du plan de l'organisation, qui s'appliquerait aussi au projet Neon existant; elle n'a donc pas été sélectionnée.
- Tarifs affichés dans cette console : Postgres à `$0.106/CU-hr`, stockage à `$0.35/GB-month`, restauration instantanée à `$0.20/GB-month`. Le compute peut être réglé dès `0.25 CU` et suspendu après 5 minutes d'inactivité. À 0.25 CU, cela représente `$0.0265` par heure active et environ `$19.35` pour 30 jours continus; 1 GB stocké pendant un mois ajoute `$0.35`, hors restauration.
- Le seuil affiché est une alerte de dépense de l'organisation, pas un arrêt automatique. Aucun plafond dur de coût/stockage par projet n'a été trouvé. La création et le test d'une base Launch sont donc en attente d'un accord de dépense explicite; ne pas changer le plan de l'organisation, créer la base, l'activer, la remplir ou lancer une recette avant cet accord.
- Sources : [tarifs Neon affichés dans la console](https://neon.com/pricing), [tailles/autoscaling des computes Neon](https://neon.com/docs/manage/endpoints/), [suspension des projets au seuil de dépense](https://neon.com/blog/introducing-organization-spending-limits) (l'article indique que l'option de suspension automatique est annoncée comme « coming soon »).

## Garde de coût Vercel Blob

- Les stores Blob n'ont pas de frais fixes documentés; la consommation est facturée par stockage, opérations et transfert. Le changelog Vercel du 23/09/2026 indique que la création d'un store compte désormais comme une opération avancée. Le tarif Pro publié hors quota est `$5 / 1 000 000` opérations; les quotas inclus dépendent du plan, qui n'a pas été confirmé.
- Deux stores staging ont été créés, sans données ni accès de test. Au tarif Pro hors quota, 2 opérations équivalent à `$0.00001`. La période de facturation consultée remontait `$0` facturé pour les opérations avancées Blob, mais sa fenêtre ne permet pas d'attribuer les créations; leur inclusion dans le quota reste donc à vérifier. Aucun autre listing du contenu, upload, téléchargement, test ou store ne sera effectué avant vérification du quota/coût.
- Sources : [tarifs Blob par plan](https://vercel.com/docs/vercel-blob/usage-and-pricing), [création d'un store comptée comme opération avancée](https://vercel.com/changelog/unlimited-vercel-blob-stores-on-every-plan).

## DB, seeds et contenus

- Ne jamais employer `prisma db push`, `db:setup` ou un reset sur Neon. L'historique existant contient des SQL manuels, des objets hors Prisma et des migrations anciennes destructives; `prisma migrate deploy` ne doit pas être lancé avant réconciliation documentée de l'historique réel.
- Avant un premier déploiement de schéma, comparer le schéma Prisma, les dossiers de migrations, les migrations SQL manuelles, extensions, index et objets hors Prisma à une base staging vide. Établir une seule voie versionnée et additive; tester la création sur une troisième base jetable distincte du staging permanent. Aucune migration ne s'exécute pendant install/build.
- Seeds reproductibles : données de comptes et dossiers explicitement fictifs, référentiels publics versionnés seulement après vérification. Aucun compte, dossier, email, NISS, IBAN, conversation ou fichier personnel n'est copié depuis Production.
- Code, structure DB et contenus métier sont trois lots séparés. Une fusion Git ne transfère pas un changement fait dans l'admin staging.
- Avant toute publication de contenu, produire un manifeste ciblé : domaine, IDs métier stables, version/empreinte, dépendances, empreintes des fichiers, version de code compatible, différences et conflits. L'aperçu/dry-run ne doit effectuer aucune écriture. L'application en Production exigera une autorisation humaine de l'empreinte exacte.
- Pour Lookup, garder séparés code, migration et contenu ONEM. Une démonstration staging devra utiliser deux bases non productives et vérifier avant/après la publication ciblée. Le contenu propriétaire modifié dans l'admin staging ne passe jamais avec le code seul.
- Pas de synchroniseur général : les autres CMS, arbres, formulaires, barèmes et fichiers demandent une procédure propre à chaque domaine.

## Flux de validation et réglages à faire approuver

Flux cible : branche de fonctionnalité → PR vers `staging` → CI verte et déploiement du seul SHA sur staging → recette → approbation humaine de ce SHA et des empreintes de contenu/migration → PR `staging` vers `main` → contrôles requis → déploiement Git Vercel de `main`, seul chemin de production.

Avant de pousser une branche ou d'activer les builds, le propriétaire doit choisir et approuver une protection Preview sur le projet de production, qui partage aujourd'hui secrets et DB avec Preview. Option recommandée : désactiver les déploiements Preview de ce projet; sinon, retirer les portées Preview des secrets/connexions Production et les remplacer par des valeurs/test stores dédiés. Les protections ne doivent pas modifier la cible Production. Retour arrière : restaurer les valeurs et portées précédentes après vérification, sans changement de valeur Production.

Le propriétaire doit aussi approuver l'application des règles suivantes, car elles modifient le fonctionnement du déploiement Production : protéger `main`, PR obligatoire, au moins une revue humaine, checks CI requis (`test`, lint sans nouvelle erreur, `i18n`, build), résolution des conversations et historique non réécrit. La validation est liée au SHA du PR et au manifeste de contenu; toute modification exige nouvelle recette/revue. Les contournements administrateur et CLI doivent être limités et documentés. Garder Vercel Git comme unique publication automatique; ne pas ajouter de second pipeline `--prod`.

Avant toute fusion future de cette livraison vers `main`, ajouter `APP_ENV=production` aux variables Production après approbation et vérifier un déploiement de santé non destructif. Le runtime Production actuel n'a pas cette variable; elle n'a pas été ajoutée dans cette préparation.

Une approbation GitHub ne peut être déclarée effective qu'après vérification du plan, des protections disponibles et du nombre réel de mainteneurs. Ces informations n'ont pas été accessibles ici.

## Recette, version et retour arrière

Sur staging seulement, la recette minimale attend : connexion fictive, accès admin, Lookup (après revue/lot précis), dossier fictif sauvegardé puis repris, document généré, upload puis suppression d'un fichier de test, alias Vercel protégé, refus sans Basic Auth, bandeau et `noindex`. Tester aussi les refus de DB/Blob incohérents, l'absence des secrets fournisseurs, les crons en `503`, les publications de contenu modifié et les resets hors base jetable.

Pour rollback, redéployer le SHA staging précédent connu et vérifier la santé. Les migrations doivent rester compatibles avec la version précédente; si elles ne le sont pas, préparer une migration corrective. Ne pas restaurer toute la DB comme opération ordinaire et ne jamais copier staging vers Production. Pour un hotfix, partir de `main`, le vérifier en production selon le chemin autorisé, puis le réintégrer dans `staging` et refaire la recette.

## Statut de cette préparation

| État | Détail |
| --- | --- |
| Implémenté localement | identité APP_ENV, gate Basic Auth staging, bandeau/i18n/noindex, cron staging refusé, vérifications de cible DB/Blob |
| Vérifié localement | Socle seul (`codex/staging-foundation`) : 3 408 réussis/2 ignorés; candidat Lookup antérieur : 3 435 réussis/2 ignorés. Nouveau candidat `ee22a6a7` + correctif local : 3 436 réussis/2 ignorés, revue indépendante sans finding, `git diff --check` et i18n passent. Contrôle TypeScript complet : 22 diagnostics ailleurs dans le dépôt, aucun dans les fichiers staging. Build local non validé : `@parcel/watcher` manquant après installation interrompue/verrouillée (`EPERM` sur `next-swc`); build CI de la PR Lookup est vert. |
| Configuré à distance | projet Vercel staging vide; Preview désactivé; SSO sur alias `vercel.app`; deux stores Blob vides liés uniquement au projet; `APP_ENV=staging` et 4 identités Blob en variables Production du staging. Aucun Neon, domaine, dépôt lié, build ni déploiement staging |
| Testé sur staging | non, aucun staging accessible |
| Bloqué | accord sur les frais d'usage Neon (plan Launch sans plafond dur; Free implique un changement de plan au niveau de l'organisation), puis création/accès à un projet DB isolé; variables DB et secrets staging; confirmation du quota Blob avant tout usage; secrets Basic Auth/Better Auth et domaine staging avant build; autorisation humaine du lot exact avant sa publication |
