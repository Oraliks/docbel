# Couverture de l'aide de champ — C1A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Documenter les 76 champs sans `help` du C1A (78 identifiés à
l'audit initial, moins `employeurNom`/`employeurAdresse` déjà comblés au
chantier « autofill employeur BCE »). Huitième et dernier document du
chantier. **Aucun des 76 champs n'a besoin d'un nouveau texte** : la grille
horaire (48 champs) est déjà couverte par sa question mère bien documentée,
et le reste (28 champs) est soit trivial, soit déjà signalé comme ambiguïté
consciente à trancher par Oraliks (`descriptionAide1`, `revenuAnnuelMandat2`)
— je ne dois rien inventer pour combler ces deux-là.

**Architecture:** Contenu (documentation d'absence), pas de code fonctionnel
nouveau (`docs/superpowers/specs/2026-08-04-couverture-aide-de-champ-design.md`).
La factory partagée `grilleHoraire()` (`lib/pdf-forms/seed/c1a-fields.ts:110-309`)
génère les DEUX grilles (Q4 et Q18) — 6 édits dans son corps couvrent les 44
checkboxes des deux grilles à la fois, au lieu de 44 sites séparés.

## Global Constraints

- Vérifié sur `private/pdfs/C1A_FR.pdf` : chaque case de la grille horaire
  (lundi/mardi/…/avant 7h/entre 7h et 18h/après 18h) porte un texte imprimé
  **identique et répété** — le label (nom du jour ou de la tranche) est déjà
  toute l'information.
- **Ne pas toucher** aux deux zones déjà signalées « A VALIDER Oraliks » dans
  le code (`descriptionAide1` ligne ~713, `revenuAnnuelMandat2` ligne ~909) :
  ce sont des décisions déjà pesées et documentées, pas des oublis. Les
  laisser sans aide, avec un commentaire qui les CONFIRME plutôt que de les
  reformuler.
- Aucun texte inventé : les 76 champs restent sans `help`, chacun avec une
  justification précise en commentaire.
- `git add` de chemin explicite uniquement.
- Commandes de validation : `pnpm vitest run lib/pdf-forms/seed/__tests__/c1a-fields.test.ts` · `pnpm build` · `pnpm lint`.

---

### Task 1: Identité + Q1-Q2 (7 champs)

**Files:** Modify `lib/pdf-forms/seed/c1a-fields.ts`

`nomEtPrenom`, `rue`, `numero`, `codePostal`, `commune` (identité, triviaux),
`independantNom`, `independantAdresseCodePostalCommune` (Q1-Q2, triviaux).

- [ ] **Step 1 à 7** : pour chacun, ajouter après son `label` :
```ts
    // Pas de `help` : aucun texte imprimé propre à ce champ.
```

- [ ] **Step 8: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1a-fields.test.ts`

```bash
git add lib/pdf-forms/seed/c1a-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1A (1/5) — identité et Q1-Q2 documentés sans aide"
```

---

### Task 2: Grille horaire — 6 édits dans la factory partagée (44 champs des 2 grilles)

**Files:** Modify `lib/pdf-forms/seed/c1a-fields.ts` (fonction `grilleHoraire`, lignes ~110-309)

Chaque édit ci-dessous couvre **les deux grilles à la fois** (Q4 « aide
l'indépendant » et Q18 « exercice de l'activité ») puisqu'elles partagent la
même factory.

- [ ] **Step 1: case « jour »**

```ts
      label: { fr: jour.charAt(0).toUpperCase() + jour.slice(1) },
      visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
      section: opts.section,
      order: ordre(),
      // Regroupement PRÉSENTATIONNEL en tableau (cf. types.ts) : ce champ est
      // la case "jour" de sa ligne — rendue dans la cellule de tête avec son
      // propre libellé (le nom du jour), pas une colonne de créneau.
      scheduleGrid: { row: jour },
    });
```
devient (ajout d'une ligne, juste avant `visibleIf`) :
```ts
      label: { fr: jour.charAt(0).toUpperCase() + jour.slice(1) },
      // Pas de `help` : le nom du jour EST déjà toute l'information.
      visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
      section: opts.section,
      order: ordre(),
      // Regroupement PRÉSENTATIONNEL en tableau (cf. types.ts) : ce champ est
      // la case "jour" de sa ligne — rendue dans la cellule de tête avec son
      // propre libellé (le nom du jour), pas une colonne de créneau.
      scheduleGrid: { row: jour },
    });
```

- [ ] **Step 2: case « Avant 7 h »**

```ts
      label: { fr: "Avant 7 h" },
      section: opts.section,
      order: ordre(),
      scheduleGrid: { row: jour, col: "avant7h" },
    });
