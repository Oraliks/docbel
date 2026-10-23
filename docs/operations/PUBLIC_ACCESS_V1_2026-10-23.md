# Accès publics V1 — qualification et plan du 23/10/2026

Responsable code : chat technique 01a16953-4c65-7c62-9d0f-baf80c1beaa3.
Chef : chat « Coordonner les livraisons DocBel » 01a16942-9455-7162-b68f-24062f3c4e5d.
Base vérifiée : origin/main fdeab981 ; worktree isolé public-access-v1/Docbel.
Le checkout partagé codex/article-110-consolidation à 88d6eed9 est préservé.
Mandat du 23/10 : consultation/outils sans compte visiteur ni dossier enregistré,
admin conservé. Aucun effacement, DB/Blob partagé, migration, fusion ou déploiement.
Aucun changement de règle familiale, de calculateur, de seed ou de test métier.

## Résultat et critères du premier lot

Matrice ciblée et plan auth/cookies écrits avant code ; premier correctif borné
aux créations de comptes publics. Réussite : les appels HTTP directs d'inscription
échouent sans création User/Account/Session ; les inscriptions implicites social et
magic link sont interdites ; connexion/session admin et gestion admin conservées.
Ce lot NE constitue PAS la fermeture complète des dossiers/booking ni une recette
navigateur de tous les outils. Consommation non mesurée, pas de dépense autorisée.
Exécution par ce chat ; revue indépendante proportionnée après tests. Budget initial
20–60 min, confiance moyenne ; deux essais sans information nouvelle => restitution.

## Matrice ciblée de la base (avant correctif)

