# Couverture de l'aide de champ — C1 (changement de situation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traiter les 29 champs sans `help` du C1 — cinquième document du
chantier, le plus riche après C1A. 4 champs reçoivent une vraie aide (les
dates génériques « À partir du » du moule `dateAPartirDu`, dont le label seul
ne dit pas à quoi la date se réfère) ; les 25 autres sont déjà
auto-explicatifs (label/options recopiés fidèlement) et documentés comme tels.

**Architecture:** Contenu sourcé, pas de code
(`docs/superpowers/specs/2026-08-04-couverture-aide-de-champ-design.md`).
Répartition en 5 tâches par fichier seed touché.

**Tech Stack:** aucun — édition de
`lib/pdf-forms/seed/c1/{identite,motif,activites,paiement,final}.ts`.

## Global Constraints

- Aucun texte inventé, source `private/pdfs/C1_FR.pdf` (extraction
  markitdown, 2026-08-04).
- **Réserve importante** : le PDF affiche « oui → allez à la rubrique
  suivante » sur `statutRefugie` et `apatrideReconnu`, mais le `visibleIf` de
  `accesMarcheTravail` (dans `final.ts`) ne dépend QUE de `nationaliteHorsEEE`
  — pas de ces deux champs. Le comportement de saut décrit sur le papier
  n'est donc **pas implémenté** dans le runner actuel. Écrire une aide qui
  affirme « vous pouvez vous arrêter là » serait trompeur (l'écran continue
  de poser la question suivante). **Ces deux champs restent sans `help`** —
  la divergence papier/runtime est hors périmètre de ce lot de contenu, à
  signaler séparément à Oraliks (cf. Task 6).
- Le moule `dateAPartirDu()` (`lib/pdf-forms/seed/_shared/moules.ts:102`) a un
  `label` fixe (« À partir du ») sans paramètre `help`. Pour les 4 dates qui
  en ont besoin, on **surcharge par spread** (`{ ...dateAPartirDu({...}),
  help: {...} }`) — patron déjà utilisé dans `activites.ts` (`dejaDeclare` +
  `stepPriority` surchargé, ligne ~100-109). On ne touche pas au moule
  partagé lui-même : d'autres appels n'ont pas besoin de `help`.
- `git add` de chemin explicite uniquement.
- Commandes de validation par tâche : `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts` · `pnpm build` · `pnpm lint`.

---

### Task 1: `identite.ts` — 4 champs identité/adresse triviaux

**Files:** Modify `lib/pdf-forms/seed/c1/identite.ts`

- [ ] **Step 1: `nom`**

```ts
    id: "nom",
    pdfFieldName: "Nom",
    type: "text",
    required: true,
    label: { fr: "Nom" },
    prefillFrom: "profile.lastName",
```
devient
```ts
    id: "nom",
    pdfFieldName: "Nom",
    type: "text",
    required: true,
    label: { fr: "Nom" },
    // Pas de `help` : aucun texte imprimé propre à ce champ (audit
    // couverture aide de champ, 2026-08-04).
    prefillFrom: "profile.lastName",
```

- [ ] **Step 2: `pr_nom`**

```ts
    id: "pr_nom",
    pdfFieldName: "Prenom",
    type: "text",
    required: true,
    label: { fr: "Prénom" },
    prefillFrom: "profile.firstName",
```
devient
```ts
    id: "pr_nom",
    pdfFieldName: "Prenom",
    type: "text",
    required: true,
    label: { fr: "Prénom" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    prefillFrom: "profile.firstName",
```

- [ ] **Step 3: `code_postal`**

```ts
    id: "code_postal",
    pdfFieldName: "",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal" },
    placeholder: { fr: "1000" },
```
devient
```ts
    id: "code_postal",
    pdfFieldName: "",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    placeholder: { fr: "1000" },
```

- [ ] **Step 4: `num_ro`**

```ts
    id: "num_ro",
    pdfFieldName: "Numero",
    type: "text",
    required: true,
    label: { fr: "Numéro" },
    canonicalKey: "adresse.numero",
```
devient
```ts
    id: "num_ro",
    pdfFieldName: "Numero",
    type: "text",
    required: true,
    label: { fr: "Numéro" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    canonicalKey: "adresse.numero",
```

- [ ] **Step 5: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`
Expected: PASS.

```bash
git add lib/pdf-forms/seed/c1/identite.ts
git commit -m "content(pdf-forms): couverture aide de champ C1 (1/5) — identité/adresse documentés sans aide"
```

---

### Task 2: `motif.ts` — 4 chips de modification + date de création

**Files:** Modify `lib/pdf-forms/seed/c1/motif.ts`

- [ ] **Step 1: `modificationAdresse`**

```ts
    id: "modificationAdresse",
    pdfFieldName: "mon adresse à partir du",
    type: "checkbox",
    required: false,
    label: { fr: "Modification d'adresse" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 5,
    renderAs: "chip",
  },
