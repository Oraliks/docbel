# Autofill employeur via BCE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur le C1A et le C1B, remplacer la saisie libre du nom d'employeur
par un autocomplete adossé au mirroir KBO local : le citoyen tape le nom, une
liste de suggestions apparaît, il choisit — nom officiel et adresse du siège
social se remplissent, toujours modifiables ensuite.

**Architecture:** Copie conforme du patron `streetAutocomplete` déjà en place
(`components/ui/street-autocomplete-input.tsx`) : un prop déclaratif sur
`PdfFormField`, un module pur de parsing/formatage, un composant client
d'autocomplete, une route publique dédiée qui enveloppe `searchByName`
(`lib/be-companies/kbo-lookup.ts`, déjà rafraîchi par
`/api/cron/kbo-refresh`). Spec validée :
`docs/superpowers/specs/2026-08-03-autofill-employeur-bce-design.md`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Prisma 5
(lecture seule via `searchByName`, aucune migration), Zod n'intervient pas ici
(pas de nouveau payload validé), vitest.

## Global Constraints

- **Aucune nouvelle dépendance. Aucune migration DB.**
- **Toujours pré-rempli, jamais verrouillé** : `employeurNom`/`employeurAdresse`
  (et leurs équivalents C1B) restent éditables après sélection d'une
  suggestion — aucun `requireListMatch`, une frappe libre sans sélection reste
  acceptée (contrairement aux rues).
- La route publique est **name-search uniquement** (pas de recherche par
  numéro BCE en V1) — ne pas ajouter de paramètre `number` non demandé.
- `/api/admin/lookup/bce` (admin-only) reste **inchangée** — la nouvelle route
  est sœur, pas une ouverture de l'existante.
- `git add` de chemins **explicites** uniquement (workdir partagé
  multi-agents). Jamais `git add -A`, jamais `--force` sur `main`.
- `pnpm lint` a ~129 erreurs préexistantes : **zéro nouvelle erreur**.
- Front public : tokens glass (`--glass-ink`, `--glass-border`,
  `--glass-surface`…), jamais `bg-white`/`#FFFFFF` en dur.
