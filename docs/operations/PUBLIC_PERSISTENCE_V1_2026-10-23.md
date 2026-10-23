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

## Sous-lot D — qualification et plan du 23/10/2026 (avant code)

Branche isolée codex/public-profile-booking-v1, fondée sur C11e6426e ; A/C et
leurs PR conservées. Contrat UI A/C compact transmis au chef par message, sans
document miroir ni intervention dans nav/header/footer/zones DESIGN.
Budget initial20–60min, confiance moyenne ; revue indépendante proportionnée,
consommation non mesurée. Lots3–5 fichiers ; deux essais sans nouvelle preuve => chef.

Qualification ciblée :
- /api/user/profile : GET sous session du propriétaire, PUT upsert données
  personnelles et DELETE deleteMany. Fermer PUT/DELETE côté HTTP ; garder GET
  sous sa garde existante. Aucune donnée effacée ni statut/rôle changé.
- /api/booking/[slug]/waitlist : POST public crée identité et contact en DB.
  Fermer les nouvelles inscriptions ; anciens enregistrements conservés.
- /api/booking/[slug]/book : POST public crée Booking, activité et notifications.
  Fermeture prévue, mais transition des anciennes notifications waitlist à arbitrer
  avant cette partie (voir ci-dessous). Aucun appel réel DB/mail.
- Gestion existante : cancel/reschedule/verify/confirm-presence et ICS sous token,
  renvoi du lien à l'email déjà enregistré, espaces privés sous leurs gardes.
  Le report met à jour le même Booking ; ne pas le fermer comme nouvelle demande.
- Availability et dedupe-check restent des lectures/traitements sans création de
  réservation ; ne pas supprimer un outil éphémère par commodité.

Point soumis au chef : notifyNextWaiter est appelé par annulation/report/actions
admin et cron ; il marque notified et envoie un lien de création, sans preuve
permettant une exception de réservation. Recommandation : suspendre seulement
ce helper avant lecture/mutation/email quand les nouvelles réservations sont
fermées ; données waitlist, cron/rétention et autres emails inchangés. Sinon
isoler /book et livrer profil+waitlist seulement. Ne pas décider une suspension
non mandatée : attendre réponse chef pour la partie concernée, continuer le reste.

Plan de vérification : refus direct HTTP et encodages ; gardes admin/profil lecture
maintenues ; anciens RDV consultables/annulables/reportables sous contrôles
existants ; pas de lecture corps/DB/mail au refus. Tests ciblés puis lint baseline,
suite complète, i18n et build en CI propre. Pas de build local identique aux échecs
connus de jonction A/C. Pas de DB/Blob partagée, effacement, variables prod,
fusion/déploiement, modification métier/arbre/calcul/seed/test métier.

### Décisions reçues avant la suite D

Le propriétaire a confirmé explicitement le23/10 : « V1 sans compte visiteur ni
dossier enregistré, comme décidé ici ». Le conflit avec les clauses génériques
comptes/sauvegarde du prompt design est tranché ; ne pas le rouvrir. Suspension
courte du travail respectée, aucun changement perdu ; reprise sur ce mandat.
Le chef autorise ensuite précisément la première option de transition booking :
fermer nouvelles réservations/waitlist et suspendre notifyNextWaiter avant toute
lecture/mutation/email, pour conserver les inscrits sans les marquer notifiés.
Annulation/report/vérification/ICS/lien de gestion existants, données, gardes
privées, autres notifications et planification/rétention crons restent conservés.
Implémentation bornée prévue : proxy, helper waitlist, tests frontière existants,
nouveau test intégration gestion/profil, ce rapport (5 fichiers). Aucun fichier
visuel ou du responsable DESIGN n'est édité.

### Résultats D et limites de la preuve

Delta D limité aux cinq fichiers annoncés. Le proxy refuse les mutations profil
et nouvelles réservations/waitlist avec403 avant les handlers. notifyNextWaiter
retournefalse avant tout I/O ; aucun inscrit existant n'est marqué ni averti.
Les tests exécutent les vrais handlers cancel/reschedule et GET profil avec
fixtures : même Booking mis à jour, email ordinaire conservé, propriétaire requis.

