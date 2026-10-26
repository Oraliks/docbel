# Staging et publication DocBel

Mise à jour du 26/10/2026. Ce guide décrit les flux vérifiés et distingue le code, le schéma et le contenu administré.

## Environnements et protections

- Le projet staging et ses bases et stores Blob sont distincts de la production. Les recettes utilisent des données et comptes fictifs. Les secrets et identifiants de ressources ne sont pas publiés dans ce dépôt.
- L’alias Vercel staging exige SSO Vercel et Basic Auth applicatif. Le domaine personnalisé `staging.docbel.be` dispose de DNS et TLS valides et exige Basic Auth applicatif; la protection SSO Vercel ne couvre pas les domaines personnalisés. Les réponses observées sont privées, sans indexation et sans cache partagé. Les cookies d’authentification restent Secure et limités à l’hôte.
- La création et la sauvegarde de dossiers fictifs dans l’interface exigent les deux variables publiques d’opt-in de staging. Les écritures API exigent séparément le drapeau serveur staging et les gardes d’authentification/propriété. La fermeture globale reste active en production; les inscriptions, profils, rendez-vous, emails et tâches planifiées ne sont pas rouverts.
- Les identifiants de fournisseurs d’email, d’IA, d’IMAP, de paiement et de tâches planifiées ne sont pas configurés dans le projet staging. Les contrôles anonymes des routes sensibles ont répondu fermé, sans appel fournisseur. Les tests de recette n’utilisent pas de destinataire réel.
- Les futures variables de production et la connexion Neon gérée sont limitées à l’environnement Production. Les variables gérées de Neon portent un préfixe dédié; les deux variables Prisma de connexion restent manuelles et doivent être vérifiées et renouvelées explicitement lors d’une rotation.
- Les règles GitHub imposent une PR vers `main`, un contrôle CI vert et interdisent force-push et suppression de `main`. Le projet Vercel de production ne construit que la branche de production. La validation humaine du SHA de déploiement reste une étape de procédure: le dépôt ne requiert pas d’approbation GitHub indépendante (mainteneur unique). Les restrictions d’environnement s’appliquent aux futurs déploiements; d’anciens aperçus immuables restent protégés par SSO et ne sont ni supprimés ni réécrits par cette procédure.

## Versions et recette staging

Chaque lot staging est vérifié sur le SHA déployé exact. La recette UI doit exercer le vrai parcours de création, le code de reprise, l’autosauvegarde, la reprise et le téléchargement PDF, avec des données fictives. Le résultat, le SHA, les commandes et les captures expurgées sont consignés dans un reçu de recette séparé; ce guide décrit la procédure durable.

Le correctif Lookup normalise les dates en UTC avant l’écriture dans les colonnes `timestamp without time zone`. Les tests PostgreSQL réels couvrent UTC, Europe/Paris et America/Los_Angeles, les valeurs nulles, le retry et la préservation des entrées omises d’un export.

La preuve interbases fictive a réussi sur une cible PostgreSQL locale jetable: diff de deux modifications et une omission, empreinte inchangée avant publication, rejet d’une proposition altérée sans écriture, deux approbations distinctes, publication ciblée et préservation de la ligne omise. Cette preuve couvre ce parcours Lookup précis; elle ne démontre pas une synchronisation générale de toutes les données entre environnements.

Les essais API staging couvrent la création du dossier, l’autosauvegarde rattachée au run, la reprise par code, la restauration SSR du brouillon, la génération PDF fictive et les accès Blob (upload, téléchargement privé authentifié, refus anonyme et suppression). L’isolement entre utilisateurs et les refus des routes sensibles ont été contrôlés. Compléter les contrôles API par un parcours navigateur sur le SHA staging courant; consigner le résultat dans le reçu de recette séparé.

## Publication du code, du schéma et du contenu

Une fusion Git ne publie pas les données éditées dans l’administration. Les flux restent distincts:

1. **Code**: PR ciblée vers `staging`, revue, CI complète verte sur le SHA exact, fusion puis vérification du déploiement staging sur ce SHA. Toute publication en production demande une PR distincte vers `main` et une autorisation du propriétaire sur le SHA; ce contrôle humain est documenté et n’est pas un verrou technique indépendant.
2. **Schéma**: migrations additives et versionnées. Les commandes `db:push` et `db:setup` refusent les bases partagées et n’acceptent que la fixture locale jetable explicitement reconnue. Ne jamais lancer `prisma db push`, `db:setup` ou reset sur une base Neon, Vercel, staging ou production. Vérifier extensions, objets hors Prisma et migrations couvertes avant toute opération.
3. **Contenu métier**: utiliser l’import CSV Lookup existant. Conserver la proposition et son empreinte, examiner le diff, y compris les entrées absentes de l’export, exiger les approbations distinctes et valider la résolution à date. Répéter sur une cible non productive avant toute publication de contenu en production.

### Préparation du workflow d’import Lookup en production

Le lot Lookup de staging ajoute la migration `60_lookup_import_proposals`. Le nouveau code lit `LookupTable.publishedRevision` et les tables de propositions dès l’exécution; déployer le code avant le schéma peut rendre les recherches Lookup indisponibles et casser les écrans d’administration concernés. La procédure est donc strictement ordonnée et n’est pas une migration automatique au build :