- Contenu affiché (aide de champ) : texte factuel et sourcé du comportement
  réel du mirroir (siège social, pas unité d'établissement) — pas de
  formulation réglementaire inventée.
- **`employeurNom`/`employeurAdresse` (C1A) et
  `congeSansSoldeNomEmployeur`/`congeSansSoldeAdresseEmployeur` (C1B) sont des
  seeds `C1_IMPROVEMENT_TARGETS`** (`lib/pdf-forms/seed/apply-c1-improvements-core.ts`) :
  éditer le seed ne change rien à l'écran tant que
  `pnpm tsx scripts/apply-c1-improvements.ts --yes` n'a pas tourné contre la
  base partagée. **Ce lancement reste à Oraliks** (base Neon partagée) — ne
  pas l'exécuter soi-même.
- Commandes de validation : `pnpm vitest run <chemin>` (ciblé par tâche), puis
  en fin de lot `pnpm test` · `pnpm build` · `pnpm lint`.

---

### Task 1: Prop déclaratif `enterpriseAutocomplete` (types + vue publique)

**Files:**
- Modify: `lib/pdf-forms/types.ts:340` (juste après `streetAutocomplete`)
- Modify: `lib/pdf-forms/public-serializer.ts:49` (interface `PublicField`)
- Modify: `lib/pdf-forms/public-serializer.ts:105` (mapping `toPublicField`)
- Test: `lib/pdf-forms/__tests__/public-serializer-enterprise.test.ts`

**Interfaces:**
- Consumes: rien (déclaration de type pure).
- Produces: `PdfFormField["enterpriseAutocomplete"]` et
  `PublicField["enterpriseAutocomplete"]`, tous deux
  `{ addressFieldId: string } | undefined` — consommés par les Tasks 4-6.

- [ ] **Step 1: Écrire le test (d'abord, il doit échouer)**

`lib/pdf-forms/__tests__/public-serializer-enterprise.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { toPublicField } from "../public-serializer";
import type { PdfFormField } from "../types";

describe("toPublicField — enterpriseAutocomplete", () => {
  it("copie le prop enterpriseAutocomplete vers la vue publique", () => {
    const field: PdfFormField = {
      id: "employeurNom",
      pdfFieldName: "14 Données concernant votre employeur",
      type: "text",
      required: true,
      label: { fr: "Nom de votre employeur" },
      section: "employeur",
      order: 63,
      enterpriseAutocomplete: { addressFieldId: "employeurAdresse" },
    };
    const pub = toPublicField(field);
    expect(pub.enterpriseAutocomplete).toEqual({ addressFieldId: "employeurAdresse" });
  });

  it("absent du schéma → absent de la vue publique", () => {
    const field: PdfFormField = {
      id: "autreChamp",
      pdfFieldName: "x",
      type: "text",
      required: false,
      label: { fr: "x" },
      section: "s",
      order: 1,
    };
    expect(toPublicField(field).enterpriseAutocomplete).toBeUndefined();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm vitest run lib/pdf-forms/__tests__/public-serializer-enterprise.test.ts`
Expected: FAIL (le champ `enterpriseAutocomplete` n'existe pas encore sur
`PdfFormField`, erreur TypeScript à la compilation du test).

- [ ] **Step 3: Ajouter le prop à `PdfFormField`**

Dans `lib/pdf-forms/types.ts`, ligne 340 :

```ts
  streetAutocomplete?: { postalFieldId: string };
```

devient :

```ts
  streetAutocomplete?: { postalFieldId: string };
  /// Active l'autocomplete d'entreprise belge (mirroir KBO local, cf.
  /// lib/be-companies/kbo-lookup.ts) sur un champ `text`. `addressFieldId` =
  /// id du champ adresse du MÊME formulaire : choisir une suggestion remplit
  /// aussi ce champ avec l'adresse du siège social (cf.
  /// components/ui/enterprise-autocomplete-input.tsx). Le mirroir ne porte
  /// pas les unités d'établissement — l'adresse suggérée peut différer du
  /// lieu de travail réel, d'où l'aide de champ dédiée côté seed.
  enterpriseAutocomplete?: { addressFieldId: string };
```

- [ ] **Step 4: Ajouter le prop à `PublicField` (interface)**

Dans `lib/pdf-forms/public-serializer.ts` :

```ts
  streetAutocomplete?: PdfFormField["streetAutocomplete"];
  requireListMatch?: PdfFormField["requireListMatch"];
```

devient :

```ts
  streetAutocomplete?: PdfFormField["streetAutocomplete"];
  enterpriseAutocomplete?: PdfFormField["enterpriseAutocomplete"];
  requireListMatch?: PdfFormField["requireListMatch"];
```

- [ ] **Step 5: Ajouter le prop au mapping `toPublicField`**

Dans le même fichier :

```ts
    streetAutocomplete: f.streetAutocomplete,
    requireListMatch: f.requireListMatch,
```

devient :

```ts
    streetAutocomplete: f.streetAutocomplete,
    enterpriseAutocomplete: f.enterpriseAutocomplete,
    requireListMatch: f.requireListMatch,
```

- [ ] **Step 6: Vérifier le passage**

Run: `pnpm vitest run lib/pdf-forms/__tests__/public-serializer-enterprise.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/pdf-forms/types.ts lib/pdf-forms/public-serializer.ts lib/pdf-forms/__tests__/public-serializer-enterprise.test.ts
git commit -m "feat(pdf-forms): prop déclaratif enterpriseAutocomplete (types + vue publique)"
```

---

### Task 2: Module pur `enterprise-suggestions.ts`

**Files:**
- Create: `lib/pdf-forms/enterprise-suggestions.ts`
- Test: `lib/pdf-forms/__tests__/enterprise-suggestions.test.ts`

**Interfaces:**
- Consumes: `KboLookupResult` (`lib/be-companies/kbo-lookup.ts`, type only —
  aucun accès DB dans ce module).
- Produces: `EnterpriseSuggestion { bceNumber, name, address }`,
  `parseEnterpriseSuggestions(results: KboLookupResult[]): EnterpriseSuggestion[]`,
  `formatEnterpriseAddress(office: KboLookupResult["registeredOffice"]): string` —
  consommés par la Task 3 (route) et la Task 4 (composant, via le type).

- [ ] **Step 1: Écrire le test (d'abord, il doit échouer)**

`lib/pdf-forms/__tests__/enterprise-suggestions.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { formatEnterpriseAddress, parseEnterpriseSuggestions } from "../enterprise-suggestions";
import type { KboLookupResult } from "@/lib/be-companies/kbo-lookup";

function result(p: Partial<KboLookupResult> = {}): KboLookupResult {
  return {
    enterpriseNumber: "0123456749",
    status: "AC",
    juridicalForm: null,
    startDate: null,
    names: { default: "Cantillon SPRL", fr: "Cantillon SPRL" },
    registeredOffice: {
      street: "Rue Gheude",
      houseNumber: "56",
      zipcode: "1070",
      city: "Anderlecht",
      country: "Belgique",
    },
    mainNaceCode: null,
    ...p,
  };
}

describe("formatEnterpriseAddress", () => {
  it("compose rue + numéro, CP + ville", () => {
    expect(formatEnterpriseAddress(result().registeredOffice)).toBe(
      "Rue Gheude 56, 1070 Anderlecht",
    );
  });

  it("ajoute la boîte si présente", () => {
    expect(
      formatEnterpriseAddress({
        street: "Avenue Louise",
        houseNumber: "1",
        box: "3",
        zipcode: "1050",
        city: "Bruxelles",
      }),
    ).toBe("Avenue Louise 1, boîte 3, 1050 Bruxelles");
  });

  it("rue/CP/ville manquants → chaîne vide (pas d'adresse tronquée trompeuse)", () => {
    expect(formatEnterpriseAddress(undefined)).toBe("");
    expect(formatEnterpriseAddress({ city: "Bruxelles" })).toBe("");
  });
});

describe("parseEnterpriseSuggestions", () => {
  it("mappe nom + adresse composée + numéro BCE", () => {
    const out = parseEnterpriseSuggestions([result()]);
    expect(out).toEqual([
      { bceNumber: "0123456749", name: "Cantillon SPRL", address: "Rue Gheude 56, 1070 Anderlecht" },
    ]);
  });

  it("dénomination absente → entreprise ignorée", () => {
    const out = parseEnterpriseSuggestions([result({ names: { default: "" } })]);
    expect(out).toEqual([]);
  });

  it("pas d'adresse de siège → suggestion gardée avec address vide", () => {
    const out = parseEnterpriseSuggestions([result({ registeredOffice: undefined })]);
    expect(out).toEqual([{ bceNumber: "0123456749", name: "Cantillon SPRL", address: "" }]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm vitest run lib/pdf-forms/__tests__/enterprise-suggestions.test.ts`
Expected: FAIL — module `../enterprise-suggestions` introuvable.

- [ ] **Step 3: Implémenter**

`lib/pdf-forms/enterprise-suggestions.ts` :

```ts
/// Suggestions d'autocomplete d'entreprise — parsing/formatage PURS, aucun
/// accès DB (cf. lib/be-companies/kbo-lookup.ts pour la requête elle-même).
/// Consommé par la route /api/lookup/entreprise ET par le composant client
/// (via le type EnterpriseSuggestion).

import type { KboLookupResult } from "@/lib/be-companies/kbo-lookup";

export interface EnterpriseSuggestion {
  bceNumber: string;
  name: string;
  /// Adresse du SIÈGE SOCIAL, composée en une ligne (le champ PDF cible est
  /// du texte libre). Chaîne vide si l'entreprise n'a pas d'adresse
  /// exploitable dans le mirroir — jamais une adresse partielle trompeuse.
  address: string;
}

/// Compose l'adresse du siège social en une ligne unique ("Rue Gheude 56,
/// 1070 Anderlecht"). Le mirroir KBO ne porte que l'adresse REGO (siège
/// social) — pas les unités d'établissement (cf. kbo-lookup.ts,
/// ENTERPRISE_INCLUDE). L'écart avec le lieu de travail réel, pour un
/// employeur multi-sites, est assumé et dit à l'écran (aide de champ, cf.
/// seeds c1a/c1b).
export function formatEnterpriseAddress(
  office: KboLookupResult["registeredOffice"],
): string {
  if (!office?.street || !office.zipcode || !office.city) return "";
  const numero = [office.houseNumber, office.box ? `boîte ${office.box}` : null]
    .filter(Boolean)
    .join(", ");
  const ligne1 = numero ? `${office.street} ${numero}` : office.street;
  return `${ligne1}, ${office.zipcode} ${office.city}`;
}

/// Transforme les résultats bruts du lookup KBO en suggestions affichables.
/// Une entreprise sans dénomination exploitable (données incomplètes dans le
/// mirroir) est ignorée plutôt que montrée avec un nom vide.
export function parseEnterpriseSuggestions(
  results: KboLookupResult[],
): EnterpriseSuggestion[] {
  const out: EnterpriseSuggestion[] = [];
  for (const r of results) {
    const name = r.names.fr || r.names.default;
    if (!name) continue;
    out.push({
      bceNumber: r.enterpriseNumber,
      name,
      address: formatEnterpriseAddress(r.registeredOffice),
    });
  }
  return out;
}
```

- [ ] **Step 4: Vérifier le passage**

Run: `pnpm vitest run lib/pdf-forms/__tests__/enterprise-suggestions.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-forms/enterprise-suggestions.ts lib/pdf-forms/__tests__/enterprise-suggestions.test.ts
git commit -m "feat(pdf-forms): module pur enterprise-suggestions (parsing + formatage adresse)"
```

---

### Task 3: Route publique `GET /api/lookup/entreprise`

**Files:**
- Create: `app/api/lookup/entreprise/route.ts`

**Interfaces:**
- Consumes: `searchByName` (`lib/be-companies/kbo-lookup.ts`),
  `parseEnterpriseSuggestions` (Task 2), `checkRateLimit`/`getClientIp`
  (`lib/pdf-forms/security.ts`).
- Produces: `GET /api/lookup/entreprise?q=<nom>` → `{ results: EnterpriseSuggestion[] }`
  (200) ou `{ error }` (429/500) — consommé par la Task 4.
- Aucun paramètre `number` : recherche par nom uniquement (contrainte globale).

- [ ] **Step 1: Implémenter**

`app/api/lookup/entreprise/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { searchByName } from "@/lib/be-companies/kbo-lookup";
import { parseEnterpriseSuggestions } from "@/lib/pdf-forms/enterprise-suggestions";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET /api/lookup/entreprise?q=<nom> — recherche PUBLIQUE d'entreprise belge
/// par nom, mirroir KBO local rafraîchi par /api/cron/kbo-refresh. Sœur de
/// /api/admin/lookup/bce (admin-only, inchangée) : périmètre volontairement
/// plus étroit — recherche par nom uniquement, pas par numéro (spec
/// 2026-08-03-autofill-employeur-bce-design.md). Le plancher de longueur de
/// requête (3 caractères) est déjà appliqué par `searchByName` — pas de
/// duplication ici.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`lookup-entreprise:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes, réessayez plus tard" },
      { status: 429, headers: json },
    );
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const raw = await searchByName(q, 10);
    return NextResponse.json({ results: parseEnterpriseSuggestions(raw) }, { headers: json });
  } catch (err) {
    console.error("[lookup-entreprise] error:", err);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500, headers: json });
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `pnpm build`
Expected: build OK, `/api/lookup/entreprise` apparaît dans la liste des
routes générées.