- Tests ciblés :64/64 ; suite complète :3238 réussis,1 ignoré (311 fichiers
  réussis,1 ignoré). Lint :0 erreur,58 avertissements existants. i18n :réussi.
- Premier passage complet :timeout15s du test AST rate-limit sous charge
  concurrente lint/dev/tests. Ce test passe seul7/7 en3,02s ; suite entière
  relancée seule après arrêt dev/lint, réussie en37,12s. Aucun test/timeout changé.
- HTTP local Next16.2.6/pnpm10.33.2 :15/15 scénarios ;8 refus directs avec
  encodages/corps malformés/en-tête middleware, lectures/gardes existantes et
  contrôles inverses des en-têtes de routage. Renvoi du lien avec email invalide
  retourne200 avantDB/mail. Le premier503 venait du rate-limit local non
  configuré ; backend mémoire explicite pour la seconde preuve locale seulement.
- DB factice127.0.0.1:1, aucune DB/Blob partagée ou messagerie réelle appelée.
  Serveur de preuve arrêté, aucun listener3327 restant.
- Revue indépendante GPT-6.1 Sol/medium des cinq fichiers :aucun défaut bloquant,
  aucun secret/PII réelle. Reviewer informé des résultats et de la qualification.
- Preuves locales ignorées : .validation-profile-booking-{targeted,tests,lint,
  i18n,rate-limit,http-results,http-script,server,review}.log.

Le build requis est réservé à la CI propre ; les échecs locaux connus de la
jonction de dépendances ne sont pas répétés. La PR dépend de83/84 ; cible main
pour la CI filtrée main/dev. Son diff complet inclut donc A/C par ascendance,
le delta D seul se lit contre codex/public-persistence-v1. Aucune fusion ou mise
en production autorisée par ce lot. Les parcours réels sous tokens et avec
DB partagée ne sont pas testés ici ; fixtures et gardes contrôlent la transition.
Les adaptations visuelles restent au responsable DESIGN via le chef.

## Livraison cohérente — mandat du propriétaire du 23/10/2026

Le propriétaire a explicitement autorisé la clôture et la mise en production des
fermetures A/C/D, sans attendre la refonte DESIGN. Ces fermetures sont TEMPORAIRES
pendant les travaux. Ce mandat de livraison remplace l'absence d'autorisation de
fusion/production des sous-lots historiques ci-dessus ; il ne permet aucun
changement de données, métier, référence verrouillée, configuration ou dépendance.

La branche codex/temporary-closure-release conserve les commits A/C/D inchangés et
ajoute uniquement la transition fonctionnelle sur le design actuel : entrées
inscription/RDV suspendues, notices next-intl, anciennes réponses/profil en
consultation, création/édition/reset/abandon masqués, aucune promesse d'autosave.
Les pages de réservation fermées retournent avant les lectures métier. Un id de
run demandé mais inaccessible renvoie404 au lieu d'ouvrir une autre demande.

Récupération : les endpoints GET dédiés conservent propriété/rate-limit et le
verrou allRequiredDone. Les documents d'un dossier entièrement complété restent
récupérables. Aucun téléchargement prématuré ni assouplissement de ce verrou ;
le handler generate avec bundleRunId reste fermé car il peut écrire même en
mode download. Les consignes existantes de la feuille de route sont conservées.

Réouverture ultérieure : coordonner lib/public-access.ts (présentation), les
gardes auth/proxy, le hook autosave et notifyNextWaiter. Le seul indicateur UI ne
réactive pas les écritures. Aucun module ou enregistrement existant supprimé.

Validation nouvelle :19 tests de rendu SSR et de routage (code reprise, gestion
par token, profil/formulaires existants, deux demandes distinctes, autosave).
Les preuves définitives de lint baseline, suite complète, i18n, build, revue du
SHA final, fusion et déploiement/alias sont consignées dans la PR de release et
le bilan au chef. Les limites des fixtures et de la recette production demeurent
explicites ; aucun succès production ne découle du seul push ou merge.
