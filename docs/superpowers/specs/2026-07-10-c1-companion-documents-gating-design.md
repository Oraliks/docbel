# Gating du téléchargement — documents compagnons déclenchés par le C1 (design)

Statut : validé par Oraliks (2026-07-10).

## Contexte

Le C1 (déclaration de situation personnelle) porte 10 déclencheurs
(`C1_TRIGGERS`, `lib/pdf-forms/seed/c1-fields-improvements.ts:1710`) : selon
les réponses données dans le C1 lui-même (ex. `tremplinIndependants = oui`
et pas déjà déclaré), un document compagnon devient obligatoire (C1C, C1A,
C47, C46, Annexe Regis, C1-Partenaire). Le moteur qui évalue ces
déclencheurs et matérialise les documents dans le parcours
(`lib/pdf-forms/triggers.ts`, `collectAllTriggeredSlugs`) existe déjà et est
testé.

**Vérification en base (2026-07-10, dry-run `scripts/apply-c1-improvements.ts`
+ requête statut) :**

| Slug | Champs/triggers en DB | status |
|---|---|---|
| `c1-insertion` | 131 champs, **10 triggers** ✓ | `published` |
| `c1-changement-situation` | 132 champs, **10 triggers** ✓ | `published` |
| `c1c`, `c1a`, `c1b`, `c46`, `c47`, `c1-partenaire`, `c1-regis` | champs/triggers corrects | **`draft`** ⚠️ |

Le C1 est donc déjà correctement câblé. Mais la route qui matérialise les
documents déclenchés dans le parcours (`app/d/[slug]/page.tsx:135`) ne
récupère que les PdfForms `status: "published", active: true`. **Les 7
formulaires compagnons étant en `draft`, aucun d'eux ne s'affiche
aujourd'hui**, quelle que soit la réponse donnée dans le C1 — c'est la cause
racine immédiate du problème signalé par Oraliks, avant même la question du
verrou de téléchargement.

Par ailleurs, aucun PDF n'est jamais stocké côté serveur (contrainte RGPD,
`app/api/pdf/[slug]/generate/route.ts` : commentaire "AUCUN stockage").
Chaque téléchargement régénère le PDF à la volée depuis un payload déjà
validé. Un `BundleRun` (`prisma/migrations/6_bundle_runs`) persiste déjà les
payloads validés par formulaire (`payloads: Record<pdfFormId, FormPayload>`)
et la liste des formulaires complétés (`completedTemplateIds`).

**Reconciliation avec le plan `2026-07-04-allocations-insertion-forms-refresh`
(Tasks 9-12, jamais exécutées — vérifié : `gatedByRestOfDossier` absent de
`lib/dossiers/types.ts`, `locked` absent de `compute.ts`) :** ce plan
proposait un verrou plus étroit — un seul document désigné par dossier
(`gatedByRestOfDossier: true` sur `c109-36-demande` uniquement) resterait
verrouillé tant que le reste n'est pas fait, mais les *autres* documents
(dont le C1 lui-même) resteraient télécharge­ables individuellement dès
qu'ils sont complétés. Ce n'est PAS ce qui est demandé aujourd'hui : le
scénario d'Oraliks ("je remplis le C1 avec tremplin=oui/1ère fois → je dois
aussi remplir le C1C → alors seulement je peux télécharger LES DEUX") exige
que **le C1 lui-même** reste verrouillé tant que son compagnon déclenché
n'est pas fait. Les Tasks 9-12 de ce plan sont donc **abandonnées** au
profit du modèle "verrou dossier entier" ci-dessous. Task 8
(`collectAllTriggeredSlugs`) reste la fondation, réutilisée telle quelle.

## Objectif

1. Publier les 7 formulaires compagnons pour qu'ils apparaissent réellement
   dans le parcours quand déclenchés.
2. Dans un dossier (`bundleRunId` présent) : terminer un formulaire =
   **« Valider »** (payload sauvegardé, aucun PDF généré). Le téléchargement
   individuel, le zip global et l'envoi par mail restent verrouillés tant
   que **tous** les documents requis du dossier — y compris ceux
   nouvellement déclenchés par les réponses données — ne sont pas tous
   complétés.
3. Une fois tout complété, un écran « Mes documents » permet : téléchargement
   individuel par document, téléchargement groupé en zip, ou envoi par mail
   — au choix de l'utilisateur (aucun n'est le mode par défaut imposé).
4. Hors dossier (formulaire ouvert seul, sans `bundleRunId`) : comportement
   inchangé — téléchargement immédiat autorisé, avec une note informative
   non bloquante si le formulaire a des triggers actifs sur le payload
   soumis (cohérent avec le principe déjà en place ailleurs dans l'app :
   "informatif jamais bloquant").
