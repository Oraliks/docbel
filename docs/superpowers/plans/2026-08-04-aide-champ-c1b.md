# Couverture de l'aide de champ — C1B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Documenter les 25 champs sans `help` du C1B (sur les 27 identifiés à
l'audit initial — `congeSansSoldeNomEmployeur`/`congeSansSoldeAdresseEmployeur`
ont déjà reçu leur aide au chantier « autofill employeur BCE »). Sixième
document du chantier. Contrairement au C1, chaque date de ce formulaire porte
un label déjà contextualisé individuellement (« Pension de survie belge — à
partir du », « Période de cumul antérieur — du ») — pas de moule générique à
enrichir ici. Les 25 champs restent auto-explicatifs.

**Architecture:** Contenu sourcé, pas de code
(`docs/superpowers/specs/2026-08-04-couverture-aide-de-champ-design.md`).

**Tech Stack:** aucun — édition de `lib/pdf-forms/seed/c1b-fields.ts`.

## Global Constraints

- Vérifié sur `private/pdfs/C1B_FR.pdf` (extraction markitdown, 2026-08-04) :
  aucun des 25 champs n'a de note marginale exploitable au-delà de son
  propre label, déjà recopié fidèlement du papier.
- Les renvois « voir X » imprimés sur ce document sont des marqueurs de FLUX
  (quelle question suivante remplir), pas des explications de contenu — déjà
  couverts par le mécanisme d'étapes/`visibleIf` de l'app, pas par une aide
  de champ.
- Aucun texte inventé : les 25 restent sans `help`, chacun avec une
  justification précise en commentaire.
- `git add` de chemin explicite uniquement.
- Commandes de validation : `pnpm vitest run lib/pdf-forms/seed/__tests__/c1b-fields.test.ts` · `pnpm build` · `pnpm lint`.

---

### Task 1: 6 champs identité/adresse

**Files:** Modify `lib/pdf-forms/seed/c1b-fields.ts`

- [ ] **Step 1: `nom`**

```ts
    label: { fr: "Nom" },
    prefillFrom: "profile.lastName",
    canonicalKey: "identity.nom",
    inheritedFromDossier: true,
```
devient (insérer juste après `label`)
```ts
    label: { fr: "Nom" },
    // Pas de `help` : aucun texte imprimé propre à ce champ (audit
    // couverture aide de champ, 2026-08-04).
    prefillFrom: "profile.lastName",
    canonicalKey: "identity.nom",
    inheritedFromDossier: true,
```

- [ ] **Step 2: `pr_nom`** — même geste après `label: { fr: "Prénom" }`.
- [ ] **Step 3: `rue`** — même geste après `label: { fr: "Rue" }`.
- [ ] **Step 4: `num_ro`** — même geste après `label: { fr: "Numéro" }`.
- [ ] **Step 5: `code_postal`** — même geste après `label: { fr: "Code postal" }`.
- [ ] **Step 6: `commune`** — même geste après `label: { fr: "Commune" }`
  (attention : ce champ a un commentaire existant juste après le label,
  insérer le nouveau commentaire AVANT celui-ci, pas à sa place).

- [ ] **Step 7: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1b-fields.test.ts`

```bash
git add lib/pdf-forms/seed/c1b-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1B (1/3) — identité/adresse documentés sans aide"
```

---

### Task 2: 13 questions et dates de revenus/pension (déjà contextualisées)

**Files:** Modify `lib/pdf-forms/seed/c1b-fields.ts`

Pour chacun des 13 champs suivants, ajouter un commentaire `// Pas de help :
...` juste après le `label` (ou avant `visibleIf` s'il n'y a pas d'autre
propriété entre les deux) :

| Champ | Justification |
|---|---|
| `droitPensionRetraiteComplete` | Label = question imprimée complète. |
| `typePensionRetraiteComplete` | Options recopiées fidèlement. |
| `datePensionRetraiteComplete` | Label déjà spécifique (« … avez-vous droit à cette pension ? »). |
| `percoitPension` | Label = question imprimée complète. |
| `dateEffetPensionSurvieBelge` | Label déjà contextualisé (« Pension de survie belge — à partir du »), contrairement au moule générique du C1. |
| `cumulAnterieurMaladieChomagePrepension` | Label reprend déjà, mot pour mot, la question imprimée (la plus longue du document). |
| `cumulAnterieurDateDebut` | Label déjà contextualisé (« Période de cumul antérieur — du »). |
| `cumulAnterieurDateFin` | Idem, borne de fin. |
| `indemniteMaladieInvaliditeEtrangere` | Label = question imprimée complète. |
| `indemniteAccidentTravailBelge` | Label = question imprimée complète. |
| `congeSansSolde` | Label = question imprimée complète. |
| `congeSansSoldeDateDebut` | Label déjà contextualisé (« Période de congé sans solde — du »). |
| `congeSansSoldeDateFin` | Idem, borne de fin. |

- [ ] **Step 1 à 13** : un edit par champ, patron identique à Task 1.

- [ ] **Step 14: Vérifier et commit**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1b-fields.test.ts`

```bash
git add lib/pdf-forms/seed/c1b-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1B (2/3) — revenus et pension documentés sans aide"
```

---

### Task 3: 6 annexes

**Files:** Modify `lib/pdf-forms/seed/c1b-fields.ts`

Les 5 checkboxes d'annexe (`annexeDecisionsBelges`, `annexeDecisionsEtrangeres`,
`annexeCopiesPaiement`, `annexeModele74`, `annexeAutre`) ont chacune un
`label` qui EST le nom exact du document imprimé (« Je joins : décision(s)
d'octroi d'institutions belges », etc.). `annexeAutreDescription` est un
champ texte trivial déjà rencontré à l'identique sur C46 et C1.

- [ ] **Step 1 à 5** : pour chaque checkbox d'annexe, ajouter après le `label` :

```ts
    // Pas de `help` : le libellé nomme déjà exactement le document attendu.
```

- [ ] **Step 6: `annexeAutreDescription`**

```ts
    label: { fr: "Description du document joint" },
    visibleIf: { fieldId: "annexeAutre", op: "equals", value: true },
```
devient
```ts
    label: { fr: "Description du document joint" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "annexeAutre", op: "equals", value: true },
```

- [ ] **Step 7: Vérifier et commit + push**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1b-fields.test.ts && pnpm build && pnpm lint`

```bash
git add lib/pdf-forms/seed/c1b-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1B (3/3) — 6 annexes documentées sans aide"
git push
```

---

## Self-review

Les 25 champs restants de l'audit initial (27 moins 2 déjà comblés par le
chantier autofill BCE) sont traités. Aucun texte substantiel ajouté — vérifié
champ par champ que chaque label est déjà spécifique et fidèle au PDF, y
compris pour les dates (contrairement au C1, ce document ne passe pas par un
moule générique). Pas d'audit réglementaire dédié : aucune nouvelle
affirmation faite au citoyen.