```
devient
```ts
    id: "modificationAdresse",
    pdfFieldName: "mon adresse à partir du",
    type: "checkbox",
    required: false,
    label: { fr: "Modification d'adresse" },
    // Pas de `help` : le label recopie fidèlement la case imprimée, une des
    // 5 situations du bloc « je déclare une modification concernant ».
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 5,
    renderAs: "chip",
  },
```

- [ ] **Step 2: `modificationCompte`**

```ts
    id: "modificationCompte",
    pdfFieldName: "le mode de paiement de mes allocations ou mon numéro de compte6",
    type: "checkbox",
    required: false,
    label: { fr: "Modification du compte bancaire" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 6,
    renderAs: "chip",
  },
```
devient
```ts
    id: "modificationCompte",
    pdfFieldName: "le mode de paiement de mes allocations ou mon numéro de compte6",
    type: "checkbox",
    required: false,
    label: { fr: "Modification du compte bancaire" },
    // Pas de `help` : label fidèle à la case imprimée (cf. modificationAdresse).
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 6,
    renderAs: "chip",
  },
```

- [ ] **Step 3: `modificationSituationFamiliale`**

```ts
    id: "modificationSituationFamiliale",
    pdfFieldName: "ma situation personnelle ou celle des membres de mon ménage 7",
    type: "checkbox",
    required: false,
    label: { fr: "Modification de situation familiale" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 7,
    renderAs: "chip",
  },
```
devient
```ts
    id: "modificationSituationFamiliale",
    pdfFieldName: "ma situation personnelle ou celle des membres de mon ménage 7",
    type: "checkbox",
    required: false,
    label: { fr: "Modification de situation familiale" },
    // Pas de `help` : label fidèle à la case imprimée (cf. modificationAdresse).
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 7,
    renderAs: "chip",
  },
```

- [ ] **Step 4: `modificationPermisSejour`**

```ts
    id: "modificationPermisSejour",
    pdfFieldName: "mon permis de séjour ou mon permis de travail",
    type: "checkbox",
    required: false,
    label: { fr: "Modification du permis de séjour" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 8,
    renderAs: "chip",
  },
```
devient
```ts
    id: "modificationPermisSejour",
    pdfFieldName: "mon permis de séjour ou mon permis de travail",
    type: "checkbox",
    required: false,
    label: { fr: "Modification du permis de séjour" },
    // Pas de `help` : label fidèle à la case imprimée (cf. modificationAdresse).
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 8,
    renderAs: "chip",
  },
```

- [ ] **Step 5: `dateCreationDossier`**

```ts
    id: "dateCreationDossier",
    pdfFieldName: "DateDeCréationDocument",
    type: "date",
    required: false,
    label: { fr: "Date de création du document" },
    prefillFrom: "system.today",
```
devient
```ts
    id: "dateCreationDossier",
    pdfFieldName: "DateDeCréationDocument",
    type: "date",
    required: false,
    label: { fr: "Date de création du document" },
    // Pas de `help` : champ auto-rempli (`system.today`) et jamais rendu à
    // l'écran (`isCreationDateField`) — le citoyen ne le voit jamais.
    prefillFrom: "system.today",
```

- [ ] **Step 6: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`

```bash
git add lib/pdf-forms/seed/c1/motif.ts
git commit -m "content(pdf-forms): couverture aide de champ C1 (2/5) — motifs de modification documentés sans aide"
```

---

### Task 3: `activites.ts` — 3 vraies aides sur les dates génériques

**Files:** Modify `lib/pdf-forms/seed/c1/activites.ts`

- [ ] **Step 1: `etudesPleinExerciceDate`**

```ts
  dateAPartirDu({
    id: "etudesPleinExerciceDate",
    pdfFieldName: "DateEtudes",
    parentId: "etudesPleinExercice",
    section: SECTION_ACTIVITES,
    order: 201,
  }),
```
devient
```ts
  {
    // Le moule `dateAPartirDu` pose un label générique (« À partir du ») —
    // help ajoutée pour rappeler le sujet, son label ne le dit pas seul.
    ...dateAPartirDu({
      id: "etudesPleinExerciceDate",
      pdfFieldName: "DateEtudes",
      parentId: "etudesPleinExercice",
      section: SECTION_ACTIVITES,
      order: 201,
    }),
    help: { fr: "Date à partir de laquelle vous suivez ces études de plein exercice." },
  },
```

- [ ] **Step 2: `apprentissageAlternanceDate`**

