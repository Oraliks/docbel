# Couverture de l'aide de champ — C1C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Documenter les 10 champs sans `help` du C1C — quatrième document du
chantier. Contrairement à C46/C1-Partenaire, aucun n'a de note marginale
propre inexploitée dans le PDF officiel : chacun est un radio/texte dont le
label ou le placeholder, déjà recopié fidèlement, constitue l'explication.

**Architecture:** Contenu sourcé, pas de code
(`docs/superpowers/specs/2026-08-04-couverture-aide-de-champ-design.md`).

**Tech Stack:** aucun — édition de `lib/pdf-forms/seed/c1c-fields.ts`.

## Global Constraints

- Vérifié sur `private/pdfs/C1C_FR.pdf` (extraction markitdown, 2026-08-04) :
  l'avertissement sur le travail exercé par des tiers est DÉJÀ recopié sur la
  question mère `activiteExerceeParTiers` (ligne ~378) — son champ de détail
  conditionnel `tiersPrecision` n'a pas besoin de le répéter.
- Aucun texte inventé : les 10 champs restent sans `help`, chacun avec une
  justification précise en commentaire.
- `git add` de chemin explicite uniquement.
- Commandes de validation : `pnpm vitest run lib/pdf-forms/seed/__tests__/c1c-fields.test.ts` · `pnpm build` · `pnpm lint`.

---

### Task 1: Documenter les 10 absences

**Files:**
- Modify: `lib/pdf-forms/seed/c1c-fields.ts` (10 champs listés ci-dessous)

Pour chaque champ, ajouter un commentaire `// Pas de help : ...` juste après
son `label`, sans toucher au reste. Justification par champ :

| Champ | Justification |
|---|---|
| `pr_nom_et_nom` | Aucun texte imprimé propre (identité standard). |
| `possedeSiteInternet` | Question oui/non, label déjà la question complète. |
| `siteInternetUrl` | Placeholder « exemple.be » joue déjà ce rôle (format attendu sans www.). |
| `lieuExerciceActivite` | Choix à 2 options, libellés recopiés fidèlement. |
| `adresseActiviteLigne1` | Aucun texte imprimé propre à cette ligne. |
| `formeExerciceActivite` | Choix à 2 options, libellés recopiés fidèlement. |
| `nomEntreprise` | Aucun texte imprimé propre. |
| `tiersPrecision` | L'avertissement du PDF est déjà porté par la question mère `activiteExerceeParTiers`. |
| `activiteIndependanteAnterieure` | Label déjà la question complète, telle qu'imprimée. |
| `descriptionActivitesAnterieures1` | Couvert par le contexte de la question précédente. |

- [ ] **Step 1: `pr_nom_et_nom`** (ligne ~103)

```ts
    label: { fr: "Prénom et nom" },
```
devient
```ts
    label: { fr: "Prénom et nom" },
    // Pas de `help` : aucun texte imprimé propre à ce champ (audit
    // couverture aide de champ, 2026-08-04).
```

- [ ] **Step 2: `possedeSiteInternet`** (ligne ~212)

```ts
    label: { fr: "Je dispose d'un site internet pour mon activité" },
    options: NON_OUI,
```
devient
```ts
    label: { fr: "Je dispose d'un site internet pour mon activité" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    options: NON_OUI,
```

- [ ] **Step 3: `siteInternetUrl`** (ligne ~233-237)

```ts
    label: { fr: "Adresse du site internet" },
    // Sans `www.` : c'est ce que le formulaire attend, et le placeholder est
    // le seul endroit qui le montre avant la saisie. Une adresse collée avec
    // son `https://www.` reste acceptée — elle est nettoyée au stamping.
    placeholder: { fr: "exemple.be" },
```
devient
```ts
    label: { fr: "Adresse du site internet" },
    // Sans `www.` : c'est ce que le formulaire attend, et le placeholder est
    // le seul endroit qui le montre avant la saisie. Une adresse collée avec
    // son `https://www.` reste acceptée — elle est nettoyée au stamping.
    // Pas de `help` distinct : le placeholder ci-dessous porte déjà l'info.
    placeholder: { fr: "exemple.be" },
```

- [ ] **Step 4: `lieuExerciceActivite`** (ligne ~247)

```ts
    label: { fr: "J'exerce mon activité" },
    options: [
      { value: "domicile", label: { fr: "À l'adresse de mon domicile" } },
      { value: "autre", label: { fr: "À une autre adresse" } },
    ],