5. Documents "à charge d'un tiers" (A15, évaluations SIP, C4 employeur…) :
   ajouter un lien cliquable optionnel vers une explication externe (ex. A15
   → page Actiris) ; ces documents restent, comme aujourd'hui, hors du calcul
   du verrou (ils ne sont jamais "complétables" dans beldoc).

## Périmètre

**Dans le périmètre :**
- Le mécanisme de verrou est générique (`lib/pdf-forms/triggers.ts` +
  `components/docbel/bundle-runner/compute.ts`), donc actif sur **tous**
  les dossiers utilisant des `PdfFormTrigger` — pas seulement
  `allocations-insertion`. Aucune règle de déclenchement nouvelle n'est
  ajoutée : les 10 `C1_TRIGGERS` existants suffisent.
- Publication des 7 PdfForms compagnons (action admin, pas de nouveau code
  de seed).
- Nouveau mode `delivery: "save"` sur la route generate existante.
- Verrou serveur sur `delivery: "download"/"doccle"` quand `bundleRunId` est
  fourni.
- Écran « Mes documents » : téléchargement individuel (nouvelle route
  légère, relit le payload stocké), zip global (`adm-zip`, déjà une
  dépendance), envoi par mail (Resend, déjà utilisé pour les `.ics` de
  `lib/booking/emails.ts` — même pattern d'attachments `Buffer`).
- `responsibilityUrl` optionnel sur `DossierDocument` (lien cliquable pour
  les documents tiers), utilisé au moins pour l'A15.

**Hors périmètre (différé) :**
- Traduction NL/DE des raisons de triggers (`PdfFormTrigger.reason`) —
  restent FR-only comme aujourd'hui.
- Le DIPLÔME (`c109-36-diplome`) fonctionne déjà comme souhaité
  (`lockUndeclaredFields: true`, identité citoyen seule) — aucun changement.
- Remplissage du DIPLÔME directement par l'école (compte tiers, notification
  école) — évoqué comme vision future par Oraliks, pas dans ce lot.
- Toute nouvelle règle de déclenchement (les 10 existantes suffisent).

## Design détaillé

### Lot 0 — Publier les compagnons (préalable, opérationnel)

