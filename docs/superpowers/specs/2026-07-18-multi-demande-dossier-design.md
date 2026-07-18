# Plusieurs demandes par dossier (multi-run citoyen)

Date : 2026-07-18
Statut : design validé (en attente de relecture)

## Contexte & problème

Un « dossier » (`DocumentBundle`) se remplit via une **demande** = un `BundleRun`
(ses `payloads` par formulaire, son code de reprise, sa complétion, son statut).

Aujourd'hui, un citoyen ne peut avoir **qu'une seule demande en cours par
dossier** : ouvrir un dossier déjà démarré **reprend** systématiquement la même
demande (« il me dit de la modifier »), sans aucun moyen d'en créer une nouvelle
et distincte. Un citoyen qui a plusieurs cas réels du même dossier est bloqué.

**Bonne nouvelle** : le modèle de données supporte DÉJÀ plusieurs `BundleRun` par
dossier (aucune contrainte d'unicité). Le blocage est **uniquement dans le
flux** :
- `POST /api/documents/bundles/[id]/run` **réutilise** le run éditable existant
  (in_progress OU completed) au lieu d'en créer un nouveau.
- Les points d'entrée (`/d/[slug]`, cartes « Dossiers en cours » de
  `/mon-dossier`) sont centrés sur le **slug du bundle**, jamais sur un `runId`.