| Entrée UI / API | Effet et garde constatés | Proposition / lot |
| --- | --- | --- |
| `/inscription*`, lien `/login` | Formulaires citoyen/pro, route partenaire distincte | Retirer pages/liens dans lot navigation ; fermer serveur en A |
| `/api/auth/sign-up/email` | Better Auth crée compte/session ; aucune fermeture publique | A : disabledPaths HTTP, garder API serveur pour bootstrap interne |
| `/api/auth/sign-in/social`, `/callback/google` | Google configurable ; nouveau compte pro si domaine autorisé | A : Google disableSignUp + refus profil inconnu dans mapProfileToUser (voir contournement ci-dessous) ; login existant inchangé dans A |
| `/api/auth/sign-in/magic-link`, `/magic-link/verify` | Envoi réservé pro actif, plugin peut créer un inconnu à la vérification | A : disableSignUp ; maintien des accès existants dans A |
| `/formations/proposer`, `POST /api/formations/organismes` | Flag organizationCreation configurable ; crée FormationOrganization, User/Account/membre et emails (même compte pending) | A : refus avant corps/DB/email, service interne conservé |
| `POST /api/inscription/partenaire` | Domaine autorisé puis User/Account/confirmation email ; public | A : refus avant lecture corps, DB ou email |
| `/login`, reset password, `/api/auth/get-session`, sign-out | Session admin nécessaire ; hooks lock/statut ; cookies sans cache de session | Préserver en A ; B prépare séparation admin/anciens comptes |
| `/admin/**`, `/api/users`, `/api/files/**` | Création users/upload/admin ; requireAdminAuth DB. Download public selon confidentialité | Préserver les accès admin et fichiers publics existants |
| `/mon-dossier`, `/d/[slug]` (ancien `/outils/bundles/[slug]`), `/creer-ma-demande`, `/mes-demarches`, `/reprendre` | UI de création/reprise ; `/onboarding` absent de la base (ancien nom) | C : retirer parcours persistant, rediriger vers outils avec transition explicite |
| `GET/POST/PATCH /api/documents/bundles/[id]/run` | Session user OU cookie anonyme ; GET pose cookie 30j, POST crée BundleRun, PATCH écrit réponses | C : refuser création/écriture et lecture publique correspondante avant effets |
| `POST /api/bundles/resume`, `/api/bundles/runs/[runId]/**` | Code = preuve d'accès, cookie 30j, reprises, email, téléchargement, abandon | C : fermer nouvelles écritures ; données/codes existants conservés, prévoir transition avant fermeture des reprises |
| `GET/PUT/DELETE /api/user/profile`, `/profil` | Session suffit ; profil NISS/IBAN/ménage en DB | B/C : fermer visiteurs existants côté serveur, garder données et administration |
| `/document/[...path]`, `GET/PUT/DELETE /api/pdf/[slug]/draft` | Brouillon connecté PdfFormDraft (7j) OU BundleRun anonyme via cookie | C : empêcher autosave serveur et réponse conservée navigateur ; ne pas désactiver un outil éphémère sans qualification |
| `POST /api/pdf/[slug]/generate` | Download autonome stream ; `bundleRunId` écrit payload/completion même en download ; save écrit ; log submission (hash/IP/user) | C : fermer branche persistante ; génération documentaire hors nouveau développement. Décider exposition avec chef après qualification, aucune modification métier |
| `/api/pdf/[slug]/prefill/start` | Cookie OAuth court ; callback stub | C : qualifier avec documents, pas de nouvelle intégration |
| `/[slug]/rendez-vous`, `/rendez-vous/guichets`, `POST /api/booking/[slug]/book`, `/waitlist` | Public + rate-limit/tenant actif ; Booking/Waitlist nom/email/téléphone/NRN et emails | D : fermer nouvelles réservations et attente serveur, conserver gestion/reprises existantes jusqu'à transition |
| `/api/booking/manage/[token]/**`, `/api/booking/partner/**`, crons | Gestion token/rôle des réservations existantes, notifications et rétention | D : inventorier transition ; ne pas supprimer ni changer crons/rétention sous ce mandat |
| Contact / `POST /api/contact-messages` | Resend vers CONTACT_EMAIL_FROM ; Activity garde nom/email/sujet via logActivity | Transmis chef/RGPD ; laissé accessible, aucune suppression décidée ; commentaire « Nothing is stored » trop large |
| Newsletter / `POST /api/newsletter` | Rate-limit public ; NewsletterSubscriber create/update ; admin pour gestion | Transmis chef ; maintenu dans A, choix explicite ultérieur sur exposition |
| Audience shell / événements bundle | AnalyticsGate monte Vercel et page views après consentement ; `/api/bundles/events` écrit DB sans consentement serveur vérifié ici | Transmis chef ; vérifier réseau avant notice ; pas de désactivation présumée |

Les chemins ci-dessus sont le périmètre constaté dans le code, pas un état de
production ou de configuration distante. Les gardes de branches secondaires
(download/email/booking manage) restent à relire dans leurs sous-lots.

## Plan dédié auth et cookies (avant intervention)

1. A — fermer les créations HTTP de comptes sans changer les sessions existantes.
   `disabledPaths` Better Auth interdit email sur HTTP uniquement ; option Google
   `disableSignUp` et refus des profils inconnus dans `mapProfileToUser` ferment
   Google ; magic link `disableSignUp` bloque ses créations implicites.
   Les routes partenaire et organismes de formation renvoient 403 avant corps/Prisma/Resend. Aucun cookie supplémentaire.
   L'API serveur de bootstrap reste interne ; `/api/users` reste sous requireAdminAuth.
   Tests : vraies requêtes Better Auth avec adaptateur mémoire ; DB/email interdits
   dans test route partenaire ; login/session/sign-out admin préexistant conservés.
2. B — séparer les usages admin de l'ancien accès visiteur : login admin identifiable,
   gardes serveur sur profil et espaces pro publics. Conserver lock/rate-limit/CSRF,
   récupération mot de passe, révocation DB et stop impersonation. Ne pas supprimer
   User/Account/Session et ne pas utiliser un rôle en cookie comme autorité.