- [ ] **Step 3: Commit**

```bash
git add app/api/lookup/entreprise/route.ts
git commit -m "feat(pdf-forms): route publique GET /api/lookup/entreprise (rate-limitée)"
```

---

### Task 4: Composant `EnterpriseAutocompleteInput`

**Files:**
- Create: `components/ui/enterprise-autocomplete-input.tsx`

**Interfaces:**
- Consumes: `EnterpriseSuggestion` (Task 2, type), `Input`
  (`@/components/ui/input`), route de la Task 3.
- Produces: `<EnterpriseAutocompleteInput value onChange onSelectSuggestion? ...props />` —
  consommé par la Task 5.

- [ ] **Step 1: Implémenter**

`components/ui/enterprise-autocomplete-input.tsx` (copie conforme de
`components/ui/street-autocomplete-input.tsx`, sans la priorisation par code
postal ni `requireListMatch` — absents du design de cette feature) :

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { EnterpriseSuggestion } from "@/lib/pdf-forms/enterprise-suggestions";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;
const MAX_SUGGESTIONS = 8;

interface EnterpriseAutocompleteInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  /// Appelé en plus de `onChange` quand l'utilisateur choisit une suggestion
  /// — permet au formulaire d'auto-remplir l'adresse à partir du choix.
  onSelectSuggestion?: (suggestion: EnterpriseSuggestion) => void;
}

