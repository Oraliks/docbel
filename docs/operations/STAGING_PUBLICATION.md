# Staging et publication DocBel

État de préparation au 25/10/2026. Ce guide est la documentation active unique du flux staging. Les sections « constaté » décrivent les ressources réellement vérifiées; les réglages « à appliquer » ne sont pas présentés comme déjà actifs.

## Version de départ et Lookup

- Base choisie pour le staging : `main` / `4ff84786b47d7da6fc6315c1b8aebdb76de68918`, commit de production vérifié dans Vercel.
- PR #96 Lookup : développement techniquement terminé sur `621c832eb8c2057523f8578664f0ebe7011b5a3e`; CI générale, PostgreSQL isolé et recette navigateur réussis. Le PR est encore brouillon et sans revue humaine. Il n'est pas intégré à ce lot staging.
- Toute recette Lookup sur staging devra être un lot identifié. Après revue humaine, intégrer le commit dans `staging`, vérifier le résultat combiné avec `main`, puis vérifier à nouveau les contrôles et le SHA. Aucune publication ni migration de Lookup en production n'est autorisée par ce guide.

## Matrice des ressources constatées

| Ressource | Production constatée | Cible staging | Isolation attendue | État constaté |
| --- | --- | --- | --- | --- |
| Git | `main`, déploiement `READY` sur `4ff84786` | branche permanente `staging` | même dépôt, lots de fonctionnalité distincts | branche staging et protection non vérifiées/créées à distance |
| Vercel | équipe Docbel `team_QGE3ZmKTdwjFIVFmoO7W1u7f`, projet `docbel` `prj_6r3N3jyVPYTJjKTHcyTkgtfTgqcf`; `docbel.be` vérifié | projet `docbel-staging`, `staging.docbel.be` | projet, accès, variables et déploiements distincts | un seul projet existe; création staging refusée `403` faute de permission |
| Déploiements Preview | Preview partage des variables sensibles avec Production, dont `DATABASE_URL`, `DIRECT_URL`, auth, clés fournisseurs et Blob public | aucun secret de production | aperçus désactivés ou secrets Preview séparés et non productifs | risque confirmé; aucun changement Production/Preview appliqué |
| Neon/PostgreSQL | connexions Vercel nommées, destinations non vérifiées par Neon | nouveau projet Neon et nouvelle base staging | projet distinct; URL poolée et directe même base; droits limités | aucun connecteur Neon disponible dans cette session; projet, historique, extensions et objets réels non vérifiés |
| Stockage Blob | identifiants de stores et portées Vercel visibles; le store public est partagé Preview/Production | stores staging publics/privés dédiés | stores, jetons et droits différents des deux stores Production | stores staging non créés; aucun jeton de production repris |
| Auth/cookies | Better Auth, base URL et origins configurés par variables; cookies ne fixent pas de domaine parent | URL, secrets, compte admin et membres fictifs propres au staging | hôte staging, secrets distincts, aucun cookie `.docbel.be` | séparation distante non configurée |
| Emails, IMAP, IA, paiements | Resend, IMAP OVH, clés IA et Stripe existent dans les variables Production/Preview | désactivés ou compte sandbox explicitement distinct | aucun secret fournisseur Production en staging | non neutralisés à distance; crons bloqués par le code staging |
| Crons | 12 horaires déclarés dans `vercel.json` | désactivés en staging | aucune purge, sync, ingestion ou notification réelle | le proxy staging renvoie `503`; la configuration Vercel dédiée n'existe pas encore |
| Accès/indexation | protections Vercel SSO observées sur le projet existant; domaines personnalisés publics | accès Basic Auth au niveau application sur tous les chemins, bandeau et `noindex` | protection valable aussi sur les alias Vercel | code local préparé; déploiement non configuré |

Les valeurs des secrets n'ont pas été lues ni copiées. Les lignes Vercel décrivent seulement les noms, cibles et identités non secrètes retournées par l'API.