```
devient
```ts
      label: { fr: "Avant 7 h" },
      // Pas de `help` : la tranche horaire EST déjà toute l'information.
      section: opts.section,
      order: ordre(),
      scheduleGrid: { row: jour, col: "avant7h" },
    });
```

- [ ] **Step 3: case « Entre 7 h et 18 h »**

```ts
      label: { fr: "Entre 7 h et 18 h" },
      section: opts.section,
      order: ordre(),
      scheduleGrid: { row: jour, col: "entre7h18h" },
    });
```
devient
```ts
      label: { fr: "Entre 7 h et 18 h" },
      // Pas de `help` : la tranche horaire EST déjà toute l'information.
      section: opts.section,
      order: ordre(),
      scheduleGrid: { row: jour, col: "entre7h18h" },
    });
```

- [ ] **Step 4: case « Après 18 h »**

```ts
      label: { fr: "Après 18 h" },
      section: opts.section,
      order: ordre(),
      scheduleGrid: { row: jour, col: "apres18h" },
    });
```
devient
```ts
      label: { fr: "Après 18 h" },
      // Pas de `help` : la tranche horaire EST déjà toute l'information.
      section: opts.section,
      order: ordre(),
      scheduleGrid: { row: jour, col: "apres18h" },
    });
```

- [ ] **Step 5: case « Samedi »**

```ts
    label: { fr: "Samedi" },
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
    // Pas de créneau pour le week-end : ligne avec la seule case "jour",
    // cf. `scheduleGrid` — les colonnes de créneau restent vides pour elle.
    scheduleGrid: { row: "samedi" },
  });
```
devient
```ts
    label: { fr: "Samedi" },
    // Pas de `help` : le nom du jour EST déjà toute l'information.
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
    // Pas de créneau pour le week-end : ligne avec la seule case "jour",
    // cf. `scheduleGrid` — les colonnes de créneau restent vides pour elle.
    scheduleGrid: { row: "samedi" },
  });
```

- [ ] **Step 6: case « Dimanche »**

```ts
    label: { fr: "Dimanche" },
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
    scheduleGrid: { row: "dimanche" },
  });
```
devient
```ts
    label: { fr: "Dimanche" },
    // Pas de `help` : le nom du jour EST déjà toute l'information.
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
    scheduleGrid: { row: "dimanche" },
  });
```

- [ ] **Step 7: les 2 champs texte-libre (`periodesTexte`, `irregulierementTexte`) — déjà documentés**

Le commentaire existant (lignes ~275-279 : « Aucune de ces deux lignes n'a de
libellé imprimé propre sur le PDF… les libellés ci-dessous sont des
instructions neutres ») explique déjà l'absence de `help`. Vérifier qu'il est
toujours présent — **aucune édition nécessaire**, étape de lecture seule.

- [ ] **Step 8: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1a-fields.test.ts`
Expected: PASS — les tests de géométrie ne doivent voir aucun changement
(seule la clé `help` est touchée, 6 fois, dans la factory).

```bash
git add lib/pdf-forms/seed/c1a-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1A (2/5) — grille horaire Q4+Q18 documentée sans aide (factory partagée)"
```

---

### Task 3: Q5-Q11 (4 champs à documenter + 1 confirmation)

**Files:** Modify `lib/pdf-forms/seed/c1a-fields.ts`

- [ ] **Step 1: `descriptionAide1` — confirmation, aucune édition**

Le commentaire existant (lignes ~713-716) explique déjà pourquoi ce champ
n'a plus de `help` (ancien texte obsolète retiré, aucun remplacement
disponible). Vérifier qu'il est intact — **aucune édition**.

- [ ] **Step 2: `montantAidePeriodicite`**

```ts
    label: { fr: "Ce montant est :" },
    options: [
      { value: "mois", label: { fr: "Par mois" } },
      { value: "an", label: { fr: "Par an" } },
    ],
```
devient
```ts
    label: { fr: "Ce montant est :" },
    // Pas de `help` : les deux options recopient fidèlement les cases imprimées.
    options: [
      { value: "mois", label: { fr: "Par mois" } },
      { value: "an", label: { fr: "Par an" } },
    ],
```

- [ ] **Step 3: `aidaitDejaIndependant`**

```ts
    label: { fr: "Aidiez-vous déjà cet indépendant dans le passé ?" },
    options: YN,
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 56,
  },
```
devient
```ts
    label: { fr: "Aidiez-vous déjà cet indépendant dans le passé ?" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    options: YN,
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 56,
  },
```

- [ ] **Step 4: `dateDebutAide`**