/// Autocomplete d'entreprise belge, source mirroir KBO local via l'API
/// publique dédiée `/api/lookup/entreprise` — aucune dépendance externe,
/// aucun appel réseau tiers. Champ TEXTE normal en repli si l'API échoue ou
/// si l'entreprise n'est pas dans le mirroir (indépendant récent, structure
/// étrangère…) : aucun forçage de liste, contrairement aux rues — la
/// suggestion aide, elle n'impose rien.
export function EnterpriseAutocompleteInput({
  value,
  onChange,
  onSelectSuggestion,
  className,
  ...props
}: EnterpriseAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<EnterpriseSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < MIN_CHARS) {
      setSuggestions([]);
      return;
    }
    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(() => {
      fetch(`/api/lookup/entreprise?q=${encodeURIComponent(value.trim())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          // Ignore une réponse arrivée en retard (l'utilisateur a retapé depuis).
          if (seq !== requestSeq.current || !data?.results) return;
          setSuggestions((data.results as EnterpriseSuggestion[]).slice(0, MAX_SUGGESTIONS));
        })
        .catch(() => {
          if (seq === requestSeq.current) setSuggestions([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <Input
        {...props}
        value={value}
        className="w-full"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Délai avant fermeture pour laisser le clic sur une suggestion aboutir.
        onBlur={(e) => {
          props.onBlur?.(e);
          setTimeout(() => setOpen(false), 150);
        }}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-2xl border border-[color:var(--glass-border)] p-1.5 shadow-xl backdrop-blur-md"
          // Fond opaque (≥95%) comme la liste de rues : reste lisible
          // au-dessus d'inputs déjà remplis, compatible dark via light-dark().
          style={{
            backgroundColor: "light-dark(rgba(255,255,255,0.97), rgba(24,24,32,0.97))",
          }}
        >
          {suggestions.map((s) => (
            <li key={s.bceNumber}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-[color:var(--glass-pop-bg)]"
                onMouseDown={(e) => {
                  // onMouseDown (avant le blur) pour que le clic ne soit pas
                  // annulé par la fermeture du dropdown au blur de l'input.
                  e.preventDefault();
                  onChange(s.name);
                  onSelectSuggestion?.(s);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-[color:var(--glass-ink)]">{s.name}</span>
                {s.address ? (
                  <span className="text-xs text-[color:var(--glass-ink-soft)]">{s.address}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `pnpm build`
Expected: build OK (composant non encore utilisé nulle part, mais doit
compiler seul sans erreur de type).

- [ ] **Step 3: Commit**

```bash
git add components/ui/enterprise-autocomplete-input.tsx
git commit -m "feat(pdf-forms): composant EnterpriseAutocompleteInput (mirroir street-autocomplete)"
```

---

### Task 5: Câblage `pdf-field.tsx`

**Files:**
- Modify: `components/pdf-forms/pdf-field.tsx`

**Interfaces:**
- Consumes: `EnterpriseAutocompleteInput` (Task 4), `field.enterpriseAutocomplete`
  (Task 1).
- Produces: nouvelle prop `onSelectEnterpriseAddress?: (address: string) => void`
  sur `PdfField` — consommée par la Task 6.

- [ ] **Step 1: Import du composant**

Après la ligne `import { StreetAutocompleteInput } from "@/components/ui/street-autocomplete-input";` :

```ts
import { StreetAutocompleteInput } from "@/components/ui/street-autocomplete-input";
import { EnterpriseAutocompleteInput } from "@/components/ui/enterprise-autocomplete-input";
```

- [ ] **Step 2: Ajouter la prop à l'interface `Props`**

Juste après (dans le bloc de doc de) `onSelectStreetSuggestion?: (postalCode: string) => void;` :

```ts
  onSelectStreetSuggestion?: (postalCode: string) => void;
  /// Appelé quand l'utilisateur choisit une suggestion d'entreprise
  /// (`field.enterpriseAutocomplete`) : permet au formulaire de remplir le
  /// champ adresse désigné par `addressFieldId` en retour.
  onSelectEnterpriseAddress?: (address: string) => void;
```

- [ ] **Step 3: Destructurer la prop dans `PdfFieldControl`**

```ts
function PdfFieldControl({
  field, value, error, locale, onChange, formId, formSlug, rowLayout = false,
  segmentedVariant = "connected",
  autoLocked = false,
  derivedValue = null, relatedPostalCode, onSelectStreetSuggestion, onStreetVerifiedChange, parentValues,
  onFocusField,
  hideLabel = false,
}: Props) {
```

devient :

```ts
function PdfFieldControl({
  field, value, error, locale, onChange, formId, formSlug, rowLayout = false,
  segmentedVariant = "connected",
  autoLocked = false,
  derivedValue = null, relatedPostalCode, onSelectStreetSuggestion, onStreetVerifiedChange, parentValues,
  onFocusField,
  hideLabel = false,
  onSelectEnterpriseAddress,
}: Props) {
```

- [ ] **Step 4: Calculer `useEnterpriseAutocomplete`**

```ts
  const useStreetAutocomplete = field.streetAutocomplete != null && !locked;
```

devient :

```ts
  const useStreetAutocomplete = field.streetAutocomplete != null && !locked;
  const useEnterpriseAutocomplete = field.enterpriseAutocomplete != null && !locked;
```

- [ ] **Step 5: Ajouter la branche de rendu**

```tsx
        {useStreetAutocomplete ? (
          <StreetAutocompleteInput
            id={field.id}
            value={String(displayValue)}
            placeholder={placeholder}
            aria-invalid={invalid}
            aria-required={ariaRequired}
            aria-describedby={textDescribedBy}
            className="flex-1"
            postalCode={relatedPostalCode}
            onChange={(v) => onChange(v)}
            onSelectSuggestion={(s) => onSelectStreetSuggestion?.(s.postalCode)}
            onVerifiedChange={field.requireListMatch ? onStreetVerifiedChange : undefined}
            onBlur={markTouched}
          />
        ) : useCountrySelect ? (
```

devient :

```tsx
        {useStreetAutocomplete ? (
          <StreetAutocompleteInput
            id={field.id}
            value={String(displayValue)}
            placeholder={placeholder}
            aria-invalid={invalid}
            aria-required={ariaRequired}
            aria-describedby={textDescribedBy}
            className="flex-1"
            postalCode={relatedPostalCode}
            onChange={(v) => onChange(v)}
            onSelectSuggestion={(s) => onSelectStreetSuggestion?.(s.postalCode)}
            onVerifiedChange={field.requireListMatch ? onStreetVerifiedChange : undefined}
            onBlur={markTouched}
          />
        ) : useEnterpriseAutocomplete ? (
          <EnterpriseAutocompleteInput
            id={field.id}
            value={String(displayValue)}
            placeholder={placeholder}
            aria-invalid={invalid}
            aria-required={ariaRequired}
            aria-describedby={textDescribedBy}
            className="flex-1"
            onChange={(v) => onChange(v)}
            onSelectSuggestion={(s) => onSelectEnterpriseAddress?.(s.address)}
            onBlur={markTouched}
          />
        ) : useCountrySelect ? (
```

- [ ] **Step 6: Vérifier la compilation**

Run: `pnpm build`
Expected: build OK.

- [ ] **Step 7: Commit**

```bash
git add components/pdf-forms/pdf-field.tsx
git commit -m "feat(pdf-forms): branche de rendu enterpriseAutocomplete dans pdf-field.tsx"
```

---

### Task 6: Câblage `pdf-form-runner.tsx`

**Files:**
- Modify: `components/pdf-forms/pdf-form-runner.tsx:1740-1758`

**Interfaces:**
- Consumes: `onSelectEnterpriseAddress` (Task 5, prop de `PdfField`),
  `field.enterpriseAutocomplete` (Task 1), `setValue` (existant, déjà utilisé
  pour `onSelectStreetSuggestion`).
- Produces: rien de nouveau exposé — ferme la boucle « sélection → écriture
  dans le champ adresse ».

- [ ] **Step 1: Ajouter le callback à l'appel de `PdfField`**

Dans le bloc `standaloneOtherFields.map` :

```tsx
                <PdfField
                  field={f}
                  value={values[f.id] ?? ""}
                  error={errors[f.id]}
                  locale={locale}
                  onChange={(v) => setValue(f.id, v)}
                  formId={formId}
                  formSlug={formSlug}
                  derivedValue={deriveValueFor(f)}
                  relatedPostalCode={relatedPostalCodeFor(f)}
                  onSelectStreetSuggestion={(postalCode) => {
                    if (f.streetAutocomplete) setValue(f.streetAutocomplete.postalFieldId, postalCode);
                  }}
                  onStreetVerifiedChange={(v) => onStreetVerifiedChange?.(f.id, v)}
                  parentValues={values}
                  onFocusField={onFocusField}
                  hideLabel={f.id === hideLabelForId}
                />
```

devient :

```tsx
                <PdfField
                  field={f}
                  value={values[f.id] ?? ""}
                  error={errors[f.id]}
                  locale={locale}
                  onChange={(v) => setValue(f.id, v)}
                  formId={formId}
                  formSlug={formSlug}
                  derivedValue={deriveValueFor(f)}
                  relatedPostalCode={relatedPostalCodeFor(f)}
                  onSelectStreetSuggestion={(postalCode) => {
                    if (f.streetAutocomplete) setValue(f.streetAutocomplete.postalFieldId, postalCode);
                  }}
                  onSelectEnterpriseAddress={(address) => {
                    if (f.enterpriseAutocomplete) setValue(f.enterpriseAutocomplete.addressFieldId, address);
                  }}
                  onStreetVerifiedChange={(v) => onStreetVerifiedChange?.(f.id, v)}
                  parentValues={values}
                  onFocusField={onFocusField}
                  hideLabel={f.id === hideLabelForId}
                />
```

- [ ] **Step 2: Vérifier la compilation**

Run: `pnpm build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add components/pdf-forms/pdf-form-runner.tsx
git commit -m "feat(pdf-forms): écrit l'adresse suggérée dans le champ désigné par enterpriseAutocomplete"
```

---

### Task 7: Application aux seeds C1A et C1B

**Files:**
- Modify: `lib/pdf-forms/seed/c1a-fields.ts:972-980` (`employeurNom`)
- Modify: `lib/pdf-forms/seed/c1a-fields.ts:984-991` (`employeurAdresse`)
- Modify: `lib/pdf-forms/seed/c1b-fields.ts:482-490` (`congeSansSoldeNomEmployeur`)
- Modify: `lib/pdf-forms/seed/c1b-fields.ts:492-499` (`congeSansSoldeAdresseEmployeur`)

**Interfaces:**
- Consumes: `enterpriseAutocomplete` (Task 1).
- Produces: rien — c'est le point d'application final, consommé par l'écran
  une fois le re-semis fait (cf. contrainte globale, hors périmètre agent).

- [ ] **Step 1: C1A — `employeurNom`**

Dans `lib/pdf-forms/seed/c1a-fields.ts`, le champ `employeurNom` :

```ts
    id: "employeurNom",
    pdfFieldName: "14 Données concernant votre employeur",
    type: "text",
    required: true,
    label: { fr: "Nom de votre employeur" },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 63,
  },
```

devient :

```ts
    id: "employeurNom",
    pdfFieldName: "14 Données concernant votre employeur",
    type: "text",
    required: true,
    label: { fr: "Nom de votre employeur" },
    help: { fr: "Tapez le nom pour rechercher votre employeur — son adresse se remplira automatiquement." },
    enterpriseAutocomplete: { addressFieldId: "employeurAdresse" },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 63,
  },
```

- [ ] **Step 2: C1A — `employeurAdresse`**

```ts
    id: "employeurAdresse",
    pdfFieldName: "Nom employeur",
    type: "text",
    required: false,
    label: { fr: "Adresse de votre employeur" },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 64,
  },
```

devient :

```ts
    id: "employeurAdresse",
    pdfFieldName: "Nom employeur",
    type: "text",
    required: false,
    label: { fr: "Adresse de votre employeur" },
    help: { fr: "Adresse du siège social — à corriger si vous travailliez ailleurs." },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 64,
  },
```

- [ ] **Step 3: C1B — `congeSansSoldeNomEmployeur`**

Dans `lib/pdf-forms/seed/c1b-fields.ts` :

```ts
  {
    id: "congeSansSoldeNomEmployeur",
    pdfFieldName: "nom employeur",
    type: "text",
    required: false,
    label: { fr: "Congé sans solde — nom de l'employeur" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 51,
  },
```

devient :

```ts
  {
    id: "congeSansSoldeNomEmployeur",
    pdfFieldName: "nom employeur",
    type: "text",
    required: false,
    label: { fr: "Congé sans solde — nom de l'employeur" },
    help: { fr: "Tapez le nom pour rechercher l'employeur — son adresse se remplira automatiquement." },
    enterpriseAutocomplete: { addressFieldId: "congeSansSoldeAdresseEmployeur" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 51,
  },
```

- [ ] **Step 4: C1B — `congeSansSoldeAdresseEmployeur`**

```ts
  {
    id: "congeSansSoldeAdresseEmployeur",
    pdfFieldName: "adresse employeur",
    type: "text",
    required: false,
    label: { fr: "Congé sans solde — adresse de l'employeur" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 52,
  },
```

devient :

```ts
  {
    id: "congeSansSoldeAdresseEmployeur",
    pdfFieldName: "adresse employeur",
    type: "text",
    required: false,
    label: { fr: "Congé sans solde — adresse de l'employeur" },
    help: { fr: "Adresse du siège social — à corriger si vous travailliez ailleurs." },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 52,
  },
```

- [ ] **Step 2bis: Vérifier que les seeds compilent et que les tests existants passent**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1a-fields.test.ts lib/pdf-forms/seed/__tests__/c1b-fields.test.ts`
Expected: PASS — ces tests verrouillent la géométrie/le mapping des widgets,
pas le contenu de `help`/`enterpriseAutocomplete` : l'ajout ne doit rien casser.

- [ ] **Step 3: Commit**

```bash
git add lib/pdf-forms/seed/c1a-fields.ts lib/pdf-forms/seed/c1b-fields.ts
git commit -m "feat(pdf-forms): active l'autocomplete employeur sur C1A et C1B (aide siège social)"
```

---

### Task 8: Validation finale et note de déploiement

**Files:**
- Modify: `docs/tasks/NEXT_ACTIONS.md` (note de suivi, section pdf-forms)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: lot poussé, prêt pour la relecture d'Oraliks + son lancement du
  re-semis.

- [ ] **Step 1: Suite complète**

Run: `pnpm test && pnpm build && pnpm lint`
Expected: tous les tests verts (dont les 8 nouveaux : 2 public-serializer + 6
enterprise-suggestions), build OK, lint sans nouvelle erreur (≈129
préexistantes).

- [ ] **Step 2: QA manuelle (dev)**

Lancer le dev server (PowerShell propre — cf. mémoire projet), ouvrir le C1A
à l'étape employeur : taper 3+ caractères d'un nom d'entreprise connue du
mirroir, vérifier que la liste apparaît, qu'un choix remplit nom + adresse,
que les deux champs restent éditables ensuite, et que le repli en texte libre
fonctionne pour un nom absent du mirroir (aucune suggestion, aucune erreur
visible). Répéter sur le C1B (bloc congé sans solde). Vérifier clair/sombre.

**Ce test suppose que `scripts/apply-c1-improvements.ts --yes` a déjà tourné**
contre la base utilisée par le dev server — sinon les nouveaux props
`help`/`enterpriseAutocomplete` ne sont pas encore en base et l'écran ne
change pas (comportement attendu, pas un bug — cf. contrainte globale).

- [ ] **Step 3: Note de suivi dans NEXT_ACTIONS**

Ajouter une ligne dans le tableau des items « Formulaires PDF » de
`docs/tasks/NEXT_ACTIONS.md` :

```
| # | P2 | Dette | Lancer `pnpm tsx scripts/apply-c1-improvements.ts --yes` pour publier l'autocomplete employeur (BCE) sur C1A/C1B — code livré 2026-08-03, écran inchangé tant que le re-semis n'a pas tourné | `lib/pdf-forms/seed/c1a-fields.ts`, `c1b-fields.ts` | Faible | écran C1A + C1B, employeur | **Oraliks** — lancement du re-semis |
```

(Utiliser le prochain numéro `#` disponible dans le tableau.)

- [ ] **Step 4: Commit + push**

```bash
git add docs/tasks/NEXT_ACTIONS.md
git commit -m "docs(pdf-forms): note de suivi — re-semis à lancer pour l'autocomplete employeur"
git push
```

---

## Self-review (fait à l'écriture du plan)

- **Couverture spec** : prop déclaratif + vue publique (T1) ; module pur
  parsing/formatage siège social (T2) ; route publique name-only rate-limitée,
  distincte de l'admin (T3) ; composant sans `requireListMatch` (T4) ; câblage
  runner bout en bout (T5-T6) ; application aux 2 seeds concernés avec aide de
  champ « siège social » (T7) ; validation + note de re-semis pour Oraliks
  (T8). Portée respectée : pas de sexe-NISS, pas de scan eID, pas de recherche
  par numéro BCE.
- **Placeholders** : aucun TBD. Le seul point non exécuté par l'agent
  (lancement du re-semis) est une contrainte globale explicite, pas un trou de
  design.
- **Cohérence de types** : `EnterpriseSuggestion { bceNumber, name, address }`
  identique du module (T2) au composant (T4) à la route (T3, via
  `parseEnterpriseSuggestions`). `enterpriseAutocomplete: { addressFieldId }`
  identique de `types.ts` (T1) à `public-serializer.ts` (T1) aux seeds (T7).
  `onSelectEnterpriseAddress` même signature de `pdf-field.tsx` (T5) à
  `pdf-form-runner.tsx` (T6).
