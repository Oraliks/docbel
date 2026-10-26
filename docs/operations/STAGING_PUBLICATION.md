# Staging et publication DocBel

État vérifié le 26/10/2026. Ce document décrit le flux actif et distingue le code, les schémas de données et le contenu métier.

## Ressources et accès

- Le projet de staging est distinct du projet de production et dispose de sa propre base Neon, de ses propres stores Blob, de ses propres secrets d’authentification et d’un compte admin fictif. Les valeurs de connexion et les identifiants ne sont pas publiés ici.
- L’alias Vercel de staging exige SSO et le Basic Auth applicatif. Les réponses staging portent noindex et no-store; les routes de cron, d’IMAP et d’ingestion restent bloquées.
- staging.docbel.be est rattaché au projet staging, mais le DNS externe ne le résout pas encore. L’enregistrement CNAME communiqué au propriétaire doit être publié chez le DNS autoritaire avant les essais sur ce nom. Better Auth doit alors utiliser cette origine de façon explicite et les cookies doivent rester limités à l’hôte. Le Basic Auth applicatif doit être vérifié sur le domaine personnalisé, car la protection SSO Vercel ne couvre pas les domaines personnalisés.
- Le projet de production ne construit que la branche de production. Le dépôt exige une PR vers main, le contrôle CI test et interdit force-push et suppression de main. La connexion Neon Native de production est limitée à l’environnement Production. Son préfixe de variables gérées est DOCBEL_NEON_NATIVE; les variables Prisma principales restent manuelles et Production-only. Lors d’une rotation Neon, vérifier et renouveler explicitement ces deux connexions manuelles avant un déploiement.
- La base de production est maintenant servie par une nouvelle ressource Neon gérée par Vercel. L’ancienne base et le compte Neon direct sont conservés pour retour arrière; aucune fermeture ni suppression n’est incluse dans cette livraison. Le retour arrière applicatif vers l’ancienne base après de nouvelles écritures exige une réconciliation des données, pas un simple changement d’URL.

## Garde staging et version

L’activation de l’écriture de test exige simultanément l’environnement staging, le projet et la branche staging, un Basic Auth valide, une base et des stores dédiés, ainsi que le drapeau serveur STAGING_TEST_PERSISTENCE=1. Le flux UI de dossier/PDF staging nécessite aussi NEXT_PUBLIC_APP_ENV=staging et NEXT_PUBLIC_STAGING_TEST_PERSISTENCE=1. Ces variables sont configurées uniquement sur le projet staging. Elles ne désactivent pas la fermeture des inscriptions, profils, prises de rendez-vous, emails ou tâches planifiées en production.

La branche de fonctionnalité codex/lookup-postgres-utc-staging et la PR #97 vers staging corrigent la mise à jour des dates Lookup et ouvrent, sous ces garde-fous, l’enregistrement et la reprise de dossiers fictifs. Les changements client sérialisent les sauvegardes et suppressions concurrentes. Le contrôle CI est requis avant fusion vers staging; le SHA déployé doit ensuite être vérifié dans Vercel avant la recette. Cette PR ne vise pas main et ne publie aucun contenu de production.

## Publication de code, structure et contenu

Une fusion Git ne publie pas les données éditées dans l’administration. Les lots sont distincts :

1. **Code** : PR vers staging, CI verte, revue, puis vérification du déploiement staging au SHA exact. Une publication en production requiert une PR distincte vers main et une autorisation du propriétaire sur le SHA.
2. **Schéma** : migrations additives et versionnées. Ne jamais utiliser prisma db push, db:setup ou reset sur une base partagée. Vérifier les extensions, objets hors Prisma et migrations couvertes avant toute opération.
3. **Contenu métier** : utiliser l’import CSV Lookup existant. Conserver la proposition et son empreinte, examiner le diff (y compris les entrées absentes de l’export), exiger les approbations distinctes prévues et valider le résultat par une résolution à date. Répéter d’abord sur des bases non productives. Une approbation de contenu est distincte de l’approbation d’un déploiement de code.

Aucun synchroniseur général ni export global staging→production n’est autorisé par ce guide. Les dépendances de contenu entre deux bases non productives restent à vérifier; la recette d’un seul projet ne prouve pas une synchronisation universelle.

## Vérifications et retour arrière

Les contrôles locaux du correctif Lookup couvrent l’écriture de dates UTC vers timestamp without time zone sous des sessions PostgreSQL UTC, Europe/Paris et America/Los_Angeles, le maintien des lignes absentes d’un export, le rollback transactionnel, le retry explicite et les valeurs nulles. Les tests ciblés des garde-fous, de l’autosave et de l’écran de reprise passent localement. La CI complète, le déploiement staging du SHA final et les parcours UI/API de bout en bout restent les preuves à obtenir avant clôture.

La recette staging doit encore vérifier sur des données fictives : import/approbations/résolution Lookup, création et reprise du dossier, génération PDF en téléchargement local, upload/téléchargement/suppression Blob, protection Basic sur l’alias et le domaine personnalisé, cookies host-only et refus des crons/effets externes. N’utiliser aucun vrai destinataire ni fournisseur externe.

Avant tout rollback staging, conserver le SHA staging précédent et les preuves des données de test. Vérifier que migrations additives et nouveaux enregistrements restent compatibles avec ce SHA, puis redéployer le précédent SHA et contrôler que les versions/drafts/fichiers de recette restent accessibles après rechargement. Aucun test de restauration globale de production n’est prévu. L’ancienne base directe est conservée jusqu’à une décision distincte de décommissionnement.

## État actuel

| Élément | État |
| --- | --- |
| Migration de production | Runtime vérifié sur la cible Neon gérée par Vercel; l’ancienne cible reste intacte. Santé de production vérifiée après le raccordement. |
| Protections de publication | Réglages Vercel Production-only et règles GitHub main relus après application. Le premier push de la branche de fonctionnalité n’a créé ni aperçu Vercel de production ni nouvelle branche Neon. |
| PR vers staging | PR #97 contient le correctif et cette version du guide. Le contrôle CI test doit être vert sur le SHA final avant fusion. Aucun merge ni déploiement de ce correctif vers staging n’est confirmé ici. |
| Domaine personnalisé | Domaine rattaché au projet staging; DNS externe manquant, domaine non résolvable. |
| Recette de bout en bout | Incomplète. Les parcours finaux après déploiement et la recette sur le domaine personnalisé restent à faire. |
| Rollback staging | Procédure définie; exercice réel de rollback avec vérification des données de test encore à effectuer. |
| Coût | Aucun achat, changement de plan ou frais supplémentaires n’a été autorisé par ce guide. La consommation d’un plan gratuit peut atteindre sa limite; surveiller l’usage et arrêter les essais avant toute opération facturable non couverte. |