1. Obtenir une autorisation distincte pour la migration de production et le déploiement du SHA exact. Cette PR ne donne pas cette autorisation.
2. Vérifier l’identité de la base cible, sauvegarde restaurable, état des extensions/objets hors Prisma, schéma Lookup réel et historique complet. Exécuter `prisma migrate status` et faire examiner `_prisma_migrations`; si l’historique manque, comporte un échec non résolu ou ne correspond pas au dépôt, arrêter et établir un plan de réconciliation avant toute écriture.
3. Exécuter le `preflight.sql` en lecture seule sur la cible. Il n’accepte que les tables Lookup de base présentes, tous les objets de migration 60 absents et aucun enregistrement actif d’application de cette migration. Tout état partiel, déjà appliqué ou inconnu impose l’arrêt; ne pas réparer par `IF NOT EXISTS`, `db push` ou reset.
4. Après validation du préflight et de l’historique, appliquer **uniquement** le fichier versionné `migration.sql` comme transaction SQL additive, en dehors du build (par exemple avec `psql --single-transaction`). Ne jamais modifier ce fichier après application : son checksum fait partie de l’historique Prisma. Vérifier ensuite la colonne, les deux tables, contraintes/index; puis, seulement si l’historique a été validé et l’application est complète, enregistrer la migration avec `prisma migrate resolve --applied 60_lookup_import_proposals` et confirmer `prisma migrate status`. Si `resolve` échoue ou si le statut reste incohérent, arrêter les déploiements, conserver les objets additifs et réconcilier manuellement l’historique; ne jamais réappliquer ni supprimer les objets pour forcer le ledger.
5. Seulement après ces vérifications et l’autorisation du propriétaire sur le SHA, fusionner/déployer le code. Vérifier santé, recherche et administration Lookup. Aucun CSV, contenu administré, brouillon, dossier ou fichier n’est copié par la migration ni par Git.

Le retour arrière applicatif consiste à revenir au SHA précédent tout en conservant les objets SQL additifs. Ne pas exécuter de migration descendante, `DROP`, reset ou suppression de données : des propositions et approbations créées après la migration pourraient en dépendre. En cas d’incertitude, arrêter et réconcilier avant toute action. Aucun préflight ni migration de production n’a été exécuté dans le cadre de cette préparation.

### Validation propriétaire

Ouvrir `https://staging.docbel.be`, vérifier la version affichée et signaler l’URL, les étapes suivies et une capture contenant uniquement des données fictives. Avant toute publication, le propriétaire valide le SHA du code et les CSV de contenu sélectionnés. Une fusion autorisée vers `main` déclenche le déploiement Vercel de production; elle ne transfère automatiquement ni contenu administré, ni dossiers, fichiers ou secrets. Si le lot ou `main` change après validation, refaire les vérifications et renouveler l’accord. Un correctif fait sur `main` doit ensuite être réintégré à `staging`.

Aucun synchroniseur général ni export global staging→production n’est prévu. Les dépendances de contenu entre bases restent propres à chaque lot; une recette Lookup ne prouve pas la publication universelle des contenus.

## Retour arrière et limites

Le rollback staging a été exercé: le code a été temporairement ramené au SHA staging antérieur puis restauré. Après rechargement, les données de recette vérifiées (versions Lookup, brouillon de dossier et métadonnées PDF) étaient toujours disponibles. Aucun reset de base ni restauration de données de production n’a été effectué. Avant un nouveau rollback, vérifier que migrations et écritures récentes restent compatibles avec le SHA visé.

La nouvelle base Neon de production est utilisée par le site; l’ancienne base et le compte Neon direct restent conservés. Un retour vers l’ancienne base après de nouvelles écritures nécessite une réconciliation des données; ce n’est pas un simple changement d’URL. La fermeture du compte ou la suppression de l’ancienne base demande une décision distincte.

Le plan gratuit peut approcher sa limite d’heures de calcul. Surveiller l’usage et arrêter avant toute opération facturable non couverte. Aucun achat, changement de plan ou frais additionnel n’est autorisé par ce guide.

## État à cette mise à jour

| Élément | État |
| --- | --- |
| Migration de production | Runtime et santé vérifiés sur la nouvelle ressource Neon gérée par Vercel; ancienne base intacte. |
| Protections de production | Connexion Neon et variables futures limitées à Production; builds de production ciblés; règles `main` relues. Les anciens aperçus immuables restent protégés par SSO. |
| Domaine staging | `staging.docbel.be` rattaché au projet staging, DNS et TLS valides; contrôles Basic Auth et santé API réussis. |
| Recette API et interbases | Parcours Lookup, brouillon/reprise SSR, PDF, Blob et une simulation interbases fictive vérifiés. |
| Recette UI dossier | Vérifier chaque SHA staging selon le parcours décrit ci-dessus; consigner le résultat dans le reçu de recette séparé. |
| Rollback staging | Exercé sur le code; données fictives vérifiées après retour et restauration du déploiement courant. |
| Coût | Aucun achat ou changement de plan; suivre la marge du plan gratuit avant de poursuivre les essais. |
