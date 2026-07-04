# Allocations d'insertion — refonte du parcours documents (design)

Statut : validé par Oraliks (2026-07-04), i18n complet volontairement différé.

## Contexte

Le dossier `allocations-insertion` (`lib/dossiers/allocations-insertion/index.ts`) affiche
aujourd'hui, avant la liste des documents, un écran de pré-qualification
(`EligibilityPrequalifier`) avec 9 questions. Seules 3 d'entre elles
(`age`, `parcoursEtudes`, `aTravaille`) déterminent réellement quels documents
apparaissent (`includeWhen`) ; les 6 autres n'alimentent qu'un verdict
informatif, jamais utilisé pour brancher un document.

Séparément, aucun mécanisme ne garantit qu'un document conditionnel rendu
obligatoire par un choix (ex. `parcoursEtudes = secondaire-belge` ⇒
C109/36-DIPLÔME requis) soit réellement complété avant que l'utilisateur
télécharge les documents de base (DEMANDE, C1).

Il existe une **deuxième source** de documents conditionnels, indépendante
de `dossier.questions` : le C1 (déclaration de situation personnelle) porte
déjà, ailleurs dans le code (`lib/pdf-forms/seed/c1-fields-improvements.ts`),
un schéma enrichi complet (`C1_QUESTIONS`, 15 questions oui/non) et 9
déclencheurs (`C1_TRIGGERS`, mécanisme `PdfFormTrigger` déjà implémenté dans
`app/d/[slug]/page.tsx`) qui ajoutent un document supplémentaire selon la
réponse donnée DANS le C1 lui-même (ex. cohabitant financièrement à charge
→ C1-Partenaire ; situation de cohabitation ambiguë → Annexe Regis ;
incapacité 33 % → C47 ; activité accessoire → C1A ; etc.). **Ce schéma
enrichi n'a jamais été appliqué au C1 du dossier insertion** (`c1-insertion`) :
celui-ci n'a aujourd'hui que le NISS mappé, tout le reste est auto-inféré
avec des libellés bruts et zéro trigger actif.

## Objectif

1. Supprimer l'étape "questionnaire" séparée : après l'écran d'explication
   (journey, inchangé), l'utilisateur arrive directement sur l'écran des
   documents.
2. Les 3 questions qui branchent un document restent posées, mais en ligne,
   au-dessus de la liste des documents — jamais comme un écran bloquant à
   part.
3. Les 6 questions purement informatives sont supprimées (contenu déjà
   couvert par les cartes "à savoir" du journey).
4. Le document C109/36-DEMANDE (la soumission finale) reste verrouillé tant
   que le C1, le document conditionnel remplissable de la branche choisie
   (DIPLÔME ou ÉTRANGER, si applicable) et tout document actuellement
   déclenché par les réponses du C1 (C1-Partenaire, Annexe Regis, C47,
   C46, C1A, C1B, C1C) ne sont pas tous complétés.
5. Brancher le schéma C1 enrichi existant (`C1_QUESTIONS` + `C1_TRIGGERS`,
   9 déclencheurs, inchangés) sur `c1-insertion` — aujourd'hui absent.
   Aucun sous-ensemble à choisir : chaque déclencheur se résout
   naturellement selon la réponse individuelle du citoyen (répondre "non"
   à une question ne fait simplement jamais apparaître le document lié).
6. Ajouter une question concrète "Habites-tu en colocation ?" au C1
   (partagée, profite à tous les C1) qui déclenche automatiquement
   l'Annexe Regis avec le code FN4 pré-rempli pour les cohabitants sans
   lien de parenté — évite de faire choisir au citoyen un code qu'il ne
   connaît pas.

## Périmètre

**Dans le périmètre** : dossier `allocations-insertion` uniquement. Nouveau
comportement strictement opt-in — tout autre dossier (chômage temporaire,
formations…) garde `EligibilityPrequalifier` tel quel. Le C1 générique
(hors insertion) et ses 9 déclencheurs existants ne sont pas modifiés — on
les **applique tels quels** à `c1-insertion` (même schéma, même règles,
zéro nouvelle règle de branchement inventée).