## Préparation locale implémentée

- `APP_ENV` est centralisé et ses valeurs inconnues sont rejetées. La branche Vercel `staging` ne répond pas si `APP_ENV=staging` manque ou si des identifiants Basic Auth valides (mot de passe d'au moins 24 caractères) ne sont pas configurés.
- Toutes les pages, l'administration, les API et les alias de déploiement passent par l'accès Basic Auth; les réponses staging portent `X-Robots-Tag: noindex` et `private, no-store`.
- Les routes cron staging répondent `503` au lieu d'afficher un faux succès. Les quatre identités Blob et les identités de cible DB sont exigées et comparées avant une opération staging.
- La bannière « ENVIRONNEMENT DE TEST — Données fictives — Version [commit] » apparaît dans le shell racine, donc aussi dans l'administration. La métadonnée racine désactive l'indexation en staging.
- CI reçoit `APP_ENV=ci`; `.env.example` indique `APP_ENV=development`.

Ces contrôles applicatifs ne prouvent pas seuls l'isolation distante. Les identifiants attendus doivent être comparés aux métadonnées du projet Neon et aux `storeId` des tokens Blob dans leurs consoles/API, sans afficher les tokens.

## Mise en place distante avant le premier build

1. Dans l'équipe Vercel Docbel, créer `docbel-staging` sans lancer de build ni reprendre la connexion Git de `docbel`.
2. Créer un projet Neon distinct et un rôle limité au staging. Vérifier l'ID projet, les deux URLs, la base, les rôles, les extensions, les index/colonnes hors Prisma et `_prisma_migrations`. Comparer explicitement les identités à la production, sans lire ni publier les valeurs d'URL.
3. Créer des stores Blob staging publics et privés distincts. Raccorder leurs jetons uniquement au projet staging et noter leurs `storeId` non secrets.
4. Dans l'environnement Vercel `Production` du projet staging, configurer `APP_ENV=staging`, Basic Auth, les deux URLs DB, `APP_DATABASE_TARGET`, `APP_PRODUCTION_DATABASE_TARGET`, les quatre identités Blob, les secrets Better Auth et les URLs `https://staging.docbel.be`. Les autres environnements du projet restent sans secrets ou utilisent uniquement des doublures.
5. Configurer l'accès de déploiement Vercel avant le raccordement Git. Vérifier l'accès au déploiement permanent et à ses domaines `*.vercel.app`; garder les crons inactifs.
6. Seulement après vérification des variables et des ressources, connecter le dépôt `Oraliks/docbel`, choisir `staging` comme branche de production du projet staging et ajouter `staging.docbel.be`. Confirmer équipe, projet, branche et SHA avant toute opération.
7. Vérifier sans secrets que les tokens Blob ont les `storeId` staging attendus, que les deux URLs DB ciblent le même environnement logique Neon, et que le projet Neon est distinct de Production. Puis seulement lancer le premier build.

Le connecteur Neon et le droit Vercel de créer/configurer le projet n'étaient pas disponibles pendant cette préparation. Aucune ressource staging distante ni aucun domaine staging ne sont donc annoncés comme créés.

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
| Vérifié localement | Suite Vitest complète : 3 408 tests passent, 2 ignorés. Les tests ciblés staging et `pnpm i18n:check` passent avec les avertissements historiques de couverture. ESLint ciblé passe. Le build a échoué avant compilation applicative car `@parcel/watcher` est indisponible après une installation locale interrompue/verrouillée (`EPERM` sur `next-swc`). |
| Configuré à distance | aucun projet Vercel, Neon, Blob ou domaine staging; la création du projet Vercel a été refusée (403) |
| Testé sur staging | non, aucun staging accessible |
| Bloqué | droit de création Vercel; accès Neon; stores Blob et variables staging; choix/approbation des protections Preview Production; revue humaine PR #96 |