```ts
  dateAPartirDu({
    id: "apprentissageAlternanceDate",
    pdfFieldName: "DateFormation",
    parentId: "apprentissageAlternance",
    section: SECTION_ACTIVITES,
    order: 211,
  }),
```
devient
```ts
  {
    ...dateAPartirDu({
      id: "apprentissageAlternanceDate",
      pdfFieldName: "DateFormation",
      parentId: "apprentissageAlternance",
      section: SECTION_ACTIVITES,
      order: 211,
    }),
    help: {
      fr: "Date à partir de laquelle vous suivez cet apprentissage ou cette formation en alternance.",
    },
  },
```

- [ ] **Step 3: `formationStageSyntraDate`**

```ts
  dateAPartirDu({
    id: "formationStageSyntraDate",
    pdfFieldName: "DateFormationStageSyntraIfapmeEpepmeIawm",
    parentId: "formationStageSyntra",
    section: SECTION_ACTIVITES,
    order: 221,
  }),
```
devient
```ts
  {
    ...dateAPartirDu({
      id: "formationStageSyntraDate",
      pdfFieldName: "DateFormationStageSyntraIfapmeEpepmeIawm",
      parentId: "formationStageSyntra",
      section: SECTION_ACTIVITES,
      order: 221,
    }),
    help: { fr: "Date à partir de laquelle vous suivez cette formation avec convention de stage." },
  },
```

- [ ] **Step 4: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`

```bash
git add lib/pdf-forms/seed/c1/activites.ts
git commit -m "content(pdf-forms): couverture aide de champ C1 (3/5) — 3 dates génériques précisées (études/alternance/stage)"
```

---

### Task 4: `paiement.ts` — 3 champs déjà auto-explicatifs

**Files:** Modify `lib/pdf-forms/seed/c1/paiement.ts`

- [ ] **Step 1: `modePaiementChequeWarning`**

Localiser le champ `modePaiementChequeWarning` (case de confirmation dont le
label est déjà la phrase complète : « Je confirme avoir compris que le
chèque circulaire est rare et plus lent à la réception… »). Ajouter juste
après son `label` :

```ts
    // Pas de `help` distinct : le label EST déjà la phrase de confirmation
    // complète — rien à ajouter sans la répéter.
```

- [ ] **Step 2: `titulaireCompte`**

Localiser le champ `titulaireCompte` (« Le compte bancaire est à mon nom ? »,
radio oui/non). Ajouter après son `label` :

```ts
    // Pas de `help` : la question et ses deux options recopient fidèlement
    // le texte imprimé.
```

- [ ] **Step 3: `titulaireCompteNom`**

Localiser le champ `titulaireCompteNom` (« Nom et prénom du propriétaire du
compte », visible si `titulaireCompte === "autre-nom"`). Ajouter après son
`label` :

```ts
    // Pas de `help` : aucun texte imprimé propre à ce champ.
```

- [ ] **Step 4: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`

```bash
git add lib/pdf-forms/seed/c1/paiement.ts
git commit -m "content(pdf-forms): couverture aide de champ C1 (4/5) — mode de paiement documenté sans aide"
```

---

### Task 5: `final.ts` — statut hors EEE, congé, affirmations, annexes

**Files:** Modify `lib/pdf-forms/seed/c1/final.ts`

- [ ] **Step 1: `statutRefugie`, `apatrideReconnu` — AUCUNE modification**