```ts
    label: { fr: "À partir de quelle date aidiez-vous déjà cet indépendant ?" },
    visibleIf: { fieldId: "aidaitDejaIndependant", op: "equals", value: "oui" },
```
devient
```ts
    label: { fr: "À partir de quelle date aidiez-vous déjà cet indépendant ?" },
    // Pas de `help` : le label reprend déjà, mot pour mot, la question imprimée.
    visibleIf: { fieldId: "aidaitDejaIndependant", op: "equals", value: "oui" },
```

- [ ] **Step 5: `revenuAnnuelMandat2` — confirmation + commentaire de non-invention**

```ts
    // A VALIDER Oraliks : la seconde ligne de Q11. Le formulaire prévoit deux
    // montants sans préciser à l'impression ce qui les distingue — un second
    // mandat, ou une seconde composante du même revenu.
    id: "revenuAnnuelMandat2",
    pdfFieldName: "",
    drawAt: { page: 1, x: 69, y: 694, size: 9, maxWidth: 62 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Second montant, si vous exercez plus d'un mandat (EUR)" },
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
```
devient (un seul commentaire ajouté, rien d'autre) :
```ts
    // A VALIDER Oraliks : la seconde ligne de Q11. Le formulaire prévoit deux
    // montants sans préciser à l'impression ce qui les distingue — un second
    // mandat, ou une seconde composante du même revenu.
    id: "revenuAnnuelMandat2",
    pdfFieldName: "",
    drawAt: { page: 1, x: 69, y: 694, size: 9, maxWidth: 62 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Second montant, si vous exercez plus d'un mandat (EUR)" },
    // Pas de `help` : l'ambiguïté du PDF ci-dessus (« A VALIDER Oraliks »)
    // empêche d'écrire une explication fiable — inventer une précision ici
    // trancherait silencieusement une question ouverte.
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
```

- [ ] **Step 6: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1a-fields.test.ts`

```bash
git add lib/pdf-forms/seed/c1a-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1A (3/5) — Q5-Q11 documentés sans aide (2 ambiguïtés confirmées, non tranchées)"
```

---

### Task 4: Q12-Q17 (7 champs)

**Files:** Modify `lib/pdf-forms/seed/c1a-fields.ts`

`activiteCommeSalarie`, `adresseActivite`, `adresseActiviteCodePostalCommune`,
`formeActivite`, `disposeNumeroEntreprise`, `numeroEntreprise`,
`descriptionActivite1`.

- [ ] **Step 1: `activiteCommeSalarie`**

```ts
    label: { fr: "Exercez-vous cette activité comme salarié ?" },
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 62,
  },
```
devient
```ts
    label: { fr: "Exercez-vous cette activité comme salarié ?" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 62,
  },
```

- [ ] **Step 2: `adresseActivite`**

```ts
    label: { fr: "À quelle adresse exercez-vous cette activité ? — rue et numéro" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 65,
  },
```
devient
```ts
    label: { fr: "À quelle adresse exercez-vous cette activité ? — rue et numéro" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 65,
  },
```

- [ ] **Step 3: `adresseActiviteCodePostalCommune`**

```ts
    label: { fr: "Code postal et commune (activité accessoire)" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 66,
  },
```
devient
```ts
    label: { fr: "Code postal et commune (activité accessoire)" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 66,
  },
```

- [ ] **Step 4: `formeActivite`**

```ts
    label: { fr: "J'exerce l'activité comme :" },
    options: [
      { value: "personne-physique", label: { fr: "Personne physique" } },
      { value: "mandataire", label: { fr: "Mandataire, administrateur ou gestionnaire" } },
    ],
```
devient
```ts
    label: { fr: "J'exerce l'activité comme :" },
    // Pas de `help` : les deux options recopient fidèlement les cases imprimées.
    options: [
      { value: "personne-physique", label: { fr: "Personne physique" } },
      { value: "mandataire", label: { fr: "Mandataire, administrateur ou gestionnaire" } },
    ],
```

- [ ] **Step 5: `disposeNumeroEntreprise`**

```ts
    label: { fr: "Je dispose d'un numéro d'entreprise :" },
    options: YN,
    visibleIf: { fieldId: "formeActivite", op: "equals", value: "mandataire" },
    section: SECTION_ACTIVITES,
    order: 68,
  },
```
devient
```ts
    label: { fr: "Je dispose d'un numéro d'entreprise :" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    options: YN,
    visibleIf: { fieldId: "formeActivite", op: "equals", value: "mandataire" },
    section: SECTION_ACTIVITES,
    order: 68,
  },
```

- [ ] **Step 6: `numeroEntreprise`**

```ts
    label: { fr: "Numéro d'entreprise (BCE)" },
    visibleIf: { fieldId: "disposeNumeroEntreprise", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 69,
  },