- En revanche le remplissage des documents est DÉJÀ conscient du `runId`
  (`bundleRunId` circule jusqu'au Form Runner et aux brouillons).

Donc la couche manquante = **sélection + création** d'une demande.

## Décisions (validées avec Oraliks)

1. **Cas d'usage** : un citoyen, plusieurs cas du même dossier. Identification
   légère, pas de logique « pour qui ».
2. **Entrée hybride** : 0/1 demande → ouverture directe (comportement actuel) +
   bouton discret « Nouvelle demande » ; 2+ → écran « Mes demandes ».
3. **Libellé** : « Demande » + date de début + progression, **calculé** (pas de
   nom éditable, donc aucun champ à stocker).
4. **Abandon inclus** dans ce lot : pouvoir abandonner une demande (soft-delete
   réversible côté admin).

## Approche retenue

**A — Changement de flux minimal, ZÉRO migration.** On réutilise le socle
(`runId` déjà câblé). Écartées : (B) route dédiée `/d/[slug]/demandes` = surface
de routing en plus pour peu de gain ; (C) champ « nom » en base = YAGNI vu la
décision 3.

## Modèle de données

**Aucun changement de schéma.** Une demande = un `BundleRun` existant, avec :
`bundleId`, `userId`/`sessionId`, `startedAt`, `payloads`, `draftPayloads`,
`completedTemplateIds`, `status` (`in_progress`/`completed`/`abandoned`/
anonymisé), `resumeCodeHash`, `completedAt`.

**Libellé calculé** (jamais persisté), par run d'un même dossier trié par
`startedAt` : `Demande n°{N} · démarrée le {JJ/MM/AAAA} · {complétés}/{total}
documents`. `N` = rang de création. Helper pur `lib/bundles/run-label.ts`
(testable), réutilisé par « Mes demandes » et les cartes `/mon-dossier`.

## API

### `POST /api/documents/bundles/[id]/run` — flag `forceNew`

- Body optionnel `{ forceNew?: boolean, eligibilityAnswers? }`.
- `forceNew: true` → **saute** la réutilisation du run existant et crée toujours
  un nouveau run (nouveau code de reprise, `startedAt` = maintenant).
- **Garde-fou anti-doublon vide** : si `forceNew` ET qu'un run **sans
  progression** (aucun `payload`, aucun `completedTemplateIds`, aucune réponse
  de pré-qual) existe déjà pour ce (bundle, user/session), on **renvoie ce run
  vide** au lieu d'en créer un second. Évite les demandes fantômes en cas de
  double-clic / allers-retours.
- **Cap souple** : refuse (409 `too_many_runs`) au-delà de ~20 demandes éditables
  par (bundle, user/session). Anti-abus, jamais atteint en usage normal.
- Sans `forceNew` : comportement inchangé (réutilise / crée).

### `DELETE /api/documents/bundles/[id]/run` — abandon d'une demande

- Body `{ runId }`. Vérifie la propriété (userId de session OU cookie anonyme),
  puis passe `status = "abandoned"` (**soft-delete** : aucune donnée effacée,
  réversible côté admin ; distinct de l'anonymisation RGPD).
- Idempotent + sans fuite : run inconnu / pas à l'appelant → `{ ok: true }` sans
  rien changer.
- Un run `abandoned` sort de `EDITABLE_BUNDLE_RUN_STATUSES` → disparaît
  automatiquement de toutes les listes éditables et des reprises.

### Lecture

Pas de nouvel endpoint de liste : la page serveur `/d/[slug]` lit déjà en
`findMany` (voir plus bas). `GET …/run` (dernier run) reste inchangé.

## Page `/d/[slug]`

Ajoute la prise en charge d'un `?bundleRun=<runId>` et la logique hybride.

- **`?bundleRun=<runId>` présent** → charge CE run (garde de propriété
  identique à l'existant) et rend le `BundleRunner` dessus. Un run non possédé /
  abandonné / inconnu → on ignore le param et on retombe sur la logique hybride.
- **Sinon**, sur les runs **avec progression** (`runHasProgress`, déjà défini)
  du (bundle, user/session), en `findMany` trié `startedAt desc` :
  - **0** → comportement actuel (journey / pré-qualif / démarrage).
  - **1** → ouverture directe (actuel) ; le `BundleRunner` reçoit un flag pour
    afficher le bouton discret « Nouvelle demande ».
  - **2+** → rend le composant **« Mes demandes »** (liste + « Nouvelle
    demande »).
- `?demarrer=1` continue de forcer l'ouverture directe du Form Runner (reprise /
  parcours guidé) ; combiné à `?bundleRun=X` il cible une demande précise.

## Composant « Mes demandes » (nouveau, client)

Affiché quand 2+ demandes. Pour chaque `BundleRun` du dossier :
- libellé calculé (helper `run-label`), progression (barre + `x/total`), statut
  (En cours / Terminé — un `completed_editable` reste modifiable),
- bouton **Reprendre** (in_progress) / **Revoir** (terminé) →
  `/d/[slug]?bundleRun=<id>&demarrer=1`,
- bouton **Abandonner** (avec confirmation) → `DELETE …/run { runId }`, puis
  retire la carte.

En tête ou pied : bouton **« Nouvelle demande »**.

## Bouton « Nouvelle demande »

Présent (1) sur l'écran d'une demande unique (dans le `BundleRunner`, en-tête ou
pied, discret) et (2) dans « Mes demandes ». Au clic : `POST …/run
{ forceNew: true }` → récupère le nouveau `runId` → navigue vers
`/d/[slug]?bundleRun=<newId>&demarrer=1`. (Le code de reprise du nouveau run
s'affiche comme pour un premier démarrage.)

## `/mon-dossier` — « Dossiers en cours »

`ActiveBundleRun` (dans `lib/landing/resume.ts`) gagne un champ **`runId`**.
`loadActiveBundleRuns` est déjà en `findMany` → on ajoute `id` au `select` et on
le propage. Chaque demande devient **sa propre carte** (date + progression) au
lieu de se télescoper par slug ; le lien de la carte devient
`/d/[slug]?bundleRun=<runId>&demarrer=1`. La bande « Reprendre » de la home suit
le même changement (elle consomme la même source).

## Isolation (la « dissociation »)

Chaque `BundleRun` porte ses propres `payloads` / `draftPayloads` / complétion /
code de reprise. **Aucun** pré-remplissage croisé entre demandes ; seul le
prefill **profil** (utilisateur connecté) s'applique à une nouvelle demande —
c'est exactement la dissociation attendue. Rien à changer : le prefill
inter-documents est déjà borné à l'intérieur d'un run.

## Garde-fous & cas limites

- **Anonyme** (cookie `beldoc-bundle-session`) : plusieurs runs sur le même
  cookie, chacun son code de reprise. Fonctionne via `sessionId`.
- **Runs vides** : le garde-fou `forceNew` (réutilise un vide) évite les
  doublons fantômes ; `runHasProgress` continue de masquer un run vide de la
  liste.
- **Ownership** partout (comme l'existant) : jamais lire/écrire/abandonner le run
  d'un autre citoyen (cross-tenant).
- **Read-only / impersonation** : `ensureWriteAllowed` déjà appliqué sur les
  routes d'écriture — l'ajouter sur `DELETE …/run`.

## Tests

- `run-label` : numérotation par `startedAt`, format date + progression.
- `POST …/run` `forceNew` : crée un nouveau run ; réutilise un run vide existant ;
  respecte le cap (409).
- `DELETE …/run` : passe en `abandoned` avec garde de propriété ; idempotent ;
  disparaît des listes éditables.
- `/d/[slug]` : `?bundleRun` charge le bon run (+ garde propriété) ; branche
  hybride 0/1/2+.
- `resume.ts` : renvoie `runId` ; deux demandes du même bundle = deux entrées.

## Hors périmètre (YAGNI)

Nom personnalisé de demande ; partage entre personnes ; duplication d'une demande
en une autre ; fusion de demandes.
