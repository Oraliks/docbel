# PDF Form Runner — Compact Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dense, all-fields-at-once rendering of `PdfFormRunner` (used by every PDF form in the app) with a compact, guided experience — visual stepper, contextual help panel, inline tooltips, choice cards, compact accordions — without changing any business logic (validation, auto-save, signature, submission).

**Architecture:** In-place modification of the existing shared component. New small presentational components (`InfoTooltip`, `YesNoSegmentedControl`, `OptionCard`, `CompactAccordionSection`, `FormStepper`, `FormShell`, `ContextHelpPanel`, `AutoSaveNotice`) compose into `PdfFormRunner`. A pure `buildSteps()` function (new) decides which sections are mandatory ("core") vs collapsible ("optional") based on a new opt-in `stepPriority` field property. A new `renderAs: "chip"` field property drives `OptionCard` rendering for specific fields (only tagged on the C1 form in this plan). A server-only env var gates an instant fallback to the old rendering.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict / Tailwind 4 / shadcn (base-ui) / vitest (node environment, no jsdom — component tests are NOT possible in this repo's current test setup).

**Spec:** [docs/superpowers/specs/2026-07-05-pdf-form-runner-compact-redesign-design.md](../specs/2026-07-05-pdf-form-runner-compact-redesign-design.md)

## Global Constraints

- **No business-logic changes.** Validation (`buildValidator`), auto-save (debounce 1500ms → `PUT /api/pdf/{slug}/draft`), submission (`submit()`), signature resolution (`resolveSignerName`), draft loading, itsme prefill: byte-for-byte identical behavior. Only presentation changes.
- **Test infra reality:** `vitest.config.ts` has `environment: "node"` and only includes `.test.ts` (not `.test.tsx`) — there is NO component-rendering test capability in this repo (no jsdom, no `@testing-library/react`). Do NOT add these dependencies (against the project's "no new dependency without justification" rule) and do NOT write fake/vacuous tests for presentational components. Only the PURE LOGIC extracted in Task 1 and Task 7 gets real unit tests. All new presentational components are verified manually in Task 14 (browser preview) — this is a deliberate, accepted gap in this plan, not an oversight.
- **Glass design tokens only.** Never `bg-white`/`#FFFFFF` hardcoded. Use `--glass-accent-deep` (#5B46E5), `--glass-pop-bg`, `--glass-surface`/`--glass-surface-strong`, `--glass-border`, `--glass-ink`, or the helpers in `lib/glass-classes.ts` (`GLASS_CARD`, `GLASS_INPUT`, `GLASS_LABEL`). Rounded corners 12–24px, soft shadows, no hard edges.
- **No `max-w-*`/`container`/`mx-auto` on a front-end page root** (shell already centers). Not applicable to component-level work in this plan (no new pages), but keep in mind for `FormShell`.
- **Scope: everywhere, one session.** No dossier-by-dossier phasing — the redesign applies to every `PdfForm` once merged, with the env-var safety switch as the sole rollback mechanism (not a phased rollout).
- **`renderAs: "chip"` and `stepPriority: "optional"` are OPT-IN, default-absent properties.** Every existing `PdfForm` that doesn't set them keeps behaving exactly as it does today (all sections as sequential "core" steps, no chip rendering) — verified by Task 1's tests.
- Max 3–5 files per task (each task below respects this).

---

### Task 1: `renderAs`/`stepPriority` field properties + pure `buildSteps()` function

**Files:**
- Modify: `lib/pdf-forms/types.ts` (interface `PdfFormField`, ~line 151-220)
- Modify: `lib/pdf-forms/public-serializer.ts` (interface `PublicField` + `toPublicField()`)
- Create: `lib/pdf-forms/build-steps.ts`
- Test: `lib/pdf-forms/__tests__/build-steps.test.ts`

**Interfaces:**
- Consumes: `PublicField`, `FormPayload`, `Locale` (existing, unchanged shapes plus the 2 new optional properties), `sectionLabel()` (existing, `lib/pdf-forms/section-labels.ts`), `isFieldVisible()` (existing, `lib/pdf-forms/validation.ts`), `isAutoField()` (existing, `lib/pdf-forms/auto-fields.ts`).
- Produces: `buildSteps(fields: PublicField[], values: FormPayload, locale: Locale, labels: BuildStepsLabels): BuildStepsResult` — consumed by Task 11 (`PdfFormRunner` integration). Exact shape below; Task 11 must match these type names exactly.

- [ ] **Step 1: Write the failing tests**

Create `lib/pdf-forms/__tests__/build-steps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSteps } from "../build-steps";
import type { PublicField } from "../public-serializer";

const LABELS = { fallbackTitle: "Informations", fallbackSubtitle: "Complétez les champs" };

function field(overrides: Partial<PublicField> & { id: string }): PublicField {
  return {
    type: "text",
    required: false,
    label: { fr: overrides.id },
    ...overrides,
  } as PublicField;
}

describe("buildSteps — comportement inchangé sans stepPriority (rétrocompatibilité)", () => {
  it("toutes les sections deviennent des core steps, comme aujourd'hui", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "adresse" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps).toHaveLength(2);
    expect(result.coreSteps[0].id).toBe("identite");
    expect(result.coreSteps[1].id).toBe("adresse");
    expect(result.optionalSections).toHaveLength(0);
  });

  it("regroupe globalement par section (pas seulement les champs consécutifs)", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "adresse" }),
      field({ id: "c", section: "identite" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps).toHaveLength(2);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["a", "c"]);
  });

  it("un champ sans section utilise le titre/sous-titre de repli", () => {
    const fields = [field({ id: "a" })];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].title).toBe("Informations");
  });
});

describe("buildSteps — sections optionnelles", () => {
  it("une section stepPriority=optional ne devient pas un core step", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "mes-activites", stepPriority: "optional" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps).toHaveLength(1);
    expect(result.coreSteps[0].id).toBe("identite");
    expect(result.optionalSections).toHaveLength(1);
    expect(result.optionalSections[0].key).toBe("mes-activites");
  });

  it("une section optionnelle SANS réponse est repliée par défaut", () => {
    const fields = [field({ id: "b", section: "mes-activites", stepPriority: "optional" })];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.optionalSections[0].defaultOpen).toBe(false);
  });

  it("une section optionnelle AVEC une valeur déjà répondue est dépliée par défaut", () => {
    const fields = [field({ id: "b", section: "mes-activites", stepPriority: "optional" })];
    const result = buildSteps(fields, { b: "oui" }, "fr", LABELS);
    expect(result.optionalSections[0].defaultOpen).toBe(true);
  });

  it("mélange core + optional : l'ordre des core steps ne compte pas les sections optionnelles", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "mes-activites", stepPriority: "optional" }),
      field({ id: "c", section: "adresse" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps.map((s) => s.id)).toEqual(["identite", "adresse"]);
    expect(result.optionalSections.map((s) => s.key)).toEqual(["mes-activites"]);
  });
});

describe("buildSteps — champs invisibles et auto-champs exclus", () => {
  it("un champ dont visibleIf n'est pas satisfait n'apparaît dans aucun step", () => {
    const fields = [
      field({ id: "a", section: "demande" }),
      field({ id: "b", section: "demande", visibleIf: { fieldId: "a", op: "equals", value: "oui" } }),
    ];
    const result = buildSteps(fields, { a: "non" }, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/pdf-forms/__tests__/build-steps.test.ts`
Expected: FAIL — `../build-steps` module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

In `lib/pdf-forms/types.ts`, find the `PdfFormField` interface (starts `export interface PdfFormField {`, has a `section?: string; order?: number;` pair around line 182-184). Add immediately after `order?: number;`:

```ts
  /// Habillage visuel spécifique (absent = rendu par défaut). "chip" = rendu
  /// en carte de choix cliquable (OptionCard) au lieu du widget standard —
  /// réservé aux champs où un choix visuel fait sens (ex. motif d'un C1).
  /// N'affecte ni la validation ni la valeur stockée.
  renderAs?: "chip";
  /// Priorité d'affichage de la SECTION de ce champ (tous les champs d'une
  /// même section doivent porter la même valeur). Absent/"core" = toujours
  /// une étape séquentielle obligatoire (comportement actuel). "optional" =
  /// section repliée en fin de parcours, dépliée automatiquement si déjà
  /// répondue (cf. lib/pdf-forms/build-steps.ts).
  stepPriority?: "core" | "optional";
```

In `lib/pdf-forms/public-serializer.ts`, add to the `PublicField` interface (after `section?: string; order?: number;`):

```ts
  renderAs?: PdfFormField["renderAs"];
  stepPriority?: PdfFormField["stepPriority"];
```

And to `toPublicField()`'s return object (after `order: f.order,`):

```ts
    renderAs: f.renderAs,
    stepPriority: f.stepPriority,
```

Create `lib/pdf-forms/build-steps.ts`:

```ts
// Construction pure des étapes du form-runner : regroupement par section
// (global, pas seulement consécutif — cf. commentaire historique dans
// pdf-form-runner.tsx), puis séparation core (étapes séquentielles
// obligatoires) vs optional (bloc replié en fin de parcours, sauf si déjà
// répondu). Aucune dépendance React : testable en isolation.

import { isFieldVisible } from "./validation";
import { sectionLabel } from "./section-labels";
import type { FormPayload, Locale } from "./types";
import type { PublicField } from "./public-serializer";

export interface CoreStep {
  kind: "fields";
  id: string;
  title: string;
  subtitle: string;
  fields: PublicField[];
}

export interface OptionalSection {
  key: string;
  title: string;
  fields: PublicField[];
  defaultOpen: boolean;
}

export interface BuildStepsResult {
  coreSteps: CoreStep[];
  optionalSections: OptionalSection[];
}

export interface BuildStepsLabels {
  fallbackTitle: string;
  fallbackSubtitle: string;
}

function hasAnyValue(fields: PublicField[], values: FormPayload): boolean {
  return fields.some((f) => {
    const v = values[f.id];
    if (v === undefined || v === null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "boolean") return v === true;
    return true;
  });
}

export function buildSteps(
  fields: PublicField[],
  values: FormPayload,
  locale: Locale,
  labels: BuildStepsLabels
): BuildStepsResult {
  const visible = fields.filter((f) => isFieldVisible(f.visibleIf, values));

  const groups: Array<{ key: string | undefined; fields: PublicField[] }> = [];
  const groupIndexByKey = new Map<string | undefined, number>();
  for (const f of visible) {
    const idx = groupIndexByKey.get(f.section);
    if (idx !== undefined) groups[idx].fields.push(f);
    else {
      groupIndexByKey.set(f.section, groups.length);
      groups.push({ key: f.section, fields: [f] });
    }
  }

  const coreSteps: CoreStep[] = [];
  const optionalSections: OptionalSection[] = [];

  groups.forEach((g, i) => {
    const isOptional = g.fields[0]?.stepPriority === "optional";
    const title = g.key ? sectionLabel(g.key, locale) : labels.fallbackTitle;
    if (isOptional && g.key) {
      optionalSections.push({
        key: g.key,
        title,
        fields: g.fields,
        defaultOpen: hasAnyValue(g.fields, values),
      });
    } else {
      coreSteps.push({
        kind: "fields",
        id: g.key ?? `section-${i}`,
        title,
        subtitle: labels.fallbackSubtitle,
        fields: g.fields,
      });
    }
  });

  return { coreSteps, optionalSections };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/pdf-forms/__tests__/build-steps.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Run the full existing suite to check for regressions**

Run: `pnpm test`
Expected: PASS, same count as baseline + 8 new (adding 2 optional properties to `PdfFormField`/`PublicField` must not break any existing field-array test — they only assert on specific known keys).

- [ ] **Step 6: Commit**

```bash
git add lib/pdf-forms/types.ts lib/pdf-forms/public-serializer.ts lib/pdf-forms/build-steps.ts lib/pdf-forms/__tests__/build-steps.test.ts
git commit -m "feat(pdf-forms): renderAs/stepPriority + buildSteps pur (core vs optional)"
```

---

### Task 2: `InfoTooltip` component

**Files:**
- Create: `components/ui/info-tooltip.tsx`

**Interfaces:**
- Consumes: `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` (existing, `components/ui/tooltip.tsx`, base-ui backed).
- Produces: `InfoTooltip({ text }: { text: string })` — consumed by Task 5 (`PdfField`) and Task 7 (`ContextHelpPanel`, indirectly via pattern reuse).

- [ ] **Step 1: Write the component**

Create `components/ui/info-tooltip.tsx`:

```tsx
"use client";

import { useState } from "react";
import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  text: string;
  className?: string;
}

/// Petite icône "i" : affiche `text` au survol/focus (desktop, via le
/// Tooltip base-ui existant) ET au tap (mobile — le Tooltip base-ui ne gère
/// pas le tactile nativement, donc on pilote l'ouverture manuellement).
export function InfoTooltip({ text, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          type="button"
          aria-label={text}
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[color:var(--glass-ink-soft)] transition-colors hover:text-[color:var(--glass-accent-deep,#5B46E5)] ${className ?? ""}`}
        >
          <InfoIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-left">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | grep -i "info-tooltip\|error" || echo "no errors referencing info-tooltip"`
Expected: no TypeScript error referencing this file. (Full manual visual verification happens in Task 14 — no component-rendering test exists in this repo, cf. Global Constraints.)

- [ ] **Step 3: Commit**

```bash
git add components/ui/info-tooltip.tsx
git commit -m "feat(ui): composant InfoTooltip (hover desktop + tap mobile)"
```

---

### Task 3: `YesNoSegmentedControl` component

**Files:**
- Create: `components/ui/yes-no-segmented.tsx`

**Interfaces:**
- Consumes: `FieldOption` shape `{ value: string; label: Localized }` (existing, `lib/pdf-forms/types.ts`), `loc()` (existing).
- Produces: `YesNoSegmentedControl({ value, onChange, options, locale, id, invalid }): JSX.Element` — consumed by Task 5 (`PdfField`).

- [ ] **Step 1: Write the component**

Create `components/ui/yes-no-segmented.tsx`:

```tsx
"use client";

import { loc, type FieldOption, type Locale } from "@/lib/pdf-forms/types";

interface YesNoSegmentedControlProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: [FieldOption, FieldOption];
  locale: Locale;
  invalid?: boolean;
}

/// Bascule à 2 boutons pour un champ radio à exactement 2 options (souvent
/// oui/non). Remplace le rendu en liste déroulante par défaut — plus rapide
/// à lire et à répondre pour un choix binaire.
export function YesNoSegmentedControl({
  id,
  value,
  onChange,
  options,
  locale,
  invalid,
}: YesNoSegmentedControlProps) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-invalid={invalid}
      className="inline-flex overflow-hidden rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)]"
    >
      {options.map((opt, i) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${i === 0 ? "" : "border-l border-[color:var(--glass-border)]"} ${
              selected
                ? "bg-[color:var(--glass-accent-deep,#5B46E5)] text-white"
                : "text-[color:var(--glass-ink-soft)] hover:bg-[color:var(--glass-pop-bg)]"
            }`}
          >
            {loc(opt.label, locale)}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | grep -i "yes-no-segmented\|error" || echo "no errors referencing yes-no-segmented"`
Expected: no TypeScript error referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/ui/yes-no-segmented.tsx
git commit -m "feat(ui): composant YesNoSegmentedControl"
```

---

### Task 4: `OptionCard` component

**Files:**
- Create: `components/ui/option-card.tsx`

**Interfaces:**
- Consumes: nothing project-specific (pure props).
- Produces: `OptionCard({ label, selected, onToggle, icon? }): JSX.Element` — consumed by Task 11 (`PdfFormRunner`, for `renderAs: "chip"` field clusters).

- [ ] **Step 1: Write the component**

Create `components/ui/option-card.tsx`:

```tsx
"use client";

import { CheckIcon, type LucideIcon } from "lucide-react";

interface OptionCardProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  icon?: LucideIcon;
}

/// Carte cliquable pour un choix visuel (ex. "type de changement" du C1).
/// Le mode single-select vs multi-select est décidé par l'appelant (qui
/// gère la logique de bascule via `onToggle` — ce composant est purement
/// présentationnel et ne connaît pas le type de champ sous-jacent).
export function OptionCard({ label, selected, onToggle, icon: Icon }: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
        selected
          ? "border-[color:var(--glass-accent-deep,#5B46E5)] bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep,#5B46E5)]"
          : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] hover:border-[color:var(--glass-accent-deep,#5B46E5)]"
      }`}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      <span>{label}</span>
      {selected && <CheckIcon className="ml-auto size-4 shrink-0" />}
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | grep -i "option-card\|error" || echo "no errors referencing option-card"`
Expected: no TypeScript error referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/ui/option-card.tsx
git commit -m "feat(ui): composant OptionCard"
```

---

### Task 5: Wire `InfoTooltip` + `YesNoSegmentedControl` into `PdfField`

**Files:**
- Modify: `components/pdf-forms/pdf-field.tsx` (full file, 251 lines)

**Interfaces:**
- Consumes: `InfoTooltip` (Task 2), `YesNoSegmentedControl` (Task 3).
- Produces: `PdfField` keeps its EXACT existing prop signature (`{ field, value, error, locale, onChange, formId, formSlug }`) — Task 11 continues to call it exactly as today for every field NOT pulled out for `OptionCard` rendering.

- [ ] **Step 1: Replace the full file**

Replace the entire contents of `components/pdf-forms/pdf-field.tsx` with:

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { NissInput } from "@/components/ui/niss-input";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { YesNoSegmentedControl } from "@/components/ui/yes-no-segmented";
import { FieldErrorReport } from "./field-error-report";
import { ArrayField } from "./array-field";
import { loc, Locale, FieldValue, FullNameValue, isFullNameValue } from "@/lib/pdf-forms/types";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

// Type HTML + inputMode adaptés au type sémantique (clavier mobile pertinent).
const INPUT_HINTS: Record<string, { type?: string; inputMode?: "numeric" | "tel" | "email" | "text" }> = {
  number: { type: "number", inputMode: "numeric" },
  date: { type: "date" },
  email: { type: "email", inputMode: "email" },
  phone_be: { type: "tel", inputMode: "tel" },
  niss: { inputMode: "numeric" },
  postal_be: { inputMode: "numeric" },
  bce: { inputMode: "numeric" },
  tva_be: { inputMode: "text" },
};

interface Props {
  field: PublicField;
  value: FieldValue;
  error?: string;
  locale: Locale;
  onChange: (value: FieldValue) => void;
  /// Contexte (optionnel) pour permettre le signalement d'un faux positif
  /// avec la traçabilité du formulaire d'origine.
  formId?: string;
  formSlug?: string;
}

/// Rend le label + une InfoTooltip si `help` est présent — remplace
/// l'ancien affichage systématique de `help` en <FieldDescription> visible
/// en permanence (objectif : compacité, cf. spec 2026-07-05).
function LabelWithTooltip({ label, help, required }: { label: string; help: string; required?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      {required && <span className="text-destructive"> *</span>}
      {help && <InfoTooltip text={help} />}
    </span>
  );
}

export function PdfField({ field, value, error, locale, onChange, formId, formSlug }: Props) {
  const label = loc(field.label, locale);
  const help = loc(field.help, locale);
  const placeholder = loc(field.placeholder, locale);
  const invalid = !!error;

  // Helper local : évite de répéter les mêmes props 6 fois.
  const errorReport = (
    <FieldErrorReport
      error={error}
      fieldId={field.id}
      fieldType={field.type}
      rejectedValue={value}
      formId={formId}
      formSlug={formSlug}
      locale={locale}
    />
  );

  // Tableau de lignes (cohabitants etc.) — composant dédié.
  if (field.type === "array") {
    return (
      <ArrayField
        field={field}
        value={value}
        locale={locale}
        onChange={onChange}
        formId={formId}
        formSlug={formSlug}
      />
    );
  }

  // Checkbox : disposition horizontale (case + libellé).
  if (field.type === "checkbox") {
    // `readOnly` est porté côté schéma pour certaines cases qui ne doivent
    // PAS être modifiées côté UX (eg. cotisation syndicale, gérée par
    // l'organisme de paiement). On désactive l'interaction et on grise.
    const isReadOnly = field.readOnly === true;
    return (
      <Field orientation="horizontal" data-invalid={invalid}>
        <Checkbox
          id={field.id}
          checked={value === true}
          onCheckedChange={(c) => !isReadOnly && onChange(c === true)}
          disabled={isReadOnly}
        />
        <FieldLabel
          htmlFor={field.id}
          className={isReadOnly ? "font-normal text-muted-foreground" : "font-normal"}
        >
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        {errorReport}
      </Field>
    );
  }

  // Radio à exactement 2 options : bascule compacte au lieu d'une liste
  // déroulante (auto-appliqué, pas d'opt-in par champ nécessaire).
  if (field.type === "radio" && (field.options || []).length === 2) {
    const opts = field.options as [typeof field.options[number], typeof field.options[number]];
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <YesNoSegmentedControl
          id={field.id}
          value={(value as string) ?? ""}
          onChange={onChange}
          options={opts}
          locale={locale}
          invalid={invalid}
        />
        {errorReport}
      </Field>
    );
  }

  // Select / radio (3+ options) : liste déroulante (compact), inchangé.
  if (field.type === "select" || field.type === "radio") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <Select value={(value as string) ?? ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger id={field.id} className="w-full" aria-invalid={invalid}>
            <SelectValue placeholder={placeholder || "Sélectionner…"} />
          </SelectTrigger>
          <SelectContent>
            {!field.required && <SelectItem value="">—</SelectItem>}
            {(field.options || []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {loc(o.label, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorReport}
      </Field>
    );
  }

  // Textarea
  if (field.type === "textarea") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <Textarea
          id={field.id}
          value={(value as string) ?? ""}
          placeholder={placeholder}
          maxLength={field.maxLength}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
        {errorReport}
      </Field>
    );
  }

  // Nom complet : deux inputs côté front (prénom + nom), une seule valeur PDF.
  if (field.type === "fullname") {
    const v: FullNameValue = isFullNameValue(value) ? value : {};
    const lastFirst = field.nameOrder === "last-first";
    const firstInput = (
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">Prénom</span>
        <Input
          value={v.first ?? ""}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-label={`${label} — prénom`}
          onChange={(e) => onChange({ ...v, first: e.target.value })}
        />
      </div>
    );
    const lastInput = (
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">Nom</span>
        <Input
          value={v.last ?? ""}
          aria-invalid={invalid}
          aria-label={`${label} — nom`}
          onChange={(e) => onChange({ ...v, last: e.target.value })}
        />
      </div>
    );
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          {lastFirst ? lastInput : firstInput}
          {lastFirst ? firstInput : lastInput}
        </div>
        {errorReport}
      </Field>
    );
  }

  // NB : les champs `signature` sont rendus par <SignatureConfirm> dans le
  // runner (étape Signature dédiée), pas ici.

  // NISS : masque automatique AAMMJJ-SSS.CC
  if (field.type === "niss") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <NissInput
          id={field.id}
          value={(value as string) ?? ""}
          aria-invalid={invalid}
          onChange={(v) => onChange(v)}
        />
        {errorReport}
      </Field>
    );
  }

  // Champs texte (text, iban, date, number, email, phone…)
  const hint = INPUT_HINTS[field.type] || {};
  // Date auto (date de génération) : pré-remplie et non éditable.
  const autoToday = field.prefillFrom === "system.today";
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.id}>
        <LabelWithTooltip label={label} help={help} required={field.required} />
      </FieldLabel>
      <Input
        id={field.id}
        type={hint.type ?? "text"}
        inputMode={hint.inputMode}
        value={(value as string | number) ?? ""}
        placeholder={placeholder}
        maxLength={field.maxLength}
        min={field.min}
        max={field.max}
        aria-invalid={invalid}
        disabled={autoToday}
        readOnly={autoToday}
        onChange={(e) => onChange(e.target.value)}
      />
      {autoToday && !help && (
        <FieldDescription>Date de génération du document (automatique).</FieldDescription>
      )}
      {errorReport}
    </Field>
  );
}
```

Notes for the implementer:
- `field.options[number]` typing in the 2-option radio branch: if TypeScript complains about the tuple cast, use `field.options as unknown as [FieldOption, FieldOption]` — the runtime check (`.length === 2`) already guarantees safety, this is a type-level cast only.
- The `autoToday` `FieldDescription` fallback is INTENTIONALLY kept as always-visible text (not a tooltip) — it explains why a *disabled* field is pre-filled, which is different from the "explain what to answer" tooltips elsewhere. Do not tooltip-ify this one.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: PASS, same count as Task 1's result (this task changes no logic, only JSX — no test should reference `PdfField`'s internals directly; if any test unexpectedly fails, STOP and report — do not silently adjust the test to match).

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: succeeds, no new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add components/pdf-forms/pdf-field.tsx
git commit -m "feat(pdf-forms): PdfField — help en tooltip, radio 2 options en segmented control"
```