```
devient
```ts
    label: { fr: "Numéro d'entreprise (BCE)" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "disposeNumeroEntreprise", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 69,
  },
```

- [ ] **Step 7: `descriptionActivite1`**

```ts
    label: { fr: "Je décris mon activité" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 70,
  },
```
devient
```ts
    label: { fr: "Je décris mon activité" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 70,
  },
```

- [ ] **Step 8: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1a-fields.test.ts`

```bash
git add lib/pdf-forms/seed/c1a-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1A (4/5) — Q12-Q17 documentés sans aide"
```

---

### Task 5: Q20-Q24 (9 champs) + validation finale du document

**Files:** Modify `lib/pdf-forms/seed/c1a-fields.ts`

`exerceDejaActivite`, `dateDebutActivite`, `joursOccupeLundi` à
`joursOccupeSamedi` (6, écrits individuellement — pas de factory ici),
`affirmationSincerite`.

- [ ] **Step 1: `exerceDejaActivite`**

```ts
    label: { fr: "Exerciez-vous déjà cette activité dans le passé ?" },
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 150,
  },
```
devient
```ts
    label: { fr: "Exerciez-vous déjà cette activité dans le passé ?" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 150,
  },
```

- [ ] **Step 2: `dateDebutActivite`**

```ts
    label: { fr: "Depuis quand exercez-vous cette activité ?" },
    visibleIf: { fieldId: "exerceDejaActivite", op: "equals", value: "oui" },
```
devient
```ts
    label: { fr: "Depuis quand exercez-vous cette activité ?" },
    // Pas de `help` : le label reprend déjà, mot pour mot, la question imprimée.
    visibleIf: { fieldId: "exerceDejaActivite", op: "equals", value: "oui" },
```

- [ ] **Step 3 à 8: les 6 `joursOccupe*`**

Pour chacun (`joursOccupeLundi`, `Mardi`, `Mercredi`, `Jeudi`, `Vendredi`,
`Samedi`), ajouter après le `label` :
```ts
    // Pas de `help` : le nom du jour EST déjà toute l'information ; le
    // contexte (« chômeur temporaire ») est expliqué par estChomeurTemporaire.
```

- [ ] **Step 9: `affirmationSincerite`**

```ts
    label: {
      fr: "J'affirme sur l'honneur que la présente déclaration est sincère et complète et je m'engage à communiquer toute modification à mon organisme de paiement.",
    },
    section: SECTION_AFFIRMATIONS,
    order: 180,
  },
```
devient
```ts
    label: {
      fr: "J'affirme sur l'honneur que la présente déclaration est sincère et complète et je m'engage à communiquer toute modification à mon organisme de paiement.",
    },
    // Pas de `help` : le label EST la déclaration légale complète imprimée.
    section: SECTION_AFFIRMATIONS,
    order: 180,
  },
```

- [ ] **Step 10: Vérifier, build, lint, commit + push**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1a-fields.test.ts lib/pdf-forms/__tests__/widget-geometry.test.ts && pnpm build && pnpm lint`

```bash
git add lib/pdf-forms/seed/c1a-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1A (5/5) — Q20-Q24 documentés sans aide"
git push
```

---

### Task 6: Clôture du chantier — mise à jour de la spec

**Files:** Modify `docs/superpowers/specs/2026-08-04-couverture-aide-de-champ-design.md`

- [ ] **Step 1: Marquer le chantier terminé**

Ajouter en tête de la spec, sous le titre, une ligne :
```
**Statut : TERMINÉ 2026-08-04** — 8 documents traités (C46, C47,
C1-Partenaire, C1C, C1, C1B, C1-Regis, C1A). 13 vraies aides ajoutées au
total (le reste, largement majoritaire, était déjà auto-explicatif une fois
regroupé par famille — cf. commits individuels par document). Rollout
(re-semis) laissé à Oraliks, comme toute évolution de seed.
```

- [ ] **Step 2: Commit + push**

```bash
git add docs/superpowers/specs/2026-08-04-couverture-aide-de-champ-design.md
git commit -m "docs(pdf-forms): chantier couverture aide de champ — terminé, 8/8 documents"
git push
```

---

## Self-review

Les 76 champs restants du C1A sont traités. Aucun texte substantiel ajouté :
vérifié champ par champ (y compris via la factory partagée pour la grille
horaire) que chacun est déjà auto-explicatif, ou explicitement laissé en
l'état car une ambiguïté est déjà signalée dans le code (`descriptionAide1`,
`revenuAnnuelMandat2`) — ni l'une ni l'autre n'est tranchée dans ce lot, pour
ne pas inventer une réponse à une question ouverte. Aucun test de géométrie
ne doit bouger : seule la clé `help` est touchée.