Passer `c1a`, `c1b`, `c1c`, `c46`, `c47`, `c1-partenaire`, `c1-regis` en
`status: "published"` (admin UI existante, `/admin/pdf-forms`). Vérifier
qu'aucun n'a de champ bloquant non résolu avant publication (aperçu +
génération de test dans l'éditeur admin). Aucune ligne de code.

**Garde-fou permanent (déjà vrai dans le code actuel, à documenter) :** un
slug déclenché sans PdfForm `published && active` ne compte jamais parmi les
requis du verrou — évite un verrou permanent si un compagnon futur reste en
brouillon par erreur.

### Lot 1 — Logique de verrou partagée + route generate

**`components/docbel/bundle-runner/compute.ts`** : `computeItemStatuses` est
pur, sans dépendance React — réutilisable tel quel côté serveur (import
direct dans la route API) pour calculer `allRequiredDone` à partir de
`(items, completedTemplateIds, payloads, applicableSlugs)`. Pas de
duplication de logique.

**`app/api/pdf/[slug]/generate/route.ts`** :
- Nouveau `delivery: "save"` : valide le payload (comme aujourd'hui), persiste
  dans `BundleRun.payloads`/`completedTemplateIds`, **ne génère pas le PDF**
  (`fillForm` sauté). Réponse : `{ ok: true, newlyTriggered: [{ slug, title, reason }] }`
  — diff entre les slugs déclenchés par le run juste avant et juste après
  cette sauvegarde (calculé via `collectAllTriggeredSlugs`), pour que l'UI
  annonce "Le C1C devient obligatoire".
- Pour `delivery: "download"/"doccle"` **avec un `bundleRunId` fourni** :
  avant `fillForm`, recharger le `BundleRun` + les items du bundle + les
  PdfForms compagnons publiés (même requête que `page.tsx`), calculer
  `allRequiredDone`. Si faux → `409 { error: "dossier incomplet", missing: [{slug, title}] }`
  sans générer de PDF. Sans `bundleRunId` : comportement inchangé (aucune
  vérification, comme aujourd'hui).
- **Propriété du run** : un `bundleRunId` est un cuid, mais reste un
  identifiant qu'il ne faut jamais faire confiance aveuglément — même
  pattern de contrôle que `app/api/documents/bundles/[id]/run/route.ts`
  (PATCH) : `where: userId ? { id: bundleRunId, userId } : { id: bundleRunId, sessionId }`
  avec `sessionId` lu du cookie `beldoc-bundle-session` (httpOnly). Un run
  qui ne matche pas → `404`, jamais de fuite d'existence. Ce contrôle
  s'applique à `delivery: "save"` ET aux 3 nouvelles routes du Lot 3
  (téléchargement individuel, zip, email) — sans lui, connaître/deviner un
  `bundleRunId` suffirait à lire les documents (et l'email) d'un autre
  utilisateur.

### Lot 2 — Runner (pendant le remplissage, `components/pdf-forms/pdf-form-runner.tsx`)

- Si `bundleRunId` présent : le bouton final devient "Valider et continuer
  mon dossier" (`delivery: "save"`), plus "Télécharger".
- Réponse avec `newlyTriggered` non vide → bannière/toast ("Le C1C devient
  obligatoire — Tremplin-indépendants à déclarer") puis redirection vers le
  parcours (`/d/[slug]`) plutôt que l'écran "done/download" actuel.
- Sans `bundleRunId` : comportement inchangé (download/doccle immédiat) ;
  ajout d'une note non bloquante si `activeTriggers(triggers, payload)` est
  non vide au moment du submit ("N'oublie pas de joindre aussi : C1C").

### Lot 3 — Écran « Mes documents » (fin de parcours, `app/d/[slug]/page.tsx` + nouveau composant client)

Nouvelle section, affichée dans le parcours, listant chaque item requis
(de base + déclenché) avec son statut :
- **Verrouillé** (cadenas + liste de ce qui manque) tant que
  `allRequiredDone` est faux.
- **Téléchargement individuel** une fois débloqué : nouvelle route
  `GET/POST /api/documents/bundles/[bundleRunId]/download/[pdfFormId]` qui
  relit le payload déjà stocké dans `BundleRun.payloads`, réapplique
  `fillForm` + bindings (même chemin que la route generate), stream le PDF —
  sans repasser par le formulaire.
- **Tout télécharger (.zip)** : `GET /api/documents/bundles/[bundleRunId]/download-all`,
  régénère chaque PDF requis et les zippe (`adm-zip`), gated par
  `allRequiredDone`.
- **Envoyer par mail** : dialogue destinataire (email libre, ou email de
  session si connecté) → `POST /api/documents/bundles/[bundleRunId]/email`,
  régénère chaque PDF en mémoire, les attache via Resend (pattern identique
  à `sendBookingConfirmed`, `content: Buffer`), envoie, gated par
  `allRequiredDone`, rate-limité (`checkRateLimit`, même mécanisme que la
  route generate), consentement RGPD requis (checkbox déjà existante dans le
  runner, réutilisée).
- **Les 3 routes ci-dessus appliquent le même contrôle de propriété du run**
  que décrit au Lot 1 (`userId`/`sessionId` cookie) — jamais de PDF ni
  d'email servis sur la seule foi d'un `bundleRunId` dans l'URL.
- Les documents "à charge d'un tiers" gardent leur carte séparée actuelle
  (`externalDocuments`), non affectée par le verrou.

### Lot 4 — Polish

- `DossierDocument.responsibilityUrl?: Localized` (type `lib/dossiers/types.ts`) —
  rendu en lien dans la carte "à fournir par un tiers"
  (`components/docbel/bundle-runner.tsx`, section `externalDocuments`).
  Renseigné au moins pour `attestation-inscription-a15` (lien vers la page
  Actiris explicative).
- Notice en direct pendant le remplissage du C1 (`activeTriggers`) —
  annonce qu'une réponse ajoute un document, avant même de valider.

## Risques

- **Reprise de dossiers existants** : un `BundleRun` où le C1 a déjà été
  téléchargé à l'ancienne (avant ce lot) doit rester valide — son
  `completedTemplateIds` contient déjà le C1, le nouveau calcul
  `allRequiredDone` s'applique simplement à partir de maintenant, sans
  migration de données nécessaire.
- **Verrou circulaire** : couvert par le garde-fou Lot 0 (slug non publié =
  jamais requis).
- **Email = nouveau canal vers un tiers (Resend)** : déjà utilisé pour des
  données utilisateur (confirmations de rendez-vous avec PII) — pas une
  nouvelle décision de fond, mais à mentionner dans la politique de
  confidentialité si elle liste les sous-traitants (à vérifier, hors
  périmètre code).
- **Taille des pièces jointes email** : un dossier avec beaucoup de PDF
  compagnons pourrait dépasser les limites Resend — prévoir un garde-fou
  (taille totale, fallback vers "trop volumineux, utilisez le
  téléchargement zip").

## Validation

- `pnpm test` : nouveaux tests sur le calcul du verrou (déjà testé via
  `compute.ts`, cas serveur ajouté), les 3 nouvelles routes (mock Prisma),
  `collectAllTriggeredSlugs` (inchangé, déjà couvert).
- `pnpm build`.
- Manuel : parcours `/d/allocations-insertion`, remplir le C1 avec
  `tremplinIndependants = oui` → vérifier que le C1C apparaît (nécessite Lot
  0 fait), que le C1 seul reste verrouillé, puis compléter le C1C → vérifier
  déblocage des 3 actions (téléchargement individuel / zip / mail) sur
  l'écran final.