3. C — empêcher les nouveaux runs, brouillons et payloads persistants, y compris
   accès GET créant le cookie `beldoc-bundle-session`, `save`/`download` avec bundleRunId.
   Adapter l'autosave avant exposition d'un formulaire autonome, sans toucher à son arbre.
   Retirer les nouveaux cookies d'orientation/parcours et empêcher leur renouvellement.
   Codes/données existants conservés. La fermeture de l'ancienne reprise nécessite une
   page de transition expliquant l'indisponibilité et le contact retenu par le chef ;
   aucune promesse d'export exhaustif ni suppression automatique.
4. D — fermer nouvelles réservations/attentes et entrées UI. Conserver les rendez-vous,
   les liens de gestion existants et l'admin ; traiter explicitement les crons existants.
5. E — navigation publique sans compte/dossier : header/hero/footer/palette/teaser,
   pages d'inscription/profil/reprise, outils utilisables sans connexion. Lots 3–5 fichiers.
   Ne pas remplacer le guide familial ni changer les questions/résultats approuvés.
6. Cookies à préserver : auth admin (HttpOnly/Secure/SameSite), consentement, langue ;
   préférences thème/accessibilité. Cookies de dossiers à arrêter sans lecture/effacement
   des données serveur. Cookie consentement et préférences ne prouvent pas absence
   de stockage : vérification navigateur obligatoire dans E/F.

## Stockages navigateur et collectes restant à vérifier

Constat statique : `app/layout.tsx` lit localStorage `docbel-theme` et
`docbel-accessibility` ; dossier-wizard pose `beldoc-orientation`. `article-view.tsx`
stocke les favoris et `ec32-interactive-simulator.tsx` stocke un payload dans
localStorage (confirmés par lecture ciblée). Le guide familial
reste hors modifications. Le hook `components/pdf-forms/use-draft-autosave.ts`
confirme des PUT avec payload, flush à la fermeture et suppression du brouillon
serveur ; ces requêtes devront être arrêtées en C pour une utilisation éphémère.
Les stockages transversaux devront être qualifiés dans C/E ; aucune promesse
« sans conservation » sur l'ensemble du site à ce stade. Pas d'inspection live,
DB, Blob ou production dans ce premier lot.

## Validation et découpage restant

A : configuration auth + route partenaire + tests (3–5 fichiers), puis ajustement
UI inscription/login dans E. pnpm 10.33.2 et Node 24.19 constatés ; dépendances
existantes via jonction locale, aucune installation ni modification de lockfile.
Contrôles requis : lint baseline, suite Vitest, build/typecheck, i18n ; refus d'API
réels en mémoire et revue indépendante. Les résultats seront ajoutés ici.
B–F : chacune 20–60 min à confirmer après lecture ciblée ; revue chef nécessaire
avant intégration globale. Aucun lot non exécuté ne sera marqué livré ou vérifié.

## Résultats stabilisés du sous-lot A

Cinq fichiers : auth, routes partenaire et organisme, nouveau test et ce rapport. Aucune UI
modifiée : les formulaires/liens restent visibles et sont reportés au lot E.
L'accès serveur est fermé pour les nouvelles inscriptions uniquement ; aucun
changement de statut, révocation, suppression ou migration de compte existant.
Connexion email/session/logout et récupération mot de passe administrateur
préexistant testées avec vrais hooks et adaptateur mémoire. Le Google des
partenaires/employeurs existants reste possible. L'admin Google/magic link était
déjà refusé par le mapping/envoi de la base ; il n'est pas nouvellement interdit.

Le premier essai (15/17 réussis) a trouvé un contournement réel dans Better Auth
1.6.9 : `sign-in.mjs` lit `provider.disableSignUp` pour idToken, alors que le
callback lit `provider.options.disableSignUp`. La création restait donc possible
par idToken malgré l'option. Le correctif refuse les profils inconnus dans le
mapping Google commun aux deux chemins. Tests conservant le vrai décodage et
mapping Google ; seule vérification cryptographique réseau remplacée. Aucun
changement de dépendance. Les tests de référence métier sont inchangés.

