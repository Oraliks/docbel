# Vocabulaire de clés canoniques Orientation ↔ Pré-qualification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relier orientation (Decision Builder) et pré-qualification (DocumentBundle) par un vocabulaire de clés canoniques, pour pré-remplir (modifiable) les questions de pré-qual déjà répondues dans l'orientation.

**Architecture:** Un registre de clés canoniques en code. Des tags JSON optionnels sur les options d'arbre (`canonical`) et les questions de pré-qual (`canonicalKey`/`canonicalValue`/`canonicalTrue`/`canonicalFalse`). Un cœur pur qui dérive des « faits » des options choisies et pré-remplit les réponses de pré-qual. Résolution côté serveur dans `app/d/[slug]/page.tsx` : les réponses d'orientation (cookie = IDs d'OptionNode) sont résolues contre l'arbre publié → faits → pré-remplissage + badge.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript strict, Zod 4, Prisma 5, next-intl 4, vitest 4, Tailwind 4 + base-ui.

## Global Constraints

- **Zéro migration DB.** Les tags vivent dans le JSON existant (`DecisionTree.*Content`, `DocumentBundle.eligibilityQuestions`). Ne PAS lancer `prisma db push`/`migrate`.
- **Repli sûr obligatoire.** Tag absent / clé inconnue / arbre indisponible → comportement inchangé (pré-qual normale). Jamais de crash, jamais de blocage (« informatif jamais bloquant »).
- **Registre en code, typé.** Ajouter une *clé* = éditer `lib/parcours/canonical-keys.ts`. Le starter (`age_bracket`, `situation_familiale`, `a_deja_travaille`) est **à valider par Oraliks** — ne pas le figer comme vérité métier.
- **Validation :** `pnpm exec tsc --noEmit` (0 nouvelle erreur ; 1 erreur pré-existante tolérée dans `lib/pdf-forms/__tests__/street-suggestions.test.ts`) + `pnpm test` (vert) + `pnpm exec vitest run <fichier>` pour les tests ciblés.
- **Commits :** chemins EXPLICITES uniquement (`git add <chemins>`), jamais `-A`. Branche `feat/parcours-canonical-keys`.

## File Structure

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `lib/parcours/canonical-keys.ts` (create) | Registre du vocabulaire + helpers purs | 1 |
| `lib/parcours/__tests__/canonical-keys.test.ts` (create) | Tests registre | 1 |
| `lib/bundles/eligibility.ts` (modify) | +champs canoniques sur types + parser | 2 |
| `lib/decision-builder/schema.ts` (modify) | +`canonical` sur `OptionNodeSchema` | 3 |
| `lib/parcours/canonical-facts.ts` (create) | `collectCanonicalFacts` + `prefillEligibilityAnswers` (purs) | 4 |
| `lib/parcours/__tests__/canonical-facts.test.ts` (create) | Tests dérivation/prefill | 4 |
| `components/decision-builder/node-inspector.tsx` (modify) | UI tag option (clé+valeur) | 5 |
| `components/admin/documents/eligibility-questions-editor.tsx` (modify) | UI tag question/option | 6 |
| `lib/decision-builder/loader.ts` (modify) | `loadPublishedTreeContent(segment)` (contenu brut) | 7 |
| `app/d/[slug]/page.tsx` (modify) | Résolution faits + prefill + set d'IDs orientation | 8 |
| `components/docbel/bundle-runner.tsx` (modify) | Thread `orientationAnswerIds` | 9 |
| `components/docbel/onboarding/eligibility-prequalifier.tsx` (modify) | Badge « d'après vos réponses » | 9 |

Ordre = dépendances. Types (2,3) avant le cœur qui les consomme (4). Runtime (7,8,9) en dernier.

---

## Task 1: Registre de clés canoniques (pur)

**Files:**
- Create: `lib/parcours/canonical-keys.ts`
- Test: `lib/parcours/__tests__/canonical-keys.test.ts`

**Interfaces:**
- Produces: `CanonicalKeyDef`, `CANONICAL_KEYS: CanonicalKeyDef[]`, `getCanonicalKey(key: string): CanonicalKeyDef | undefined`, `canonicalValues(key: string): { value: string; label: string }[]`, `isValidCanonicalPair(key: string, value: string): boolean`.

- [ ] **Step 1: Write the failing test**

Create `lib/parcours/__tests__/canonical-keys.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CANONICAL_KEYS,
  getCanonicalKey,
  canonicalValues,
  isValidCanonicalPair,
} from "@/lib/parcours/canonical-keys";

describe("canonical-keys registry", () => {
  it("has unique keys", () => {
    const keys = CANONICAL_KEYS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has unique values within each key", () => {
    for (const def of CANONICAL_KEYS) {
      const vals = def.values.map((v) => v.value);
      expect(new Set(vals).size, `clé ${def.key}`).toBe(vals.length);
    }
  });

  it("seeds the starter keys", () => {
    expect(getCanonicalKey("age_bracket")).toBeDefined();
    expect(getCanonicalKey("situation_familiale")).toBeDefined();
    expect(getCanonicalKey("a_deja_travaille")).toBeDefined();
    expect(getCanonicalKey("inconnue")).toBeUndefined();
  });

  it("canonicalValues returns the key's values or [] for unknown", () => {
    expect(canonicalValues("age_bracket").map((v) => v.value)).toEqual([
      "under_25",
      "25_plus",
    ]);
    expect(canonicalValues("inconnue")).toEqual([]);
  });

  it("isValidCanonicalPair validates key+value", () => {
    expect(isValidCanonicalPair("age_bracket", "under_25")).toBe(true);
    expect(isValidCanonicalPair("age_bracket", "bogus")).toBe(false);
    expect(isValidCanonicalPair("inconnue", "x")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/parcours/__tests__/canonical-keys.test.ts`
Expected: FAIL — cannot resolve `@/lib/parcours/canonical-keys`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/parcours/canonical-keys.ts`:

```ts
/**
 * Registre du vocabulaire de clés canoniques partagé entre orientation
 * (options d'arbre) et pré-qualification (questions d'éligibilité).
 *
 * ⚠️ STARTER À VALIDER par Oraliks (expertise chômage). Les seuils (ex. 21/25
 * ans selon les règles ONEM d'insertion) et les valeurs sont un point de
 * départ, pas une vérité figée. Ajouter une clé = éditer ce fichier.
 */

export interface CanonicalKeyDef {
  key: string;
  label: string;
  values: { value: string; label: string }[];
}

export const CANONICAL_KEYS: CanonicalKeyDef[] = [
  {
    key: "age_bracket",
    label: "Tranche d'âge",
    values: [
      { value: "under_25", label: "Moins de 25 ans" },
      { value: "25_plus", label: "25 ans ou plus" },
    ],
  },
  {
    key: "situation_familiale",
    label: "Situation familiale",
    values: [
      { value: "isole", label: "Isolé" },
      { value: "cohabitant", label: "Cohabitant" },
      { value: "chef_menage", label: "Chef de ménage" },
    ],
  },
  {
    key: "a_deja_travaille",
    label: "A déjà travaillé",
    values: [
      { value: "oui", label: "Oui" },
      { value: "non", label: "Non" },
    ],
  },
];

const BY_KEY = new Map(CANONICAL_KEYS.map((d) => [d.key, d]));

export function getCanonicalKey(key: string): CanonicalKeyDef | undefined {
  return BY_KEY.get(key);
}

export function canonicalValues(key: string): { value: string; label: string }[] {
  return BY_KEY.get(key)?.values ?? [];
}

export function isValidCanonicalPair(key: string, value: string): boolean {
  const def = BY_KEY.get(key);
  return !!def && def.values.some((v) => v.value === value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/parcours/__tests__/canonical-keys.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/parcours/canonical-keys.ts lib/parcours/__tests__/canonical-keys.test.ts
git commit -m "feat(parcours): registre de clés canoniques (starter à valider)"
```

---

## Task 2: Champs canoniques sur les types d'éligibilité + parser

**Files:**
- Modify: `lib/bundles/eligibility.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `EligibilityQuestionBase.canonicalKey?: string`; `EligibilityBooleanQuestion.canonicalTrue?: string`, `canonicalFalse?: string`; `EligibilityOption.canonicalValue?: string`. `parseEligibilityQuestions` lit ces champs (tolérant).

- [ ] **Step 1: Write the failing test**

Add to a NEW test file `lib/bundles/__tests__/eligibility-canonical.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEligibilityQuestions } from "@/lib/bundles/eligibility";

describe("parseEligibilityQuestions — champs canoniques", () => {
  it("lit canonicalKey + canonicalValue sur un select", () => {
    const [q] = parseEligibilityQuestions([
      {
        id: "age",
        label: "Votre âge ?",
        type: "select",
        canonicalKey: "age_bracket",
        options: [
          { value: "j", label: "Jeune", verdict: "neutral", canonicalValue: "under_25" },
          { value: "v", label: "Autre", verdict: "neutral" },
        ],
      },
    ]);
    expect(q.canonicalKey).toBe("age_bracket");
    expect(q.type === "select" && q.options[0].canonicalValue).toBe("under_25");
    expect(q.type === "select" && q.options[1].canonicalValue).toBeUndefined();
  });

  it("lit canonicalTrue/canonicalFalse sur un boolean", () => {
    const [q] = parseEligibilityQuestions([
      {
        id: "trav",
        label: "Avez-vous déjà travaillé ?",
        type: "boolean",
        verdictTrue: "eligible",
        verdictFalse: "neutral",
        canonicalKey: "a_deja_travaille",
        canonicalTrue: "oui",
        canonicalFalse: "non",
      },
    ]);
    expect(q.canonicalKey).toBe("a_deja_travaille");
    expect(q.type === "boolean" && q.canonicalTrue).toBe("oui");
    expect(q.type === "boolean" && q.canonicalFalse).toBe("non");
  });

  it("tolère l'absence de champs canoniques (rétro-compat)", () => {
    const [q] = parseEligibilityQuestions([
      { id: "x", label: "X", type: "boolean", verdictTrue: "neutral", verdictFalse: "neutral" },
    ]);
    expect(q.canonicalKey).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/bundles/__tests__/eligibility-canonical.test.ts`
Expected: FAIL — TS/runtime : `canonicalKey` n'existe pas sur le type (et le parser ne le renvoie pas).

- [ ] **Step 3: Write minimal implementation**

In `lib/bundles/eligibility.ts`:

(a) Add to `EligibilityOption` (after the `verdict` field, ~line 23):

```ts
export interface EligibilityOption {
  value: string;
  label: string;
  verdict: EligibilityVerdict;
  /// Valeur canonique que cette option affirme (cf. lib/parcours/canonical-keys).
  canonicalValue?: string;
}
```

(b) Add to `EligibilityQuestionBase` (after `visibleIf`, ~line 75):

```ts
  /// Clé canonique à laquelle cette question répond (pré-remplissage depuis
  /// l'orientation). Cf. lib/parcours/canonical-keys.
  canonicalKey?: string;
```

(c) Add to `EligibilityBooleanQuestion` (after `verdictFalse`, ~line 83):

```ts
  /// Valeur canonique correspondant à « oui » / « non ».
  canonicalTrue?: string;
  canonicalFalse?: string;
```

(d) In `parseEligibilityQuestions`, in the `type === "boolean"` branch (~line 254), add the three fields to the pushed object:

```ts
        canonicalKey: typeof r.canonicalKey === "string" ? r.canonicalKey : undefined,
        canonicalTrue: typeof r.canonicalTrue === "string" ? r.canonicalTrue : undefined,
        canonicalFalse: typeof r.canonicalFalse === "string" ? r.canonicalFalse : undefined,
```

(e) In the `type === "select"` branch, add `canonicalValue` to the option push (inside the `for (const o of r.options)` loop, ~line 270):

```ts
        opts.push({
          value: oo.value,
          label: oo.label,
          verdict: parseVerdict(oo.verdict) ?? "neutral",
          canonicalValue: typeof oo.canonicalValue === "string" ? oo.canonicalValue : undefined,
        });
```

And add `canonicalKey` to the pushed select question object (~line 277):

```ts
        out.push({
          id: r.id,
          label: r.label,
          helpText: typeof r.helpText === "string" ? r.helpText : undefined,
          helpUrl: typeof r.helpUrl === "string" ? r.helpUrl : undefined,
          visibleIf,
          canonicalKey: typeof r.canonicalKey === "string" ? r.canonicalKey : undefined,
          type: "select",
          options: opts,
        });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/bundles/__tests__/eligibility-canonical.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/bundles/eligibility.ts lib/bundles/__tests__/eligibility-canonical.test.ts
git commit -m "feat(bundles): champs canoniques sur les questions d'éligibilité + parser"
```

---

## Task 3: Champ `canonical` sur l'option d'arbre

**Files:**
- Modify: `lib/decision-builder/schema.ts`

**Interfaces:**
- Produces: `OptionNodeSchema` accepte `canonical?: { key: string; value: string }` ; le type `OptionNode` (dérivé via `z.infer` dans `types.ts`) gagne ce champ automatiquement.

- [ ] **Step 1: Write the failing test**

Add `lib/decision-builder/__tests__/canonical-option.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { OptionNodeSchema } from "@/lib/decision-builder/schema";

describe("OptionNodeSchema — canonical", () => {
  it("accepte une option avec tag canonical", () => {
    const parsed = OptionNodeSchema.parse({
      type: "option",
      id: "o1",
      label: "Moins de 25 ans",
      nextId: "q2",
      canonical: { key: "age_bracket", value: "under_25" },
    });
    expect(parsed.canonical).toEqual({ key: "age_bracket", value: "under_25" });
  });

  it("accepte une option SANS canonical (rétro-compat)", () => {
    const parsed = OptionNodeSchema.parse({
      type: "option",
      id: "o2",
      label: "Autre",
      nextId: "q3",
    });
    expect(parsed.canonical).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/decision-builder/__tests__/canonical-option.test.ts`
Expected: FAIL — `parsed.canonical` est `undefined` sur le 1er cas (Zod strip le champ inconnu).

- [ ] **Step 3: Write minimal implementation**

In `lib/decision-builder/schema.ts`, add to `OptionNodeSchema` (after `conditions`, before `nextId`, ~line 144):

```ts
  /// Tag canonique : choisir cette option affirme `key = value` (cf.
  /// lib/parcours/canonical-keys). Sert au pré-remplissage de la pré-qual.
  canonical: z
    .object({ key: z.string().min(1), value: z.string().min(1) })
    .optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/decision-builder/__tests__/canonical-option.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/decision-builder/schema.ts lib/decision-builder/__tests__/canonical-option.test.ts
git commit -m "feat(decision-builder): tag canonical optionnel sur OptionNode"
```

---

## Task 4: Cœur pur — collectCanonicalFacts + prefillEligibilityAnswers

**Files:**
- Create: `lib/parcours/canonical-facts.ts`
- Test: `lib/parcours/__tests__/canonical-facts.test.ts`

**Interfaces:**
- Consumes: `isValidCanonicalPair` (Task 1) ; `EligibilityQuestion`, `EligibilityAnswers` avec les champs canoniques (Task 2).
- Produces: `type CanonicalFacts = Record<string, string>`; `collectCanonicalFacts(taggedOptions): CanonicalFacts`; `prefillEligibilityAnswers(questions, facts): EligibilityAnswers`.

- [ ] **Step 1: Write the failing test**

Create `lib/parcours/__tests__/canonical-facts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  collectCanonicalFacts,
  prefillEligibilityAnswers,
} from "@/lib/parcours/canonical-facts";
import type { EligibilityQuestion } from "@/lib/bundles/eligibility";

describe("collectCanonicalFacts", () => {
  it("rassemble les tags valides des options choisies", () => {
    const facts = collectCanonicalFacts([
      { canonical: { key: "age_bracket", value: "under_25" } },
      { canonical: { key: "a_deja_travaille", value: "non" } },
      undefined,
      {},
    ]);
    expect(facts).toEqual({ age_bracket: "under_25", a_deja_travaille: "non" });
  });

  it("ignore un tag invalide (clé/valeur hors registre)", () => {
    const facts = collectCanonicalFacts([
      { canonical: { key: "age_bracket", value: "bogus" } },
      { canonical: { key: "inconnue", value: "x" } },
    ]);
    expect(facts).toEqual({});
  });

  it("dernier gagnant sur clé en conflit", () => {
    const facts = collectCanonicalFacts([
      { canonical: { key: "age_bracket", value: "under_25" } },
      { canonical: { key: "age_bracket", value: "25_plus" } },
    ]);
    expect(facts).toEqual({ age_bracket: "25_plus" });
  });
});

describe("prefillEligibilityAnswers", () => {
  const selectQ: EligibilityQuestion = {
    id: "age", label: "Âge", type: "select", canonicalKey: "age_bracket",
    options: [
      { value: "j", label: "Jeune", verdict: "neutral", canonicalValue: "under_25" },
      { value: "a", label: "Autre", verdict: "neutral", canonicalValue: "25_plus" },
    ],
  };
  const boolQ: EligibilityQuestion = {
    id: "trav", label: "Travaillé ?", type: "boolean",
    verdictTrue: "eligible", verdictFalse: "neutral",
    canonicalKey: "a_deja_travaille", canonicalTrue: "oui", canonicalFalse: "non",
  };

  it("pré-remplit un select via canonicalValue", () => {
    expect(prefillEligibilityAnswers([selectQ], { age_bracket: "under_25" })).toEqual({ age: "j" });
  });

  it("pré-remplit un boolean via canonicalTrue/False", () => {
    expect(prefillEligibilityAnswers([boolQ], { a_deja_travaille: "non" })).toEqual({ trav: "false" });
  });

  it("ignore une question sans canonicalKey", () => {
    const q: EligibilityQuestion = { id: "z", label: "Z", type: "boolean", verdictTrue: "neutral", verdictFalse: "neutral" };
    expect(prefillEligibilityAnswers([q], { age_bracket: "under_25" })).toEqual({});
  });

  it("ignore une clé absente des faits", () => {
    expect(prefillEligibilityAnswers([selectQ], { autre: "x" })).toEqual({});
  });

  it("ignore un fait sans option correspondante", () => {
    expect(prefillEligibilityAnswers([selectQ], { age_bracket: "valeur_sans_option" })).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/parcours/__tests__/canonical-facts.test.ts`
Expected: FAIL — cannot resolve `@/lib/parcours/canonical-facts`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/parcours/canonical-facts.ts`:

```ts
import { isValidCanonicalPair } from "./canonical-keys";
import type {
  EligibilityQuestion,
  EligibilityAnswers,
} from "@/lib/bundles/eligibility";

/** Faits canoniques dérivés de l'orientation : clé canonique → valeur. */
export type CanonicalFacts = Record<string, string>;

/**
 * Rassemble les faits depuis les options choisies (tags validés contre le
 * registre). Dernier gagnant en cas de conflit sur une même clé.
 */
export function collectCanonicalFacts(
  taggedOptions: (
    | { canonical?: { key: string; value: string } }
    | null
    | undefined
  )[],
): CanonicalFacts {
  const facts: CanonicalFacts = {};
  for (const opt of taggedOptions) {
    const c = opt?.canonical;
    if (!c) continue;
    if (!isValidCanonicalPair(c.key, c.value)) continue;
    facts[c.key] = c.value;
  }
  return facts;
}

/**
 * Réponses de pré-qualification pré-remplies depuis les faits. Ne renvoie QUE
 * les questions mappées dont la clé est présente dans `facts` ET dont une
 * option/valeur correspond. N'écrase RIEN : le caller fusionne (prefill en
 * base, saisie manuelle par-dessus).
 */
export function prefillEligibilityAnswers(
  questions: EligibilityQuestion[],
  facts: CanonicalFacts,
): EligibilityAnswers {
  const out: EligibilityAnswers = {};
  for (const q of questions) {
    const key = q.canonicalKey;
    if (!key) continue;
    const fact = facts[key];
    if (fact === undefined) continue;
    if (q.type === "boolean") {
      if (q.canonicalTrue === fact) out[q.id] = "true";
      else if (q.canonicalFalse === fact) out[q.id] = "false";
    } else {
      const opt = q.options.find((o) => o.canonicalValue === fact);
      if (opt) out[q.id] = opt.value;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/parcours/__tests__/canonical-facts.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/parcours/canonical-facts.ts lib/parcours/__tests__/canonical-facts.test.ts
git commit -m "feat(parcours): dérivation faits canoniques + prefill pré-qual (purs, testés)"
```

---

## Task 5: UI admin — tag canonique sur l'option d'arbre

**Files:**
- Modify: `components/decision-builder/node-inspector.tsx`

**Interfaces:**
- Consumes: `getCanonicalKey`, `CANONICAL_KEYS`, `canonicalValues` (Task 1) ; `OptionNode.canonical` (Task 3) ; helper `update(patch: Partial<OptionNode>)` déjà présent (lignes 238-240) ; composant local `Field` (lignes 486-495) ; `Select*` déjà importés (lignes 14-20).

**Note :** cette tâche est de l'UI React sans infra de test composant dans le repo. Vérification = `pnpm exec tsc --noEmit` (0 nouvelle erreur) + revue visuelle manuelle (voir Step 3).

- [ ] **Step 1: Add the imports**

At the top of `components/decision-builder/node-inspector.tsx`, add after the mutations import block (~line 37):

```ts
import {
  CANONICAL_KEYS,
  canonicalValues,
} from "@/lib/parcours/canonical-keys";
```

- [ ] **Step 2: Insert the canonical field pair in `OptionFields`**

In `components/decision-builder/node-inspector.tsx`, insert BETWEEN the Icône `</Field>` (line 268) and the `<Separator />` (line 270):

```tsx
      <Field label="Clé canonique (optionnel) — pré-remplit la pré-qualification">
        <div className="flex gap-2">
          <Select
            value={node.canonical?.key ?? ""}
            onValueChange={(k) =>
              update({
                canonical: k
                  ? { key: k, value: canonicalValues(k)[0]?.value ?? "" }
                  : undefined,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Aucune" />
            </SelectTrigger>
            <SelectContent>
              {CANONICAL_KEYS.map((d) => (
                <SelectItem key={d.key} value={d.key}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {node.canonical?.key && (
            <Select
              value={node.canonical.value}
              onValueChange={(v) =>
                update({ canonical: { key: node.canonical!.key, value: v } })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canonicalValues(node.canonical.key).map((val) => (
                  <SelectItem key={val.value} value={val.value}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Field>
```

Note : le sélecteur de clé n'a PAS de sentinelle « aucune » comme `SelectItem` (base-ui affiche alors la valeur brute pour `value=""`). Le `placeholder="Aucune"` sur `SelectValue` couvre l'état vide. Pour permettre de RETIRER un tag, on garde la valeur `""` gérée par le placeholder ; si une régression d'affichage « _none » apparaît (cf. gotcha base-ui connu), ajouter un `<SelectItem value="__none">Aucune</SelectItem>` et mapper `"__none"` → `undefined` dans `onValueChange`.

- [ ] **Step 3: Verify types + visual**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -i node-inspector` → aucune sortie (0 erreur sur ce fichier).
Manuel (facultatif, dev server admin) : ouvrir un arbre dans `/admin/decision-trees/<id>`, sélectionner une option, vérifier que le couple clé/valeur s'affiche et se sauvegarde (le contenu d'arbre est auto-sauvé côté éditeur).

- [ ] **Step 4: Commit**

```bash
git add components/decision-builder/node-inspector.tsx
git commit -m "feat(admin): tag canonique (clé+valeur) sur l'option dans l'inspecteur d'arbre"
```

---

## Task 6: UI admin — tag canonique sur la question de pré-qual

**Files:**
- Modify: `components/admin/documents/eligibility-questions-editor.tsx`

**Interfaces:**
- Consumes: `CANONICAL_KEYS`, `canonicalValues` (Task 1) ; champs canoniques (Task 2) ; helpers `updateQ`, `updateOption` (lignes 51-55, 99-105) ; factories `newQuestion`/`newOption` (lignes 33-45) ; `changeType` (lignes 69-97).

**Note :** UI sans test composant → vérif via `tsc` + revue manuelle.

- [ ] **Step 1: Add the import**

Add after the eligibility types import (~line 20):

```ts
import { CANONICAL_KEYS, canonicalValues } from "@/lib/parcours/canonical-keys";
```

- [ ] **Step 2: `canonicalKey` select on the question**

Insert BETWEEN the helpText/helpUrl grid close (line 221) and the boolean/select ternary (line 223):

```tsx
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Clé canonique (optionnel) — pré-remplie depuis l&apos;orientation
                </Label>
                <Select
                  value={q.canonicalKey ?? ""}
                  onValueChange={(k) =>
                    updateQ(idx, { canonicalKey: k || undefined })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANONICAL_KEYS.map((d) => (
                      <SelectItem key={d.key} value={d.key} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
```

- [ ] **Step 3: `canonicalValue` per select option**

In the per-option row (lines 286-325), extend the grid template and add a value select. Change line 287 from:

```tsx
                    <div key={oIdx} className="grid grid-cols-[1fr_1fr_140px_auto] gap-1.5">
```

to:

```tsx
                    <div key={oIdx} className="grid grid-cols-[1fr_1fr_140px_150px_auto] gap-1.5">
```

Then insert, AFTER the verdict `</Select>` (line 314) and BEFORE the delete `<Button>` (line 315):

```tsx
                      <Select
                        value={opt.canonicalValue ?? ""}
                        onValueChange={(v) =>
                          updateOption(idx, oIdx, { canonicalValue: v || undefined })
                        }
                        disabled={!q.canonicalKey}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Valeur canon." />
                        </SelectTrigger>
                        <SelectContent>
                          {canonicalValues(q.canonicalKey ?? "").map((val) => (
                            <SelectItem key={val.value} value={val.value} className="text-xs">
                              {val.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
```

- [ ] **Step 4: `canonicalTrue`/`canonicalFalse` for boolean**

In the boolean branch grid (lines 224-265), add two cells. Change line 224 from `md:grid-cols-2` to `md:grid-cols-2` unchanged (keep 2 columns, add a second row). After the `verdictFalse` cell close (line 264, the `</div>` closing the second `space-y-1`), insert two more cells INSIDE the same grid:

```tsx
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Valeur canon. si « oui »
                    </Label>
                    <Select
                      value={q.canonicalTrue ?? ""}
                      onValueChange={(v) => updateQ(idx, { canonicalTrue: v || undefined })}
                      disabled={!q.canonicalKey}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {canonicalValues(q.canonicalKey ?? "").map((val) => (
                          <SelectItem key={val.value} value={val.value} className="text-xs">
                            {val.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Valeur canon. si « non »
                    </Label>
                    <Select
                      value={q.canonicalFalse ?? ""}
                      onValueChange={(v) => updateQ(idx, { canonicalFalse: v || undefined })}
                      disabled={!q.canonicalKey}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {canonicalValues(q.canonicalKey ?? "").map((val) => (
                          <SelectItem key={val.value} value={val.value} className="text-xs">
                            {val.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
```

- [ ] **Step 5: Preserve canonical fields through `changeType` + factories**

In `changeType` (lines 69-97), both rebuild branches must carry `canonicalKey`. Add `canonicalKey: q.canonicalKey` to the object built in EACH branch (the boolean rebuild ~line 79-80 and the select rebuild ~line 89). Example for the boolean branch object:

```ts
      next[idx] = {
        id: q.id,
        label: q.label,
        helpText: q.helpText,
        helpUrl: q.helpUrl,
        canonicalKey: q.canonicalKey,
        type: "boolean",
        verdictTrue: "neutral",
        verdictFalse: "neutral",
      };
```

(and the analogous `canonicalKey: q.canonicalKey` in the `select` rebuild object). `canonicalTrue/False` and per-option `canonicalValue` are type-specific and reset on toggle — that is acceptable (they don't apply to the other type). No change needed to `newQuestion`/`newOption` factories (the optional fields default to `undefined`).

- [ ] **Step 6: Verify types + visual**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -i eligibility-questions-editor` → aucune sortie.
Manuel : ouvrir `/admin/pdf/dossiers/<id>`, section « Pré-qualification » : ajouter une question, choisir une clé canonique, vérifier que les sélecteurs de valeur apparaissent et se sauvent (PUT bundle).

- [ ] **Step 7: Commit**

```bash
git add components/admin/documents/eligibility-questions-editor.tsx
git commit -m "feat(admin): tag canonique (clé question + valeurs option/booléen) dans l'éditeur de pré-qual"
```

---

## Task 7: Loader du contenu d'arbre publié (brut)

**Files:**
- Modify: `lib/decision-builder/loader.ts`

**Interfaces:**
- Produces: `loadPublishedTreeContent(segment: string): Promise<DecisionTreeContent | null>` — renvoie le contenu parsé (nœuds bruts), ou `null` si absent/flag off/invalide.

- [ ] **Step 1: Write the failing test**

Add `lib/decision-builder/__tests__/loader-content.test.ts` (test d'export/signature — pas de DB) :

```ts
import { describe, it, expect } from "vitest";
import { loadPublishedTreeContent } from "@/lib/decision-builder/loader";

describe("loadPublishedTreeContent", () => {
  it("est exportée et renvoie une promesse", () => {
    expect(typeof loadPublishedTreeContent).toBe("function");
    // Flag runtime OFF par défaut en test → null, sans toucher la DB.
    return expect(loadPublishedTreeContent("chomage")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/decision-builder/__tests__/loader-content.test.ts`
Expected: FAIL — `loadPublishedTreeContent` non exportée.

- [ ] **Step 3: Write minimal implementation**

In `lib/decision-builder/loader.ts`, replicate the gated DB-load pattern (lignes 26-42) but return the raw content. Add (imports already present : `prisma`, `withDbRetry`, `safeParseTreeContent`, `DecisionTreeContent` type). If `DecisionTreeContent` n'est pas déjà importé, ajouter `import type { DecisionTreeContent } from "@/lib/decision-builder/types";`.

```ts
/**
 * Contenu BRUT (nœuds) de l'arbre publié d'un segment — pour marcher les tags
 * `canonical` des options côté serveur. Même garde flag que
 * `loadPublishedDecisionTree` : quand le flag runtime est OFF, l'orientation
 * n'est pas pilotée par l'arbre DB → on renvoie `null` (repli sûr, aucun fait).
 */
export async function loadPublishedTreeContent(
  segment: string,
): Promise<DecisionTreeContent | null> {
  if (process.env.DECISION_TREE_RUNTIME_ENABLED !== "true") return null;
  try {
    const tree = await withDbRetry(() =>
      prisma.decisionTree.findFirst({
        where: { segment, status: "published" },
        orderBy: { publishedAt: "desc" },
        select: { publishedContent: true },
      }),
    );
    if (!tree?.publishedContent) return null;
    return safeParseTreeContent(tree.publishedContent);
  } catch {
    return null;
  }
}
```

> **Note d'implémentation :** vérifier la constante/condition exacte du flag utilisée par `loadPublishedDecisionTree` en haut du fichier (lignes 18-21) et RÉUTILISER la même expression (ex. un helper `isTreeRuntimeEnabled()` s'il existe) plutôt que de dupliquer `process.env...`. Si un tel helper existe, remplacer la ligne `if (process.env...)` par lui.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/decision-builder/__tests__/loader-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/decision-builder/loader.ts lib/decision-builder/__tests__/loader-content.test.ts
git commit -m "feat(decision-builder): loadPublishedTreeContent (contenu brut d'arbre publié)"
```

---

## Task 8: Résolution serveur des faits + pré-remplissage (page dossier)

**Files:**
- Modify: `app/d/[slug]/page.tsx`

**Interfaces:**
- Consumes: `loadPublishedTreeContent` (Task 7) ; `collectCanonicalFacts`, `prefillEligibilityAnswers` (Task 4) ; `parseEligibilityQuestions` (déjà importé côté runner ; ici importer depuis `@/lib/bundles/eligibility`) ; `parseOrientationAnswers` (déjà importé, ligne 16).
- Produces: ajoute `orientationAnswerIds: string[]` à l'objet `runnerProps` (les IDs de questions pré-remplies depuis l'orientation, pour le badge).

**Note :** RSC + I/O → pas de test unitaire ; vérif = `tsc` + build + repli sûr (flag off → aucun fait, comportement inchangé).

- [ ] **Step 1: Add imports**

In `app/d/[slug]/page.tsx`, add near the other lib imports (after line 17) :

```ts
import { parseEligibilityQuestions } from "@/lib/bundles/eligibility";
import { loadPublishedTreeContent } from "@/lib/decision-builder/loader";
import {
  collectCanonicalFacts,
  prefillEligibilityAnswers,
} from "@/lib/parcours/canonical-facts";
```

(Note : `parseEligibilityAnswers` est déjà importé ligne 14 ; `parseEligibilityQuestions` est un export distinct du même module.)

- [ ] **Step 2: Compute canonical prefill + orientation-sourced id set**

In `app/d/[slug]/page.tsx`, REPLACE the existing orientation-prefill block (lines 210-227) — currently:

```ts
  let eligibilityAnswers = parseEligibilityAnswers(effectiveRun?.eligibilityAnswers);

  // Chaînage orientation → pré-qualification : ... (bloc existant lignes 212-227)
  if (!effectiveRun && dossier?.prefillFromOrientation) {
    const orientation = parseOrientationAnswers(
      cookieStore.get(ORIENTATION_COOKIE)?.value,
    );
    if (orientation && orientation.slug === slug) {
      eligibilityAnswers = {
        ...dossier.prefillFromOrientation(orientation),
        ...eligibilityAnswers,
      };
    }
  }
```

with (garde le prefill code existant ET ajoute le prefill canonique via clés) :

```ts
  let eligibilityAnswers = parseEligibilityAnswers(effectiveRun?.eligibilityAnswers);
  // Ids des questions pré-remplies depuis l'orientation (badge « d'après vos réponses »).
  const orientationAnswerIds: string[] = [];

  // Chaînage orientation → pré-qualification : si l'utilisateur arrive du wizard
  // (cookie `beldoc-orientation`) et qu'aucun run réel n'existe encore, on
  // pré-sélectionne les réponses connues — informatif, jamais bloquant.
  if (!effectiveRun) {
    const orientation = parseOrientationAnswers(
      cookieStore.get(ORIENTATION_COOKIE)?.value,
    );
    if (orientation && orientation.slug === slug) {
      // (a) Prefill existant des dossiers CODÉS (inchangé).
      if (dossier?.prefillFromOrientation) {
        eligibilityAnswers = {
          ...dossier.prefillFromOrientation(orientation),
          ...eligibilityAnswers,
        };
      }
      // (b) Prefill par CLÉS CANONIQUES depuis l'arbre publié. Repli sûr :
      // arbre indisponible / options sans tag / questions sans tag → aucun fait.
      const treeContent = await loadPublishedTreeContent("chomage");
      if (treeContent) {
        const chosenIds = [
          orientation.situation,
          orientation.subOption,
          orientation.refine,
        ].filter((v): v is string => typeof v === "string");
        const chosenOptions = chosenIds
          .map((id) => treeContent.nodes[id])
          .filter((n) => n?.type === "option") as {
          canonical?: { key: string; value: string };
        }[];
        const facts = collectCanonicalFacts(chosenOptions);
        const questions = parseEligibilityQuestions(bundle.eligibilityQuestions);
        const canonicalPrefill = prefillEligibilityAnswers(questions, facts);
        for (const qid of Object.keys(canonicalPrefill)) {
          // Ne pas écraser une réponse déjà présente (run/prefill code).
          if (eligibilityAnswers[qid] === undefined) {
            eligibilityAnswers[qid] = canonicalPrefill[qid];
            orientationAnswerIds.push(qid);
          }
        }
      }
    }
  }
```

> **À adapter selon le nom réel de la variable du bundle DB dans ce fichier :** le bloc utilise `bundle.eligibilityQuestions`. Repérer, plus haut dans la page, le nom exact de la variable qui contient la ligne `DocumentBundle` chargée (ex. `bundle`, `bundleRow`, `serializedBundle` — ce dernier est la version sérialisée passée au runner). Utiliser la source qui expose le champ JSON brut `eligibilityQuestions`. Si seul `serializedBundle` existe, lire `serializedBundle.eligibilityQuestions`.

- [ ] **Step 3: Pass `orientationAnswerIds` to the runner**

In the `runnerProps` object (lines 292-306), add the key (after `eligibilityAnswers,` line 298) :

```ts
          eligibilityAnswers,
          orientationAnswerIds,
```

- [ ] **Step 4: Verify types + build**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -iE "app/d/\[slug\]/page"` → aucune sortie **après** la Task 9 (le prop `orientationAnswerIds` n'existe sur `BundleRunner` qu'à la Task 9 ; faire les Tasks 8 et 9 avant de typechecker l'ensemble, ou committer 8 puis 9 et typechecker à la fin de 9).

- [ ] **Step 5: Commit**

```bash
git add "app/d/[slug]/page.tsx"
git commit -m "feat(parcours): résout les faits canoniques de l'orientation et pré-remplit la pré-qual"
```

---

## Task 9: Badge « d'après vos réponses » (runner + prequalifier)

**Files:**
- Modify: `components/docbel/bundle-runner.tsx`
- Modify: `components/docbel/onboarding/eligibility-prequalifier.tsx`

**Interfaces:**
- Consumes: `orientationAnswerIds: string[]` passé par la page (Task 8).
- Produces: `BundleRunnerProps.orientationAnswerIds?: string[]` ; `EligibilityPrequalifier` prop `orientationAnswerIds?: string[]` + badge par question.

**Note :** UI → vérif `tsc` + build + revue manuelle.

- [ ] **Step 1: Thread the prop through BundleRunner**

In `components/docbel/bundle-runner.tsx` :

(a) Add to `BundleRunnerProps` (after `userEmail?`, ~line 91) :

```ts
  /// Ids des questions de pré-qual pré-remplies depuis l'orientation (badge).
  orientationAnswerIds?: string[];
```

(b) Add to the destructuring (after `userEmail = null,` line 113) :

```ts
  orientationAnswerIds = [],
```

(c) Forward it into the `<EligibilityPrequalifier>` call (after `onAnswersChange={setEligibilityAnswers}` line 331) :

```tsx
          orientationAnswerIds={orientationAnswerIds}
```

- [ ] **Step 2: Render the badge in EligibilityPrequalifier**

In `components/docbel/onboarding/eligibility-prequalifier.tsx` :

(a) Add to `Props` (after `continueLabel?`, ~line 34) :

```ts
  /// Questions pré-remplies depuis l'orientation → badge informatif.
  orientationAnswerIds?: string[];
```

(b) Add to the destructuring (after `continueLabel,` line 47) :

```ts
  orientationAnswerIds = [],
```

(c) Compute a lookup set near the top of the component body (after line 51) :

```ts
  const fromOrientation = new Set(orientationAnswerIds);
```

(d) In the per-question header, REPLACE the `<Label>` block (lines 87-89) :

```tsx
            <Label htmlFor={`q-${q.id}`} className="text-sm font-medium">
              {q.label}
            </Label>
```

with :

```tsx
            <Label
              htmlFor={`q-${q.id}`}
              className="flex flex-wrap items-center gap-2 text-sm font-medium"
            >
              {q.label}
              {fromOrientation.has(q.id) && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal text-primary">
                  d&apos;après vos réponses
                </span>
              )}
            </Label>
```

- [ ] **Step 3: Verify types + full suite**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -cE "error TS"` → doit valoir 1 (l'erreur pré-existante street-suggestions ; 0 dans les fichiers de ce plan).
Run: `pnpm test`
Expected: vert (les nouveaux tests des tâches 1-4-7 inclus).

- [ ] **Step 4: Manual smoke (facultatif mais recommandé)**

Avec `DECISION_TREE_RUNTIME_ENABLED=true` et un arbre publié dont une option porte `canonical` + un dossier dont une question de pré-qual porte la même `canonicalKey`/valeur : parcourir le wizard `/mon-dossier` → arriver sur `/d/<slug>` → la question doit être pré-cochée avec le badge, et modifiable. Sans tags ou flag off : pré-qual normale (repli).

- [ ] **Step 5: Commit**

```bash
git add components/docbel/bundle-runner.tsx components/docbel/onboarding/eligibility-prequalifier.tsx
git commit -m "feat(parcours): badge « d'après vos réponses » sur les questions pré-remplies"
```

---

## Self-review (fait à l'écriture)

- **Couverture spec :** registre (T1), tags arbre (T3) + éligibilité (T2), cœur pur dérivation/prefill (T4), admin tagging arbre (T5) + pré-qual (T6), runtime résolution serveur (T7+T8) + badge modifiable (T9). Repli sûr présent à chaque point d'entrée (flag off / tags absents / clé inconnue). ✓
- **Placeholders :** aucun « TBD/TODO » ; deux notes d'adaptation explicites et bornées (nom exact de la variable bundle en T8 ; helper de flag en T7) — ce sont des vérifications ciblées, pas des trous de conception. ✓
- **Cohérence des types :** `canonicalKey`/`canonicalValue`/`canonicalTrue`/`canonicalFalse` (T2) consommés à l'identique en T4/T6 ; `OptionNode.canonical` (T3) consommé en T4/T5/T8 ; `orientationAnswerIds` (T8) = prop identique en T9. ✓
- **Ordre de dépendances :** T2/T3 (types) avant T4 (cœur) ; T7 (loader) avant T8 ; T8 (prop émis) et T9 (prop reçu) à typechecker ensemble (noté en T8 Step 4). ✓

## Execution Handoff

Deux options d'exécution — voir la fin de ce message.
