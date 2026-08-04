# Couverture de l'aide de champ — C1-Partenaire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combler la vraie lacune du C1-Partenaire (`partenaireAllocationsFamiliales`,
seule des 6 questions « Le partenaire : » sans avertissement, contrairement à
ses 5 jumelles) et documenter les 3 autres champs signalés par l'audit,
déjà volontairement sans aide.

**Architecture:** Contenu sourcé, pas de code. Troisième document du
chantier (`docs/superpowers/specs/2026-08-04-couverture-aide-de-champ-design.md`).

**Tech Stack:** aucun — édition de `lib/pdf-forms/seed/c1-partenaire-fields.ts`.

## Global Constraints

- Aucun texte inventé. Vérifié sur `private/pdfs/C1-Partenaire_FR.pdf` : les
  6 questions « LE PARTENAIRE : » sont l'application, une par une, des 6
  conditions listées plus haut dans « Qui est considéré comme votre
  partenaire ? ». 5 des 6 questions portent déjà un avertissement de ce
  type dans le seed — `partenaireAllocationsFamiliales` (la 6e) n'en a
  aucun, contrairement au patron établi par ses jumelles.
- Le texte à ajouter reprend **la formule la plus générique déjà utilisée**
  (`partenaireRevenuIntegration` : « une des 6 conditions cumulatives n'est
  plus remplie ») plutôt qu'une justification spécifique inférée (le lien
  exact entre « allocations familiales perçues pour cette personne » et
  « enfant à charge d'un parent », condition 3 du bloc définitionnel, n'est
  pas énoncé mot pour mot à cet endroit précis du PDF — inventer ce lien
  causal serait franchir la règle anti-invention).
- `revenu_de_remplacement` a déjà un commentaire explicite justifiant
  l'absence d'aide — **ne pas y toucher**, seulement le vérifier.
- `git add` de chemin explicite uniquement.
- Commandes de validation : `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-partenaire-fields.test.ts` · `pnpm build` · `pnpm lint`.

---

### Task 1: Combler `partenaireAllocationsFamiliales`, documenter les 3 autres

**Files:**
- Modify: `lib/pdf-forms/seed/c1-partenaire-fields.ts`
  (`partenaireAllocationsFamiliales`, `nom_ch_meur`,
  `montantMensuelBrutRemplacement`)

- [ ] **Step 1: `partenaireAllocationsFamiliales` — le vrai ajout**

```ts
  ynQuestion({
    id: "partenaireAllocationsFamiliales",
    pdfNon: "non_6",
    pdfOui: "oui_6",
    label: "Le partenaire est une personne pour qui quelqu'un perçoit des allocations familiales",
    order: 150,
  }),
```

devient :

```ts
  ynQuestion({
    id: "partenaireAllocationsFamiliales",
    pdfNon: "non_6",
    pdfOui: "oui_6",
    label: "Le partenaire est une personne pour qui quelqu'un perçoit des allocations familiales",
    // Même formule que partenaireRevenuIntegration : la seule justification
    // vérifiable sans inférer un lien non énoncé mot pour mot ici (cf.
    // Global Constraints).
    help: "⚠ Si oui, cette personne ne peut pas être déclarée comme partenaire à charge (une des 6 conditions cumulatives n'est plus remplie).",
    order: 150,
  }),
```

- [ ] **Step 2: `nom_ch_meur` — documenter l'absence**

```ts
    id: "nom_ch_meur",
    pdfFieldName: "Nom chômeur",
    alignTextToGuide: true,
    type: "fullname",
    nameOrder: "last-first",
    required: true,
    label: { fr: "Votre nom et prénom" },
    inheritedFromDossier: true,
```

devient :

```ts
    id: "nom_ch_meur",
    pdfFieldName: "Nom chômeur",
    alignTextToGuide: true,
    type: "fullname",
    nameOrder: "last-first",
    required: true,
    label: { fr: "Votre nom et prénom" },
    // Pas de `help` : aucun texte imprimé propre à ce champ (audit
    // couverture aide de champ, 2026-08-04).
    inheritedFromDossier: true,
```

- [ ] **Step 3: `montantMensuelBrutRemplacement` — clarifier l'absence déjà de fait**

```ts
    id: "montantMensuelBrutRemplacement",
    pdfFieldName: "",
    drawAt: { page: 0, x: 413.5, y: 375.82, size: 9, maxWidth: 58 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Montant mensuel brut du revenu de remplacement" },
```

devient :

```ts
    id: "montantMensuelBrutRemplacement",
    pdfFieldName: "",
    drawAt: { page: 0, x: 413.5, y: 375.82, size: 9, maxWidth: 58 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Montant mensuel brut du revenu de remplacement" },
    // Pas de `help` : contrairement à son jumeau `montant_mensuel_brut`
    // (revenu professionnel), la note (2) du PDF sur l'indépendant ne
    // s'applique PAS ici — aucune instruction imprimée propre à ce montant.
```

- [ ] **Step 4: Vérifier `revenu_de_remplacement` (aucune modification)**

Confirmer que le commentaire existant (lignes ~294-297) reste inchangé —
lecture seule, pas d'édition.

- [ ] **Step 5: Vérifier les tests de seed existants**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-partenaire-fields.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/pdf-forms/seed/c1-partenaire-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1-Partenaire — partenaireAllocationsFamiliales comblé, 3 absences documentées"
```

---

### Task 2: Audit réglementaire (le seul champ avec un vrai nouveau texte)

- [ ] **Step 1: `/verif-reglementation` sur le seed modifié**

Cibler spécifiquement `partenaireAllocationsFamiliales` — le seul ajout
substantiel de ce lot (les 3 autres changements sont des commentaires
justifiant une absence, sans texte affiché nouveau).

- [ ] **Step 2: Suite ciblée + build + lint**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-partenaire-fields.test.ts && pnpm build && pnpm lint`

- [ ] **Step 3: Push**

```bash
git push
```

---

## Self-review

Les 4 champs de l'audit initial sont traités : 1 vraie lacune comblée
(cohérente avec le patron de ses 5 jumelles, formule la plus prudente
retenue), 3 confirmés/documentés comme volontairement sans aide. Aucun texte
inventé — le lien causal non vérifiable a été explicitement évité.