---

### Task 6: `CompactAccordionSection` component

**Files:**
- Create: `components/pdf-forms/compact-accordion-section.tsx`

**Interfaces:**
- Consumes: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` (existing, `components/ui/accordion.tsx`), `OptionalSection` type (Task 1).
- Produces: `CompactAccordionSection({ sections, renderFields }): JSX.Element` — consumed by Task 11.

- [ ] **Step 1: Write the component**

Create `components/pdf-forms/compact-accordion-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { OptionalSection } from "@/lib/pdf-forms/build-steps";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

interface CompactAccordionSectionProps {
  sections: OptionalSection[];
  renderFields: (fields: PublicField[]) => React.ReactNode;
}

/// Regroupe les sections "optional" (cf. buildSteps) dans un accordéon
/// multi-ouverture. Une section s'ouvre par défaut si `defaultOpen` (déjà
/// répondue) — calculé une fois au montage, pas recalculé à chaque frappe
/// pour ne pas re-fermer une section que l'utilisateur vient d'ouvrir.
export function CompactAccordionSection({ sections, renderFields }: CompactAccordionSectionProps) {
  const [defaultOpenValues] = useState(() => sections.filter((s) => s.defaultOpen).map((s) => s.key));

  return (
    <Accordion type="multiple" defaultValue={defaultOpenValues} className="flex flex-col gap-1">
      {sections.map((s) => (
        <AccordionItem key={s.key} value={s.key}>
          <AccordionTrigger>{s.title}</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4 pt-1">{renderFields(s.fields)}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | grep -i "compact-accordion\|error" || echo "no errors referencing compact-accordion-section"`
Expected: no TypeScript error referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/pdf-forms/compact-accordion-section.tsx
git commit -m "feat(pdf-forms): composant CompactAccordionSection"
```

---

### Task 7: `ContextHelpPanel` + dictionnaire d'aide par section

**Files:**
- Create: `lib/pdf-forms/section-help.ts`
- Test: `lib/pdf-forms/__tests__/section-help.test.ts`
- Create: `components/pdf-forms/context-help-panel.tsx`

**Interfaces:**
- Consumes: `Locale` (existing).
- Produces: `getSectionHelp(key: string | undefined, lang: Locale): SectionHelp` — consumed by Task 11. `ContextHelpPanel({ sectionKey, title, locale }): JSX.Element` — consumed by Task 11.

- [ ] **Step 1: Write the failing test**

Create `lib/pdf-forms/__tests__/section-help.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getSectionHelp } from "../section-help";

describe("getSectionHelp", () => {
  it("renvoie un texte pour une section connue (demande)", () => {
    const help = getSectionHelp("demande", "fr");
    expect(help.body.length).toBeGreaterThan(0);
  });

  it("renvoie un texte de repli générique pour une section inconnue", () => {
    const help = getSectionHelp("section-jamais-vue-xyz", "fr");
    expect(help.body.length).toBeGreaterThan(0);
  });

  it("renvoie un texte de repli générique si la clé est absente", () => {
    const help = getSectionHelp(undefined, "fr");
    expect(help.body.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/pdf-forms/__tests__/section-help.test.ts`
Expected: FAIL — `../section-help` module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `lib/pdf-forms/section-help.ts`:

```ts
// Textes d'aide contextuelle par section, affichés dans ContextHelpPanel.
// FR uniquement dans ce lot (précédent établi : cf. NEXT_ACTIONS #20) — pas
// de titreKey/bodyKey ici, ce n'est pas du contenu i18n-critique (aide
// secondaire, dégrade proprement en restant en FR pour les autres locales).

import type { Locale } from "./types";

export interface SectionHelp {
  title: string;
  body: string;
  examples?: string[];
}

const HELP: Record<string, SectionHelp> = {
  identite: {
    title: "Votre identité",
    body: "Vérifiez que votre nom, prénom et numéro NISS correspondent à votre carte d'identité.",
  },
  adresse: {
    title: "Votre adresse",
    body: "Indiquez l'adresse à laquelle vous habitez actuellement (celle de votre domiciliation officielle).",
  },
  demande: {
    title: "Comprendre cette étape",
    body: "Indiquez la nature du changement intervenu dans votre situation.",
    examples: ["Mariage, séparation", "Déménagement", "Nouveau revenu", "Changement d'emploi", "Naissance ou départ d'un enfant"],
  },
  "situation-familiale": {
    title: "Votre situation familiale",
    body: "Ces informations déterminent votre catégorie (isolé, cohabitant, chef de ménage) et donc le montant de vos allocations.",
  },
  "mes-activites": {
    title: "Vos activités",
    body: "Toute activité professionnelle, même accessoire, doit être déclarée — elle peut nécessiter un formulaire complémentaire.",
  },
  "mes-revenus": {
    title: "Vos revenus",
    body: "Ces questions permettent de vérifier si un autre revenu de remplacement doit être pris en compte.",
  },
  "mode-paiement": {
    title: "Votre compte bancaire",
    body: "Le compte sur lequel vos allocations seront versées.",
  },
  "cotisation-syndicale": {
    title: "Cotisation syndicale",
    body: "Concerne la retenue de la cotisation syndicale sur vos allocations, si applicable.",
  },
  "non-eee": {
    title: "Hors Espace économique européen",
    body: "Ces questions concernent les travailleurs venant d'un pays hors UE/EEE/Suisse.",
  },
  divers: {
    title: "Informations complémentaires",
    body: "Quelques questions additionnelles nécessaires à l'examen de votre dossier.",
  },
  affirmations: {
    title: "Déclaration sur l'honneur",
    body: "Ces affirmations engagent votre responsabilité — relisez-les avant de continuer.",
  },
  annexes: {
    title: "Annexes",
    body: "Documents ou informations complémentaires, à fournir seulement si votre situation le nécessite.",
  },
};

const FALLBACK: Record<Locale, SectionHelp> = {
  fr: { title: "Pourquoi ces questions ?", body: "Ces informations permettent d'actualiser votre dossier et de vérifier si vos droits peuvent changer." },
  nl: { title: "Pourquoi ces questions ?", body: "Ces informations permettent d'actualiser votre dossier et de vérifier si vos droits peuvent changer." },
  de: { title: "Pourquoi ces questions ?", body: "Ces informations permettent d'actualiser votre dossier et de vérifier si vos droits peuvent changer." },
};

/// Renvoie l'aide contextuelle pour une section. Repli générique si la
/// section n'a pas d'entrée dédiée (ex. un formulaire compagnon dont les
/// sections n'ont pas encore été documentées ici) — ne renvoie jamais une
/// chaîne vide.
export function getSectionHelp(key: string | undefined, lang: Locale): SectionHelp {
  if (key && HELP[key]) return HELP[key];
  return FALLBACK[lang] ?? FALLBACK.fr;
}
```

Create `components/pdf-forms/context-help-panel.tsx`:

```tsx
"use client";

import { getSectionHelp } from "@/lib/pdf-forms/section-help";
import type { Locale } from "@/lib/pdf-forms/types";

interface ContextHelpPanelProps {
  /// Clé de section de l'étape active (undefined = étape résumé/repli).
  sectionKey: string | undefined;
  locale: Locale;
}

/// Panneau d'aide contextuelle, contenu dérivé de la section active.
/// Sticky en desktop (colonne de droite), sous le formulaire en mobile.
export function ContextHelpPanel({ sectionKey, locale }: ContextHelpPanelProps) {
  const help = getSectionHelp(sectionKey, locale);
  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-5 lg:sticky lg:top-6">
      <h3 className="text-sm font-semibold text-[color:var(--glass-ink)]">{help.title}</h3>
      <p className="text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{help.body}</p>
      {help.examples && help.examples.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm text-[color:var(--glass-ink-soft)]">
          {help.examples.map((ex) => (
            <li key={ex} className="flex items-start gap-2">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)]" />
              {ex}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/pdf-forms/__tests__/section-help.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-forms/section-help.ts lib/pdf-forms/__tests__/section-help.test.ts components/pdf-forms/context-help-panel.tsx
git commit -m "feat(pdf-forms): ContextHelpPanel + dictionnaire d'aide par section"
```

---

### Task 8: `FormStepper` component

**Files:**
- Create: `components/pdf-forms/form-stepper.tsx`

**Interfaces:**
- Consumes: nothing project-specific beyond lucide icons.
- Produces: `FormStepper({ steps, activeIndex, onSelect }): JSX.Element` — consumed by Task 11, replaces the tab bar at pdf-form-runner.tsx:337-369.

- [ ] **Step 1: Write the component**

Create `components/pdf-forms/form-stepper.tsx`:

```tsx
"use client";

import { CheckIcon } from "lucide-react";

export interface FormStepperItem {
  id: string;
  label: string;
  hasError: boolean;
}

interface FormStepperProps {
  steps: FormStepperItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/// Stepper horizontal : numéros (ou coche si l'étape précède l'active),
/// ligne de connexion, libellé court. Remplace la barre d'onglets plate.
export function FormStepper({ steps, activeIndex, onSelect }: FormStepperProps) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto px-1 py-3">
      {steps.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        const isLast = i === steps.length - 1;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={isActive ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--glass-pop-bg)]"
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isActive
                    ? "bg-[color:var(--glass-accent-deep,#5B46E5)] text-white"
                    : isDone
                    ? "bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep,#5B46E5)]"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <CheckIcon className="size-3.5" /> : i + 1}
              </span>
              <span
                className={`truncate text-xs font-semibold ${
                  isActive ? "text-[color:var(--glass-ink)]" : "text-[color:var(--glass-ink-soft)]"
                }`}
              >
                {step.label}
                {step.hasError && (
                  <span className="ml-1 inline-block size-1.5 rounded-full bg-destructive" aria-label="Erreurs dans cette étape" />
                )}
              </span>
            </button>
            {!isLast && <span aria-hidden className="h-px w-4 shrink-0 bg-[color:var(--glass-border)]" />}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | grep -i "form-stepper\|error" || echo "no errors referencing form-stepper"`
Expected: no TypeScript error referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/pdf-forms/form-stepper.tsx
git commit -m "feat(pdf-forms): composant FormStepper"
```

---

### Task 9: `FormShell` component

**Files:**
- Create: `components/pdf-forms/form-shell.tsx`

**Interfaces:**
- Consumes: nothing project-specific.
- Produces: `FormShell({ children, helpPanel }): JSX.Element` — consumed by Task 11.

- [ ] **Step 1: Write the component**

Create `components/pdf-forms/form-shell.tsx`:

```tsx
interface FormShellProps {
  children: React.ReactNode;
  helpPanel: React.ReactNode;
}

/// Layout 2 colonnes desktop (formulaire | aide contextuelle), 1 colonne
/// mobile (aide affichée sous le formulaire, jamais cachée). Pas de
/// max-w-*/mx-auto sur la racine (cf. DESIGN_RULES) — le composant se
/// contente de structurer, le conteneur parent gère déjà la largeur.
export function FormShell({ children, helpPanel }: FormShellProps) {
  return (
    <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">{children}</div>
      <div>{helpPanel}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | grep -i "form-shell\|error" || echo "no errors referencing form-shell"`
Expected: no TypeScript error referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/pdf-forms/form-shell.tsx
git commit -m "feat(pdf-forms): composant FormShell (layout 2 colonnes)"
```

---

### Task 10: `AutoSaveNotice` component

**Files:**
- Create: `components/pdf-forms/auto-save-notice.tsx`

**Interfaces:**
- Consumes: nothing project-specific.
- Produces: `AutoSaveNotice({ lastSavedAt, isPartOfBundle }): JSX.Element` — consumed by Task 11.

- [ ] **Step 1: Write the component**

Create `components/pdf-forms/auto-save-notice.tsx`:

```tsx
"use client";

interface AutoSaveNoticeProps {
  lastSavedAt: Date | null;
  /// true si ce formulaire fait partie d'un dossier multi-documents (a un
  /// bundleRunId) — dans ce cas, le code de reprise du dossier existe déjà
  /// ailleurs (ResumeCodeBanner) ; on s'y réfère au lieu de dupliquer le
  /// mécanisme.
  isPartOfBundle: boolean;
}

/// Surface visuelle de l'auto-save déjà existant (debounce 1500ms côté
/// PdfFormRunner) — n'introduit AUCUNE nouvelle logique de sauvegarde.
export function AutoSaveNotice({ lastSavedAt, isPartOfBundle }: AutoSaveNoticeProps) {
  return (
    <p className="text-xs text-[color:var(--glass-ink-soft)]">
      Vos réponses sont enregistrées automatiquement
      {lastSavedAt && ` (dernier enregistrement à ${lastSavedAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })})`}
      {isPartOfBundle && " — retrouve ton code de reprise sur la page du dossier"}.
    </p>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | grep -i "auto-save-notice\|error" || echo "no errors referencing auto-save-notice"`
Expected: no TypeScript error referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/pdf-forms/auto-save-notice.tsx
git commit -m "feat(pdf-forms): composant AutoSaveNotice"
```

---

### Task 11: Wire everything into `PdfFormRunner` (+ legacy fallback)

**Files:**
- Modify: `components/pdf-forms/pdf-form-runner.tsx` (full file, 545 lines)

**Interfaces:**
- Consumes: `buildSteps` (Task 1), `FormStepper` (Task 8), `FormShell` (Task 9), `ContextHelpPanel` (Task 7), `CompactAccordionSection` (Task 6), `OptionCard` (Task 4), `AutoSaveNotice` (Task 10), `PdfField` (Task 5, unchanged signature).
- Produces: `PdfFormRunner` gains one new optional prop `legacyLayout?: boolean` (default `false`) — consumed by Task 12 (the 2 page files pass it).

This is the largest task. Read the CURRENT file first (`components/pdf-forms/pdf-form-runner.tsx`) to confirm line numbers haven't drifted from Tasks 1–10 (they shouldn't have — no prior task touches this file), then apply the following.

- [ ] **Step 1: Add the `legacyLayout` prop and legacy-path early return**

In the `PdfFormRunnerProps` interface, add:

```ts
interface PdfFormRunnerProps {
  form: PublicForm;
  bundlePrefill?: Record<string, string>;
  bundleRunId?: string;
  onValuesChange?: (values: FormPayload) => void;
  onLocaleChange?: (locale: Locale) => void;
  /// Filet de sécurité : force l'ancien rendu (grille dense + résumé
  /// détaillé) si true. Piloté par un env var serveur, cf. Task 12. Défaut
  /// false (nouveau rendu).
  legacyLayout?: boolean;
}
```

Add `legacyLayout = false` to the destructured props of `PdfFormRunner`.

- [ ] **Step 2: Replace the `steps` useMemo with `buildSteps()` + local step-list construction**

Replace the entire `const steps = useMemo<Step[]>(...)` block (current lines 107-151, from the comment `// ----- Construction des étapes (tabs) -----` through the closing `}, [form.fields, values, locale]);`) with:

```ts
  // ----- Construction des étapes -----
  // Étapes "core" (séquentielles) + un bloc "optionnel" replié (sections
  // stepPriority=optional) + l'étape résumé, dans cet ordre. Logique pure
  // extraite dans build-steps.ts (testée indépendamment).
  const dataFields = useMemo(
    () => form.fields.filter((f) => !isAutoField(f)),
    [form.fields]
  );
  const { coreSteps, optionalSections } = useMemo(
    () =>
      buildSteps(dataFields, values, locale, {
        fallbackTitle: t("runnerStepInfoTitle"),
        fallbackSubtitle: t("runnerStepInfoSubtitle"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataFields, values, locale]
  );

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [...coreSteps];
    if (optionalSections.length > 0) {
      out.push({
        kind: "optional-group",
        id: "optional-group",
        title: t("runnerOptionalGroupTitle"),
        subtitle: t("runnerOptionalGroupSubtitle"),
        sections: optionalSections,
      });
    }
    out.push({ kind: "summary", id: "summary", title: t("runnerStepSummaryTitle"), subtitle: t("runnerStepSummarySubtitle") });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreSteps, optionalSections, locale]);
```

Add the import at the top of the file (alongside the existing `lib/pdf-forms/...` imports):

```ts
import { buildSteps } from "@/lib/pdf-forms/build-steps";
```

Update the `Step` type definition (currently `type Step = { kind: "fields"; ... } | { kind: "summary"; ... };`) to add the new variant:

```ts
type Step =
  | { kind: "fields"; id: string; title: string; subtitle: string; fields: PublicField[] }
  | { kind: "optional-group"; id: string; title: string; subtitle: string; sections: OptionalSection[] }
  | { kind: "summary"; id: string; title: string; subtitle: string };
```

Add `OptionalSection` to the import from `@/lib/pdf-forms/build-steps` (alongside `buildSteps`):

```ts
import { buildSteps, type OptionalSection } from "@/lib/pdf-forms/build-steps";
```

- [ ] **Step 3: Update `fieldStepIndex` to cover the optional-group step**

Replace the `fieldStepIndex` useMemo (current lines 160-167) with:

```ts
  // Map champ → index d'étape (pour sauter sur la 1ʳᵉ erreur).
  const fieldStepIndex = useMemo(() => {
    const m: Record<string, number> = {};
    steps.forEach((s, i) => {
      if (s.kind === "fields") s.fields.forEach((f) => (m[f.id] = i));
      if (s.kind === "optional-group") s.sections.forEach((sec) => sec.fields.forEach((f) => (m[f.id] = i)));
    });
    return m;
  }, [steps]);
```

- [ ] **Step 4: Add `lastSavedAt` state, updated by the existing auto-save timer**

In `setValue` (current lines 169-186), the debounced `fetch` call already exists — add a state update alongside it. Add near the other `useState` declarations:

```ts
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
```

In `setValue`, inside the `saveTimer.current = setTimeout(() => { ... }, 1500);` callback, after the `fetch(...).catch(() => {});` line, add:

```ts
          setLastSavedAt(new Date());
```

(Keep the rest of `setValue` — the `fetch` call and debounce mechanics — completely unchanged.)

- [ ] **Step 5: Update `stepHasError`, remove the now-unused `stepIcon`**

Immediately before the `return (` that starts the component's JSX (right after the `if (done) { ... }` block), the file has:

```ts
  const current = steps[activeIndex];
  const stepHasError = (s: Step) => s.kind === "fields" && s.fields.some((f) => errors[f.id]);

  const stepIcon = (s: Step, i: number) => {
    if (s.kind === "summary") return <EyeIcon className="size-4" />;
    return i === 0 ? <UserIcon className="size-4" /> : <FileTextIcon className="size-4" />;
  };
```

Replace it with:

```ts
  const current = steps[activeIndex];
  const stepHasError = (s: Step) =>
    (s.kind === "fields" && s.fields.some((f) => errors[f.id])) ||
    (s.kind === "optional-group" && s.sections.some((sec) => sec.fields.some((f) => errors[f.id])));
```

(`stepIcon` is deleted here — `FormStepper` computes its own icons internally, and `LegacyRunnerBody`, added in Step 7 below, defines its own local copy. Leaving the old top-level `stepIcon` in place would be dead code.)

- [ ] **Step 6: Replace the render — stepper, shell, field rendering, optional group, summary**

Replace everything from `return (` (current line 309) through the matching closing `);` (current line 501) — i.e. the ENTIRE returned JSX of the non-`done` branch — with:

```tsx
  const activeSectionKey = current.kind === "fields" ? current.id : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Barre langue + itsme (au-dessus de la carte) */}
      {(form.locales.length > 1 || form.allowItsme) && (
        <div className="flex flex-wrap items-center gap-2">
          {form.locales.length > 1 &&
            form.locales.map((l) => (
              <Button key={l} size="sm" variant={l === locale ? "default" : "outline"} className="h-7 px-2.5" onClick={() => setLocale(l)}>
                {LOCALE_NAMES[l]}
              </Button>
            ))}
          {form.allowItsme && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => { window.location.href = `/api/pdf/${form.slug}/prefill/start`; }}
            >
              {t("runnerItsmePrefillCta")}
            </Button>
          )}
        </div>
      )}

      <FormShell
        helpPanel={<ContextHelpPanel sectionKey={activeSectionKey} locale={locale} />}
      >
        <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-sm">
          <div className="border-b px-2">
            <FormStepper
              steps={steps.map((s) => ({ id: s.id, label: s.title, hasError: stepHasError(s) }))}
              activeIndex={activeIndex}
              onSelect={setActive}
            />
          </div>

          <CardContent className="p-5 sm:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (current.kind === "summary") submit();
              }}
              className="flex flex-col gap-5"
            >
              {/* En-tête d'étape */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base font-semibold">{current.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {current.kind === "summary"
                      ? t("runnerSummaryStepHelp")
                      : t("runnerFieldsStepHelp")}
                  </p>
                </div>
                {current.kind === "fields" && current.fields.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                    <InfoIcon className="size-3" />
                    {current.fields.every((f) => f.required) ? t("runnerAllFieldsRequired") : t("runnerStarFieldsRequired")}
                  </span>
                )}
              </div>

              {/* Contenu de l'étape */}
              {current.kind === "summary" ? (
                <ConfirmationCard hasSignature={form.fields.some(isSignatureField)} signerName={signerName} />
              ) : current.kind === "optional-group" ? (
                <CompactAccordionSection
                  sections={current.sections}
                  renderFields={(fields) => (
                    <FieldsCluster
                      fields={fields}
                      values={values}
                      errors={errors}
                      locale={locale}
                      setValue={setValue}
                      formId={form.id}
                      formSlug={form.slug}
                    />
                  )}
                />
              ) : (
                <FieldsCluster
                  fields={current.fields}
                  values={values}
                  errors={errors}
                  locale={locale}
                  setValue={setValue}
                  formId={form.id}
                  formSlug={form.slug}
                />
              )}

              {/* Pied d'étape */}
              {current.kind === "summary" ? (
                <div className="flex flex-col gap-4">
                  {form.allowDownload && form.allowDoccle && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{t("runnerDeliveryModeLabel")}</span>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant={delivery === "download" ? "default" : "outline"} onClick={() => setDelivery("download")}>
                          <DownloadIcon className="size-4" /> {t("runnerDeliveryDownload")}
                        </Button>
                        <Button type="button" size="sm" variant={delivery === "doccle" ? "default" : "outline"} onClick={() => setDelivery("doccle")}>
                          <SendIcon className="size-4" /> {t("runnerDeliveryDoccle")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {delivery === "doccle" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="doccle-ref">{t("runnerDoccleRecipientLabel")}</Label>
                      <Input id="doccle-ref" value={doccleRef} placeholder={t("runnerDoccleRecipientPlaceholder")} onChange={(e) => setDoccleRef(e.target.value)} />
                    </div>
                  )}
                  <Separator />
                  {form.fields.some(isSignatureField) && (
                    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("runnerDigitalSignatureLabel")}
                      </div>
                      {signerName ? (
                        <>
                          <div className="mt-1 font-serif text-lg italic">{signerName}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {t("runnerDigitalSignatureAutoNote")}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          {t("runnerDigitalSignatureNameRequired")}
                        </div>
                      )}
                    </div>
                  )}
                  <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
                    <span>{t("runnerConsentText")}</span>
                  </label>
                  <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} />
                  <div className="flex items-center gap-2">
                    {activeIndex > 0 && (
                      <Button type="button" variant="outline" onClick={() => setActive(activeIndex - 1)}>
                        <ChevronLeftIcon className="size-4" /> {t("previous")}
                      </Button>
                    )}
                    <Button type="submit" disabled={submitting} className="flex-1">
                      {submitting ? <Loader2Icon className="size-4 animate-spin" /> : delivery === "doccle" ? <SendIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                      {submitting
                        ? t("runnerGenerating")
                        : delivery === "doccle"
                        ? t("runnerSubmitSignAndSend")
                        : t("runnerSubmitSignAndGenerate")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    {activeIndex > 0 ? (
                      <Button type="button" variant="outline" onClick={() => setActive(activeIndex - 1)}>
                        <ChevronLeftIcon className="size-4" /> {t("previous")}
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button type="button" onClick={() => setActive(activeIndex + 1)}>
                      {t("continue")} <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>
                  <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} />
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </FormShell>
    </div>
  );
```

Add these new imports at the top of the file:

```ts
import { FormStepper } from "./form-stepper";
import { FormShell } from "./form-shell";
import { ContextHelpPanel } from "./context-help-panel";
import { CompactAccordionSection } from "./compact-accordion-section";
import { AutoSaveNotice } from "./auto-save-notice";
import { OptionCard } from "@/components/ui/option-card";
```

Finally, add the 2 new translation keys this step's code references (`t("runnerOptionalGroupTitle")`, `t("runnerOptionalGroupSubtitle")`). In `messages/fr.json`, find `"runnerStepSummaryTitle": "Résumé",` (namespace `public.dossier`) and add immediately after the `runnerStepSummarySubtitle` line:

```json
      "runnerOptionalGroupTitle": "Autres informations à déclarer",
      "runnerOptionalGroupSubtitle": "Dépliez uniquement ce qui vous concerne.",
```

(FR only, same precedent as prior lots — cf. NEXT_ACTIONS #20.)

- [ ] **Step 7: Add the `FieldsCluster` and `ConfirmationCard` helper components (bottom of the file)**

Add these new functions after `PdfFormRunner` and before the existing `SummaryStep` function (keep `SummaryStep` itself — cf. Step 7 below):

```tsx
/// Regroupe les champs `renderAs: "chip"` en grille de OptionCard (au lieu
/// d'appeler PdfField pour ceux-là) ; le reste des champs suit le rendu
/// PdfField habituel. Single-select si le champ est "radio", multi-select
/// (indépendant) si "checkbox" — chaque champ garde sa propre valeur, ce
/// composant ne fait qu'aiguiller le rendu.
function FieldsCluster({
  fields,
  values,
  errors,
  locale,
  setValue,
  formId,
  formSlug,
}: {
  fields: PublicField[];
  values: FormPayload;
  errors: Record<string, string>;
  locale: Locale;
  setValue: (id: string, value: FieldValue) => void;
  formId: string;
  formSlug: string;
}) {
  const chipFields = fields.filter((f) => f.renderAs === "chip");
  const otherFields = fields.filter((f) => f.renderAs !== "chip");

  return (
    <div className="flex flex-col gap-5">
      {chipFields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chipFields.map((f) => {
            if (f.type === "radio") {
              return (f.options || []).map((o) => (
                <OptionCard
                  key={`${f.id}-${o.value}`}
                  label={loc(o.label, locale)}
                  selected={values[f.id] === o.value}
                  onToggle={() => setValue(f.id, o.value)}
                />
              ));
            }
            // checkbox : une seule carte, toggle indépendant.
            return (
              <OptionCard
                key={f.id}
                label={loc(f.label, locale)}
                selected={values[f.id] === true}
                onToggle={() => setValue(f.id, values[f.id] !== true)}
              />
            );
          })}
        </div>
      )}
      {otherFields.length > 0 && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          {otherFields.map((f) => (
            <div key={f.id} className={FULL_WIDTH_TYPES.has(f.type) ? "sm:col-span-2" : ""}>
              <PdfField
                field={f}
                value={values[f.id] ?? ""}
                error={errors[f.id]}
                locale={locale}
                onChange={(v) => setValue(f.id, v)}
                formId={formId}
                formSlug={formSlug}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/// Étape finale allégée : plus de liste détaillée des valeurs (ancien
/// SummaryStep, conservé plus bas pour le mode legacy). Le mode de
/// livraison/signature/consentement restent dans le pied d'étape appelant.
function ConfirmationCard({ hasSignature, signerName }: { hasSignature: boolean; signerName: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-5 text-sm text-[color:var(--glass-ink)]">
      Votre déclaration est prête à être envoyée.
      {hasSignature && !signerName && (
        <span className="mt-1 block text-amber-700 dark:text-amber-300">
          Renseignez votre nom en début de formulaire pour signer numériquement.
        </span>
      )}
    </div>
  );
}
```

Add `loc` to the existing `@/lib/pdf-forms/types` import if not already imported at the top (it already is, per the original file's import line — keep as-is, just confirm `loc` is present in that import list; it is).

- [ ] **Step 8: Isolate the legacy rendering path**

Keep the existing `SummaryStep` function completely unchanged at the bottom of the file (it becomes the LEGACY summary, used only when `legacyLayout` is true).

At the very top of `PdfFormRunner`'s return statement — i.e., immediately after the `if (done) { ... }` block and BEFORE the `const current = steps[activeIndex];` line — add:

```tsx
  if (legacyLayout) {
    return (
      <LegacyRunnerBody
        form={form}
        steps={steps}
        activeIndex={activeIndex}
        setActive={setActive}
        locale={locale}
        values={values}
        errors={errors}
        setValue={setValue}
        signerName={signerName}
        consent={consent}
        setConsent={setConsent}
        delivery={delivery}
        setDelivery={setDelivery}
        doccleRef={doccleRef}
        setDoccleRef={setDoccleRef}
        submitting={submitting}
        submit={submit}
        t={t}
      />
    );
  }
```

Add a new `LegacyRunnerBody` component at the bottom of the file (after `ConfirmationCard`, before `SummaryStep`) — a mechanical copy of the pre-Task-11 tab-bar + grid + `SummaryStep` rendering, adjusted to take everything as props (it has no hooks of its own, `PdfFormRunner` still owns all state). Since `optional-group` steps did not exist before this task, it flattens any such step's sections into one field list so the legacy path stays fully functional:

```tsx
interface LegacyRunnerBodyProps {
  form: PublicForm;
  steps: Step[];
  activeIndex: number;
  setActive: (i: number) => void;
  locale: Locale;
  values: FormPayload;
  errors: Record<string, string>;
  setValue: (id: string, value: FieldValue) => void;
  signerName: string;
  consent: boolean;
  setConsent: (c: boolean) => void;
  delivery: "download" | "doccle";
  setDelivery: (d: "download" | "doccle") => void;
  doccleRef: string;
  setDoccleRef: (v: string) => void;
  submitting: boolean;
  submit: () => void;
  t: ReturnType<typeof useTranslations>;
}

/// Ancien rendu (grille dense 2 colonnes + résumé détaillé), conservé
/// verbatim pour le filet de sécurité PDF_FORM_LEGACY_LAYOUT (cf. Task 12).
/// Ne reçoit AUCUNE des nouvelles données (renderAs/stepPriority sont
/// ignorés ici par construction — un step "optional-group" est aplati en
/// simple liste de champs, comme un step "fields" classique).
function LegacyRunnerBody({
  form,
  steps,
  activeIndex,
  setActive,
  locale,
  values,
  errors,
  setValue,
  signerName,
  consent,
  setConsent,
  delivery,
  setDelivery,
  doccleRef,
  setDoccleRef,
  submitting,
  submit,
  t,
}: LegacyRunnerBodyProps) {
  const flatSteps = steps.map((s) =>
    s.kind === "optional-group"
      ? { kind: "fields" as const, id: s.id, title: s.title, subtitle: s.subtitle, fields: s.sections.flatMap((sec) => sec.fields) }
      : s
  );
  const activeIdx = Math.min(activeIndex, flatSteps.length - 1);
  const current = flatSteps[activeIdx];
  const stepHasError = (s: (typeof flatSteps)[number]) => s.kind === "fields" && s.fields.some((f) => errors[f.id]);

  const stepIcon = (s: (typeof flatSteps)[number], i: number) => {
    if (s.kind === "summary") return <EyeIcon className="size-4" />;
    return i === 0 ? <UserIcon className="size-4" /> : <FileTextIcon className="size-4" />;
  };

  return (
    <div className="flex flex-col gap-3">
      {(form.locales.length > 1 || form.allowItsme) && (
        <div className="flex flex-wrap items-center gap-2">
          {form.locales.length > 1 &&
            form.locales.map((l) => (
              <Button key={l} size="sm" variant={l === locale ? "default" : "outline"} className="h-7 px-2.5" onClick={() => {}}>
                {LOCALE_NAMES[l]}
              </Button>
            ))}
        </div>
      )}
      <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-sm">
        <div className="flex overflow-x-auto border-b">
          {flatSteps.map((s, i) => {
            const activeTab = i === activeIdx;
            const err = stepHasError(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                className={`flex min-w-[150px] flex-1 items-center gap-2.5 border-b-2 px-4 py-3.5 text-left transition-colors ${
                  activeTab
                    ? "border-[color:var(--glass-accent-deep,#7c3aed)] text-[color:var(--glass-accent-deep,#7c3aed)]"
                    : "border-transparent text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                    activeTab ? "bg-[color:var(--glass-pop-bg,#efe6ff)]" : "bg-muted"
                  }`}
                >
                  {stepIcon(s, i)}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {s.title}
                    {err && <span className="size-1.5 rounded-full bg-destructive" aria-label={t("runnerStepErrorsAria")} />}
                  </span>
                  <span className="truncate text-[11px] font-normal text-muted-foreground">{s.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>

        <CardContent className="p-5 sm:p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (current.kind === "summary") submit();
            }}
            className="flex flex-col gap-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold">{current.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {current.kind === "summary" ? t("runnerSummaryStepHelp") : t("runnerFieldsStepHelp")}
                </p>
              </div>
              {current.kind === "fields" && current.fields.length > 0 && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  <InfoIcon className="size-3" />
                  {current.fields.every((f) => f.required) ? t("runnerAllFieldsRequired") : t("runnerStarFieldsRequired")}
                </span>
              )}
            </div>

            {current.kind === "summary" ? (
              <SummaryStep form={form} values={values} locale={locale} signerName={signerName} />
            ) : (
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                {current.fields.map((f) => (
                  <div key={f.id} className={FULL_WIDTH_TYPES.has(f.type) ? "sm:col-span-2" : ""}>
                    <PdfField
                      field={f}
                      value={values[f.id] ?? ""}
                      error={errors[f.id]}
                      locale={locale}
                      onChange={(v) => setValue(f.id, v)}
                      formId={form.id}
                      formSlug={form.slug}
                    />
                  </div>
                ))}
              </div>
            )}

            {current.kind === "summary" ? (
              <div className="flex flex-col gap-4">
                {form.allowDownload && form.allowDoccle && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{t("runnerDeliveryModeLabel")}</span>
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" variant={delivery === "download" ? "default" : "outline"} onClick={() => setDelivery("download")}>
                        <DownloadIcon className="size-4" /> {t("runnerDeliveryDownload")}
                      </Button>
                      <Button type="button" size="sm" variant={delivery === "doccle" ? "default" : "outline"} onClick={() => setDelivery("doccle")}>
                        <SendIcon className="size-4" /> {t("runnerDeliveryDoccle")}
                      </Button>
                    </div>
                  </div>
                )}
                {delivery === "doccle" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="doccle-ref-legacy">{t("runnerDoccleRecipientLabel")}</Label>
                    <Input id="doccle-ref-legacy" value={doccleRef} placeholder={t("runnerDoccleRecipientPlaceholder")} onChange={(e) => setDoccleRef(e.target.value)} />
                  </div>
                )}
                <Separator />
                {form.fields.some(isSignatureField) && (
                  <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("runnerDigitalSignatureLabel")}</div>
                    {signerName ? (
                      <>
                        <div className="mt-1 font-serif text-lg italic">{signerName}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{t("runnerDigitalSignatureAutoNote")}</div>
                      </>
                    ) : (
                      <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("runnerDigitalSignatureNameRequired")}</div>
                    )}
                  </div>
                )}
                <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
                  <span>{t("runnerConsentText")}</span>
                </label>
                <div className="flex items-center gap-2">
                  {activeIdx > 0 && (
                    <Button type="button" variant="outline" onClick={() => setActive(activeIdx - 1)}>
                      <ChevronLeftIcon className="size-4" /> {t("previous")}
                    </Button>
                  )}
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? <Loader2Icon className="size-4 animate-spin" /> : delivery === "doccle" ? <SendIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                    {submitting ? t("runnerGenerating") : delivery === "doccle" ? t("runnerSubmitSignAndSend") : t("runnerSubmitSignAndGenerate")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {activeIdx > 0 ? (
                  <Button type="button" variant="outline" onClick={() => setActive(activeIdx - 1)}>
                    <ChevronLeftIcon className="size-4" /> {t("previous")}
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" onClick={() => setActive(activeIdx + 1)}>
                  {t("continue")} <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

This needs `useTranslations` imported as a type reference only (it's already imported as a value at the top of the file for the main component — reuse that same import, do not add a second one).

- [ ] **Step 9: Run the full test suite**

Run: `pnpm test`
Expected: PASS, same count as after Task 5 (no test touches `PdfFormRunner`'s internals directly — it's a "use client" component with no existing unit test file; confirm via `find . -iname "pdf-form-runner*.test.ts*"` that none exists, so none can regress).

- [ ] **Step 10: Run build**

Run: `pnpm build`
Expected: succeeds. Pay close attention to any TypeScript error about the `field.options` tuple cast (Task 5), the removed `stepIcon` (Step 5 of this task — make sure no other reference to it remains), or unused imports (`EyeIcon`/`UserIcon`/`FileTextIcon` are now ONLY used inside `LegacyRunnerBody` — keep their import at the top of the file, do not remove it) — fix inline if trivial, otherwise report as a concern.

- [ ] **Step 11: Commit**

```bash
git add components/pdf-forms/pdf-form-runner.tsx
git commit -m "feat(pdf-forms): PdfFormRunner — stepper, aide contextuelle, étapes optionnelles, résumé allégé + repli legacy"
```

---

### Task 12: Safety switch — env var wiring

**Files:**
- Modify: `app/document/[slug]/page.tsx`
- Modify: `app/d/[slug]/page.tsx`

**Interfaces:**
- Consumes: `PdfFormRunner`'s new `legacyLayout` prop (Task 11).
- Produces: nothing consumed by later tasks — this is the last wiring point.

- [ ] **Step 1: Read both files' current `<PdfFormRunner ... />` call sites**

In each file, locate the JSX where `<PdfFormRunner` is rendered (search for `PdfFormRunner` in both files — each renders it once).

- [ ] **Step 2: Add the env var read + prop**

In each file, near the top of the server component function body (alongside other `const` reads, before the `return`), add:

```ts
  const legacyLayout = process.env.PDF_FORM_LEGACY_LAYOUT === "1";
```

Then add `legacyLayout={legacyLayout}` to the existing `<PdfFormRunner ... />` JSX call in that file (as an additional prop, alongside whatever props already exist there — do not remove or reorder existing props).

- [ ] **Step 3: Document the env var**

In `.env.example`, add (near other feature-flag-style entries if any exist, otherwise at the end):

```
# Filet de sécurité : "1" bascule tous les formulaires PDF vers l'ancien
# rendu (grille dense) sans redéploiement. Absent/tout autre valeur = nouveau
# rendu compact (défaut).
PDF_FORM_LEGACY_LAYOUT=
```

- [ ] **Step 4: Run build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add "app/document/[slug]/page.tsx" "app/d/[slug]/page.tsx" .env.example
git commit -m "feat(pdf-forms): filet de sécurité PDF_FORM_LEGACY_LAYOUT"
```

---

### Task 13: Habillage spécifique C1 (`renderAs`/`stepPriority`)

**Files:**
- Modify: `lib/pdf-forms/seed/c1-fields-improvements.ts`
- Test: `lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`

**Interfaces:**
- Consumes: `renderAs`/`stepPriority` (Task 1).
- Produces: nothing consumed by later tasks (leaf task, only Task 14 verifies it visually).

- [ ] **Step 1: Read the full current file**

Read `lib/pdf-forms/seed/c1-fields-improvements.ts` in full (not partially — this plan's section classification below is a proposal, cf. spec §7, and must be checked against the REAL, complete list of `SECTION_*` constants and every field's actual section assignment before editing).

- [ ] **Step 2: Write the failing tests**

Add to `lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`:

```ts
describe("C1_QUESTIONS — habillage renderAs / stepPriority", () => {
  it("motifIntroduction et les champs de modification sont renderAs=chip", () => {
    const chipIds = ["motifIntroduction", "modificationAdresse", "modificationCompte", "modificationSituationFamiliale", "modificationPermisSejour", "modificationCotisationSyndicale"];
    for (const id of chipIds) {
      const f = C1_QUESTIONS.find((q) => q.id === id);
      expect(f, `champ ${id} introuvable`).toBeDefined();
      expect(f?.renderAs, `champ ${id} devrait être renderAs=chip`).toBe("chip");
    }
  });

  it("toutes les sections activités/revenus/cotisation/non-UE/divers/annexes sont stepPriority=optional", () => {
    const optionalSectionKeys = ["mes-activites", "mes-revenus", "cotisation-syndicale", "non-eee", "divers", "annexes"];
    for (const key of optionalSectionKeys) {
      const fieldsInSection = C1_QUESTIONS.filter((q) => q.section === key);
      expect(fieldsInSection.length, `aucun champ trouvé pour la section ${key}`).toBeGreaterThan(0);
      for (const f of fieldsInSection) {
        expect(f.stepPriority, `champ ${f.id} (section ${key}) devrait être stepPriority=optional`).toBe("optional");
      }
    }
  });

  it("identite/demande/situation-familiale/mode-paiement/affirmations restent stepPriority core (absent)", () => {
    const coreSectionKeys = ["identite", "demande", "situation-familiale", "mode-paiement", "affirmations"];
    for (const key of coreSectionKeys) {
      const fieldsInSection = C1_QUESTIONS.filter((q) => q.section === key);
      for (const f of fieldsInSection) {
        expect(f.stepPriority, `champ ${f.id} (section ${key}) ne devrait PAS être optional`).not.toBe("optional");
      }
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`
Expected: FAIL — no field currently has `renderAs`/`stepPriority` set.

- [ ] **Step 4: Apply the tagging**

Add `renderAs: "chip"` to the object literals of these 6 fields (found via their `id:` in the file): `motifIntroduction`, `modificationAdresse`, `modificationCompte`, `modificationSituationFamiliale`, `modificationPermisSejour`, `modificationCotisationSyndicale`. Example for one:

```ts
  {
    id: "modificationAdresse",
    pdfFieldName: "mon adresse à partir du",
    type: "checkbox",
    required: false,
    label: { fr: "Modification d'adresse", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 5,
    renderAs: "chip",
  },
```

(Apply the same `renderAs: "chip",` addition to the other 5 fields — same pattern, add as the last property before the closing brace. Do NOT change `pdfFieldName`, `visibleIf`, `section`, or `order` on any of them.)

Add `stepPriority: "optional",` (same pattern — last property before the closing brace) to EVERY field literal whose `section:` is one of: `SECTION_ACTIVITES`, `SECTION_REVENUS`, `SECTION_COTISATION`, `SECTION_NON_EEE`, `SECTION_DIVERS`, `SECTION_ANNEXES`. Do not add it to fields in `SECTION_IDENTITE`, `SECTION_DEMANDE`, `SECTION_SITUATION_FAMILIALE`, `SECTION_PAIEMENT`, `SECTION_AFFIRMATIONS`, `SECTION_SIGNATURE`, or any field with no `section` at all.

If the actual file contains sections not anticipated in the spec/this brief (the spec explicitly flagged this list as a proposal to verify), classify by the same principle — "does everyone filling a C1 need to see this, or only someone with a specific declaration?" — and note your classification decisions in the report for controller review.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts`
Expected: PASS (all tests in the file, old and new).

- [ ] **Step 6: Run the full suite**

Run: `pnpm test`
Expected: PASS — this changes data only (new optional properties on existing fields), no other test should be sensitive to `renderAs`/`stepPriority` being present.

- [ ] **Step 7: Commit**

```bash
git add lib/pdf-forms/seed/c1-fields-improvements.ts lib/pdf-forms/seed/__tests__/c1-fields-improvements.test.ts
git commit -m "feat(pdf-forms): habillage C1 — motif/modification en chips, sections secondaires repliables"
```

---

### Task 14: Validation complète (build, tests, seed, vérification manuelle)

**Files:** aucun (validation uniquement).

- [ ] **Step 1: Suite complète**

```bash
pnpm test
pnpm build
pnpm i18n:check
```

Expected: toutes vertes (nouveaux tests inclus).

- [ ] **Step 2: Re-appliquer les améliorations C1 en base (les tags renderAs/stepPriority doivent atteindre les PdfForm déjà seedés)**

Les champs `renderAs`/`stepPriority` ajoutés en Task 13 vivent dans `c1-fields-improvements.ts`, qui n'est appliqué en base QUE via `applyOneC1Improvement`/`applyAllC1Improvements` (cf. `lib/pdf-forms/seed/apply-c1-improvements-core.ts`, déjà existant — aucune modification necessary dans ce plan). Avant de vérifier visuellement, réappliquer via l'admin (`POST /api/admin/pdf-forms/apply-c1-improvements`) ou le script CLI (`pnpm tsx scripts/apply-c1-improvements.ts --yes`) sur l'environnement de vérification — sinon le C1 affiché en preview n'aura pas les nouveaux tags tant que ce n'est pas rejoué. Suivre la même prudence que pour toute écriture en base partagée (vérifier `DATABASE_URL` avant, cf. session précédente).

- [ ] **Step 3: Vérification manuelle (preview) — 3 formulaires représentatifs**

- **C1 (changement-situation-personnelle)** : le cas dense. Vérifier : stepper affiche moins d'étapes que le nombre total de sections (les optionnelles sont repliées) ; l'étape "demande" affiche des `OptionCard` pour le motif + les cases de modification, pas des checkboxes/select classiques ; un radio à 2 options ailleurs dans le formulaire (ex. activité accessoire) s'affiche en `YesNoSegmentedControl` ; le panneau d'aide change selon l'étape active ; l'étape finale montre la carte de confirmation compacte, pas de liste détaillée des valeurs ; l'auto-save affiche un horodatage après une modification.
- **Un formulaire court** (C1B ou C46) : vérifier que le nouveau rendu s'applique proprement même avec peu de sections (pas de bloc "optionnel" vide affiché s'il n'y a aucune section optional).
- **allocations-insertion** (dossier multi-documents) : vérifier que la page "Documents du parcours" (liste extérieure) est visuellement inchangée — seul le contenu APRÈS un clic "Compléter" a changé.
- **Bascule legacy** : positionner `PDF_FORM_LEGACY_LAYOUT=1` dans l'environnement de preview, recharger un des 3 formulaires ci-dessus, confirmer que l'ancien rendu (grille dense, onglets plats, résumé détaillé) s'affiche à l'identique d'avant ce plan. Remettre la variable à vide/absente ensuite.

- [ ] **Step 4: Commit final (si des ajustements ont été faits pendant la vérification)**

```bash
git add <fichiers ajustés explicitement>
git commit -m "fix(pdf-forms): ajustements post-vérification refonte form-runner"
```

(Sauter ce commit si aucun ajustement n'a été nécessaire.)

## Hors périmètre (rappel du spec)

- Pas de réécriture de `PdfField` au-delà de l'habillage tooltip/segmented (types de champs bas niveau inchangés).
- Pas de nouveau mécanisme "enregistrer et quitter" (réutilise le code de reprise existant, référencé en texte seulement).
- Pas de traduction NL/DE du nouveau contenu d'aide contextuelle dans ce lot.
- Pas de changement à la page "Documents du parcours" (`BundleRunner`, liste extérieure).
- Le classement exact "core" vs "optional" de chaque section C1 est vérifié précisément en Task 13 (lecture du fichier complet), pas garanti à l'avance dans ce plan.