**Hors périmètre (explicitement différé)** :
- Traduction des 3 questions survivantes dans les 12 langues (restent
  FR-only, comme aujourd'hui — cf. `NEXT_ACTIONS.md` #19).
- Le moteur de décision d'éligibilité complet décrit dans
  `docbel-agent-allocations-insertion-2026.md` (types `InsertionDecision`,
  34 tests métier, reason codes) — chantier séparé, bien plus large,
  non abordé ici.
- Tout changement à `copie-diplome-superieur`, `c109-36-condition21ans`,
  `c4-reduction-sip` : ce sont des rappels tiers sans PDF remplissable dans
  beldoc, donc rien à verrouiller pour eux.

## Parcours citoyen résultant

Journey (théorie, inchangé) → clic CTA → écran documents affiché
immédiatement. En haut de cet écran, un bloc compact à 3 champs (parcours
d'études / âge / a travaillé). Changer une réponse déclenche un
`router.refresh()` (pas un filtrage instantané côté client — cf. section
suivante) qui recalcule la liste des documents applicables. C1 et le
document de branche (DIPLÔME/ÉTRANGER) sont remplissables tout de suite ;
tout document déclenché par les réponses du C1 apparaît dynamiquement ;
DEMANDE apparaît grisé avec une info-bulle explicative ("Termine d'abord…")
tant que l'un de ces documents n'est pas complété.

## Aiguillage inline — mécanique

- `dossier.questions[]` (`lib/dossiers/allocations-insertion/index.ts`) est
  réduit aux 3 questions branchantes (`age`, `parcoursEtudes`,
  `aTravaille`). Les 6 autres sont supprimées du fichier.
- Nouveau champ opt-in sur `DossierDefinition` (`lib/dossiers/types.ts`) :
  `inlineDocumentQuestions?: boolean`. Si absent/faux :
  comportement actuel inchangé (gate plein-écran). Si vrai : `BundleRunner`
  n'affiche jamais `EligibilityPrequalifier` en gate, montre la section
  documents immédiatement, et rend les mêmes questions dans un contrôle
  compact au-dessus de la liste.
- Le filtrage reste **serveur** (réutilise le mécanisme existant : réponses
  persistées sur le `BundleRun` via l'API déjà utilisée par "Modifier mes
  réponses", puis `router.refresh()` recalcule `selectDocuments()` côté
  serveur dans `app/d/[slug]/page.tsx`). Pas de filtrage 100% client, car
  `includeWhen` est une fonction serveur non sérialisable (même contrainte
  déjà documentée pour `journey.ts`). Conséquence assumée : la mise à jour
  de la liste n'est pas instantanée, mais correspond à une UX déjà existante
  dans ce composant.
- Aucun autre dossier n'est impacté (flag opt-in, absent partout ailleurs).

## Brancher le C1 enrichi sur `c1-insertion` (mécanisme existant, jamais câblé)

- `applyC1Improvements()` + `C1_TRIGGERS` (`lib/pdf-forms/seed/c1-fields-improvements.ts`)
  existent déjà et sont utilisés pour le C1 générique via
  `scripts/apply-c1-improvements.ts`. Ils ne sont **pas modifiés** par ce
  chantier — seulement appliqués, tels quels, au PdfForm `c1-insertion`.
- Bug à corriger dans `scripts/apply-c1-improvements.ts` : il cible "le
  PdfForm le plus récemment modifié dont `sourceFileName` contient
  `C1_FR`" plutôt qu'un slug explicite. Comme `c1-insertion` partage le
  même fichier source (`C1_FR.pdf`) que le C1 générique, le script risque
  de mettre à jour le mauvais PdfForm selon l'ordre des mises à jour. À
  corriger pour cibler une liste de slugs explicite (`c1`, `c1-insertion`,
  et tout futur C1 par dossier), appliqué à chacun.
- Une fois branché, les 7 sous-formulaires "compagnons" déjà décrits
  (`c1a`, `c1b`, `c1c`, `c46`, `c1-partenaire`, `c47`, `c1-regis` — cf.
  `scripts/seed-c1-companion-forms.ts`, dont le commentaire dit à tort
  "cinq" alors que le tableau en liste 7) doivent exister en DB (vérifier
  qu'ils sont bien seedés en prod, pas seulement décrits dans le script).
- Comportement attendu, inchangé par rapport au mécanisme déjà en place
  ailleurs : dès que le citoyen répond dans `c1-insertion` d'une façon qui
  déclenche un trigger (ex. "oui" à activité accessoire, sans "déjà
  déclaré"), le document compagnon apparaît dans la liste du dossier
  (`triggeredForms` dans `app/d/[slug]/page.tsx`, déjà fonctionnel) —
  marqué obligatoire. Rien à coder ici pour l'apparition elle-même ;
  uniquement pour le verrou de téléchargement (section suivante).

### Amélioration ciblée : colocation → Annexe Regis (code FN4)

Source : capture d'écran Oraliks de la page 2 de l'Annexe Regis (légende des
codes + exemple rempli). Amélioration du fichier partagé
`c1-fields-improvements.ts` — profite à **tous** les C1 (pas seulement
`c1-insertion`), cohérent avec le choix de faire ça dans ce même lot.

- **Nouvelle question** dans `C1_QUESTIONS`, concrète et compréhensible :
  "Habites-tu en colocation ?" — remplace le rôle principal de l'actuelle
  `situationCohabitationAmbigue` pour ce cas précis (mais cette dernière
  reste utile telle quelle pour les *autres* cas ambigus déjà couverts —
  domiciliation ≠ résidence, hébergement temporaire chez un tiers… — donc
  **on garde les deux questions**, chacune sur son cas).
- Règle (à dériver de la grille `cohabitants` déjà saisie, sans redemander
  les noms) :
  - Colocation = "oui" ET au moins un cohabitant a `lien: "aucun-lien"`
    (pas de lien de parenté) → ce(s) cohabitant(s) comptent comme
    "isolé"/pas de ménage commun du point de vue ONEM, **même s'ils
    habitent réellement sous le même toit**. Déclenche l'Annexe Regis
    (`c1-regis`).
  - Si un cohabitant listé a un lien de parenté réel (même si le citoyen
    a répondu "colocation" par méprise du terme) → pas "isolé", c'est un
    cohabitant normal ; pas de FN4/Annexe Regis pour cette personne
    précise via cette règle.
- **Pré-remplissage automatique de l'Annexe Regis** (au lieu de redemander
  au citoyen de choisir un code qu'il ne connaît pas) : pour chaque
  cohabitant `lien: "aucun-lien"` déjà nommé dans la grille C1, la
  Grille 1 de l'Annexe Regis est marquée "différence : oui" et la
  Grille 2 pré-remplie avec le code **FN4** — c'est exactement le cas que
  ce code couvre ("il est possible que cette personne soit à juste titre
  inscrite à la même adresse... je ne règle cependant pas les questions
  ménagères avec elle"). Les codes N1/N2 (nationalité) et A1-A5/A2-A5
  (adresse) de la même légende ne sont PAS dans ce périmètre — hors sujet
  colocation, non traités ici.
- ⚠️ Le PdfForm `c1-regis` existe seulement en `draft`, jamais enrichi
  (champs bruts auto-inférés depuis `Annexe_Regis_FR.pdf`). Mapper
  précisément la Grille 1 / Grille 2 sur les vrais noms de widgets PDF est
  un travail d'implémentation (même démarche que pour le C1 : inspecter
  l'AcroForm réel), pas quelque chose à figer ici dans la spec.

## Verrou de téléchargement — mécanique (généralisée)

Deux sources indépendantes peuvent rendre un document obligatoire : le
branchement du dossier (`parcoursEtudes` → DIPLÔME/ÉTRANGER) et les
déclencheurs internes du C1 (`C1_TRIGGERS` → C1-Partenaire, Annexe Regis,
C47, C46, C1A, C1B, C1C). Un seul document du dossier joue le rôle de
"soumission finale" et doit donc attendre les deux sources : **DEMANDE**.
Tous les autres documents restent librement remplissables dès qu'ils sont
visibles — sinon on retombe dans un verrou circulaire.

```
C1 (aucun prérequis, à remplir en premier)
 └─ déclenche (selon ses propres réponses) → C1-Partenaire / Annexe Regis /
    C47 / C46 / C1A / C1B / C1C (aucun prérequis une fois déclenchés)
DIPLÔME ou ÉTRANGER (aucun prérequis, dépend de `parcoursEtudes`)
                                                                    ↘
                                                    DEMANDE (verrouillé tant que
                                                    C1 + le document de branche
                                                    applicable + tous les
                                                    documents actuellement
                                                    déclenchés ne sont pas
                                                    tous complétés)
```

- Nouveau champ opt-in sur `DossierDocument` (`lib/dossiers/types.ts`) :
  `gatedByRestOfDossier?: boolean` — posé uniquement sur `c109-36-demande`.
  (Alternative envisagée et écartée : verrouiller aussi C1 — mais C1 est
  précisément le document qui *produit* les déclencheurs ; il doit rester
  libre pour que le reste du dossier puisse même se déterminer.)
- Règle précise pour ce document :
  1. `c1-insertion` pas encore dans `completedTemplateIds` → verrouillé.
  2. `parcoursEtudes` **sans réponse** → verrouillé par défaut (même
     raisonnement que dans la version précédente de cette section : un
     citoyen qui ignore l'aiguillage ne doit pas pouvoir soumettre sans
     avoir été aiguillé vers DIPLÔME/ÉTRANGER).
  3. `parcoursEtudes` répondu et implique un document conditionnel
     remplissable (`secondaire-belge` → DIPLÔME, `etranger`/`autre` →
     ÉTRANGER) et ce document n'est pas encore dans `completedTemplateIds`
     → verrouillé.
  4. Au moins un document actuellement déclenché par le C1 (calculé avec
     la même logique que `triggeredSlugs` dans `app/d/[slug]/page.tsx`)
     n'est pas encore dans `completedTemplateIds` → verrouillé.
  5. Si aucune des conditions 1 à 4 ne s'applique → déverrouillé.
  Un document déjà dans `completedTemplateIds` ne se re-verrouille jamais
  rétroactivement (changement de branche après coup, nouveau trigger
  apparu après une modification du C1 — on ne pénalise pas un travail déjà
  fait, mais DEMANDE lui-même redevient verrouillé si on tente de le
  re-générer avant d'avoir rattrapé les nouveaux documents requis).
- La logique "quels documents sont actuellement déclenchés" (aujourd'hui
  dupliquée uniquement dans `app/d/[slug]/page.tsx`) doit être extraite en
  fonction pure partagée (ex. dans `lib/pdf-forms/triggers.ts`) pour être
  réutilisée par la route `generate` sans dupliquer la logique.
- Appliqué à deux niveaux :
  1. **UI** (`components/docbel/bundle-runner/compute.ts` +
     `components/docbel/bundle-runner.tsx`) : statut dérivé `locked` sur
     l'item DEMANDE, bouton désactivé + message listant ce qu'il reste à
     compléter (ex. "Termine d'abord C109/36-DIPLÔME et C1A").
  2. **Serveur** (`app/api/pdf/[slug]/generate/route.ts`) : avant de
     streamer le PDF de DEMANDE, si `bundleRunId` est fourni, résout le
     dossier + le run, recalcule les documents applicables et les
     documents déclenchés, et rejette (409) si l'un d'eux manque à
     `completedTemplateIds`. Nécessaire pour que le verrou soit une vraie
     garantie et pas seulement cosmétique côté client.

## Ce qui ne change pas

- `EligibilityPrequalifier` et `dossierQuestionsToEligibility` restent
  utilisés tels quels par tous les autres dossiers.
- `DossierJourneyIntro`, `BundleRoadmap`, `selectDocuments`/`includeWhen` :
  logique inchangée.
- Les 7 tests existants de branchement
  (`lib/dossiers/__tests__/insertion-documents.test.ts`) ne sont pas
  affectés (le branchement lui-même ne change pas, seule la façon dont les
  réponses sont collectées et affichées change).

## Découpage en lots d'implémentation

**Lot 1 — Aiguillage inline** (4 fichiers) : `lib/dossiers/types.ts`,
`lib/dossiers/allocations-insertion/index.ts` (questions 9→3),
`components/docbel/bundle-runner.tsx`, `app/d/[slug]/page.tsx`.

**Lot 2 — Brancher le C1 enrichi** (2-3 fichiers) :
`scripts/apply-c1-improvements.ts` (fix : cibler des slugs explicites au
lieu du "plus récent"), vérification/complément de
`scripts/seed-c1-companion-forms.ts` (les 7 compagnons doivent exister en
DB), exécution du script corrigé sur `c1-insertion` en prod. Aucun fichier
de règles métier modifié (`C1_QUESTIONS`/`C1_TRIGGERS` réutilisés tels
quels).

**Lot 3 — Verrou de téléchargement sur DEMANDE** (5-6 fichiers) :
`lib/dossiers/types.ts` (nouveau champ), `lib/dossiers/allocations-insertion/index.ts`
(flag sur `c109-36-demande`), `lib/pdf-forms/triggers.ts` (extraction de la
fonction partagée "documents actuellement déclenchés"),
`components/docbel/bundle-runner/compute.ts` (+ tests),
`components/docbel/bundle-runner.tsx` (UI), `app/api/pdf/[slug]/generate/route.ts`.

## Tests

- Nouveaux tests unitaires purs pour la fonction de calcul du statut
  `locked` de DEMANDE (extension de `compute.ts`, même style que
  `computeItemStatuses`), couvrant les 5 cas de la règle (C1 non fait,
  parcours sans réponse, document de branche manquant, document déclenché
  manquant, tout complet).
- Nouveau test pour la fonction partagée "documents actuellement
  déclenchés" (extraite de `app/d/[slug]/page.tsx` vers
  `lib/pdf-forms/triggers.ts`).
- Nouveau test pour le rejet serveur (409) dans la route `generate` quand
  DEMANDE est tenté avant que tout soit complété.
- Vérifier que `c1-insertion` reçoit bien les 9 triggers + le schéma enrichi
  après le Lot 2 (test manuel ou script de vérification, pas nécessairement
  un test automatisé vu que ça dépend d'un état DB).
- Vérifier que `lib/dossiers/__tests__/dossier.test.ts` et
  `insertion-documents.test.ts` restent verts (aucune assertion attendue
  sur le nombre de questions, à confirmer en implémentation).
- Validation globale : `pnpm test`, `pnpm build`.

## Écrans à vérifier manuellement

`/d/allocations-insertion` : journey → documents direct (plus de gate) →
répondre "oui" à une question C1 qui déclenche un compagnon (ex. activité
accessoire → C1A) sans "déjà déclaré" → C1A apparaît dans la liste, marqué
obligatoire → tenter de télécharger DEMANDE : doit être bloqué tant que
C1A n'est pas fait, même si C1 lui-même est déjà téléchargé → compléter
C1A → sans répondre à "parcours d'études", DEMANDE doit rester verrouillé
→ répondre "secondaire-belge" met à jour la liste (DIPLÔME apparaît) →
compléter DIPLÔME → DEMANDE se débloque enfin → changer pour
"superieur-belge" doit déverrouiller DEMANDE immédiatement (pas de PDF
DIPLÔME/ÉTRANGER à attendre pour cette branche).
