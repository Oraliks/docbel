# Dossier Journey Intro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the direct-to-questionnaire arrival on `/d/allocations-insertion` with a pedagogical 4-step explanation screen + a CTA that starts the existing questionnaire, built as a reusable (optional) capability on `DossierDefinition`.

**Architecture:** A new optional `journey` field on `DossierDefinition` carries the step content. A new client wrapper `DossierJourneyIntro` shows the steps + a sidebar (reusing the dossier's own `warnings`/`documents`) and, on CTA click, renders the untouched `BundleRunner`. The page (`app/d/[slug]/page.tsx`) renders the wrapper only when the dossier has a `journey` **and** there is no run already in progress; otherwise it renders `BundleRunner` exactly as today. Pure serializers convert the dossier's function-bearing warnings/documents into plain serializable props.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript strict, next-intl 4, Tailwind 4 + glass design system, vitest (node env).

## Global Constraints

- **No new dependencies** (CLAUDE.md). The repo's vitest runs in `environment: "node"` with **no** React Testing Library / jsdom — do **not** add component-render tests or any test dependency. UI is verified via the preview server.
- **Front = glass mauve.** Never `bg-white`/`#FFFFFF` hardcoded. Use `.glass-surface`, `.glass-cta`, `--glass-*` tokens. Cards that are not clickable must NOT use `.glass-interactive`.
- **Front pages never set `max-w-*`/`container`/`mx-auto` on their root** (shell centers at `max-w-[1840px]`). `max-w-*` allowed only on a text element.
- **All user-facing text via next-intl.** Keys live under `public.dossierContent.*`; the 12 covered locales are fr, en, nl, de, es, it, pt, ar, tr, ru, mk, sq. Source of truth = `messages/fr.json`.
- **Facts are derived, never re-invented.** Step content must match the already-corrected values in `lib/dossiers/allocations-insertion/index.ts` (stage = **156 jours**, régime services Actiris/Forem/VDAB/ADG, droit **12 mois** en principe). No new legal figure introduced.
- **Reduced motion:** only reuse existing motion classes (`.outils-rise`, `.glass-cta`), which already respect `prefers-reduced-motion`. No new keyframes.
- **Validation gates:** `pnpm i18n:check`, `pnpm build`, `pnpm test`. `pnpm build` = build + typecheck (there is no `pnpm typecheck`). Bash tool must use `dangerouslyDisableSandbox: true` for build/test/git (sandbox reverts tracked files).
- **git add explicit paths only** (shared multi-agent workdir). Never `git add -A`.

---

### Task 1: Journey data model + `allocations-insertion` content

Adds the `journey` shape to `DossierDefinition` and populates it for the one dossier, guarded by a data test. Types-only changes aren't independently testable, so they ship together with the content and its test.

**Files:**
- Modify: `lib/dossiers/types.ts` (add types near `DossierTheorySection`, ~line 140; add fields to `DossierDefinition`, ~line 305)
- Modify: `lib/dossiers/allocations-insertion/index.ts` (add `journeyCtaLabel*` + `journey` to the exported object, before `theory: THEORY,` at the end)
- Test: `lib/dossiers/__tests__/dossier.test.ts` (append a `describe` block)

**Interfaces:**
- Produces: `JourneyStepIcon` (string union), `DossierJourneyStep` interface, and `DossierDefinition.journey?: DossierJourneyStep[]`, `DossierDefinition.journeyCtaLabel?: string`, `DossierDefinition.journeyCtaLabelKey?: string`. Consumed by Tasks 2–4.

- [ ] **Step 1: Write the failing test**

Append to `lib/dossiers/__tests__/dossier.test.ts`:

```ts
describe("allocations-insertion — parcours (journey)", () => {
  const dossier = getDossier("allocations-insertion");

  it("expose un journey de 4 étapes avec un CTA", () => {
    expect(dossier).not.toBeNull();
    expect(dossier?.journeyCtaLabel).toBeTruthy();
    expect(dossier?.journey).toHaveLength(4);
  });

  it("chaque étape a un order 1..4 unique, une icône connue, titre et corps non vides", () => {
    const allowedIcons = ["user-check", "calendar", "file-check", "wallet"];
    const orders = (dossier?.journey ?? []).map((s) => s.order).sort();
    expect(orders).toEqual([1, 2, 3, 4]);
    for (const step of dossier?.journey ?? []) {
      expect(allowedIcons).toContain(step.icon);
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it("ne réintroduit pas l'ancienne durée de stage (310 jours)", () => {
    const blob = JSON.stringify(dossier?.journey ?? []);
    expect(blob).not.toContain("310");
    expect(blob).toContain("156");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- lib/dossiers/__tests__/dossier.test.ts`
Expected: FAIL — `journey` is `undefined` (`expect(dossier?.journey).toHaveLength(4)` → received `undefined`).

- [ ] **Step 3: Add the types to `lib/dossiers/types.ts`**

Insert immediately BEFORE `export interface DossierTheorySection {` (~line 140):

```ts
/// Identifiant d'icône pour une étape de parcours public. Jeu volontairement
/// restreint ; résolu vers un composant Lucide dans le composant de rendu
/// (pas de référence de composant directe → reste sérialisable server→client).
export type JourneyStepIcon = "user-check" | "calendar" | "file-check" | "wallet";

/// Une étape du parcours public, affichée en écran d'explication AVANT le
/// questionnaire. Contenu grand public (contrairement à `theory`/`procedures`
/// réservés admin/partenaires) : 1-2 phrases courtes, pas de Markdown long.
export interface DossierJourneyStep {
  order: number;
  icon: JourneyStepIcon;
  title: string;
  /// Clé i18n (préférée si fournie). Namespace : `public.dossierContent.*`.
  titleKey?: string;
  body: string;
  /// Clé i18n (préférée si fournie). Namespace : `public.dossierContent.*`.
  bodyKey?: string;
}
```

Then, inside `export interface DossierDefinition {`, immediately AFTER the `theory?: DossierTheorySection[];` line (~line 305), add:

```ts
  /// Écran d'explication en étapes, affiché avant le questionnaire pour un
  /// NOUVEAU visiteur (pas de run en cours). Optionnel : absent = comportement
  /// actuel inchangé (questionnaire affiché directement). Réutilisable par
  /// n'importe quel dossier.
  journey?: DossierJourneyStep[];
  /// Libellé du bouton qui démarre le questionnaire depuis l'écran
  /// d'explication. Requis (avec `journey`) pour activer l'écran : texte
  /// spécifique au dossier, non codable en dur dans la page partagée.
  journeyCtaLabel?: string;
  /// Clé i18n du libellé CTA (préférée si fournie).
  journeyCtaLabelKey?: string;
```

- [ ] **Step 4: Add the content to `lib/dossiers/allocations-insertion/index.ts`**

In the exported `allocationsInsertion` object, insert the following immediately BEFORE the final `theory: THEORY,` line:

```ts
  journeyCtaLabel: "Créer ma demande sur base des études",
  journeyCtaLabelKey: "insertion.journeyCtaLabel",
  journey: [
    {
      order: 1,
      icon: "user-check",
      title: "Après les études",
      titleKey: "insertion.journey.step1.title",
      body: "Inscris-toi comme demandeur d'emploi auprès du service régional compétent : Actiris, Forem, VDAB ou ADG.",
      bodyKey: "insertion.journey.step1.body",
    },
    {
      order: 2,
      icon: "calendar",
      title: "Pendant 156 jours",
      titleKey: "insertion.journey.step2.title",
      body: "Le stage d'insertion démarre : cherche activement du travail et garde tes preuves. Tu es suivi par le service régional de l'emploi.",
      bodyKey: "insertion.journey.step2.body",
    },
    {
      order: 3,
      icon: "file-check",
      title: "À la fin du stage",
      titleKey: "insertion.journey.step3.title",
      body: "Confirme ton inscription comme demandeur d'emploi et introduis ta demande d'allocations d'insertion.",
      bodyKey: "insertion.journey.step3.body",
    },
    {
      order: 4,
      icon: "wallet",
      title: "Après l'acceptation",
      titleKey: "insertion.journey.step4.title",
      body: "Le paiement passe par ton organisme de paiement (CAPAC ou syndicat) et tu remplis chaque mois ta carte de contrôle.",
      bodyKey: "insertion.journey.step4.body",
    },
  ],
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- lib/dossiers/__tests__/dossier.test.ts`
Expected: PASS (all 3 new tests green, existing tests still green).

- [ ] **Step 6: Commit**

```bash
git add lib/dossiers/types.ts lib/dossiers/allocations-insertion/index.ts lib/dossiers/__tests__/dossier.test.ts
git commit -m "feat(dossiers): champ journey (parcours) + contenu allocations-insertion"
```

---

### Task 2: Pure serializers for the intro sidebar

The page's `dossier.warnings` (`DossierWarning[]`) carry a non-serializable `visibleWhen` function and i18n keys; `selectedDocs` (`DossierDocument[]`) carry `includeWhen` and field arrays. A client component cannot receive functions. These two pure functions strip functions and keep only what the sidebar needs — and being pure, they are unit-testable in the node env.

**Files:**
- Create: `lib/dossiers/journey.ts`
- Test: `lib/dossiers/__tests__/journey.test.ts`

**Interfaces:**
- Consumes: `DossierWarning`, `DossierDocument`, `DossierAnswers` from `lib/dossiers/types.ts` and `lib/bundles/types.ts`'s `WarningSeverity`.
- Produces:
  - `interface JourneyWarning { title: string; titleKey?: string; message: string; messageKey?: string; severity: WarningSeverity; }`
  - `interface JourneyDocument { slug: string; title: string; titleKey?: string; issuer: string; required: boolean; }`
  - `serializeJourneyWarnings(warnings: DossierWarning[], answers: DossierAnswers): JourneyWarning[]`
  - `serializeJourneyDocuments(docs: DossierDocument[]): JourneyDocument[]`
  Consumed by Tasks 3 and 4.

- [ ] **Step 1: Write the failing test**

Create `lib/dossiers/__tests__/journey.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { serializeJourneyWarnings, serializeJourneyDocuments } from "../journey";
import type { DossierWarning, DossierDocument } from "../types";

describe("serializeJourneyWarnings", () => {
  it("mappe titre/message/severity et laisse tomber visibleWhen", () => {
    const warnings: DossierWarning[] = [
      {
        title: "Demande avant 25 ans",
        titleKey: "insertion.warning.demandeAvant25.title",
        message: "Avant 25 ans.",
        messageKey: "insertion.warning.demandeAvant25.message",
        severity: "critical",
      },
    ];
    const out = serializeJourneyWarnings(warnings, {});
    expect(out).toEqual([
      {
        title: "Demande avant 25 ans",
        titleKey: "insertion.warning.demandeAvant25.title",
        message: "Avant 25 ans.",
        messageKey: "insertion.warning.demandeAvant25.message",
        severity: "critical",
      },
    ]);
    expect(out[0]).not.toHaveProperty("visibleWhen");
  });

  it("filtre les warnings dont visibleWhen renvoie false", () => {
    const warnings: DossierWarning[] = [
      { title: "Toujours", message: "m", severity: "info" },
      { title: "Caché", message: "m", severity: "info", visibleWhen: () => false },
    ];
    const out = serializeJourneyWarnings(warnings, {});
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Toujours");
  });
});

describe("serializeJourneyDocuments", () => {
  it("garde slug/title/issuer/required, required défaut true", () => {
    const docs: DossierDocument[] = [
      {
        slug: "c1-insertion",
        title: "C1 — Déclaration",
        titleKey: "insertion.doc.c1.title",
        issuer: "ONEM",
        fields: [],
      },
    ];
    expect(serializeJourneyDocuments(docs)).toEqual([
      {
        slug: "c1-insertion",
        title: "C1 — Déclaration",
        titleKey: "insertion.doc.c1.title",
        issuer: "ONEM",
        required: true,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- lib/dossiers/__tests__/journey.test.ts`
Expected: FAIL — cannot resolve module `../journey`.

- [ ] **Step 3: Implement `lib/dossiers/journey.ts`**

```ts
/// Sérialiseurs purs pour l'écran d'explication (DossierJourneyIntro).
///
/// Les warnings/documents d'un dossier codé portent des fonctions
/// (`visibleWhen`, `includeWhen`) et des tableaux de champs non transmissibles
/// à un composant client. Ces fonctions réduisent chaque structure à sa forme
/// sérialisable minimale, en évaluant les conditions côté serveur.

import type { WarningSeverity } from "@/lib/bundles/types";
import type { DossierWarning, DossierDocument, DossierAnswers } from "./types";

/// Avertissement sérialisable pour la sidebar de l'écran d'explication.
export interface JourneyWarning {
  title: string;
  titleKey?: string;
  message: string;
  messageKey?: string;
  severity: WarningSeverity;
}

/// Document sérialisable pour la sidebar (aide-mémoire « à prévoir »).
export interface JourneyDocument {
  slug: string;
  title: string;
  titleKey?: string;
  issuer: string;
  required: boolean;
}

/// Filtre les warnings selon `visibleWhen` (avec les réponses connues) et
/// retire la fonction pour ne garder que les champs sérialisables.
export function serializeJourneyWarnings(
  warnings: DossierWarning[],
  answers: DossierAnswers,
): JourneyWarning[] {
  return warnings
    .filter((w) => (w.visibleWhen ? w.visibleWhen(answers) : true))
    .map((w) => ({
      title: w.title,
      titleKey: w.titleKey,
      message: w.message,
      messageKey: w.messageKey,
      severity: w.severity,
    }));
}

/// Réduit les documents (déjà filtrés par `selectDocuments`) à leur forme
/// d'affichage. `required` par défaut = true (cohérent avec le runner).
export function serializeJourneyDocuments(
  docs: DossierDocument[],
): JourneyDocument[] {
  return docs.map((d) => ({
    slug: d.slug,
    title: d.title,
    titleKey: d.titleKey,
    issuer: d.issuer,
    required: d.required ?? true,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- lib/dossiers/__tests__/journey.test.ts`
Expected: PASS (all 3 tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/dossiers/journey.ts lib/dossiers/__tests__/journey.test.ts
git commit -m "feat(dossiers): sérialiseurs purs warnings/documents pour l'écran parcours"
```

---

### Task 3: `DossierJourneyIntro` client component

The wrapper: shows steps + sidebar until the CTA is clicked, then renders the untouched `BundleRunner`. No unit test (repo has no component-render infra); verified live in Task 4.

**Files:**
- Create: `components/docbel/dossier-journey-intro.tsx`

**Interfaces:**
- Consumes: `DossierJourneyStep`, `JourneyStepIcon` (Task 1); `JourneyWarning`, `JourneyDocument` (Task 2); `BundleRunner` + its props type.
- Produces: `export function DossierJourneyIntro(props)` where `props` = `{ journey: DossierJourneyStep[]; warnings: JourneyWarning[]; documents: JourneyDocument[]; ctaLabel: string; ctaLabelKey?: string } & ComponentProps<typeof BundleRunner>`. Consumed by Task 4.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { type ComponentProps, useState } from "react";
import { useTranslations } from "next-intl";
import {
  UserCheck,
  CalendarDays,
  FileCheck,
  Wallet,
  ArrowRight,
  AlertTriangle,
  Info,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { BundleRunner } from "./bundle-runner";
import type { DossierJourneyStep, JourneyStepIcon } from "@/lib/dossiers/types";
import type { JourneyWarning, JourneyDocument } from "@/lib/dossiers/journey";

const JOURNEY_ICONS: Record<JourneyStepIcon, LucideIcon> = {
  "user-check": UserCheck,
  calendar: CalendarDays,
  "file-check": FileCheck,
  wallet: Wallet,
};

type DossierJourneyIntroProps = {
  journey: DossierJourneyStep[];
  warnings: JourneyWarning[];
  documents: JourneyDocument[];
  ctaLabel: string;
  ctaLabelKey?: string;
} & ComponentProps<typeof BundleRunner>;

export function DossierJourneyIntro({
  journey,
  warnings,
  documents,
  ctaLabel,
  ctaLabelKey,
  ...runnerProps
}: DossierJourneyIntroProps) {
  const t = useTranslations("public.dossierContent");
  const [started, setStarted] = useState(false);

  // Résout une clé i18n si elle existe dans le catalogue, sinon le libellé brut.
  const resolve = (key: string | undefined, fallback: string): string =>
    key && t.has(key) ? t(key) : fallback;

  if (started) {
    return (
      <div className="outils-rise">
        <BundleRunner {...runnerProps} />
      </div>
    );
  }

  const steps = [...journey].sort((a, b) => a.order - b.order);

  return (
    <section className="flex w-full flex-col gap-6">
      {/* En-tête */}
      <header className="flex flex-col gap-2">
        <h1 className="glass-display text-[28px] font-semibold leading-tight sm:text-[34px]">
          {runnerProps.bundle.name}
        </h1>
        {runnerProps.bundle.description ? (
          <p className="max-w-2xl text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            {runnerProps.bundle.description}
          </p>
        ) : null}
      </header>

      {/* Corps : étapes (gauche) + sidebar (droite) */}
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* Étapes */}
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map((step, i) => {
            const Icon = JOURNEY_ICONS[step.icon];
            return (
              <li
                key={step.order}
                className="glass-surface outils-rise flex flex-col gap-2 p-5"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="glass-icon-tile flex size-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)]"
                    style={
                      {
                        background:
                          "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
                        "--tile-hue": "var(--glass-accent-deep)",
                      } as React.CSSProperties
                    }
                    aria-hidden
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
                    Étape {step.order}
                  </span>
                </div>
                <h2 className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                  {resolve(step.titleKey, step.title)}
                </h2>
                <p className="text-[13.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                  {resolve(step.bodyKey, step.body)}
                </p>
              </li>
            );
          })}
        </ol>

        {/* Sidebar : avertissements + documents */}
        <aside className="flex flex-col gap-4">
          {warnings.map((w) => {
            const critical = w.severity === "critical";
            const WIcon = critical ? AlertTriangle : Info;
            return (
              <div
                key={w.titleKey ?? w.title}
                className="glass-surface flex flex-col gap-1.5 p-4"
                style={{
                  borderLeft: `3px solid ${
                    critical
                      ? "var(--glass-pop-fg)"
                      : "color-mix(in oklab, var(--glass-accent-deep) 45%, transparent)"
                  }`,
                }}
              >
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--glass-ink)]">
                  <WIcon
                    className="size-3.5 shrink-0"
                    style={{ color: critical ? "var(--glass-pop-fg)" : "var(--glass-accent-deep)" }}
                    aria-hidden
                  />
                  {resolve(w.titleKey, w.title)}
                </p>
                <p className="text-[12.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                  {resolve(w.messageKey, w.message)}
                </p>
              </div>
            );
          })}

          {documents.length > 0 ? (
            <div className="glass-surface flex flex-col gap-2 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
                À prévoir
              </p>
              <ul className="flex flex-col gap-1.5">
                {documents.map((d) => (
                  <li
                    key={d.slug}
                    className="flex items-start gap-2 text-[12.5px] text-[color:var(--glass-ink-soft)]"
                  >
                    <FileText className="mt-0.5 size-3.5 shrink-0 text-[color:var(--glass-accent-deep)]" aria-hidden />
                    <span>{resolve(d.titleKey, d.title)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {/* CTA */}
      <div>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-bold"
        >
          {resolve(ctaLabelKey, ctaLabel)}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck compiles (no test infra for components)**

Run: `pnpm build`
Expected: `✓ Compiled successfully`. The only runtime warning printed is the pre-existing `/api/data/commissions couldn't be rendered statically` (unrelated). If a lucide import name errors, check the exact export in `node_modules/lucide-react` and adjust (all four — `UserCheck`, `CalendarDays`, `FileCheck`, `Wallet` — are standard v1 exports).

- [ ] **Step 3: Commit**

```bash
git add components/docbel/dossier-journey-intro.tsx
git commit -m "feat(dossiers): composant DossierJourneyIntro (écran d'explication + CTA)"
```

---

### Task 4: Wire into the page + FR i18n + live verification

Renders the intro only for a dossier that has a journey **and** no run in progress; otherwise `BundleRunner` as today. Adds the French strings and verifies the three flows in the browser.

**Files:**
- Modify: `app/d/[slug]/page.tsx` (imports at top; replace the `<BundleRunner .../>` block at ~line 258)
- Modify: `messages/fr.json` (add keys inside the existing `public.dossierContent.insertion` object)

**Interfaces:**
- Consumes: `DossierJourneyIntro` (Task 3), `serializeJourneyWarnings`, `serializeJourneyDocuments` (Task 2), and existing page locals `dossier`, `run`, `eligibilityAnswers`, `selectedDocs`, and the BundleRunner prop values.

- [ ] **Step 1: Add imports to `app/d/[slug]/page.tsx`**

After the existing `import { BundleRunner } from "@/components/docbel/bundle-runner";` (line 6), add:

```ts
import { DossierJourneyIntro } from "@/components/docbel/dossier-journey-intro";
import { serializeJourneyWarnings, serializeJourneyDocuments } from "@/lib/dossiers/journey";
```

- [ ] **Step 2: Replace the render block**

Replace the current block (lines ~258–271):

```tsx
      <BundleRunner
        bundle={serializedBundle}
        runId={run?.id ?? null}
        resumeCode={run?.resumeCode ?? null}
        resumeCodeExpiresAt={run?.resumeCodeExpiresAt?.toISOString() ?? null}
        resumeEmail={run?.resumeEmail ?? null}
        eligibilityAnswers={eligibilityAnswers}
        completedTemplateIds={(run?.completedTemplateIds as string[]) || []}
        payloads={payloads}
        templateNames={templateNames}
        fieldLabels={fieldLabels}
        applicableSlugs={finalApplicableSlugs}
        externalDocuments={externalDocuments}
      />
```

with:

```tsx
      {(() => {
        const runnerProps = {
          bundle: serializedBundle,
          runId: run?.id ?? null,
          resumeCode: run?.resumeCode ?? null,
          resumeCodeExpiresAt: run?.resumeCodeExpiresAt?.toISOString() ?? null,
          resumeEmail: run?.resumeEmail ?? null,
          eligibilityAnswers,
          completedTemplateIds: (run?.completedTemplateIds as string[]) || [],
          payloads,
          templateNames,
          fieldLabels,
          applicableSlugs: finalApplicableSlugs,
          externalDocuments,
        };

        // Écran d'explication : uniquement si le dossier codé fournit un
        // `journey` + un libellé CTA, ET qu'aucun run n'est déjà en cours
        // (un visiteur qui reprend son dossier va droit au questionnaire).
        const showJourney =
          dossier?.journey && dossier.journeyCtaLabel && !run;

        if (showJourney) {
          return (
            <DossierJourneyIntro
              journey={dossier!.journey!}
              warnings={serializeJourneyWarnings(
                dossier!.warnings,
                eligibilityAnswers as unknown as DossierAnswers,
              )}
              documents={serializeJourneyDocuments(selectedDocs ?? [])}
              ctaLabel={dossier!.journeyCtaLabel!}
              ctaLabelKey={dossier!.journeyCtaLabelKey}
              {...runnerProps}
            />
          );
        }

        return <BundleRunner {...runnerProps} />;
      })()}
```

(`DossierAnswers` is already imported at line 14; `selectedDocs` and `dossier` are already computed above.)

- [ ] **Step 3: Add French i18n keys**

In `messages/fr.json`, inside the `public.dossierContent.insertion` object (the object that already contains `"warning"`, `"doc"`, `"theory"` — around line 7804), add these two siblings (after `"description"`, before `"warning"`):

```json
        "journeyCtaLabel": "Créer ma demande sur base des études",
        "journey": {
          "step1": {
            "title": "Après les études",
            "body": "Inscris-toi comme demandeur d'emploi auprès du service régional compétent : Actiris, Forem, VDAB ou ADG."
          },
          "step2": {
            "title": "Pendant 156 jours",
            "body": "Le stage d'insertion démarre : cherche activement du travail et garde tes preuves. Tu es suivi par le service régional de l'emploi."
          },
          "step3": {
            "title": "À la fin du stage",
            "body": "Confirme ton inscription comme demandeur d'emploi et introduis ta demande d'allocations d'insertion."
          },
          "step4": {
            "title": "Après l'acceptation",
            "body": "Le paiement passe par ton organisme de paiement (CAPAC ou syndicat) et tu remplis chaque mois ta carte de contrôle."
          }
        },
```

- [ ] **Step 4: Validate i18n + build**

Run: `pnpm i18n:check`
Expected: `Résultat : SUCCÈS`, 0 JSON invalides, 0 erreurs ICU.

Run: `pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Live verification (preview server)**

Ensure the dossier is active in the DB (it was set `active: true` in the prior session; if a fresh DB says otherwise, that's a data concern, not a code one — note it, don't block).

1. `preview_start` (config `beldoc-dev`).
2. Navigate to `http://localhost:3000/d/allocations-insertion` (a browser without an existing run cookie).
3. `preview_snapshot` / `preview_eval` on `document.body.innerText` → assert it contains "Étape 1", "156 jours", the CTA label "Créer ma demande sur base des études", and NOT "310".
4. Click the CTA (`preview_eval`: find the button by text, `.click()`), then `preview_snapshot` → assert the questionnaire ("Quel âge as-tu ?") is now shown.
5. `preview_console_logs level:error` → assert none.
6. Sanity: navigate to `http://localhost:3000/d/chomage-complet` → assert it does NOT show an "Étape 1" intro (no `journey` → unchanged behaviour). Note: if `chomage-complet` is inactive in this DB it shows "Bientôt disponible" — that's still "no journey intro", which satisfies the check.
7. `preview_stop`.

- [ ] **Step 6: Commit**

```bash
git add app/d/[slug]/page.tsx messages/fr.json
git commit -m "feat(dossiers): branche l'écran d'explication sur /d/allocations-insertion (+ i18n FR)"
```

---

### Task 5: Translations for the 11 remaining locales

Fills the `journey` + `journeyCtaLabel` keys in the other 11 message files with native-quality translations, gated by `i18n:check`. Parallelizable — one subagent per locale (or small batches). Not fold-able into Task 4: each locale is an independently reviewable/rejectable deliverable.

**Files:**
- Modify: `messages/{en,nl,de,es,it,pt,ar,tr,ru,mk,sq}.json`

**Interfaces:** none (leaf content task).

**Per-locale instructions (identical shape for all 11):** In `<locale>.json`, locate the `public.dossierContent.insertion` object (it already contains `warning`/`doc`/`theory` with the same keys as fr.json). Add a `journeyCtaLabel` string and a `journey` object mirroring the FR structure below, translated to the target language. Rules:
- Keep proper nouns unchanged: **Actiris, Forem, VDAB, ADG, CAPAC**. For `nl.json`, follow the file's existing convention (it uses `www.rva.be` and Dutch terms — keep VDAB/Actiris/Forem/ADG as-is; "carte de contrôle" → "controlekaart", "stage d'insertion" → "beroepsinschakelingstijd", consistent with the entries already in that file).
- Keep the figure **156** exactly; never introduce "310".
- Match the tone of the existing `insertion.theory`/`insertion.warning` strings already in that same file (tutoiement where the file uses it, register, any bracketed FR glosses that file adds for legal terms).
- Valid JSON only (double quotes, comma placement); do not touch any other key.

**FR source to translate (from `messages/fr.json`):**

```json
"journeyCtaLabel": "Créer ma demande sur base des études",
"journey": {
  "step1": { "title": "Après les études", "body": "Inscris-toi comme demandeur d'emploi auprès du service régional compétent : Actiris, Forem, VDAB ou ADG." },
  "step2": { "title": "Pendant 156 jours", "body": "Le stage d'insertion démarre : cherche activement du travail et garde tes preuves. Tu es suivi par le service régional de l'emploi." },
  "step3": { "title": "À la fin du stage", "body": "Confirme ton inscription comme demandeur d'emploi et introduis ta demande d'allocations d'insertion." },
  "step4": { "title": "Après l'acceptation", "body": "Le paiement passe par ton organisme de paiement (CAPAC ou syndicat) et tu remplis chaque mois ta carte de contrôle." }
}
```

- [ ] **Step 1: Translate all 11 files**

Dispatch one subagent per locale (parallel), each given: the target file path, the exact JSON insertion point (inside `public.dossierContent.insertion`, after `description`), the FR source above, and the rules. Each subagent edits only its file.

- [ ] **Step 2: Validate**

Run: `pnpm i18n:check`
Expected: `Résultat : SUCCÈS`, 0 JSON invalides, 0 erreurs ICU. (Coverage % per locale rises slightly; warnings are non-blocking.)

Run: `pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Spot-check two locales**

`preview_start`, then for `nl` and `ar`: `preview_eval` navigating to `/d/allocations-insertion` after setting the locale cookie (or via the language switcher), assert the step titles render in the target language and no "310" appears. `preview_stop`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/nl.json messages/de.json messages/es.json messages/it.json messages/pt.json messages/ar.json messages/tr.json messages/ru.json messages/mk.json messages/sq.json
git commit -m "i18n(dossiers): traduit le parcours allocations-insertion (11 langues)"
```

---

## Self-Review

**Spec coverage:**
- §2 reusable model → Task 1 (`journey?` on `DossierDefinition`). ✓
- §2 content from structured field → Task 1. ✓
- §2 same-URL CTA toggle → Task 3 (`started` state). ✓
- §2 sidebar reuses warnings+documents → Tasks 2 (serializers) + 3 (render). ✓
- §2 run-in-progress skips intro → Task 4 (`!run` guard). ✓
- §2 zero BundleRunner modification → Tasks 3/4 pass props through only. ✓
- §3 data model → Task 1. ✓
- §4 wrapper architecture → Tasks 3/4. ✓
- §5 content → Task 1 Step 4. ✓
- §6 i18n 12 locales → Task 4 (fr) + Task 5 (11). ✓
- §7 style/motion (glass, `.outils-rise`, `.glass-cta`, no `.glass-interactive`, no shimmer) → Task 3. ✓
- §8 validation (build, i18n:check, live 3 flows, unchanged dossier) → Tasks 4/5. ✓
- Spec correction: sidebar warnings from `dossier.warnings`, not the empty DB `serializedBundle.warnings` → Task 4 Step 2 uses `dossier!.warnings`. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code; every command has expected output. Task 5 translations are intentionally produced by per-locale subagents from the given FR source (translation is generative and gated by `i18n:check` + a spot-check) — the FR source and rules are fully specified. ✓

**Type consistency:** `JourneyStepIcon`/`DossierJourneyStep` defined in Task 1 and imported in Tasks 2/3. `JourneyWarning`/`JourneyDocument` + `serializeJourneyWarnings`/`serializeJourneyDocuments` defined in Task 2 with exact signatures, consumed with matching names in Tasks 3/4. Component prop names (`journey`, `warnings`, `documents`, `ctaLabel`, `ctaLabelKey`) consistent between Task 3 definition and Task 4 call site. `dossier.journeyCtaLabel`/`journeyCtaLabelKey` names consistent between Task 1, content, and page wiring. ✓