| Contrôle local | Résultat / preuve locale ignorée par Git |
| --- | --- |
| 18 tests ciblés (12 nouveaux + 6 sécurité auth existants) | Réussis, `.validation-signup-targeted.log` |
| Suite complète `pnpm test` | 3 180 réussis, 1 ignoré ; 309 fichiers réussis + 1 ignoré, `.validation-signup-tests.log` |
| Lint avec baseline CI | 0 erreur, 58 avertissements avant ajout organisme, `.validation-signup-lint.log` ; lint des quatre fichiers code finaux réussi sans avertissement, `.validation-signup-final-lint.log` |
| `pnpm i18n:check` | Réussi, 0 erreur ICU/JSON ; fallback FR existant, `.validation-signup-i18n.log` |
| `pnpm build` | Échec infrastructure : Turbopack refuse la jonction node_modules hors racine, `.validation-signup-build.log` |
| `pnpm build --webpack` | Échec résolution react-pdf CJS/pdfjs-dist ESM via la jonction, `.validation-signup-build-webpack.log` ; aucune configuration projet modifiée |
| Diagnostic `pnpm exec tsc --project tsconfig.build.json --noEmit --incremental false` | Échec : erreurs dans fichiers hors delta (routes featured/og générées, Leaflet, tests familiaux/barèmes) ; `.validation-signup-tsc.log`, ne remplace pas le build requis |

Revue indépendante : GPT-6 Luna, effort medium, lecture seule. La première
conclusion sur l'option Google a été retirée après le test révélant le défaut.
Revue du mapping corrigé : aucun autre défaut constaté, tests non relancés par
le reviewer. Son Git sandbox n'accédait pas au worktree ; diff exporté relu
pour revue du delta exact ; ajout organisme également revu, aucun défaut résiduel constaté. Validation prod/DB/auth externe et navigateur non faite.
SHA256 du référentiel verrouillé principal contrôlé en lecture seule :
35A677763C099CB5784E6D4D1D29990270BC21ACD9975F946F7D0CA1EF5D6E74.

Contact/newsletter/audience restent accessibles comme constatés, pas fermés par A.
La newsletter peut réactiver un désabonné : point transmis au chef/RGPD, aucune
nouvelle décision de suppression prise. Les notices ne peuvent donc pas annoncer
un site sans collecte. B/C/D/E et recette outils restent à faire ; prochaine
dépendance technique : arrêter les créations/écritures BundleRun + autosave avant
la simplification de navigation et sans changer de comportement métier.

Vérification supplémentaire des créations de comptes : seuls `/api/users` (admin
DB) et le service `createOrgApplication` subsistent dans app/lib hors Better Auth.
La route publique `/api/formations/organismes` du service a donc été ajoutée au
lot A : le flag configurable ne valait pas fermeture. Le helper interne est
conservé. `/api/auth/confirm` active un compte préexistant ; il ne crée pas de
User/Account. Aucun blocage général des connexions existantes dans ce lot.

Le build requis reste NON VALIDÉ localement ; le diagnostic TypeScript éventuel
ne s'y substitue pas. Préparer une PR brouillon, garder les gates manquants
visibles et attendre CI propre avant de demander intégration. Aucune modification
de configuration PDF ou de dépendance n'entre dans ce lot.

PR brouillon ouverte : https://github.com/Oraliks/docbel/pull/83 ; commit de code
f2402ef261e61449b6de4f7ea5998fdce183e50a, base distante vérifiée fdeab9816da4d77baf8e90716aa6bc5109037d08.
CI en cours à l'ouverture. Le diagnostic TypeScript n'a signalé aucun fichier du
delta ; les fichiers cités sont inchangés par rapport à la base (à distinguer
d'une validation TypeScript globale, qui a échoué). Aucun de ces tests métier
n'a été modifié pour contourner le diagnostic. L'état final CI est porté par la
PR et la restitution au chef ; ce rapport décrit les preuves locales du lot.