Cf. Global Constraints : réserve sur la divergence papier/runtime. Ne pas
ajouter de `help`. Étape de vérification seulement (lecture, pas d'édition).

- [ ] **Step 2: `congeSansSolde`**

```ts
  ouiNon({
    id: "congeSansSolde",
    pdfFieldName: "oui du|non_20",
    label: "Je suis actuellement dans une période de congé sans solde",
    section: SECTION_DIVERS,
    order: 900,
  }),
```
devient
```ts
  ouiNon({
    id: "congeSansSolde",
    pdfFieldName: "oui du|non_20",
    label: "Je suis actuellement dans une période de congé sans solde",
    // Pas de `help` : le label EST déjà la question complète imprimée.
    section: SECTION_DIVERS,
    order: 900,
  }),
```

- [ ] **Step 3: `congeSansSoldeDate` — vraie aide (4e et dernière)**

```ts
  dateAPartirDu({
    id: "congeSansSoldeDate",
    pdfFieldName: "Date11_af_date",
    parentId: "congeSansSolde",
    section: SECTION_DIVERS,
    order: 901,
  }),
```
devient
```ts
  {
    // Cohérent avec son jumeau `congeSansSoldeDateFin` (« Jusqu'au »,
    // help déjà présente juste en dessous) — celui-ci précise le début.
    ...dateAPartirDu({
      id: "congeSansSoldeDate",
      pdfFieldName: "Date11_af_date",
      parentId: "congeSansSolde",
      section: SECTION_DIVERS,
      order: 901,
    }),
    help: { fr: "Date de début du congé sans solde." },
  },
```

- [ ] **Step 4: `affirmationSincerite`, `affirmationLectureNotice`, `affirmationModifications`**

Pour chacune des 3 (leur `label` est déjà la déclaration légale complète,
recopiée mot pour mot du PDF), ajouter après le `label` :

```ts
    // Pas de `help` : le label EST la déclaration légale complète imprimée
    // — rien à ajouter sans la répéter.
```

- [ ] **Step 5: 6 annexes (`annexeHandicap`, `annexeExtraitPension`,
  `annexeC1Regis`, `annexePermisSejour`, `annexeAutre`,
  `annexeAutreDescription`)**

Les 5 premières sont produites par `annexeJointe(...)` — leur libellé est le
nom exact du document imprimé sur le PDF. `annexeAutreDescription` est un
champ texte trivial. Pour chacune, en s'appuyant sur le patron de spread déjà
utilisé (Task 3), ajouter un commentaire — **pas de `help`** (le nom du
document EST l'explication) :

```ts
  {
    ...annexeJointe({
      id: "annexeHandicap",
      pdfFieldName: "une attestation de la DG Personnes handicapées du SPF Sécurité sociale",
      order: 1100,
    }),
    // Pas de `help` : le libellé nomme déjà exactement le document attendu.
  },
```

Répéter pour `annexeExtraitPension`, `annexeC1Regis`, `annexePermisSejour`,
`annexeAutre` (même patron, même commentaire). Pour `annexeAutreDescription` :

```ts
    label: { fr: "Description du document joint" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
```

- [ ] **Step 6: `transfereOrganismePaiement`**

Champ virtuel (aucune case PDF propre — construction Docbel, pas du papier).
Localiser `TRANSFERE_ORGANISME_FIELD` (fichier `overlay.ts`, PAS `final.ts` —
vérifier son emplacement exact avant d'éditer) et ajouter :

```ts
  label: { fr: "Je transfère mon dossier vers un autre organisme de paiement" },
  // Pas de `help` : champ synthétique Docbel (pas de case PDF propre), déjà
  // nommé explicitement.
```

- [ ] **Step 7: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`

```bash
git add lib/pdf-forms/seed/c1/final.ts lib/pdf-forms/seed/c1/overlay.ts
git commit -m "content(pdf-forms): couverture aide de champ C1 (5/5) — statut hors EEE, congé, affirmations, annexes"
```

---

### Task 6: Audit réglementaire (les 4 vraies aides) + validation finale + suivi

**Files:** `docs/tasks/NEXT_ACTIONS.md` (note de suivi)

- [ ] **Step 1: `/verif-reglementation` ciblé sur les 4 dates**

Cibler les 4 champs avec un vrai nouveau texte (`etudesPleinExerciceDate`,
`apprentissageAlternanceDate`, `formationStageSyntraDate`,
`congeSansSoldeDate`). Les 25 autres sont des commentaires justifiant une
absence — pas de nouvelle affirmation au citoyen.

- [ ] **Step 2: Suite complète + build + lint**

Run: `pnpm test && pnpm build && pnpm lint`

- [ ] **Step 3: Note de suivi — divergence statutRefugie/apatrideReconnu**

Ajouter une ligne dans `docs/tasks/NEXT_ACTIONS.md` (prochain `#` disponible) :

```
| # | P3 | Dette | **Le C1 imprime « oui → allez à la rubrique suivante » sur `statutRefugie`/`apatrideReconnu`, mais le runner pose quand même la question d'accès au marché du travail ensuite** (`accesMarcheTravail` ne dépend que de `nationaliteHorsEEE`). Décalage papier/écran repéré en documentant l'aide de champ (2026-08-04), pas corrigé dans ce lot | `lib/pdf-forms/seed/c1/final.ts` | Faible (pas de case blanche, juste une question en trop) | parcours C1 étape hors-EEE | **Oraliks** — décider si le saut doit être implémenté |
```

- [ ] **Step 4: Commit + push**

```bash
git add docs/tasks/NEXT_ACTIONS.md
git commit -m "docs(pdf-forms): #NN — divergence statutRefugie/apatrideReconnu repérée en documentant l'aide de champ C1"
git push
```

---

## Self-review

Les 29 champs de l'audit sont traités : 4 vraies aides ajoutées (dates
génériques du moule partagé, cohérentes avec leur question mère), 25
documentés comme volontairement sans aide. Une divergence fonctionnelle
repérée en chemin (statutRefugie/apatrideReconnu) est signalée séparément
plutôt que risquer une aide trompeuse ou corriger silencieusement une
logique hors du périmètre de ce lot de contenu.