```
devient
```ts
    label: { fr: "J'exerce mon activité" },
    // Pas de `help` : les deux options recopient fidèlement les cases imprimées.
    options: [
      { value: "domicile", label: { fr: "À l'adresse de mon domicile" } },
      { value: "autre", label: { fr: "À une autre adresse" } },
    ],
```

- [ ] **Step 5: `adresseActiviteLigne1`** (ligne ~271)

```ts
    label: { fr: "Adresse où j'exerce mon activité" },
    visibleIf: { fieldId: "lieuExerciceActivite", op: "equals", value: "autre" },
```
devient
```ts
    label: { fr: "Adresse où j'exerce mon activité" },
    // Pas de `help` : aucun texte imprimé propre à cette ligne.
    visibleIf: { fieldId: "lieuExerciceActivite", op: "equals", value: "autre" },
```

- [ ] **Step 6: `formeExerciceActivite`** (ligne ~285)

```ts
    label: { fr: "Je souhaite exercer cette activité en tant que" },
    options: [
      { value: "personne-physique", label: { fr: "Personne physique" } },
      {
        value: "societe",
        label: { fr: "Société (mandataire, administrateur, gérant ou associé actif)" },
      },
    ],
```
devient
```ts
    label: { fr: "Je souhaite exercer cette activité en tant que" },
    // Pas de `help` : les deux options recopient fidèlement les cases imprimées.
    options: [
      { value: "personne-physique", label: { fr: "Personne physique" } },
      {
        value: "societe",
        label: { fr: "Société (mandataire, administrateur, gérant ou associé actif)" },
      },
    ],
```

- [ ] **Step 7: `nomEntreprise`** (ligne ~333)

```ts
    label: { fr: "Nom de l'entreprise" },
    visibleIf: { fieldId: "formeExerciceActivite", op: "equals", value: "societe" },
```
devient
```ts
    label: { fr: "Nom de l'entreprise" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "formeExerciceActivite", op: "equals", value: "societe" },
```

- [ ] **Step 8: `tiersPrecision`** (ligne ~396)

```ts
    label: { fr: "Précisez" },
    visibleIf: { fieldId: "activiteExerceeParTiers", op: "equals", value: "oui" },
```
devient
```ts
    label: { fr: "Précisez" },
    // Pas de `help` distinct : l'avertissement du PDF est déjà porté par la
    // question mère `activiteExerceeParTiers`, dont ce champ n'est qu'un
    // détail conditionnel — le répéter ici serait redondant.
    visibleIf: { fieldId: "activiteExerceeParTiers", op: "equals", value: "oui" },
```

- [ ] **Step 9: `activiteIndependanteAnterieure`** (ligne ~464-466)

```ts
    label: {
      fr: "J'ai exercé une activité indépendante à titre principal au cours des 6 dernières années, calculées de date à date, précédant la date de début de la nouvelle activité",
    },
    options: NON_OUI,
```
devient
```ts
    label: {
      fr: "J'ai exercé une activité indépendante à titre principal au cours des 6 dernières années, calculées de date à date, précédant la date de début de la nouvelle activité",
    },
    // Pas de `help` : le label reprend déjà, mot pour mot, la question imprimée.
    options: NON_OUI,
```

- [ ] **Step 10: `descriptionActivitesAnterieures1`** (ligne ~483)

```ts
    label: { fr: "Je décris précisément ci-dessous chaque activité exercée" },
    visibleIf: { fieldId: "activiteIndependanteAnterieure", op: "equals", value: "oui" },
```
devient
```ts
    label: { fr: "Je décris précisément ci-dessous chaque activité exercée" },
    // Pas de `help` : couvert par le contexte de la question précédente
    // (activité indépendante antérieure), déjà auto-explicatif.
    visibleIf: { fieldId: "activiteIndependanteAnterieure", op: "equals", value: "oui" },
```

- [ ] **Step 11: Vérifier les tests de seed existants**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1c-fields.test.ts`
Expected: PASS.

- [ ] **Step 12: Commit + push**

```bash
git add lib/pdf-forms/seed/c1c-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1C — 10 absences documentées (aucune n'apporterait de valeur)"
git push
```

---

## Self-review

Aucun texte substantiel ajouté sur ce document — vérifié champ par champ que
chacun est déjà auto-explicatif (label/options/placeholder fidèlement
recopiés) ou couvert par sa question mère. Pas d'audit réglementaire dédié :
aucune nouvelle affirmation n'est faite au citoyen, seulement des commentaires
de code expliquant une absence délibérée.
