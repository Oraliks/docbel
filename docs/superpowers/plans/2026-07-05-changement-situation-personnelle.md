# Dossier "Changement dans ma situation personnelle" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new dossier type, centré sur le formulaire C1, permettant à toute personne déjà indemnisée de déclarer un changement (adresse, compte bancaire, situation familiale, permis de séjour, cotisation syndicale, changement d'organisme de paiement).

**Architecture:** Réutilisation totale de l'infrastructure C1 existante — nouveau `PdfForm` slug ajouté à `C1_IMPROVEMENT_TARGETS` (hérite des champs enrichis + des 10 triggers déjà écrits), nouveau module `DossierDefinition` avec écran `journey` obligatoire et sans questionnaire d'orientation, enregistré dans le registre existant.

**Tech Stack:** Next.js 16 / TypeScript strict / Prisma 5 (PostgreSQL/Neon) / vitest / next-intl 4.

**Spec :** [docs/superpowers/specs/2026-07-05-changement-situation-personnelle-design.md](../specs/2026-07-05-changement-situation-personnelle-design.md)

## Global Constraints

- Jamais `prisma db push` / `pnpm db:setup` contre la base Neon partagée. Toute création de ligne `PdfForm`/`DocumentBundle` passe par `seedDossier()` (`lib/dossiers/seed.ts`) via l'endpoint admin existant `POST /api/admin/bundles/seed/[slug]` — un INSERT Prisma additif, jamais une migration de schéma.
- `git add` de chemins **explicites** uniquement (jamais `-A` ni un chemin large) — workdir partagé multi-agents.
- i18n : ce lot ajoute les clés uniquement dans `messages/fr.json` (langue source). Les 11 autres langues sont un suivi séparé (précédent établi : item #19 de `docs/tasks/NEXT_ACTIONS.md`) — `pnpm i18n:check` ne bloque QUE sur JSON invalide ou erreur de syntaxe ICU, jamais sur une couverture incomplète (vérifié dans `scripts/i18n-validate.ts`).
- `pnpm lint` a ~74 erreurs pré-existantes : ne pas en ajouter, mais ne pas viser un delta zéro forcé.
- Max 3–5 fichiers par tâche de code (chaque tâche ci-dessous respecte cette limite).
- `applyC1Improvements()` est **partagée** par les cibles `c1` et `c1-insertion` : tout changement doit être rétrocompatible (aucun changement de comportement observable pour ces deux cibles sans option explicite).

---

### Task 1: `defaultMotif` optionnel sur `applyC1Improvements`

**Files:**
- Modify: `lib/pdf-forms/seed/c1-fields-improvements.ts:1440-1453`
- Test: `lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`

**Interfaces:**
- Consumes: rien (fonction existante, pure).
- Produces: `applyC1Improvements(fields: PdfFormField[], opts?: { defaultMotif?: string }): PdfFormField[]` — Task 3 appelle cette fonction avec `{ defaultMotif: "modification" }`.

- [ ] **Step 1: Write the failing tests**

Dans `lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`, modifier la ligne d'import existante :

```ts
import { C1_QUESTIONS, C1_TRIGGERS } from "../c1-fields-improvements";
```

en :

```ts
import { C1_QUESTIONS, C1_TRIGGERS, applyC1Improvements } from "../c1-fields-improvements";
```

Puis ajouter ce bloc à la fin du fichier :

```ts
describe("applyC1Improvements — defaultMotif optionnel", () => {
  it("sans options, motifIntroduction n'a pas de defaultValue (comportement actuel inchangé)", () => {
    const result = applyC1Improvements([]);
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif).toBeDefined();
    expect(motif?.defaultValue).toBeUndefined();
  });

  it("avec defaultMotif, motifIntroduction porte la defaultValue fournie", () => {
    const result = applyC1Improvements([], { defaultMotif: "modification" });
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBe("modification");
  });

  it("C1_QUESTIONS partagé reste non muté après un appel avec defaultMotif", () => {
    applyC1Improvements([], { defaultMotif: "modification" });
    const motif = C1_QUESTIONS.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`
Expected: FAIL — `applyC1Improvements` n'accepte pas encore de second argument, et sans lui `defaultValue` reste toujours `undefined` (le 2ᵉ test échoue).

- [ ] **Step 3: Write minimal implementation**

Dans `lib/pdf-forms/seed/c1-fields-improvements.ts`, remplacer (lignes 1440-1453) :

```ts
export function applyC1Improvements(fields: PdfFormField[]): PdfFormField[] {
  const covered = coveredCheckboxNames();
  const newIds = new Set(C1_QUESTIONS.map((q) => q.id));

  const preserved = fields.filter((f) => {
    // Retire les anciens checkboxes individuels désormais couverts par radio.
    if (covered.has(f.pdfFieldName)) return false;
    // Retire aussi un éventuel ancien champ portant un id qu'on redéfinit.
    if (newIds.has(f.id)) return false;
    return true;
  });

  return [...preserved, ...C1_QUESTIONS];
}
```

par :

```ts
export interface ApplyC1ImprovementsOptions {
  /// Valeur par défaut à appliquer sur `motifIntroduction` pour CETTE cible
  /// uniquement (ne mute jamais le tableau partagé `C1_QUESTIONS`). Utilisé
  /// par les dossiers dont le motif d'entrée est implicite (ex.
  /// "changement-situation-personnelle" → "modification").
  defaultMotif?: string;
}

export function applyC1Improvements(
  fields: PdfFormField[],
  opts?: ApplyC1ImprovementsOptions
): PdfFormField[] {
  const covered = coveredCheckboxNames();
  const newIds = new Set(C1_QUESTIONS.map((q) => q.id));

  const preserved = fields.filter((f) => {
    // Retire les anciens checkboxes individuels désormais couverts par radio.
    if (covered.has(f.pdfFieldName)) return false;
    // Retire aussi un éventuel ancien champ portant un id qu'on redéfinit.
    if (newIds.has(f.id)) return false;
    return true;
  });

  const questions = opts?.defaultMotif
    ? C1_QUESTIONS.map((q) =>
        q.id === "motifIntroduction" ? { ...q, defaultValue: opts.defaultMotif } : q
      )
    : C1_QUESTIONS;

  return [...preserved, ...questions];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`
Expected: PASS (tous les tests du fichier, y compris les préexistants sur `habiteEnColocation`/`C1_TRIGGERS`).

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-forms/seed/c1-fields-improvements.ts lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts
git commit -m "feat(pdf-forms): defaultMotif optionnel sur applyC1Improvements"
```

---

### Task 2: Nouveau champ `dateModificationEffective` + aide enrichie sur `dateChangementOrganisme`

**Files:**
- Modify: `lib/pdf-forms/seed/c1-fields-improvements.ts` (bloc `modificationCotisationSyndicale` ~ligne 332-341, et champ `dateChangementOrganisme` ~ligne 280-290)
- Test: `lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`

**Interfaces:**
- Consumes: `SECTION_DEMANDE` (constante déjà définie ligne 22 du même fichier).
- Produces: champ `dateModificationEffective` dans `C1_QUESTIONS` — aucune tâche suivante n'en dépend directement (consommé par le rendu générique du formulaire C1, déjà existant).

- [ ] **Step 1: Write the failing tests**

Ajouter à `lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts` :

```ts
describe("C1_QUESTIONS — dateModificationEffective", () => {
  it("existe, type date, visible seulement si motifIntroduction = modification", () => {
    const f = C1_QUESTIONS.find((q) => q.id === "dateModificationEffective");
    expect(f).toBeDefined();
    expect(f?.type).toBe("date");
    expect(f?.required).toBe(false);
    expect(f?.visibleIf).toEqual({ fieldId: "motifIntroduction", op: "equals", value: "modification" });
  });
});

describe("C1_QUESTIONS — dateChangementOrganisme aide enrichie", () => {
  it("mentionne que le délai dépend du type d'allocation en cours", () => {
    const f = C1_QUESTIONS.find((q) => q.id === "dateChangementOrganisme");
    expect(f?.help?.fr).toContain("type d'allocation");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`
Expected: FAIL — `dateModificationEffective` n'existe pas encore ; le help de `dateChangementOrganisme` ne contient pas "type d'allocation".

- [ ] **Step 3: Write minimal implementation**

Dans `lib/pdf-forms/seed/c1-fields-improvements.ts`, remplacer le champ `dateChangementOrganisme` :

```ts
  {
    id: "dateChangementOrganisme",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    help: { fr: "Date de prise d'effet du changement d'organisme de paiement.", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "changement-op" },
    section: SECTION_DEMANDE,
    order: 4,
  },
```

par :

```ts
  {
    id: "dateChangementOrganisme",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    help: {
      fr: "Le transfert prend effet le mois suivant, sous certaines conditions de délai qui dépendent de ton type d'allocation actuel. Ton nouvel organisme de paiement te confirmera la date exacte.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "changement-op" },
    section: SECTION_DEMANDE,
    order: 4,
  },
```

Puis, juste après le champ `modificationCotisationSyndicale` (qui se termine par `order: 9,\n  },`) et avant le commentaire `// ====... SECTION 2 — SITUATION FAMILIALE`, insérer :

```ts
  {
    id: "dateModificationEffective",
    pdfFieldName: "", // À stamper sur les 3 cases date réelles (adresse / situation familiale / compte) — noms AcroForm à identifier via scripts/dump-c1.ts (suivi séparé, cf. NEXT_ACTIONS).
    type: "date",
    required: false,
    label: { fr: "Date d'effet de la ou des modification(s) cochée(s) ci-dessus", nl: "", de: "" },
    help: {
      fr: "Une seule date pour l'adresse, la situation personnelle/du ménage et le compte bancaire. Si tes changements n'ont pas tous la même date d'effet, fais une déclaration séparée pour chaque date différente. Ne concerne pas la cotisation syndicale ni le permis de séjour (pas de date sur le formulaire officiel).",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 9.5,
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`
Expected: PASS (tous les tests du fichier).

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-forms/seed/c1-fields-improvements.ts lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts
git commit -m "feat(pdf-forms): champ dateModificationEffective + aide transfert OP enrichie"
```

---

### Task 3: Nouvelle cible `c1-changement-situation` dans `C1_IMPROVEMENT_TARGETS`

**Files:**
- Modify: `lib/pdf-forms/seed/apply-c1-improvements-core.ts:24-34`
- Test: `lib/pdf-forms/seed/__tests__/apply-c1-improvements-core.test.ts` (nouveau)

**Interfaces:**
- Consumes: `applyC1Improvements(fields, opts?)` (Task 1), `C1_TRIGGERS` (existant).
- Produces: entrée `{ slug: "c1-changement-situation", ... }` dans `C1_IMPROVEMENT_TARGETS` — consommée par l'endpoint admin `apply-c1-improvements` (Task 6, étape de seed).

- [ ] **Step 1: Write the failing test**

Créer `lib/pdf-forms/seed/__tests__/apply-c1-improvements-core.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { C1_IMPROVEMENT_TARGETS } from "../apply-c1-improvements-core";
import { C1_TRIGGERS } from "../c1-fields-improvements";

describe("C1_IMPROVEMENT_TARGETS — c1-changement-situation", () => {
  it("est présent, réutilise C1_TRIGGERS, et force le motif par défaut sur 'modification'", () => {
    const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === "c1-changement-situation");
    expect(target).toBeDefined();
    expect(target?.triggers).toBe(C1_TRIGGERS);

    const improved = target!.improve([]);
    const motif = improved.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBe("modification");
  });

  it("n'affecte pas le defaultValue de motifIntroduction pour c1 / c1-insertion", () => {
    for (const slug of ["c1", "c1-insertion"]) {
      const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === slug);
      expect(target).toBeDefined();
      const improved = target!.improve([]);
      const motif = improved.find((f) => f.id === "motifIntroduction");
      expect(motif?.defaultValue).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/apply-c1-improvements-core.test.ts`
Expected: FAIL — `C1_IMPROVEMENT_TARGETS` ne contient pas encore `"c1-changement-situation"`.

- [ ] **Step 3: Write minimal implementation**

Dans `lib/pdf-forms/seed/apply-c1-improvements-core.ts`, remplacer :

```ts
export const C1_IMPROVEMENT_TARGETS: C1ImprovementTarget[] = [
  { slug: "c1", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  { slug: "c1-insertion", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  { slug: "c1-regis", improve: applyC1RegisImprovements, triggers: [] },
```

par :

```ts
export const C1_IMPROVEMENT_TARGETS: C1ImprovementTarget[] = [
  { slug: "c1", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  { slug: "c1-insertion", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  {
    slug: "c1-changement-situation",
    improve: (fields) => applyC1Improvements(fields, { defaultMotif: "modification" }),
    triggers: C1_TRIGGERS,
  },
  { slug: "c1-regis", improve: applyC1RegisImprovements, triggers: [] },
```

(le reste du tableau — `c1-partenaire`, `c1a`, `c1b`, `c1c`, `c46`, `c47` — ne change pas)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/apply-c1-improvements-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-forms/seed/apply-c1-improvements-core.ts lib/pdf-forms/seed/__tests__/apply-c1-improvements-core.test.ts
git commit -m "feat(pdf-forms): enregistrer la cible c1-changement-situation"
```

---

### Task 4: Module `DossierDefinition` + enregistrement au registre

**Files:**
- Create: `lib/dossiers/changement-situation-personnelle/index.ts`
- Modify: `lib/dossiers/registry.ts`
- Test: `lib/dossiers/__tests__/changement-situation-personnelle.test.ts` (nouveau)

**Interfaces:**
- Consumes: `DossierDefinition`, `DossierTheorySection`, `DossierJourneyStep` (types de `lib/dossiers/types.ts`, inchangés).
- Produces: `changementSituationPersonnelle: DossierDefinition` (slug `"changement-situation-personnelle"`, document unique de slug `"c1-changement-situation"`) — consommé par Task 5 (clés i18n référencées) et Task 6 (vérification `/d/changement-situation-personnelle`).

- [ ] **Step 1: Write the failing test**

Créer `lib/dossiers/__tests__/changement-situation-personnelle.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { getDossier } from "../registry";

describe("Dossier changement-situation-personnelle", () => {
  it("est enregistré dans le registre", () => {
    const dossier = getDossier("changement-situation-personnelle");
    expect(dossier).not.toBeNull();
  });

  it("pointe vers le PdfForm c1-changement-situation, sans questionnaire d'orientation", () => {
    const dossier = getDossier("changement-situation-personnelle")!;
    expect(dossier.questions).toEqual([]);
    expect(dossier.documents).toHaveLength(1);
    expect(dossier.documents[0].slug).toBe("c1-changement-situation");
    expect(dossier.documents[0].sourcePdfPath).toBe("private/pdfs/C1_FR.pdf");
  });

  it("a un écran journey de 4 étapes ordonnées, avec CTA", () => {
    const dossier = getDossier("changement-situation-personnelle")!;
    expect(dossier.journey).toHaveLength(4);
    expect(dossier.journey!.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(dossier.journeyCtaLabel).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/dossiers/__tests__/changement-situation-personnelle.test.ts`
Expected: FAIL — le module `lib/dossiers/changement-situation-personnelle` n'existe pas encore.

- [ ] **Step 3: Write minimal implementation**

Créer `lib/dossiers/changement-situation-personnelle/index.ts` :

```ts
// Dossier "Changement dans ma situation personnelle" — pour toute personne
// DÉJÀ indemnisée (insertion, chômage complet, temporaire...) qui doit
// signaler un changement à son organisme de paiement : adresse, compte
// bancaire, situation familiale/ménage, permis de séjour, cotisation
// syndicale, ou changement d'organisme de paiement.
//
// Réutilise entièrement l'infrastructure C1 existante : le PdfForm
// "c1-changement-situation" hérite des mêmes champs enrichis + des mêmes
// triggers que "c1"/"c1-insertion" (cf. C1_IMPROVEMENT_TARGETS), avec le
// motif d'introduction pré-sélectionné sur "modification" (éditable — la
// personne peut aussi choisir "changement d'organisme de paiement").
//
// Pas de questionnaire d'orientation (`questions: []`) : l'interaction se
// fait DANS le formulaire C1 lui-même (déjà organisé en sections), pas en
// amont — conforme à l'abandon du système d'aiguillage.

import type { DossierDefinition, DossierTheorySection } from "../types";

const THEORY: DossierTheorySection[] = [
  {
    id: "transferts-organisme-paiement",
    title: "Délais des transferts d'organisme de paiement",
    titleKey: "changementSituation.theory.transfertsOp.title",
    body: `
Le délai d'introduction et la prise d'effet d'un transfert d'organisme de
paiement dépendent du type d'allocation en cours :

- **Chômage complet / AGR** : demande à introduire au plus tard le dernier
  jour du mois précédant celui visé par le transfert ; prise d'effet le
  1ᵉʳ jour du mois suivant la réception du flux par le bureau du chômage.
- **Chômage temporaire** : demande à introduire au plus tard le dernier jour
  du 2ᵉ mois qui suit celui visé ; prise d'effet dès le 1ᵉʳ jour du mois
  visé (sauf chômage temporaire déjà indemnisé pour ce mois).

Source interne (formation partenaire) — paraphrasé, jamais cité verbatim.
    `.trim(),
    bodyKey: "changementSituation.theory.transfertsOp.body",
    audience: ["admin", "partner"],
    internalRef: "Slide interne « Transferts d'OP » (formation partenaire), reçue 2026-07-05.",
    lastReviewedAt: "2026-07-05",
  },
];

export const changementSituationPersonnelle: DossierDefinition = {
  slug: "changement-situation-personnelle",
  title: "Changement dans ma situation personnelle",
  titleKey: "changementSituation.title",
  description:
    "Déclare un changement d'adresse, de compte bancaire, de situation familiale, de permis de séjour, de cotisation syndicale ou d'organisme de paiement pendant que tu touches des allocations.",
  descriptionKey: "changementSituation.description",
  category: "emploi",
  icon: "🔄",
  color: "#7C3AED",
  vocabularyTags: [
    "changement d'adresse",
    "déménagement chômage",
    "changement de compte bancaire",
    "situation familiale",
    "permis de séjour",
    "cotisation syndicale",
    "changement d'organisme de paiement",
    "transfert FGTB CSC CAPAC SYNOVA",
    "C1 modification",
  ],
  types: [],
  questions: [],
  warnings: [
    {
      title: "Une seule date par déclaration",
      titleKey: "changementSituation.warning.uneSeuleDate.title",
      message:
        "Si tes changements n'ont pas tous la même date d'effet, fais une déclaration séparée pour chaque date différente.",
      messageKey: "changementSituation.warning.uneSeuleDate.message",
      severity: "info",
    },
  ],
  documents: [
    {
      slug: "c1-changement-situation",
      title: "C1 — Déclaration de changement de situation",
      titleKey: "changementSituation.doc.c1.title",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C1_FR.pdf",
      internalRef:
        "Dossier changement-situation-personnelle, document unique (motif « modification » / « changement d'organisme »).",
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
  ],
  journeyCtaLabel: "Déclarer mon changement",
  journeyCtaLabelKey: "changementSituation.journeyCtaLabel",
  journey: [
    {
      order: 1,
      icon: "user-check",
      title: "Ta situation a changé",
      titleKey: "changementSituation.journey.step1.title",
      body: "Déménagement, nouveau compte bancaire, changement familial, permis de séjour ou envie de changer d'organisme de paiement : ce formulaire couvre ces cas.",
      bodyKey: "changementSituation.journey.step1.body",
    },
    {
      order: 2,
      icon: "file-check",
      title: "Un seul C1 pour plusieurs changements",
      titleKey: "changementSituation.journey.step2.title",
      body: "Tu peux cocher plusieurs cases à la fois si elles prennent effet à la même date. Sinon, fais une déclaration séparée par date.",
      bodyKey: "changementSituation.journey.step2.body",
    },
    {
      order: 3,
      icon: "calendar",
      title: "Prépare tes informations",
      titleKey: "changementSituation.journey.step3.title",
      body: "Nouvelle adresse, IBAN, date d'effet : aie ces éléments sous la main avant de commencer.",
      bodyKey: "changementSituation.journey.step3.body",
    },
    {
      order: 4,
      icon: "wallet",
      title: "Envoi à ton organisme de paiement",
      titleKey: "changementSituation.journey.step4.title",
      body: "Une fois complété, le C1 (et les formulaires complémentaires si besoin) part vers ton organisme de paiement (FGTB, CSC, SYNOVA, CAPAC).",
      bodyKey: "changementSituation.journey.step4.body",
    },
  ],
  theory: THEORY,
};
```

Dans `lib/dossiers/registry.ts`, remplacer :

```ts
import type { DossierDefinition } from "./types";
import { chomageTemporaire } from "./chomage-temporaire";
import { chomageComplet } from "./chomage-complet";
import { chomageFrontalier } from "./chomage-frontalier";
import { prepension } from "./prepension";
import { allocationsInsertion } from "./allocations-insertion";

const REGISTRY: Record<string, DossierDefinition> = {
  [chomageTemporaire.slug]: chomageTemporaire,
  [chomageComplet.slug]: chomageComplet,
  [chomageFrontalier.slug]: chomageFrontalier,
  [prepension.slug]: prepension,
  [allocationsInsertion.slug]: allocationsInsertion,
};
```

par :

```ts
import type { DossierDefinition } from "./types";
import { chomageTemporaire } from "./chomage-temporaire";
import { chomageComplet } from "./chomage-complet";
import { chomageFrontalier } from "./chomage-frontalier";
import { prepension } from "./prepension";
import { allocationsInsertion } from "./allocations-insertion";
import { changementSituationPersonnelle } from "./changement-situation-personnelle";

const REGISTRY: Record<string, DossierDefinition> = {
  [chomageTemporaire.slug]: chomageTemporaire,
  [chomageComplet.slug]: chomageComplet,
  [chomageFrontalier.slug]: chomageFrontalier,
  [prepension.slug]: prepension,
  [allocationsInsertion.slug]: allocationsInsertion,
  [changementSituationPersonnelle.slug]: changementSituationPersonnelle,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/dossiers/__tests__/changement-situation-personnelle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dossiers/changement-situation-personnelle/index.ts lib/dossiers/registry.ts lib/dossiers/__tests__/changement-situation-personnelle.test.ts
git commit -m "feat(dossiers): ajouter le dossier changement-situation-personnelle"
```

---

### Task 5: i18n (FR) + suivi traduction

**Files:**
- Modify: `messages/fr.json`
- Modify: `docs/tasks/NEXT_ACTIONS.md`

**Interfaces:**
- Consumes: clés référencées par `titleKey`/`descriptionKey`/`journeyCtaLabelKey`/`journey[].titleKey`/`journey[].bodyKey`/`warnings[].titleKey`/`warnings[].messageKey`/`documents[].titleKey`/`theory[].titleKey`/`theory[].bodyKey` définies dans Task 4.
- Produces: rien de consommé par du code — dernière tâche de contenu avant validation (Task 6).

- [ ] **Step 1: Localiser le point d'insertion**

Dans `messages/fr.json`, chercher la séquence exacte (fin du bloc `"insertion"` sous `public.dossierContent`, juste avant `"formationsLib"`) :

```json
        }
      }
    },
    "formationsLib": {
```

Cette séquence est unique dans le fichier (repérable par la ligne `"formationsLib": {` qui suit).

- [ ] **Step 2: Insérer le nouveau bloc de traductions**

Remplacer cette séquence par :

```json
        }
      },
      "changementSituation": {
        "title": "Changement dans ma situation personnelle",
        "description": "Déclare un changement d'adresse, de compte bancaire, de situation familiale, de permis de séjour, de cotisation syndicale ou d'organisme de paiement pendant que tu touches des allocations.",
        "journeyCtaLabel": "Déclarer mon changement",
        "journey": {
          "step1": {
            "title": "Ta situation a changé",
            "body": "Déménagement, nouveau compte bancaire, changement familial, permis de séjour ou envie de changer d'organisme de paiement : ce formulaire couvre ces cas."
          },
          "step2": {
            "title": "Un seul C1 pour plusieurs changements",
            "body": "Tu peux cocher plusieurs cases à la fois si elles prennent effet à la même date. Sinon, fais une déclaration séparée par date."
          },
          "step3": {
            "title": "Prépare tes informations",
            "body": "Nouvelle adresse, IBAN, date d'effet : aie ces éléments sous la main avant de commencer."
          },
          "step4": {
            "title": "Envoi à ton organisme de paiement",
            "body": "Une fois complété, le C1 (et les formulaires complémentaires si besoin) part vers ton organisme de paiement (FGTB, CSC, SYNOVA, CAPAC)."
          }
        },
        "warning": {
          "uneSeuleDate": {
            "title": "Une seule date par déclaration",
            "message": "Si tes changements n'ont pas tous la même date d'effet, fais une déclaration séparée pour chaque date différente."
          }
        },
        "doc": {
          "c1": {
            "title": "C1 — Déclaration de changement de situation"
          }
        },
        "theory": {
          "transfertsOp": {
            "title": "Délais des transferts d'organisme de paiement",
            "body": "Le délai d'introduction et la prise d'effet d'un transfert d'organisme de paiement dépendent du type d'allocation en cours :\n\n- **Chômage complet / AGR** : demande à introduire au plus tard le dernier jour du mois précédant celui visé par le transfert ; prise d'effet le 1ᵉʳ jour du mois suivant la réception du flux par le bureau du chômage.\n- **Chômage temporaire** : demande à introduire au plus tard le dernier jour du 2ᵉ mois qui suit celui visé ; prise d'effet dès le 1ᵉʳ jour du mois visé (sauf chômage temporaire déjà indemnisé pour ce mois).\n\nSource interne (formation partenaire) — paraphrasé, jamais cité verbatim."
          }
        }
      }
    },
    "formationsLib": {
```

- [ ] **Step 3: Vérifier le JSON valide**

Run: `pnpm i18n:check`
Expected: section "1. Parse JSON" → `[OK] fr.json` ; section "3. Couverture" signale `changementSituation.*` en clés manquantes pour les 11 autres locales (attendu, non bloquant) ; "Résultat : SUCCÈS".

- [ ] **Step 4: Ajouter les 2 suivis dans NEXT_ACTIONS**

Dans `docs/tasks/NEXT_ACTIONS.md`, ajouter ces deux lignes au tableau (après la ligne `#19`), en gardant le même format :

```
| 20 | P3 | i18n | Traduire le contenu du dossier `changement-situation-personnelle` (titre/description/journey/warning/doc/theory) dans les 12 langues, laissé FR-only à la création | `lib/dossiers/changement-situation-personnelle/index.ts`, `messages/*.json` | Faible | `pnpm i18n:check` | à faire |
| 21 | P2 | Dette | Identifier les 3 vrais noms AcroForm des dates de modification C1 (adresse/situation familiale/compte) via `scripts/dump-c1.ts` et stamper `dateModificationEffective` dessus à la génération PDF | `lib/pdf-forms/seed/c1-fields-improvements.ts`, `lib/pdf-forms/filler.ts` | Faible | `pnpm test` + génération PDF réelle | à faire |
```

- [ ] **Step 5: Commit**

```bash
git add messages/fr.json docs/tasks/NEXT_ACTIONS.md
git commit -m "feat(i18n): traductions FR du dossier changement-situation-personnelle"
```

---

### Task 6: Validation complète (build, tests, seed, vérification manuelle)

**Files:** aucun (validation uniquement).

**Interfaces:**
- Consumes : tout ce qui précède.
- Produces : rien (tâche terminale).

- [ ] **Step 1: Suite complète**

```bash
pnpm test
pnpm build
pnpm i18n:check
```

Expected : les 3 commandes se terminent en succès (nouveaux tests inclus ; `pnpm lint` non requis ici mais ne doit pas régresser si lancé — ~74 erreurs pré-existantes, pas de nouvelle).

- [ ] **Step 2: Vérifier la configuration DB locale avant tout seed**

Avant de créer la moindre ligne en base, vérifier que `DATABASE_URL` (dans `.env.local`) ne pointe pas vers une ressource qu'on ne maîtrise pas. Si le doute persiste sur la nature de la base (Neon partagée vs. locale jetable), **s'arrêter et demander confirmation avant le Step 3** plutôt que de seed à l'aveugle — même si l'opération est additive/idempotente par slug.

- [ ] **Step 3: Seed du nouveau dossier (additif, idempotent)**

Démarrer le serveur de dev (`preview_start`), se connecter en admin dans le navigateur de preview, puis déclencher dans cet ordre (via l'UI admin existante ou un `fetch` authentifié depuis `preview_eval`) :

1. `POST /api/admin/bundles/seed/changement-situation-personnelle` → crée le `DocumentBundle` + le `PdfForm` "c1-changement-situation" (champs auto-inférés à ce stade).
2. `POST /api/admin/pdf-forms/apply-c1-improvements` (mode apply, toutes cibles) → enrichit les champs de "c1-changement-situation" et lui attache `C1_TRIGGERS`, sans toucher aux données des autres dossiers (opération par slug).

- [ ] **Step 4: Vérification manuelle (preview)**

- `/creer-ma-demande` → la tuile "Changement dans ma situation personnelle" apparaît.
- Clic sur la tuile → écran `journey` (4 étapes) s'affiche, PAS de questionnaire.
- CTA "Déclarer mon changement" → formulaire C1 ; le champ motif est pré-sélectionné sur "Je déclare une modification" et reste modifiable.
- Cocher 2 cases parmi adresse/situation familiale/compte bancaire → un seul champ "Date d'effet..." apparaît (pas 3).
- Changer le motif vers "Je change d'organisme de paiement" → le champ date dédié s'affiche avec son aide.
- Répondre "oui" à une question d'activité (ex. activité accessoire) → le formulaire compagnon C1A se matérialise dans le parcours.
- `pnpm test`/`pnpm build` (déjà validés Step 1) : pas de régression sur `/d/chomage-complet` ni `/d/allocations-insertion`.

- [ ] **Step 5: Commit final (si des ajustements ont été faits pendant la vérification)**

```bash
git add <fichiers ajustés explicitement>
git commit -m "fix(dossiers): ajustements post-vérification changement-situation-personnelle"
```

(Sauter ce commit si aucun ajustement n'a été nécessaire.)

## Hors périmètre (rappel du spec)

- Pas de moteur de validation cross-champs générique.
- Pas de modification du mécanisme de triggers/formulaires compagnons (réutilisé tel quel).
- Pas de nouvelle route.
- Stamping réel des 3 dates de modification sur le PDF (noms AcroForm à identifier via `scripts/dump-c1.ts`) : suivi séparé, tracké en `NEXT_ACTIONS.md` #21 (Task 5, Step 4).
- Traduction complète 12 langues : suivi séparé, tracké en `NEXT_ACTIONS.md` #20 (Task 5, Step 4).
