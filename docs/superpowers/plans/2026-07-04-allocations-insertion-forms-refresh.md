# Allocations d'insertion — Refonte parcours documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the separate pre-questionnaire screen from the `allocations-insertion` dossier, replace it with 3 branching questions shown inline above the document list, wire the existing (but never-connected) C1 trigger system onto this dossier's C1 plus a new colocation→Annexe Regis rule, and lock the final C109/36-DEMANDE PDF behind completion of every other document currently required for the citizen's situation.

**Architecture:** All three lots are additive and opt-in (new optional fields on `DossierDefinition`/`DossierDocument`, defaulting to today's behavior when absent). No Prisma migration is needed anywhere in this plan — `PdfForm.fields` and `PdfForm.triggers` are already-existing JSON columns; only their *content* changes. Business logic stays in pure, unit-testable functions (`lib/dossiers/*`, `lib/pdf-forms/*`, `components/docbel/bundle-runner/compute.ts`); React components stay thin wrappers around them.

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript strict / Prisma 5 (Postgres/Neon, JSON columns only in this plan) / Vitest / pdf-lib (via existing `lib/pdf-forms/*`).

## Global Constraints

- No `prisma db push` ever, on any environment. This plan needs **zero schema migration** — verify this stays true; if a task seems to need one, stop and flag it rather than improvising.
- `git add` explicit file paths only — never `-A` (shared, multi-agent workdir).
- Every new dossier/document field is **optional and opt-in**; absence must reproduce today's exact behavior. The existing test suites for other dossiers (and the 271+ existing tests overall) must stay green throughout.
- All new user-facing text this pass is **FR-only** (`{ fr: "..." }`, no `*Key` i18n wiring) — full translation is deferred to `NEXT_ACTIONS.md` item #19, already recorded. Do not add i18n keys in this plan.
- Validation commands: `pnpm test`, `pnpm build` (also typechecks — there is no separate `pnpm typecheck`), `pnpm lint` (repo has ~74 pre-existing errors — do not add new ones, but do not chase the pre-existing ones either).
- Max 3-5 files touched per commit; each task below is already scoped to fit.
- **Explicit scope cut, disclosed to Oraliks before implementation starts:** this plan does **not** build automatic cross-form pre-filling of the Annexe Regis's Grille 1/Grille 2 from the C1's `cohabitants` data (that would require a new "read another form's payload at generation time" mechanism that doesn't exist anywhere in the codebase today). Instead, Task 4 gives the Annexe Regis clean labels and help text that tells the citizen exactly what to write (including the FN4 code) using data they already see on their own C1. Fuller automation is a reasonable fast-follow, not part of this plan.

---

## Task 1: Trim the pre-qualification questions to the 3 that actually branch documents

**Files:**
- Modify: `lib/dossiers/types.ts:305-357` (the `DossierDefinition` interface)
- Modify: `lib/dossiers/allocations-insertion/index.ts:169-302`
- Test: `lib/dossiers/__tests__/insertion-documents.test.ts`

**Interfaces:**
- Produces: `DossierDefinition.inlineDocumentQuestions?: boolean` — consumed by Task 2/3.
- Produces: `allocationsInsertion.questions` now has exactly 3 entries (`age`, `parcoursEtudes`, `aTravaille`) — consumed by Task 2 (rendering) and already consumed by `selectDocuments`/`includeWhen` (unchanged).

- [ ] **Step 1: Write the failing test**

Add to `lib/dossiers/__tests__/insertion-documents.test.ts` (append inside the existing `describe` block, after the last `it`):

```ts
  it("le questionnaire ne garde que les 3 questions qui branchent un document", () => {
    expect(allocationsInsertion.questions.map((q) => q.id)).toEqual([
      "age",
      "parcoursEtudes",
      "aTravaille",
    ]);
  });

  it("le dossier active l'aiguillage en ligne (plus d'écran séparé)", () => {
    expect(allocationsInsertion.inlineDocumentQuestions).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/dossiers/__tests__/insertion-documents.test.ts`
Expected: FAIL — `allocationsInsertion.questions.map(...)` has 9 entries, not 3; `inlineDocumentQuestions` is `undefined`.

- [ ] **Step 3: Add the field to the type**

In `lib/dossiers/types.ts`, inside the `DossierDefinition` interface, right after the `journeyCtaLabelKey?: string;` line:

```ts
  /// Clé i18n du libellé CTA (préférée si fournie).
  journeyCtaLabelKey?: string;
  /// Si vrai : `BundleRunner` n'affiche JAMAIS `EligibilityPrequalifier` en
  /// écran bloquant séparé — les questions de `questions[]` sont rendues en
  /// ligne, au-dessus de la liste de documents, qui reste toujours visible.
  /// Absent/faux = comportement actuel inchangé (écran de pré-qualification
  /// avant les documents). Opt-in par dossier — n'affecte aucun autre dossier
  /// tant qu'il n'est pas explicitement activé sur celui-ci.
  inlineDocumentQuestions?: boolean;
```

- [ ] **Step 4: Trim the questions array and set the flag**

In `lib/dossiers/allocations-insertion/index.ts`, replace the entire `questions: [...]` array (currently spanning from the `questions: [` line through its closing `],` — the block containing `age`, `aTermineEtudes`, `aDiplome`, `stageInsertion`, `inscritDemandeurEmploi`, `nationalite`, `parcoursEtudes`, `aTravaille`, `chargeFamille`) with:

```ts
  questions: [
    // ------- Âge (condition clé : demande avant 25 ans) -------
    {
      id: "age",
      label: { fr: "Quel âge as-tu ?" },
      helpText: {
        fr: "La demande doit en principe être faite avant 25 ans.",
      },
      type: "select",
      options: [
        { value: "moins-18", label: { fr: "Moins de 18 ans" } },
        { value: "18-20", label: { fr: "Entre 18 et 20 ans" } },
        { value: "21-24", label: { fr: "Entre 21 et 24 ans" } },
        { value: "25-plus", label: { fr: "25 ans ou plus" } },
      ],
    },

    // ------- Parcours d'études (branche la preuve d'études à joindre) -------
    {
      id: "parcoursEtudes",
      label: { fr: "Quel est ton parcours d'études ?" },
      helpText: {
        fr: "Cela détermine la preuve d'études à joindre : un formulaire rempli par ton école (secondaire/formation), une copie de ton diplôme (bachelier/master belge), ou un formulaire spécifique si tu as étudié à l'étranger.",
      },
      type: "select",
      options: [
        { value: "secondaire-belge", label: { fr: "Études secondaires ou de formation en Belgique" } },
        { value: "superieur-belge", label: { fr: "Bachelier ou master belge (enseignement supérieur)" } },
        { value: "etranger", label: { fr: "Études à l'étranger" } },
        { value: "autre", label: { fr: "Aucune de ces situations" } },
      ],
    },

    // ------- Travail (le C4 permet de réduire la durée du SIP) -------
    {
      id: "aTravaille",
      label: { fr: "As-tu déjà travaillé comme salarié ?" },
      helpText: {
        fr: "Si tu as travaillé, le C4 remis par ton employeur peut réduire la durée de ton stage d'insertion. Réponds « oui » même pour un job étudiant ou un contrat court.",
      },
      type: "boolean",
    },
  ],

  // Écran de pré-qualification séparé supprimé (2026-07) : ces 3 questions
  // sont rendues en ligne au-dessus des documents (cf. BundleRunner). Les 6
  // questions purement informatives retirées (aTermineEtudes, aDiplome,
  // stageInsertion, inscritDemandeurEmploi, nationalite, chargeFamille) ne
  // branchaient aucun document — leur contenu utile reste dans les cartes
  // "à savoir" du journey ci-dessous.
  inlineDocumentQuestions: true,
```

Also, in the same file, `prefillFromOrientation`, remove the now-dead line referencing a deleted question:

```ts
  prefillFromOrientation: (o) => {
    const out: Record<string, string> = {};
    if (o.situation === "jeune-etudes" && o.subOption === "25-plus") {
      out.age = "25-plus";
    }
    // « Je sors des études, j'ai peu ou pas travaillé » (perte-emploi) :
    // les études sont terminées ou arrêtées.
    if (o.subOption === "sors-etudes") out.aTermineEtudes = "true";
    return out;
  },
```

becomes:

```ts
  prefillFromOrientation: (o) => {
    const out: Record<string, string> = {};
    if (o.situation === "jeune-etudes" && o.subOption === "25-plus") {
      out.age = "25-plus";
    }
    return out;
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run lib/dossiers/__tests__/insertion-documents.test.ts`
Expected: PASS (all tests in the file, including the two new ones and the 9 pre-existing ones — `selectDocuments`/`includeWhen` logic is untouched).

- [ ] **Step 6: Run the full dossier test suite to catch collateral damage**

Run: `pnpm vitest run lib/dossiers`
Expected: PASS. If `lib/dossiers/__tests__/dossier.test.ts` or `lib/dossiers/__tests__/journey.test.ts` fail on a question-count assertion for `allocations-insertion`, update that specific assertion to match the new 3-question list (do not touch assertions for other dossiers).

- [ ] **Step 7: Commit**

```bash
git add lib/dossiers/types.ts lib/dossiers/allocations-insertion/index.ts lib/dossiers/__tests__/insertion-documents.test.ts
git commit -m "feat(allocations-insertion): trim pre-qualification to the 3 branching questions"
```

---

## Task 2: Render the 3 questions inline instead of a blocking screen

**Files:**
- Modify: `components/docbel/bundle-runner.tsx`

**Interfaces:**
- Consumes: `DossierDefinition.inlineDocumentQuestions` (Task 1) — arrives as a new `inlineDocumentQuestions?: boolean` prop on `BundleRunnerProps`, threaded by Task 3.
- Produces: `BundleRunner` renders documents unconditionally and the eligibility question block inline when `inlineDocumentQuestions` is true; behavior is byte-for-byte identical to today when it is false/absent.

- [ ] **Step 1: Manual verification baseline (no automated component test exists for BundleRunner today)**

There is no existing test file for `components/docbel/bundle-runner.tsx` — the codebase's established pattern for this component is manual browser verification (see `docs/superpowers/specs/2026-07-04-allocations-insertion-forms-refresh-design.md`, "Écrans à vérifier manuellement"). Before changing anything, note the current behavior to compare against later: visiting `/d/allocations-insertion` as a fresh visitor shows the journey intro, then after clicking the CTA shows the 3-question block as a full gate with documents hidden until "Continuer" is clicked.

- [ ] **Step 2: Add the new prop and derive the three flags**

In `components/docbel/bundle-runner.tsx`, add to the `BundleRunnerProps` interface (right after `applicableSlugs?: string[] | null;`):

```ts
  /// Documents obligatoires au dossier mais à charge d'un tiers (employeur,
  /// ONEM, mutuelle…). Listés à part — pas de bouton « Compléter ».
  externalDocuments?: ExternalDocument[];
  /// Si vrai : n'affiche jamais la pré-qualification en écran bloquant — les
  /// questions restent visibles en ligne au-dessus des documents, qui sont
  /// toujours affichés. Cf. `DossierDefinition.inlineDocumentQuestions`.
  inlineDocumentQuestions?: boolean;
```

And in the function signature destructuring, add a default:

```ts
export function BundleRunner({
  bundle,
  runId: initialRunId,
  resumeCode: initialResumeCode,
  resumeCodeExpiresAt: initialResumeCodeExpiresAt,
  resumeEmail,
  eligibilityAnswers: initialEligibilityAnswers,
  completedTemplateIds,
  payloads,
  templateNames,
  fieldLabels,
  applicableSlugs = null,
  externalDocuments = [],
  inlineDocumentQuestions = false,
}: BundleRunnerProps) {
```

- [ ] **Step 3: Replace the `showsPrequalifier` computation**

Find:

```ts
  /// Affichage de la pré-qualification :
  /// - quand on n'a pas encore démarré le run ET il y a des questions
  /// - OU quand l'utilisateur a explicitement demandé à revoir ses réponses
  const showsPrequalifier =
    (!runId && hasEligibilityQuestions) || editingEligibility;
```

Replace with:

```ts
  /// Affichage de la pré-qualification :
  /// - mode "gate" (comportement historique, inchangé) : quand on n'a pas
  ///   encore démarré le run ET il y a des questions, OU quand l'utilisateur
  ///   a explicitement demandé à revoir ses réponses.
  /// - mode "en ligne" (`inlineDocumentQuestions`) : jamais de gate — les
  ///   questions et les documents sont TOUJOURS affichés ensemble.
  const showsPrequalifierGate =
    !inlineDocumentQuestions && ((!runId && hasEligibilityQuestions) || editingEligibility);
  const showsQuestions =
    showsPrequalifierGate || (inlineDocumentQuestions && hasEligibilityQuestions);
  const showsDocumentsSection =
    inlineDocumentQuestions || !showsPrequalifierGate || Boolean(runId);
```

- [ ] **Step 4: Update the JSX to use the new flags**

Find the two blocks:

```tsx
      {/* Pré-qualification — informatif, jamais bloquant */}
      {showsPrequalifier && (
        <EligibilityPrequalifier
```

Replace `{showsPrequalifier &&` with `{showsQuestions &&` (keep everything else in that block — props — unchanged).

Find:

```tsx
      {/* Documents — masqué tant que la pré-qualification n'est pas faite */}
      {(!showsPrequalifier || runId) && (
        <>
          {!runId && (
            <Alert>
              <AlertDescription className="text-sm flex items-center justify-between gap-3 flex-wrap">
                <span>
                  {t("runnerStartHint")}
                </span>
              </AlertDescription>
            </Alert>
          )}
```

Replace with:

```tsx
      {/* Documents — masqué tant que la pré-qualification n'est pas faite (mode gate) ; toujours affiché en mode inline */}
      {showsDocumentsSection && (
        <>
          {!runId && !inlineDocumentQuestions && (
            <Alert>
              <AlertDescription className="text-sm flex items-center justify-between gap-3 flex-wrap">
                <span>
                  {t("runnerStartHint")}
                </span>
              </AlertDescription>
            </Alert>
          )}
```

(The closing `</>` and everything else inside stays exactly as-is — only the opening condition and the nested `Alert`'s condition change.)

- [ ] **Step 5: Verify other dossiers are unaffected (regression check)**

For any dossier where `inlineDocumentQuestions` is undefined: `showsPrequalifierGate` reduces to the exact old `showsPrequalifier` expression; `showsQuestions` reduces to `showsPrequalifierGate` (same as old `showsPrequalifier`); `showsDocumentsSection` reduces to `!showsPrequalifierGate || Boolean(runId)` (same as the old `(!showsPrequalifier || runId)`). Confirm this by re-reading the three derivations with `inlineDocumentQuestions = false` substituted — no behavior change is possible for other dossiers.

- [ ] **Step 6: Run the full test suite**

Run: `pnpm test`
Expected: PASS (this file has no dedicated unit tests; this confirms no other suite broke via import/typecheck side effects).

Run: `pnpm build`
Expected: PASS (typecheck catches prop mismatches).

- [ ] **Step 7: Commit**

```bash
git add components/docbel/bundle-runner.tsx
git commit -m "feat(allocations-insertion): render branching questions inline instead of a blocking screen"
```

---

## Task 3: Wire the flag from the dossier definition through the page

**Files:**
- Modify: `app/d/[slug]/page.tsx:298-312`

**Interfaces:**
- Consumes: `dossier?.inlineDocumentQuestions` (Task 1), `BundleRunnerProps.inlineDocumentQuestions` (Task 2).
- Produces: the flag reaches `BundleRunner` in both the journey-intro path and the direct path.

- [ ] **Step 1: Add the field to `runnerProps`**

In `app/d/[slug]/page.tsx`, find:

```ts
        const runnerProps = {
          bundle: serializedBundle,
          runId: effectiveRun?.id ?? null,
          resumeCode: effectiveRun?.resumeCode ?? null,
          resumeCodeExpiresAt: effectiveRun?.resumeCodeExpiresAt?.toISOString() ?? null,
          resumeEmail: effectiveRun?.resumeEmail ?? null,
          eligibilityAnswers,
          completedTemplateIds: (effectiveRun?.completedTemplateIds as string[]) || [],
          payloads,
          templateNames,
          fieldLabels,
          applicableSlugs: finalApplicableSlugs,
          externalDocuments,
        };
```

Replace with:

```ts
        const runnerProps = {
          bundle: serializedBundle,
          runId: effectiveRun?.id ?? null,
          resumeCode: effectiveRun?.resumeCode ?? null,
          resumeCodeExpiresAt: effectiveRun?.resumeCodeExpiresAt?.toISOString() ?? null,
          resumeEmail: effectiveRun?.resumeEmail ?? null,
          eligibilityAnswers,
          completedTemplateIds: (effectiveRun?.completedTemplateIds as string[]) || [],
          payloads,
          templateNames,
          fieldLabels,
          applicableSlugs: finalApplicableSlugs,
          externalDocuments,
          inlineDocumentQuestions: dossier?.inlineDocumentQuestions ?? false,
        };
```

`DossierJourneyIntro`'s prop type is already `ComponentProps<typeof BundleRunner>` with a `...runnerProps` spread, so no change is needed in `components/docbel/dossier-journey-intro.tsx` — the new field flows through automatically once it's part of `runnerProps` and once Task 2 has added it to `BundleRunnerProps`.

- [ ] **Step 2: Run build to confirm no type errors**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Manual browser verification**

Start the dev server (`pnpm dev`), visit `/d/allocations-insertion` as a fresh session (clear the `beldoc-bundle-session` cookie or use a private window):
1. Journey intro shows (theory + 4 steps), click the CTA.
2. Documents list appears **immediately**, with the 3-question block above it (parcours d'études / âge / a travaillé) — no separate gate, no "Continuer" screen blocking the list.
3. Answering "parcours d'études" and clicking the block's action button should create the run and refresh the document list (DIPLÔME or ÉTRANGER appears depending on the answer).
4. Visit `/d/chomage-temporaire` (or any other dossier with `eligibilityQuestions`) and confirm the original gate-then-documents flow is unchanged.

- [ ] **Step 4: Commit**

```bash
git add "app/d/[slug]/page.tsx"
git commit -m "feat(allocations-insertion): thread inlineDocumentQuestions flag to the runner"
```

---

## Task 4: Build the enriched field schema for the Annexe Regis (`c1-regis`)

**Files:**
- Create: `lib/pdf-forms/seed/c1-regis-fields.ts`
- Test: `lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts`

**Interfaces:**
- Produces: `C1_REGIS_FIELDS: PdfFormField[]`, `applyC1RegisImprovements(fields: PdfFormField[]): PdfFormField[]` — consumed by Task 6.

Real AcroForm field names for `private/pdfs/Annexe_Regis_FR.pdf` (42 widgets, 2 pages) were extracted with `lib/pdf-forms/acroform-parser.ts#parsePdf` before writing this task — every `pdfFieldName` below is copied verbatim from that extraction, not guessed.

- [ ] **Step 1: Write the failing test**

Create `lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { C1_REGIS_FIELDS, applyC1RegisImprovements } from "../c1-regis-fields";

describe("C1_REGIS_FIELDS", () => {
  it("couvre l'identité, les 2 lignes nationalité/adresse et les 5 lignes personne", () => {
    const ids = C1_REGIS_FIELDS.map((f) => f.id);
    expect(ids).toContain("nom");
    expect(ids).toContain("prenom");
    expect(ids).toContain("nationaliteDifference");
    expect(ids).toContain("adresseDifference");
    for (let n = 1; n <= 5; n++) {
      expect(ids).toContain(`personne${n}Difference`);
      expect(ids).toContain(`personne${n}C1`);
      expect(ids).toContain(`personne${n}Registre`);
      expect(ids).toContain(`personne${n}Explication`);
    }
  });

  it("les 5 checkboxes 'différence' pointent vers les vrais noms de widgets PDF (oui_3..oui_7)", () => {
    const byId = new Map(C1_REGIS_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("personne1Difference")?.pdfFieldName).toBe("oui_3|non_3");
    expect(byId.get("personne2Difference")?.pdfFieldName).toBe("oui_4|non_4");
    expect(byId.get("personne3Difference")?.pdfFieldName).toBe("oui_5|non_5");
    expect(byId.get("personne4Difference")?.pdfFieldName).toBe("oui_6|non_6");
    expect(byId.get("personne5Difference")?.pdfFieldName).toBe("oui_7|non_7");
  });

  it("le champ explication de la 5e personne pointe vers le widget bare 'PERSONNE' (nommage irrégulier du PDF officiel)", () => {
    const byId = new Map(C1_REGIS_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("personne5Explication")?.pdfFieldName).toBe("PERSONNE");
    expect(byId.get("personne1Explication")?.pdfFieldName).toBe("PERSONNE 1");
  });

  it("l'aide du champ explication mentionne le code FN4 pour la colocation", () => {
    const byId = new Map(C1_REGIS_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("personne1Explication")?.help?.fr).toMatch(/FN4/);
  });

  it("les champs de la grille 2 (indication C1 / registres) sont masqués tant que 'différence' n'est pas oui", () => {
    const byId = new Map(C1_REGIS_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("personne1C1")?.visibleIf).toEqual({
      fieldId: "personne1Difference",
      op: "equals",
      value: "oui",
    });
  });

  it("applyC1RegisImprovements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC1RegisImprovements([]);
    const twice = applyC1RegisImprovements(once);
    expect(twice.length).toBe(once.length);
  });

  it("applyC1RegisImprovements() masque les 2 cases administratives de la page 2 (hors périmètre citoyen)", () => {
    const fields = applyC1RegisImprovements([]);
    const hidden = fields.filter((f) => f.hidden);
    expect(hidden.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts`
Expected: FAIL — `../c1-regis-fields` module does not exist.

- [ ] **Step 3: Write the implementation**

Create `lib/pdf-forms/seed/c1-regis-fields.ts`:

```ts
// Schéma enrichi du formulaire "C1 ANNEXE REGIS" — précisions sur la
// composition de ménage quand une différence existe entre le C1 et les
// registres officiels (registre national).
//
// Mapping AcroForm vérifié sur private/pdfs/Annexe_Regis_FR.pdf via
// lib/pdf-forms/acroform-parser.ts#parsePdf (2 pages, 42 widgets).
// Référence métier : légende "Explications relatives à la rubrique I" (page
// 2 du formulaire officiel) — codes N1-N2 (nationalité), A1-A2 + sous-codes
// (adresse), FN1-FN5 / FY1-FY5 (membres du ménage).

import type { PdfFormField } from "../types";

const SECTION_IDENTITE = "identite";
const SECTION_GRILLE1 = "grille-differences";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

const YN = [
  { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
  { value: "non", label: { fr: "Non", nl: "", de: "" } },
];

/// Préfixes exacts des 2 colonnes de la Grille 1 sur le PDF officiel — la
/// virgule et les apostrophes du texte affiché sont absentes du nom de champ
/// technique (comportement du PDF source, pas une décision de notre côté).
const GRILLE1_C1_PREFIX =
  "INDICATION SUR LE C1 indiquez la nationalité ladresse le nom et le prénom";
const GRILLE1_REGISTRE_PREFIX =
  "INDICATION DANS LES REGISTRES indiquez la nationalité ladresse le nom et le prénom";

const FN4_HELP =
  "Si cette personne est une ou un colocataire (aucun lien de parenté) qui vit réellement à la même adresse mais avec qui tu ne partages pas la vie domestique/financière : indique le code FN4. Pour les autres cas, réfère-toi à la légende page 2 du formulaire officiel (codes FN1-FN5, FY1-FY5).";

/// Une ligne de la Grille 1/Grille 2 hors "personne" (nationalité, adresse).
function fixedRow(opts: {
  key: "nationalite" | "adresse";
  label: string;
  checkboxSuffix: string; // "" pour la 1re ligne (bare), "_2" pour la 2e…
  grille1Suffix: string; // "MA NATIONALITE" | "MON ADRESSE"
  order: number;
}): PdfFormField[] {
  const diffId = `${opts.key}Difference`;
  const checkbox =
    opts.checkboxSuffix === ""
      ? "oui|non"
      : `oui${opts.checkboxSuffix}|non${opts.checkboxSuffix}`;
  return [
    {
      id: diffId,
      pdfFieldName: checkbox,
      type: "radio",
      required: false,
      label: { fr: `${opts.label} — y a-t-il une différence avec les registres ?`, nl: "", de: "" },
      options: YN,
      section: SECTION_GRILLE1,
      order: opts.order,
    },
    {
      id: `${opts.key}C1`,
      pdfFieldName: `${GRILLE1_C1_PREFIX}${opts.grille1Suffix}`,
      type: "text",
      required: false,
      label: { fr: `${opts.label} — indication sur le C1`, nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: opts.order + 1,
    },
    {
      id: `${opts.key}Registre`,
      pdfFieldName: `${GRILLE1_REGISTRE_PREFIX}${opts.grille1Suffix}`,
      type: "text",
      required: false,
      label: { fr: `${opts.label} — indication dans les registres officiels`, nl: "", de: "" },
      help: { fr: "Ce que dit ton registre national — vérifie sur ton eID.", nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: opts.order + 2,
    },
    {
      id: `${opts.key}Explication`,
      pdfFieldName: opts.grille1Suffix,
      type: "text",
      required: false,
      label: { fr: `${opts.label} — explication (voir légende page 2, codes N/A)`, nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: opts.order + 3,
    },
  ];
}

/// Une ligne "Personne N" (N = 1..5). La 5e personne n'a pas de suffixe
/// numérique sur le PDF officiel (nommage irrégulier — même limitation déjà
/// documentée pour la grille "cohabitants" du C1 lui-même).
function personneRow(n: 1 | 2 | 3 | 4 | 5): PdfFormField[] {
  const checkboxSuffix = { 1: "_3", 2: "_4", 3: "_5", 4: "_6", 5: "_7" }[n];
  const grille1Suffix = n === 5 ? "PERSONNE" : `PERSONNE ${n}`;
  const label = n === 5 ? "Personne (5e)" : `Personne ${n}`;
  const diffId = `personne${n}Difference`;
  const order = 200 + n * 10;
  return [
    {
      id: diffId,
      pdfFieldName: `oui${checkboxSuffix}|non${checkboxSuffix}`,
      type: "radio",
      required: false,
      label: { fr: `${label} — y a-t-il une différence avec les registres ?`, nl: "", de: "" },
      options: YN,
      section: SECTION_GRILLE1,
      order,
    },
    {
      id: `personne${n}C1`,
      pdfFieldName: `${GRILLE1_C1_PREFIX}${grille1Suffix}`,
      type: "text",
      required: false,
      label: { fr: `${label} — indication sur le C1 (nom, prénom)`, nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: order + 1,
    },
    {
      id: `personne${n}Registre`,
      pdfFieldName: `${GRILLE1_REGISTRE_PREFIX}${grille1Suffix}`,
      type: "text",
      required: false,
      label: { fr: `${label} — indication dans les registres officiels`, nl: "", de: "" },
      help: { fr: "Ce que dit ton registre national pour cette personne — vérifie sur son eID ou demande-lui.", nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: order + 2,
    },
    {
      id: `personne${n}Explication`,
      pdfFieldName: grille1Suffix,
      type: "text",
      required: false,
      label: { fr: `${label} — explication (code)`, nl: "", de: "" },
      help: { fr: FN4_HELP, nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: order + 3,
    },
  ];
}

export const C1_REGIS_FIELDS: PdfFormField[] = [
  {
    id: "nom",
    pdfFieldName: "NOM",
    type: "text",
    required: true,
    label: { fr: "Nom", nl: "", de: "" },
    prefillFrom: "profile.lastName",
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    id: "prenom",
    pdfFieldName: "PRENOM",
    type: "text",
    required: true,
    label: { fr: "Prénom", nl: "", de: "" },
    prefillFrom: "profile.firstName",
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "dateDA",
    pdfFieldName: "Date de DA",
    type: "date",
    required: true,
    label: { fr: "Date de la demande d'allocations", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_IDENTITE,
    order: -98,
  },

  ...fixedRow({ key: "nationalite", label: "Ma nationalité", checkboxSuffix: "", grille1Suffix: "MA NATIONALITE", order: 100 }),
  ...fixedRow({ key: "adresse", label: "Mon adresse", checkboxSuffix: "_2", grille1Suffix: "MON ADRESSE", order: 110 }),
  ...personneRow(1),
  ...personneRow(2),
  ...personneRow(3),
  ...personneRow(4),
  ...personneRow(5),

  {
    id: "nombreAnnexesJointes",
    pdfFieldName: "Nombre d'annexe joint",
    type: "number",
    required: false,
    label: { fr: "Nombre d'annexes jointes", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 900,
  },
  {
    id: "signature",
    pdfFieldName: "Signature6",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique", nl: "", de: "" },
    help: { fr: "Signature « façon Adobe » : ton nom + prénom + horodatage seront appliqués à la position de la signature.", nl: "", de: "" },
    section: SECTION_SIGNATURE,
    order: 1000,
  },

  // Cases administratives (page 2) : utilisées uniquement quand le Registre
  // national lui-même n'a aucune donnée exploitable — décision de
  // l'ONEM/bureau du chômage, pas une déclaration citoyenne. Masquées.
  {
    id: "regisRegistreIndisponible1",
    pdfFieldName:
      "La rubrique I ne peut pas être complétée parce que les données du Registre national ou des registres de la",
    type: "checkbox",
    required: false,
    label: { fr: "(cas administratif — registre indisponible)", nl: "", de: "" },
    hidden: true,
    section: SECTION_ANNEXES,
    order: 1100,
  },
  {
    id: "regisRegistreIndisponible2",
    pdfFieldName:
      "La rubrique I nest pas entièrement complétée parce que le chômeur est uniquement connu dans les registres",
    type: "checkbox",
    required: false,
    label: { fr: "(cas administratif — registre partiellement indisponible)", nl: "", de: "" },
    hidden: true,
    section: SECTION_ANNEXES,
    order: 1101,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
export function applyC1RegisImprovements(fields: PdfFormField[]): PdfFormField[] {
  const newIds = new Set(C1_REGIS_FIELDS.map((f) => f.id));
  const preserved = fields.filter((f) => !newIds.has(f.id));
  return [...preserved, ...C1_REGIS_FIELDS];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Run the full pdf-forms test suite**

Run: `pnpm vitest run lib/pdf-forms`
Expected: PASS (no other test imports this new module yet, so no collateral risk — this step just confirms nothing else in the directory was accidentally broken by editing near it).

- [ ] **Step 6: Commit**

```bash
git add lib/pdf-forms/seed/c1-regis-fields.ts lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts
git commit -m "feat(pdf-forms): enrich the Annexe Regis (c1-regis) field schema"
```

---

## Task 5: Add the "Habites-tu en colocation ?" question and its trigger to the C1

**Files:**
- Modify: `lib/pdf-forms/seed/c1-fields-improvements.ts`
- Test: create `lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts` (no test file exists for this module today)

**Interfaces:**
- Produces: a new entry in `C1_QUESTIONS` with `id: "habiteEnColocation"`; a new entry in `C1_TRIGGERS` targeting `requiresFormSlug: "c1-regis"`.
- Consumes: none new (this task only adds to existing exported arrays; the FAC→C1-Partenaire and the 8 other existing triggers are untouched, per the confirmed domain rule that they're already correct).

- [ ] **Step 1: Write the failing test**

Create `lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { C1_QUESTIONS, C1_TRIGGERS } from "../c1-fields-improvements";
import { evaluateTrigger } from "../../triggers";

describe("C1_QUESTIONS — habiteEnColocation", () => {
  it("existe, est de type boolean-like (radio oui/non), et n'est visible que si cohabite", () => {
    const q = C1_QUESTIONS.find((f) => f.id === "habiteEnColocation");
    expect(q).toBeDefined();
    expect(q?.type).toBe("radio");
    expect(q?.visibleIf).toEqual({ fieldId: "statutFamilial", op: "equals", value: "cohabite" });
  });
});

describe("C1_TRIGGERS — colocation → Annexe Regis", () => {
  it("déclenche c1-regis quand habiteEnColocation = oui", () => {
    const t = C1_TRIGGERS.find(
      (trig) => trig.whenFieldId === "habiteEnColocation" && trig.requiresFormSlug === "c1-regis",
    );
    expect(t).toBeDefined();
    expect(evaluateTrigger(t!, { habiteEnColocation: "oui" })).toBe(true);
    expect(evaluateTrigger(t!, { habiteEnColocation: "non" })).toBe(false);
  });

  it("le trigger existant 'situationCohabitationAmbigue' reste inchangé (autres cas ambigus)", () => {
    const t = C1_TRIGGERS.find((trig) => trig.whenFieldId === "situationCohabitationAmbigue");
    expect(t).toBeDefined();
    expect(t?.requiresFormSlug).toBe("c1-regis");
  });

  it("les 9 déclencheurs pré-existants sont toujours présents (aucun retiré)", () => {
    expect(C1_TRIGGERS.length).toBeGreaterThanOrEqual(10); // 9 existants + 1 nouveau
    const targets = C1_TRIGGERS.map((t) => t.requiresFormSlug);
    for (const slug of ["c1-partenaire", "c47", "c1-regis", "c46", "c1c", "c1a", "c1b"]) {
      expect(targets).toContain(slug);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`
Expected: FAIL — no `habiteEnColocation` in `C1_QUESTIONS`, no matching trigger.

- [ ] **Step 3: Add the question**

In `lib/pdf-forms/seed/c1-fields-improvements.ts`, inside `C1_QUESTIONS`, right after the `situationCohabitationAmbigueDejaDeclare` entry (the `dejaDeclare({...})` call for `situationCohabitationAmbigue`) and before the `cohabitants` array field, insert:

```ts
  {
    id: "habiteEnColocation",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Habites-tu en colocation ?", nl: "", de: "" },
    help: {
      fr: "Colocation = tu partages un logement avec une ou plusieurs personnes SANS lien de parenté ni de couple (chacun sa vie, pas de ménage commun) — même si le registre national vous montre à la même adresse. Cette précision permet d'ajouter automatiquement l'ANNEXE REGIS à ton parcours.",
      nl: "", de: "",
    },
    options: YN,
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "cohabite" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 106,
  },
```

- [ ] **Step 4: Add the trigger**

In the same file, inside `C1_TRIGGERS`, right after the existing `situationCohabitationAmbigue` trigger entry, insert:

```ts
  {
    // Nouvelle question concrète (2026-07) : la colocation (aucun lien de
    // parenté, pas de ménage commun) est exactement le cas couvert par le
    // code FN4 de l'Annexe Regis. Pas de suivi "déjà déclaré" pour cette
    // question — non demandé, cf. spec.
    whenFieldId: "habiteEnColocation",
    whenValue: "oui",
    requiresFormSlug: "c1-regis",
    reason: { fr: "Colocation à préciser via l'Annexe Regis (code FN4)", nl: "", de: "" },
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 6: Run the pdf-forms suite + full suite**

Run: `pnpm vitest run lib/pdf-forms`
Expected: PASS.

Run: `pnpm test`
Expected: PASS (271+ tests, no regression).

- [ ] **Step 7: Commit**

```bash
git add lib/pdf-forms/seed/c1-fields-improvements.ts lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts
git commit -m "feat(pdf-forms): add colocation question triggering the Annexe Regis (FN4)"
```

---

## Task 6: Fix the C1-improvement script's targeting bug and extend it to `c1-insertion` + `c1-regis`

**Files:**
- Modify: `scripts/apply-c1-improvements.ts`

**Interfaces:**
- Consumes: `applyC1Improvements`, `C1_TRIGGERS` (existing), `applyC1RegisImprovements` (Task 4).
- Produces: a script runnable with `pnpm tsx scripts/apply-c1-improvements.ts` (dry-run) / `--yes` (apply) that updates explicit slugs instead of "whichever PdfForm was most recently touched."

- [ ] **Step 1: Rewrite the script**

Replace the full contents of `scripts/apply-c1-improvements.ts`:

```ts
// Applique les améliorations de schéma sur les PdfForms de la famille C1 en
// DB : le C1 générique, le C1 du dossier insertion (c1-insertion) et
// l'Annexe Regis (c1-regis).
//
// AVANT (bug) : ce script ciblait "le PdfForm le plus récemment modifié dont
// sourceFileName contient C1_FR" — comme c1-insertion partage le même
// fichier source (C1_FR.pdf) que le C1 générique, il risquait de mettre à
// jour le mauvais PdfForm selon l'ordre des dernières modifications.
// MAINTENANT : cible une liste de slugs explicite, un par un.
//
// Idempotent : à relancer après chaque ré-import.
//
// Usage : pnpm tsx scripts/apply-c1-improvements.ts        (dry run par défaut)
//         pnpm tsx scripts/apply-c1-improvements.ts --yes  (applique en DB)

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyC1Improvements, C1_TRIGGERS } from "@/lib/pdf-forms/seed/c1-fields-improvements";
import { applyC1RegisImprovements } from "@/lib/pdf-forms/seed/c1-regis-fields";
import type { PdfFormField, PdfFormTrigger } from "@/lib/pdf-forms/types";

const APPLY = process.argv.includes("--yes");

interface TargetConfig {
  slug: string;
  improve: (fields: PdfFormField[]) => PdfFormField[];
  triggers: PdfFormTrigger[];
}

const TARGETS: TargetConfig[] = [
  { slug: "c1", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  { slug: "c1-insertion", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  { slug: "c1-regis", improve: applyC1RegisImprovements, triggers: [] },
];

async function applyOne(target: TargetConfig) {
  const form = await prisma.pdfForm.findUnique({
    where: { slug: target.slug },
    select: { id: true, slug: true, title: true, version: true, fields: true, triggers: true },
  });
  if (!form) {
    console.log(`⚠️  ${target.slug.padEnd(16)} introuvable en DB — seed-le d'abord (endpoint admin ou seed-c1-companion-forms.ts).`);
    return;
  }

  const current = (form.fields as unknown as PdfFormField[]) || [];
  const improved = target.improve(current);

  console.log(`\n${target.slug} (v${form.version}, id=${form.id})`);
  console.log(`  Champs avant     : ${current.length}`);
  console.log(`  Champs après     : ${improved.length}`);
  console.log(`  Triggers avant   : ${Array.isArray(form.triggers) ? form.triggers.length : 0}`);
  console.log(`  Triggers après   : ${target.triggers.length}`);

  if (!APPLY) return;

  await prisma.pdfForm.update({
    where: { id: form.id },
    data: {
      fields: improved as unknown as Prisma.InputJsonValue,
      triggers: target.triggers as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`  ✓ mis à jour`);
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}`);
  for (const target of TARGETS) {
    await applyOne(target);
  }
  if (!APPLY) {
    console.log("\nDry-run terminé. Passe --yes pour appliquer.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build`
Expected: PASS (typecheck only — this script isn't covered by vitest, and it must NOT be run against a real database from this task; see Task 7).

- [ ] **Step 3: Commit**

```bash
git add scripts/apply-c1-improvements.ts
git commit -m "fix(pdf-forms): target explicit C1-family slugs instead of most-recently-updated"
```

---

## Task 7: [MANUAL — run in production, not from an automated coding task]

This task has **no code to write**. It is the operational step that makes Tasks 4-6 take effect on the live database. Do not run this from local dev — per existing project constraints, the Vercel Blob token only exists in the production environment, and the database is the shared Neon instance; seeding or updating `PdfForm` rows from local dev risks writing a broken (local-disk) storage path into a row Vercel prod will later read.

- [ ] **Step 1: Confirm the corrected code from Tasks 4-6 is deployed to production**

Check `GET /api/version` returns the commit SHA that includes Tasks 4-6 (cf. `project-insertion-document-tree` memory note on this endpoint).

- [ ] **Step 2: Confirm `c1-regis` exists in prod DB**

If `scripts/seed-c1-companion-forms.ts` has not been run against prod yet for `c1-regis` (Annexe_Regis_FR.pdf), run it there first (`pnpm tsx scripts/seed-c1-companion-forms.ts --yes`, executed in the environment that has prod DB + Blob access — the same way the other companions were originally seeded).

- [ ] **Step 3: Dry-run the corrected improvement script against prod**

`pnpm tsx scripts/apply-c1-improvements.ts` (no `--yes`) — read the console output for all 3 targets (`c1`, `c1-insertion`, `c1-regis`). Confirm none report "introuvable" unexpectedly, and that the before/after field and trigger counts look sane (c1/c1-insertion should show 9 triggers after; c1-regis should show its field count jump to the ~35 fields from Task 4).

- [ ] **Step 4: Apply**

`pnpm tsx scripts/apply-c1-improvements.ts --yes`, run in the same prod-connected environment as Step 3.

- [ ] **Step 5: Smoke-test in prod**

Open `/document/c1-insertion` (or start a run via `/d/allocations-insertion`) and confirm the enriched C1 renders (proper labels, cohabitants grid, the new colocation question) instead of the old NISS-only stub. Answer "oui" to the new colocation question with at least one `aucun-lien` cohabitant and confirm `c1-regis` appears as a required document in the dossier's document list, with the labels from Task 4 (not raw auto-inferred names).

---

## Task 8: Extract a shared "which documents are currently triggered" helper

**Files:**
- Modify: `lib/pdf-forms/triggers.ts`
- Modify: `app/d/[slug]/page.tsx:119-136`
- Test: `lib/pdf-forms/__tests__/triggers.test.ts`

**Interfaces:**
- Produces: `collectAllTriggeredSlugs(items: BundleItemForTriggers[], payloads: Record<string, unknown>): string[]` — consumed by Task 12 (server-side lock check) and by the refactored `page.tsx`.

- [ ] **Step 1: Write the failing test**

Append to `lib/pdf-forms/__tests__/triggers.test.ts`:

```ts
import { collectAllTriggeredSlugs } from "../triggers";

describe("collectAllTriggeredSlugs", () => {
  it("agrège les triggers de plusieurs items du bundle et déduplique contre les slugs déjà présents", () => {
    const items = [
      {
        pdfFormId: "form-c1",
        pdfFormSlug: "c1-insertion",
        rawTriggers: [
          { whenFieldId: "tremplinIndependants", whenValue: "oui", requiresFormSlug: "c1c" },
          { whenFieldId: "administrateurSociete", whenValue: "oui", requiresFormSlug: "c1a" },
        ],
      },
      {
        pdfFormId: "form-demande",
        pdfFormSlug: "c109-36-demande",
        rawTriggers: [],
      },
    ];
    const payloads = {
      "form-c1": { tremplinIndependants: "oui", administrateurSociete: "non" },
    };
    expect(collectAllTriggeredSlugs(items, payloads).sort()).toEqual(["c1c"]);
  });

  it("ignore un item déjà présent dans le bundle (pas de doublon avec un slug existant)", () => {
    const items = [
      {
        pdfFormId: "form-c1",
        pdfFormSlug: "c1a", // déjà dans le bundle sous ce même slug
        rawTriggers: [{ whenFieldId: "x", whenValue: "oui", requiresFormSlug: "c1a" }],
      },
    ];
    expect(collectAllTriggeredSlugs(items, { "form-c1": { x: "oui" } })).toEqual([]);
  });

  it("ignore les items sans payload ou sans pdfFormId", () => {
    const items = [
      { pdfFormId: null, pdfFormSlug: null, rawTriggers: [] },
      {
        pdfFormId: "form-c1",
        pdfFormSlug: "c1-insertion",
        rawTriggers: [{ whenFieldId: "x", whenValue: "oui", requiresFormSlug: "c1a" }],
      },
    ];
    expect(collectAllTriggeredSlugs(items, {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/pdf-forms/__tests__/triggers.test.ts`
Expected: FAIL — `collectAllTriggeredSlugs` is not exported.

- [ ] **Step 3: Add the function**

In `lib/pdf-forms/triggers.ts`, add at the end of the file:

```ts
/// Un item du bundle, réduit aux 3 champs nécessaires pour agréger les
/// déclencheurs de tout le dossier (pas de dépendance à Prisma ici — le
/// caller mappe ses propres types vers cette forme minimale).
export interface BundleItemForTriggers {
  pdfFormId: string | null;
  pdfFormSlug: string | null;
  /// Valeur brute JSON du champ `PdfForm.triggers` — parsée en interne.
  rawTriggers: unknown;
}

/// Agrège les documents actuellement déclenchés par les réponses déjà
/// données dans N'IMPORTE LEQUEL des formulaires du bundle (pas seulement le
/// C1) — un slug déjà présent dans le bundle n'est jamais re-proposé.
/// Utilisé par `app/d/[slug]/page.tsx` (matérialisation des items virtuels)
/// et par la route `generate` (verrou de téléchargement, cf. Task 9-12).
export function collectAllTriggeredSlugs(
  items: BundleItemForTriggers[],
  payloads: Record<string, unknown>
): string[] {
  const existingSlugs = new Set(
    items.map((it) => it.pdfFormSlug).filter((s): s is string => !!s)
  );
  const triggeredSlugs = new Set<string>();
  for (const item of items) {
    if (!item.pdfFormId) continue;
    const payload = payloads[item.pdfFormId] as FormPayload | undefined;
    if (!payload) continue;
    const triggers = parseTriggers(item.rawTriggers);
    if (triggers.length === 0) continue;
    for (const s of collectTriggeredSlugs(triggers, payload)) {
      if (!existingSlugs.has(s)) triggeredSlugs.add(s);
    }
  }
  return [...triggeredSlugs];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/pdf-forms/__tests__/triggers.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `page.tsx` to use the shared function (no behavior change)**

In `app/d/[slug]/page.tsx`, replace:

```ts
  // --- Évaluation des déclencheurs ---
  // Pour chaque PdfForm complété (ayant un payload), on évalue ses triggers
  // contre son payload et on collecte les slugs requis. Les slugs déjà présents
  // dans le bundle ne sont pas re-matérialisés.
  const existingSlugs = new Set(
    bundle.items.map((it) => it.pdfForm?.slug).filter((s): s is string => !!s)
  );
  const triggeredSlugs = new Set<string>();
  for (const item of bundle.items) {
    if (!item.pdfForm) continue;
    const payload = (payloads[item.pdfForm.id] as FormPayload) || null;
    if (!payload) continue;
    const triggers = parseTriggers(item.pdfForm.triggers);
    if (triggers.length === 0) continue;
    for (const s of collectTriggeredSlugs(triggers, payload)) {
      if (!existingSlugs.has(s)) triggeredSlugs.add(s);
    }
  }
```

with:

```ts
  // --- Évaluation des déclencheurs (logique partagée, cf. lib/pdf-forms/triggers.ts) ---
  const triggeredSlugsList = collectAllTriggeredSlugs(
    bundle.items.map((it) => ({
      pdfFormId: it.pdfFormId,
      pdfFormSlug: it.pdfForm?.slug ?? null,
      rawTriggers: it.pdfForm?.triggers,
    })),
    payloads,
  );
  const triggeredSlugs = new Set(triggeredSlugsList);
```

And update the import line near the top of the file:

```ts
import { collectTriggeredSlugs, parseTriggers } from "@/lib/pdf-forms/triggers";
```

becomes:

```ts
import { collectAllTriggeredSlugs } from "@/lib/pdf-forms/triggers";
```

(`collectTriggeredSlugs`/`parseTriggers` are no longer referenced directly in this file — everything below that used to read `triggeredSlugs` as a `Set<string>` keeps working unchanged, since we still assign `const triggeredSlugs = new Set(...)` at the end.)

- [ ] **Step 6: Run tests + build**

Run: `pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 7: Manual verification**

Visit `/d/allocations-insertion`, complete the C1 with an answer that triggers a companion (e.g. "oui" to tremplin-indépendants) and confirm the companion still appears in the document list exactly as before this refactor (this step only moved code, it must not change observed behavior).

- [ ] **Step 8: Commit**

```bash
git add lib/pdf-forms/triggers.ts "app/d/[slug]/page.tsx" lib/pdf-forms/__tests__/triggers.test.ts
git commit -m "refactor(pdf-forms): extract collectAllTriggeredSlugs shared by page and generate route"
```

---

## Task 9: Add the `gatedByRestOfDossier` field and set it on C109/36-DEMANDE

**Files:**
- Modify: `lib/dossiers/types.ts`
- Modify: `lib/dossiers/allocations-insertion/index.ts`
- Test: `lib/dossiers/__tests__/insertion-documents.test.ts`

**Interfaces:**
- Produces: `DossierDocument.gatedByRestOfDossier?: boolean`, set to `true` only on `c109-36-demande` — consumed by Task 10 (UI) and Task 12 (server enforcement).

- [ ] **Step 1: Write the failing test**

Append to `lib/dossiers/__tests__/insertion-documents.test.ts`:

```ts
  it("seul C109/36-DEMANDE est marqué gatedByRestOfDossier", () => {
    const gated = allocationsInsertion.documents.filter((d) => d.gatedByRestOfDossier);
    expect(gated.map((d) => d.slug)).toEqual(["c109-36-demande"]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/dossiers/__tests__/insertion-documents.test.ts`
Expected: FAIL — `gatedByRestOfDossier` is `undefined` on every document.

- [ ] **Step 3: Add the field to the type**

In `lib/dossiers/types.ts`, inside the `DossierDocument` interface, right after the `lockUndeclaredFields?: boolean;` field (and its doc comment):

```ts
  /// Si `true` : ce document (obligatoire, remplissable) reste verrouillé —
  /// non téléchargeable — tant que TOUT AUTRE document actuellement
  /// obligatoire et applicable du dossier (branche + déclenchés par un autre
  /// formulaire) n'est pas complété. Réservé à UN SEUL document par dossier :
  /// celui qui matérialise la soumission finale (ex. C109/36-DEMANDE). Ne
  /// jamais poser sur plus d'un document du même dossier — ça créerait un
  /// verrou circulaire (aucun des deux ne pourrait jamais se débloquer).
  gatedByRestOfDossier?: boolean;
```

- [ ] **Step 4: Set the flag on C109/36-DEMANDE**

In `lib/dossiers/allocations-insertion/index.ts`, in the `c109-36-demande` document entry, add `gatedByRestOfDossier: true,` right after `required: true,`:

```ts
    {
      slug: "c109-36-demande",
      title: "C109/36-DEMANDE — Demande d'allocations d'insertion",
      titleKey: "insertion.doc.c109Demande.title",
      issuer: "ONEM",
      required: true,
      gatedByRestOfDossier: true,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run lib/dossiers/__tests__/insertion-documents.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/dossiers/types.ts lib/dossiers/allocations-insertion/index.ts lib/dossiers/__tests__/insertion-documents.test.ts
git commit -m "feat(allocations-insertion): mark C109/36-DEMANDE as gated by the rest of the dossier"
```

---

## Task 10: Compute the `locked` status in `compute.ts`

**Files:**
- Modify: `components/docbel/bundle-runner/compute.ts`
- Test: create `components/docbel/bundle-runner/__tests__/compute.test.ts` (no test file exists for this module today)

**Interfaces:**
- Consumes: existing `evaluateCondition`, `BundleCondition`, `CollectedPayloads` (unchanged).
- Produces: `ItemStatus.locked: boolean`; `computeItemStatuses` gains a 5th parameter `opts: { eligibilityAnswersComplete?: boolean; gatedSlugs?: string[] } = {}`.

- [ ] **Step 1: Write the failing test**

Create `components/docbel/bundle-runner/__tests__/compute.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeItemStatuses, type BundleItem } from "../compute";

function item(overrides: Partial<BundleItem>): BundleItem {
  return {
    id: overrides.id ?? "item-1",
    templateId: null,
    pdfFormId: overrides.pdfFormId ?? "form-1",
    order: overrides.order ?? 0,
    required: overrides.required ?? true,
    condition: overrides.condition ?? null,
    template: null,
    triggered: overrides.triggered,
    pdfForm: overrides.pdfForm ?? {
      id: overrides.pdfFormId ?? "form-1",
      slug: overrides.id ?? "item-1",
      title: "Doc",
      description: null,
      issuer: null,
    },
  };
}

describe("computeItemStatuses — locked (gatedByRestOfDossier)", () => {
  const c1 = item({ id: "c1", pdfFormId: "form-c1" });
  const diplome = item({ id: "c109-36-diplome", pdfFormId: "form-diplome" });
  const demande = item({ id: "c109-36-demande", pdfFormId: "form-demande" });
  const items = [c1, diplome, demande];

  it("verrouillé si les questions d'aiguillage n'ont pas de réponse, même si tout le reste est fait", () => {
    const { itemStatuses } = computeItemStatuses(
      items,
      ["form-c1", "form-diplome"],
      {},
      ["c1", "c109-36-diplome", "c109-36-demande"],
      { eligibilityAnswersComplete: false, gatedSlugs: ["c109-36-demande"] },
    );
    const demandeStatus = itemStatuses.find((s) => s.item.id === "c109-36-demande")!;
    expect(demandeStatus.locked).toBe(true);
  });

  it("verrouillé si le document de branche applicable n'est pas complété", () => {
    const { itemStatuses } = computeItemStatuses(
      items,
      ["form-c1"], // diplôme pas encore fait
      {},
      ["c1", "c109-36-diplome", "c109-36-demande"],
      { eligibilityAnswersComplete: true, gatedSlugs: ["c109-36-demande"] },
    );
    const demandeStatus = itemStatuses.find((s) => s.item.id === "c109-36-demande")!;
    expect(demandeStatus.locked).toBe(true);
  });

  it("déverrouillé quand C1 + document de branche sont tous les deux complétés et les questions répondues", () => {
    const { itemStatuses } = computeItemStatuses(
      items,
      ["form-c1", "form-diplome"],
      {},
      ["c1", "c109-36-diplome", "c109-36-demande"],
      { eligibilityAnswersComplete: true, gatedSlugs: ["c109-36-demande"] },
    );
    const demandeStatus = itemStatuses.find((s) => s.item.id === "c109-36-demande")!;
    expect(demandeStatus.locked).toBe(false);
  });

  it("un document non marqué gatedByRestOfDossier n'est jamais verrouillé", () => {
    const { itemStatuses } = computeItemStatuses(
      items,
      [],
      {},
      ["c1", "c109-36-diplome", "c109-36-demande"],
      { eligibilityAnswersComplete: false, gatedSlugs: ["c109-36-demande"] },
    );
    const c1Status = itemStatuses.find((s) => s.item.id === "c1")!;
    expect(c1Status.locked).toBe(false);
  });

  it("sans opts (dossiers non concernés), locked est toujours false — comportement inchangé", () => {
    const { itemStatuses } = computeItemStatuses(items, [], {}, null);
    expect(itemStatuses.every((s) => s.locked === false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/docbel/bundle-runner/__tests__/compute.test.ts`
Expected: FAIL — `locked` is `undefined`, not `boolean`; `computeItemStatuses` doesn't accept a 5th parameter.

- [ ] **Step 3: Extend `compute.ts`**

In `components/docbel/bundle-runner/compute.ts`, update the `ItemStatus` interface:

```ts
export interface ItemStatus {
  item: BundleItem;
  completed: boolean;
  /// `false` = hors dossier / condition non remplie ; `true` = applicable ;
  /// `"pending"` = condition en attente d'autres réponses.
  eligibility: boolean | "pending";
  /// `true` si cet item est marqué `gatedByRestOfDossier` (cf.
  /// lib/dossiers/types.ts) ET qu'il manque au moins un autre document
  /// obligatoire+applicable, ou que les questions d'aiguillage n'ont pas
  /// encore de réponse. Toujours `false` pour un item non gated.
  locked: boolean;
}
```

Update the function signature and body:

```ts
export interface ComputeItemStatusesOptions {
  /// Toutes les questions de `dossier.questions` ont-elles une réponse ? Cf.
  /// `eligibilityCompleted` déjà calculé dans BundleRunner. Absent = true
  /// (aucun impact pour les dossiers qui n'utilisent pas `gatedSlugs`).
  eligibilityAnswersComplete?: boolean;
  /// Slugs des items marqués `gatedByRestOfDossier` dans ce dossier (0 ou 1
  /// en pratique aujourd'hui — jamais plus d'un, cf. commentaire du type).
  gatedSlugs?: string[];
}

/// Calcule les statuts des items. `applicableSlugs` (dossier codé) écrase la
/// visibilité : un item dont le slug n'est pas applicable est caché, peu
/// importe sa condition JSON.
export function computeItemStatuses(
  items: BundleItem[],
  completedTemplateIds: string[],
  payloads: CollectedPayloads,
  applicableSlugs: string[] | null | undefined,
  opts: ComputeItemStatusesOptions = {},
): ComputedRunner {
  const applicableSet = applicableSlugs ? new Set(applicableSlugs) : null;
  const gatedSlugs = new Set(opts.gatedSlugs ?? []);
  const eligibilityAnswersComplete = opts.eligibilityAnswersComplete ?? true;

  const baseStatuses = items.map((item) => {
    const completed = completedTemplateIds.includes(itemSourceId(item));
    const slug = item.pdfForm?.slug ?? null;
    const inDossier =
      applicableSet === null || (slug !== null && applicableSet.has(slug));
    const conditionRes = evaluateCondition(item.condition, payloads);
    const eligibility = inDossier ? conditionRes : false;
    return { item, completed, eligibility };
  });

  // Ensemble des slugs "obligatoire + actuellement applicable" — sert au
  // calcul du verrou. Un item gated s'exclut lui-même de cette liste (il ne
  // peut pas dépendre de sa propre complétion).
  const requiredApplicableSlugs = new Set(
    baseStatuses
      .filter((s) => s.item.required && s.eligibility === true && s.item.pdfForm?.slug)
      .map((s) => s.item.pdfForm!.slug),
  );

  const itemStatuses: ItemStatus[] = baseStatuses.map((s) => {
    const slug = s.item.pdfForm?.slug ?? null;
    let locked = false;
    if (slug && gatedSlugs.has(slug)) {
      if (!eligibilityAnswersComplete) {
        locked = true;
      } else {
        const othersRequired = [...requiredApplicableSlugs].filter((other) => other !== slug);
        const othersMissing = othersRequired.some((other) => {
          const otherItem = baseStatuses.find((o) => o.item.pdfForm?.slug === other);
          return !otherItem?.completed;
        });
        locked = othersMissing;
      }
    }
    return { ...s, locked };
  });

  const visibleItems = itemStatuses.filter(
    ({ eligibility }) => eligibility !== false,
  );
  const hiddenItems = itemStatuses.filter(
    ({ eligibility }) => eligibility === false,
  );
  const completedCount = visibleItems.filter((s) => s.completed).length;
  const requiredVisible = visibleItems.filter(
    (s) => s.item.required && s.eligibility === true,
  );
  const allRequiredDone = requiredVisible.every((s) => s.completed);

  return {
    itemStatuses,
    visibleItems,
    hiddenItems,
    completedCount,
    requiredVisible,
    allRequiredDone,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/docbel/bundle-runner/__tests__/compute.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS — no existing caller of `computeItemStatuses` passes a 5th argument, so `opts` defaults to `{}`, `gatedSlugs` is empty, and `locked` is `false` for every item everywhere else (verified by the 5th new test above).

- [ ] **Step 6: Commit**

```bash
git add components/docbel/bundle-runner/compute.ts components/docbel/bundle-runner/__tests__/compute.test.ts
git commit -m "feat(bundle-runner): compute locked status for gatedByRestOfDossier items"
```

---

## Task 11: Show the locked state in the UI

**Files:**
- Modify: `components/docbel/bundle-runner.tsx`
- Modify: `app/d/[slug]/page.tsx`

**Interfaces:**
- Consumes: `ItemStatus.locked` (Task 10), `DossierDocument.gatedByRestOfDossier` (Task 9).
- Produces: the "Compléter" button for a locked item is disabled with an explanatory message; no visible change for any dossier without a gated document.

- [ ] **Step 1: Thread `gatedSlugs` and `eligibilityAnswersComplete` from `page.tsx`**

In `app/d/[slug]/page.tsx`, find where `selectedDocs` is computed and add, right after it:

```ts
  const selectedDocs = dossier
    ? selectDocuments(dossier, eligibilityAnswers as unknown as DossierAnswers)
    : null;
  const gatedSlugs = dossier
    ? dossier.documents.filter((d) => d.gatedByRestOfDossier).map((d) => d.slug)
    : [];
```

Then add to `runnerProps` (right after `inlineDocumentQuestions` from Task 3):

```ts
          inlineDocumentQuestions: dossier?.inlineDocumentQuestions ?? false,
          gatedSlugs,
```

- [ ] **Step 2: Compute `eligibilityAnswersComplete` and pass both new values into `computeItemStatuses`**

In `components/docbel/bundle-runner.tsx`, add `gatedSlugs?: string[];` to `BundleRunnerProps` (right after `inlineDocumentQuestions?: boolean;`) and to the destructured props with a default `gatedSlugs = []`.

Find:

```ts
  const {
    visibleItems,
    hiddenItems,
    completedCount,
    requiredVisible,
    allRequiredDone,
  } = computeItemStatuses(
      bundle.items,
      completedTemplateIds,
      payloads,
      applicableSlugs,
    );
```

Replace with:

```ts
  const {
    visibleItems,
    hiddenItems,
    completedCount,
    requiredVisible,
    allRequiredDone,
  } = computeItemStatuses(
      bundle.items,
      completedTemplateIds,
      payloads,
      applicableSlugs,
      { eligibilityAnswersComplete: eligibilityCompleted, gatedSlugs },
    );
```

(`eligibilityCompleted` already exists a few lines above this in the same component — no new computation needed.)

- [ ] **Step 3: Disable the button and show a message for locked items**

Find, inside the `visibleItems.map(({ item, completed, eligibility }, idx) => {` block:

```tsx
              {visibleItems.map(({ item, completed, eligibility }, idx) => {
                const isPending = eligibility === "pending";
                return (
```

Replace with:

```tsx
              {visibleItems.map(({ item, completed, eligibility, locked }, idx) => {
                const isPending = eligibility === "pending";
                return (
```

Find the "isPending hint" paragraph:

```tsx
                      {isPending && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          {t("runnerPendingHint")}
                        </p>
                      )}
```

Add right after it:

```tsx
                      {locked && !completed && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          {t("runnerLockedHint")}
                        </p>
                      )}
```

Find the "Compléter/Modifier" button's `disabled` prop:

```tsx
                    <Button
                      size="sm"
                      variant={completed ? "outline" : "default"}
                      onClick={() => handleStart(item)}
                      disabled={isPending || starting}
                    >
```

Replace with:

```tsx
                    <Button
                      size="sm"
                      variant={completed ? "outline" : "default"}
                      onClick={() => handleStart(item)}
                      disabled={isPending || starting || (locked && !completed)}
                    >
```

- [ ] **Step 4: Add the new translation key**

In `messages/fr.json`, find the `public.dossier` namespace (same namespace as `runnerPendingHint`) and add a sibling key:

```json
"runnerLockedHint": "Termine d'abord les autres documents obligatoires de ton dossier avant de pouvoir compléter celui-ci.",
```

- [ ] **Step 5: Run `pnpm i18n:check`**

Run: `pnpm i18n:check`
Expected: PASS — this key is FR-only by design this pass (per Global Constraints); confirm the check doesn't hard-fail on a missing translation for a brand-new key in other locales (if it does, check how other recently-added FR-only keys in this same file were handled and follow the same pattern — do not invent a workaround).

- [ ] **Step 6: Run build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 7: Manual verification**

Visit `/d/allocations-insertion`, start a run, answer `parcoursEtudes: secondaire-belge` but do **not** complete C109/36-DIPLÔME. Confirm the C109/36-DEMANDE row shows a disabled "Compléter" button with the "Termine d'abord..." hint. Complete DIPLÔME, refresh, confirm DEMANDE's button becomes enabled.

- [ ] **Step 8: Commit**

```bash
git add components/docbel/bundle-runner.tsx "app/d/[slug]/page.tsx" messages/fr.json
git commit -m "feat(allocations-insertion): show locked state and hint for the gated document"
```

---

## Task 12: Enforce the lock server-side in the generate route

**Files:**
- Modify: `app/api/pdf/[slug]/generate/route.ts`
- Test: create `app/api/pdf/[slug]/__tests__/generate-lock.test.ts`

**Interfaces:**
- Consumes: `getDossier` (`lib/dossiers/registry.ts`), `selectDocuments` (`lib/dossiers/types.ts`), `collectAllTriggeredSlugs` (Task 8), `dossierQuestionsToEligibility`-style answer-completeness check.
- Produces: a pure function `isGeneratingBlocked(...)` (exported for the test) plus a guard added to the route's `POST` handler that returns HTTP 409 when blocked.

- [ ] **Step 1: Write the failing test**

Create `app/api/pdf/[slug]/__tests__/generate-lock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isGeneratingBlocked } from "../generate/route";
import type { DossierDefinition } from "@/lib/dossiers/types";

const dossier: DossierDefinition = {
  slug: "test-dossier",
  title: "Test",
  description: "",
  category: "emploi",
  icon: "🎓",
  color: "#000",
  vocabularyTags: [],
  types: [],
  questions: [
    {
      id: "parcoursEtudes",
      label: { fr: "Parcours" },
      type: "select",
      options: [
        { value: "secondaire-belge", label: { fr: "Secondaire" } },
        { value: "superieur-belge", label: { fr: "Supérieur" } },
      ],
    },
  ],
  warnings: [],
  documents: [
    { slug: "demande", title: "Demande", issuer: "ONEM", required: true, gatedByRestOfDossier: true, fields: [] },
    { slug: "c1", title: "C1", issuer: "ONEM", required: true, fields: [] },
    {
      slug: "diplome",
      title: "Diplôme",
      issuer: "École",
      required: true,
      includeWhen: (a) => a.parcoursEtudes === "secondaire-belge",
      fields: [],
    },
  ],
};

describe("isGeneratingBlocked", () => {
  it("bloque DEMANDE si les questions d'aiguillage n'ont pas de réponse", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: {},
      completedSlugs: ["c1"],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(true);
  });

  it("bloque DEMANDE si le document de branche applicable n'est pas complété", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "secondaire-belge" },
      completedSlugs: ["c1"], // diplome manquant
      triggeredSlugs: [],
    });
    expect(blocked).toBe(true);
  });

  it("bloque DEMANDE si un document déclenché n'est pas complété", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "superieur-belge" },
      completedSlugs: ["c1"],
      triggeredSlugs: ["c1a"],
    });
    expect(blocked).toBe(true);
  });

  it("ne bloque pas DEMANDE quand tout l'applicable est complété", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "superieur-belge" },
      completedSlugs: ["c1"],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });

  it("ne bloque jamais un document non gated (ex. C1 lui-même)", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "c1",
      answers: {},
      completedSlugs: [],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });

  it("ne bloque rien quand le dossier n'a pas de document gated", () => {
    const noGate: DossierDefinition = { ...dossier, documents: dossier.documents.map((d) => ({ ...d, gatedByRestOfDossier: false })) };
    const blocked = isGeneratingBlocked({
      dossier: noGate,
      targetSlug: "demande",
      answers: {},
      completedSlugs: [],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run app/api/pdf/[slug]/__tests__/generate-lock.test.ts`
Expected: FAIL — `isGeneratingBlocked` is not exported from `../generate/route`.

- [ ] **Step 3: Add the pure function and wire it into the route**

In `app/api/pdf/[slug]/generate/route.ts`, add near the top (after the existing imports, before the `json` constant):

```ts
import { getDossier } from "@/lib/dossiers/registry";
import { selectDocuments, type DossierAnswers, type DossierDefinition } from "@/lib/dossiers/types";
import { collectAllTriggeredSlugs } from "@/lib/pdf-forms/triggers";
import { parseEligibilityAnswers } from "@/lib/bundles/eligibility";
```

Add this exported pure function (placed after the `json` constant, before `POST`):

```ts
/// Vrai si `targetSlug` est marqué `gatedByRestOfDossier` dans `dossier` ET
/// qu'il manque au moins un autre document obligatoire+applicable pour
/// débloquer sa génération — soit parce qu'une question d'aiguillage n'a
/// pas de réponse, soit parce qu'un document de branche ou un document
/// déclenché par un autre formulaire n'est pas encore complété. Pure : ne
/// touche ni la DB ni le réseau, pour rester testable en isolation.
export function isGeneratingBlocked(params: {
  dossier: DossierDefinition;
  targetSlug: string;
  answers: DossierAnswers;
  /// Slugs des PdfForms déjà complétés dans ce run (dérivés de
  /// `completedTemplateIds` par le caller — cf. Step 4).
  completedSlugs: string[];
  triggeredSlugs: string[];
}): boolean {
  const target = params.dossier.documents.find((d) => d.slug === params.targetSlug);
  if (!target?.gatedByRestOfDossier) return false;

  const allAnswered = params.dossier.questions.every((q) => {
    const v = params.answers[q.id];
    return v !== undefined && v !== "";
  });
  if (!allAnswered) return true;

  const applicable = selectDocuments(params.dossier, params.answers);
  const requiredOtherSlugs = new Set<string>();
  for (const doc of applicable) {
    if (doc.slug === params.targetSlug) continue;
    if (!doc.required) continue;
    // Seuls les documents remplissables (fields non vide OU sourcePdfPath)
    // ont un pdfFormId à compléter — les documents à charge d'un tiers
    // (responsibility ≠ "user") ne bloquent pas ce verrou.
    if (doc.responsibility && doc.responsibility !== "user") continue;
    requiredOtherSlugs.add(doc.slug);
  }
  for (const slug of params.triggeredSlugs) {
    if (slug !== params.targetSlug) requiredOtherSlugs.add(slug);
  }

  const completed = new Set(params.completedSlugs);
  for (const slug of requiredOtherSlugs) {
    if (!completed.has(slug)) return true;
  }
  return false;
}
```

Then, inside `POST`, right after the existing block that loads `form` (`const form = await prisma.pdfForm.findUnique(...)`) and before the `body = await req.json()` parsing, we need the `bundleRunId` — but that's only known once `body` is parsed. Move the lock check to right after `bundleRunId` is extracted later in the function. Find:

```ts
  // Si le PDF est ouvert dans un dossier (bundle), on persiste le payload
  // validé dans le run pour que les PDFs suivants puissent récupérer les
  // valeurs partagées (NISS, adresse, etc.). Clé = pdfFormId (cuid unique,
  // cohabite avec les templateId de l'ancien module dans le même dict).
  const bundleRunId = typeof body.bundleRunId === "string" ? body.bundleRunId : null;
  if (bundleRunId) {
    try {
      const run = await prisma.bundleRun.findUnique({ where: { id: bundleRunId } });
      if (run && run.status === "in_progress") {
```

Replace with (note the lock check now happens BEFORE the payload/completion write, using the run's state as of the start of this request — i.e. before this generation counts itself as done):

```ts
  // Si le PDF est ouvert dans un dossier (bundle), on persiste le payload
  // validé dans le run pour que les PDFs suivants puissent récupérer les
  // valeurs partagées (NISS, adresse, etc.). Clé = pdfFormId (cuid unique,
  // cohabite avec les templateId de l'ancien module dans le même dict).
  const bundleRunId = typeof body.bundleRunId === "string" ? body.bundleRunId : null;
  if (bundleRunId) {
    try {
      const run = await prisma.bundleRun.findUnique({
        where: { id: bundleRunId },
        include: { bundle: { include: { items: { include: { pdfForm: { select: { id: true, slug: true, triggers: true } } } } } } },
      });
      if (run && run.status === "in_progress") {
        const dossier = getDossier(run.bundle.slug);
        if (dossier) {
          const answers = parseEligibilityAnswers(run.eligibilityAnswers) as unknown as DossierAnswers;
          const runPayloads = (run.payloads as Record<string, unknown>) || {};
          const triggeredSlugs = collectAllTriggeredSlugs(
            run.bundle.items.map((it) => ({
              pdfFormId: it.pdfFormId,
              pdfFormSlug: it.pdfForm?.slug ?? null,
              rawTriggers: it.pdfForm?.triggers,
            })),
            runPayloads,
          );
          const completedIds = (run.completedTemplateIds as string[]) || [];
          const completedSlugs = run.bundle.items
            .filter((it) => it.pdfForm && completedIds.includes(it.pdfFormId ?? ""))
            .map((it) => it.pdfForm!.slug);
          if (
            isGeneratingBlocked({
              dossier,
              targetSlug: slug,
              answers,
              completedSlugs,
              triggeredSlugs,
            })
          ) {
            return NextResponse.json(
              { error: "Complète d'abord les autres documents obligatoires de ton dossier." },
              { status: 409, headers: json },
            );
          }
        }
      }
      if (run && run.status === "in_progress") {
```

(The original `if (run && run.status === "in_progress") { ... }` block that follows — the one that writes `newPayloads`/`newCompleted` — stays exactly as it was; we've only added a new guarded block ABOVE it that can early-return 409, reusing the same `run` fetch. Since we changed the `prisma.bundleRun.findUnique` call to add an `include`, and the ORIGINAL following code reads `run.payloads`/`run.completedTemplateIds` — those fields are still present on `run` regardless of the added `include`, so no further changes are needed below this point.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run app/api/pdf/[slug]/__tests__/generate-lock.test.ts`
Expected: PASS (all 6 tests — pure function, no DB involved).

- [ ] **Step 5: Run the full test suite and build**

Run: `pnpm test`
Expected: PASS.

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 6: Manual verification (end-to-end, requires prod or a seeded environment per existing project constraints — cf. Task 7)**

In an environment where `allocations-insertion` is seeded (prod, per established practice — do not seed locally): start a run, answer `parcoursEtudes: secondaire-belge`, complete C1 but not DIPLÔME, then attempt to open `/document/c109-36-demande` and submit it. Confirm the request is rejected with the 409 message, even if the UI's disabled button is somehow bypassed (e.g. via direct API call) — this is the defense-in-depth check, it must hold independently of Task 11's client-side disabling.

- [ ] **Step 7: Commit**

```bash
git add "app/api/pdf/[slug]/generate/route.ts" "app/api/pdf/[slug]/__tests__/generate-lock.test.ts"
git commit -m "feat(allocations-insertion): enforce the DEMANDE lock server-side"
```

---

## Self-Review Notes

**Spec coverage:** Objectif items 1-3 → Tasks 1-3. Item 4 (lock) → Tasks 9-12. Item 5 (wire C1 triggers) → Tasks 4-7. Item 6 (colocation/FN4) → Tasks 4-5. "Ce qui ne change pas" (other dossiers, `EligibilityPrequalifier`, `BundleRoadmap`) → verified via the "reduces to old behavior when flag absent" checks in Tasks 2 and 10, and via the full `pnpm test` runs after every task. The disclosed scope cut (no Annexe Regis cross-form auto-prefill) is called out in Global Constraints and in Task 4's description — flag this to Oraliks explicitly when presenting this plan, it's a real narrowing versus the spec's original wording.

**Placeholder scan:** no TBD/TODO; every step has complete code or an exact command; Task 7 has no code by design (documented as MANUAL) and its steps are concrete operational instructions, not vague placeholders.

**Type consistency:** `ItemStatus.locked`, `ComputeItemStatusesOptions`, `BundleItemForTriggers`, `isGeneratingBlocked` signatures are used identically across the tasks that produce and consume them (Task 8→12, Task 9→10→11→12).
