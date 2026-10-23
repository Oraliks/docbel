# Persistance publique V1 — sous-lot C, plan du 23/10/2026

Base figée : lot A/PR83, 4404b678e32b46497576676a1761303c5a808666.
Branche codex/public-persistence-v1 ; PR empilée sur A, aucune modification de A.
Mandat chef du 23/10 : fermer nouvelles écritures BundleRun et autosave, préserver
admin utile, outils éphémères et données/reprises existantes. Pas de fusion,
production, DB/Blob partagée, effacement ni modification métier/arbre/tests métier.

## Plan préalable et critères

Budget initial20–60min, confiance moyenne ; exécution par ce chat, revue indépendante
Sol/medium prévue après stabilisation. Consommation non mesurée. Deux essais
improductifs sans information nouvelle => diagnostic au chef.

Lot code borné à5 fichiers : proxy.ts, GET run (lecture sans cookie neuf), reprise
sans mutation de BundleRun, hook autosave éphémère et nouveau test. Rapport séparé
après ce lot. Le contrôle HTTP est une fermeture de fonctionnalité publique,
sans DB ni décision d'autorisation ; les gardes de propriété/admin existantes
restent dans leurs handlers. Les handlers métier et tests de référence restent
inchangés pour les branches réglementaires. Pas de flag de réouverture au public.

1. Intercepter les nouvelles écritures : POST/PATCH run ; PUT/DELETE draft ;
   DELETE run ; POST email-code (écrit resumeEmail) ; generate save OU bundleRunId
   (y compris delivery download). Aucun changement aux générateurs/calculs.
2. GET run devient lecture pure : sans user/cookie => null, aucun nouveau cookie ;
   avec propriétaire existant => même recherche et réponse, aucune écriture.
3. Reprise : code existant vérifié comme avant ; sessionId existant => cookie
   d'accès maintenu pour consultation. Si sessionId absent, seul propriétaire déjà
   connecté peut consulter sans créer/attacher de sessionId serveur ; sinon erreur
   explicite409 (pas de création d'identité ni réassociation de données).
4. Autosave : suppression des PUT/DELETE, minuteurs et flush fermeture ; valeurs
   de formulaire gardées par état React existant, lastSavedAt reste null. Les GET
   des anciens brouillons restent des lectures sous leurs gardes existantes.
5. Vérifier refus HTTP direct, variantes d'URL encodées/trailing slash, body save et
   download+bundleRunId ; aucun accès DB/cookie dans les refus. Vérifier lectures
   existantes et routes admin/génération autonome/guide familial non interceptées.
6. Validation : tests ciblés + suite complète + lint/i18n ; build requis via CI
   propre (limites de jonction locales déjà documentées dans A, pas de relance
   identique sans nouvelle hypothèse) ; vérification HTTP locale avec DB factice.

## Transition

Les dossiers, payloads, brouillons, codes et fichiers existants ne sont pas effacés.
Les lectures et téléchargements dédiés d'anciens dossiers restent autorisés par
leurs preuves de possession actuelles ; édition/sauvegarde refusée côté HTTP.
Les reprises n'écrivent plus d'identifiant en DB ; le seul cas sans sessionId et
sans propriétaire connecté ne peut pas être rattaché sans mutation : conservé
et signalé au chef pour éventuelle procédure administrative distincte.
Les codes/hash/expirations existants ne sont pas modifiés. Les crons de rétention
et l'administration des données restent hors modifications de ce lot.

L'UI/navigation d'anciens dossiers n'est pas encore un lecteur dédié : certains
boutons d'édition recevront403. Un sous-lot de navigation/transition doit expliquer
lecture seule et absence de sauvegarde avant réception globale. Aucun nouveau
contact éditeur inventé. Les inscriptions A ne sont pas publiées seules.

Hors scope : profil, booking, contact/newsletter/audience, cookie d'orientation
posé par le wizard, favoris et EC32 localStorage. Leur existence n'est pas
présumée supprimée. Le guide familial et les règles approuvées ne changent pas.

## Résultats locaux du lot code (cinq fichiers)

- Nouveau proxy HTTP ; GET run sans création de cookie ; reprise sans écriture
  de sessionId dans BundleRun ; hook autosave éphémère ; nouveau test isolé.
- 74 tests ciblés réussis (32 nouveaux + sécurité auth + snapshots métier inchangés).
- Suite complète : 3 212 réussis, 1 ignoré ; 310 fichiers réussis, 1 ignoré.
- Lint baseline : 0 erreur, 58 avertissements existants. i18n : réussi.
- Vérification HTTP sur Next16.2.6 local, pnpm10.33.2, DB factice127.0.0.1:1 :
  18 scénarios réussis : refus403 de tous les points d'écriture, dont download
  avec bundleRunId, ids contenant %2F, segments encodés (api/documents/run), slash
  final/double/backslash, x-middleware-subrequest et x-invoke-path. GET anonyme
  renvoie200/null sans Set-Cookie. Deux routes admin contrôlées répondent401,
  montrant que le proxy les laisse appliquer leur garde actuelle.
- Le premier client HTTP de test envoyait DELETE sans Content-Length :400 vide
  du parseur HTTP. Corrigé dans le script de preuve, sans modification produit ;
  toutes les requêtes valides ont réussi. Aucun appel DB n'apparaît dans le log
  serveur local. Aucune DB/Blob partagée ou messagerie réelle consultée.
- Revue indépendante GPT-6.1 Sol/medium du diff exact : aucun défaut bloquant,
  aucun secret/PII réelle ; suite complète et tests ciblés lus par le reviewer.
  Son Git sandbox ne permettait pas le diff ; export relu comme preuve du delta.

Preuves locales (non committées) : `.validation-persistence-targeted.log`,
`-tests.log`, `-lint.log`, `-i18n.log`, `-http-results.log`, `-http-script.log`,
`-server.log`, `-review.log` (tous préfixés `.validation-persistence`).
Le build requis doit être vérifié en CI propre ; ne pas répéter les échecs connus
Turbopack/jonction et Webpack/pdfjs du lot A sans nouvelle hypothèse. Aucun
changement de configuration ou de dépendance pour les contourner.

Le rapport constitue un lot documentaire séparé après les cinq fichiers code.
La PR dépend explicitement de83 ; base technique A4404b678. Cibler main pour que
la CI existante (filtrée sur main/dev) vérifie le HEAD complet : le diff vers main
inclut donc A par ascendance, sans modifier A ou sa PR. Le delta propre à C se
lit contre codex/public-access-v1-signup. Ne pas fusionner cette PR avant83 et
la réception globale des sous-lots navigation/transition. Aucune autorisation de
fusion ou production n'est fournie ici.

Limites : aucune recette navigateur complète des anciens dossiers (DB réelle
interdite) ni OAuth externe ; lectures/reprises testées avec fixtures. Les boutons
persistants et le cookie d'orientation restent à corriger dans navigation. Les
logs d'événements et le journal de soumission PDF autonome restent inchangés :
une réponse éphémère n'implique pas absence de toute collecte technique. Admin
métier et outils non concernés n'ont pas été refondus ni testés globalement.
