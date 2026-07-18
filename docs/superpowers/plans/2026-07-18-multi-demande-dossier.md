# Plusieurs demandes par dossier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, autonome) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Permettre à un citoyen de créer/lister/dissocier plusieurs demandes (`BundleRun`) indépendantes pour un même dossier.

**Architecture:** Zéro migration. Une demande = un `BundleRun` (déjà multi-instanciable). On ajoute la couche sélection/création : flag `forceNew` sur la création de run, `?bundleRun=<id>` + branchement hybride sur `/d/[slug]`, un écran « Mes demandes », un bouton « Nouvelle demande », et le `runId` propagé dans `/mon-dossier`. L'abandon réutilise `DELETE /api/bundles/runs/[runId]` (existant).

**Tech Stack:** Next.js 16 (App Router, server components), React 19, Prisma 5, next-intl 4, vitest, Tailwind 4 + shadcn (glass public).

## Global Constraints

- `pnpm test` (vitest), `pnpm lint` (~74 erreurs PRÉ-EXISTANTES — ne pas en ajouter), `pnpm build` (build+typecheck, pas de `pnpm typecheck`).
- Front glass mauve : jamais `bg-white`/`#FFFFFF` en dur ; classes `glass-*`/`var(--glass-*)`.
- `git add` chemins EXPLICITES uniquement (workdir partagé). Commit à chaque tâche, **jamais push** (Oraliks pousse main).
- Textes user-facing = i18n (`useTranslations`), namespace `public.dossier` ; `fr.json` en CRLF avec doublons → insertion SURGICALE (ne pas réécrire le fichier).
- Ownership partout : jamais lire/écrire le run d'un autre (userId session OU cookie `beldoc-bundle-session`).
- Runs éditables = `EDITABLE_BUNDLE_RUN_STATUSES` (`["in_progress","completed"]`) ; `abandoned`/anonymisé exclus.

---

### Task 1: Helper de progression d'un run (pur, partagé)

**Files:**
- Create: `lib/bundles/run-progress.ts`
- Test: `lib/bundles/__tests__/run-progress.test.ts`

**Interfaces:**
- Produces: `bundleRunHasProgress(run: { completedTemplateIds: unknown; eligibilityAnswers: unknown; payloads: unknown }): boolean`

Un run « a de la progression » s'il a au moins un document complété, une réponse de pré-qualif, ou un payload. Extrait la logique inline de `app/d/[slug]/page.tsx` (`runHasProgress`) pour la partager avec la route de création.

- [ ] **Step 1 — test** (`run-progress.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { bundleRunHasProgress } from "../run-progress";

describe("bundleRunHasProgress", () => {
  it("vide sur tous les champs → false", () => {
    expect(bundleRunHasProgress({ completedTemplateIds: [], eligibilityAnswers: {}, payloads: {} })).toBe(false);
    expect(bundleRunHasProgress({ completedTemplateIds: null, eligibilityAnswers: null, payloads: null })).toBe(false);
  });
  it("un document complété → true", () => {
    expect(bundleRunHasProgress({ completedTemplateIds: ["a"], eligibilityAnswers: {}, payloads: {} })).toBe(true);
  });
  it("une réponse de pré-qualif → true", () => {
    expect(bundleRunHasProgress({ completedTemplateIds: [], eligibilityAnswers: { q1: "oui" }, payloads: {} })).toBe(true);
  });
  it("un payload → true", () => {
    expect(bundleRunHasProgress({ completedTemplateIds: [], eligibilityAnswers: {}, payloads: { form1: { niss: "x" } } })).toBe(true);
  });
});
```

- [ ] **Step 2 — implémentation** (`run-progress.ts`)

```ts
/// Un `BundleRun` « a de la progression » dès qu'il porte au moins un document
/// complété, une réponse de pré-qualification, ou un payload de formulaire.
/// Sert à (1) ne pas traiter un run vide comme une reprise (page /d/[slug]),
/// (2) réutiliser un run vide au lieu d'en créer un doublon (« Nouvelle demande »).
export function bundleRunHasProgress(run: {
  completedTemplateIds: unknown;
  eligibilityAnswers: unknown;
  payloads: unknown;
}): boolean {
  const completed = Array.isArray(run.completedTemplateIds)
    ? run.completedTemplateIds.length
    : 0;
  const elig =
    run.eligibilityAnswers && typeof run.eligibilityAnswers === "object"
      ? Object.keys(run.eligibilityAnswers as Record<string, unknown>).length
      : 0;
  const payloads =
    run.payloads && typeof run.payloads === "object"
      ? Object.keys(run.payloads as Record<string, unknown>).length
      : 0;
  return completed > 0 || elig > 0 || payloads > 0;
}
```

- [ ] **Step 3 — run** : `pnpm vitest run lib/bundles/__tests__/run-progress.test.ts` → PASS.
- [ ] **Step 4 — commit** : `git add lib/bundles/run-progress.ts lib/bundles/__tests__/run-progress.test.ts` → `feat(bundles): add bundleRunHasProgress helper`.

---

### Task 2: Décision de création (forceNew / reuse-empty / cap)

**Files:**
- Create: `lib/bundles/run-creation.ts`
- Test: `lib/bundles/__tests__/run-creation.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `MAX_EDITABLE_RUNS_PER_BUNDLE = 20`
  - `type ForceNewAction = { kind: "reuse"; runId: string } | { kind: "create" } | { kind: "too_many" }`
  - `resolveForceNewAction(existingEditable: { id: string; hasProgress: boolean }[], cap?: number): ForceNewAction`

- [ ] **Step 1 — test**

```ts
import { describe, it, expect } from "vitest";
import { resolveForceNewAction, MAX_EDITABLE_RUNS_PER_BUNDLE } from "../run-creation";

describe("resolveForceNewAction", () => {
  it("aucun run éditable → create", () => {
    expect(resolveForceNewAction([])).toEqual({ kind: "create" });
  });
  it("un run vide existe → reuse (pas de doublon vide)", () => {
    expect(resolveForceNewAction([{ id: "r1", hasProgress: false }])).toEqual({ kind: "reuse", runId: "r1" });
  });
  it("que des runs avec progression → create", () => {
    expect(resolveForceNewAction([{ id: "r1", hasProgress: true }])).toEqual({ kind: "create" });
  });
  it("au-delà du cap → too_many", () => {
    const full = Array.from({ length: MAX_EDITABLE_RUNS_PER_BUNDLE }, (_, i) => ({ id: `r${i}`, hasProgress: true }));
    expect(resolveForceNewAction(full)).toEqual({ kind: "too_many" });
  });
  it("reuse-empty prime sur le cap", () => {
    const full = Array.from({ length: MAX_EDITABLE_RUNS_PER_BUNDLE }, (_, i) => ({ id: `r${i}`, hasProgress: i !== 0 }));
    expect(resolveForceNewAction(full)).toEqual({ kind: "reuse", runId: "r0" });
  });
});
```

- [ ] **Step 2 — implémentation**

```ts
/// Plafond souple de demandes éditables par (dossier, citoyen). Anti-abus,
/// jamais atteint en usage normal.
export const MAX_EDITABLE_RUNS_PER_BUNDLE = 20;

export type ForceNewAction =
  | { kind: "reuse"; runId: string }
  | { kind: "create" }
  | { kind: "too_many" };

/// Décide ce que fait « Nouvelle demande » (forceNew) :
///  - un run VIDE existe déjà → on le réutilise (pas de doublon fantôme) ;
///  - sinon, au-delà du plafond → refus (`too_many`) ;
///  - sinon → création d'un nouveau run.
export function resolveForceNewAction(
  existingEditable: { id: string; hasProgress: boolean }[],
  cap: number = MAX_EDITABLE_RUNS_PER_BUNDLE,
): ForceNewAction {
  const empty = existingEditable.find((r) => !r.hasProgress);
  if (empty) return { kind: "reuse", runId: empty.id };
  if (existingEditable.length >= cap) return { kind: "too_many" };
  return { kind: "create" };
}
```

- [ ] **Step 3 — run** : `pnpm vitest run lib/bundles/__tests__/run-creation.test.ts` → PASS.
- [ ] **Step 4 — commit** : `git add lib/bundles/run-creation.ts lib/bundles/__tests__/run-creation.test.ts` → `feat(bundles): add resolveForceNewAction decision helper`.

---

### Task 3: Câbler `forceNew` dans la route de création + guard abandon

**Files:**
- Modify: `app/api/documents/bundles/[id]/run/route.ts` (POST)
- Modify: `app/api/bundles/runs/[runId]/route.ts` (ajout `ensureWriteAllowed`)

**Interfaces:**
- Consumes: `bundleRunHasProgress` (T1), `resolveForceNewAction`/`MAX_EDITABLE_RUNS_PER_BUNDLE` (T2).

- [ ] **Step 1 — POST : lire `forceNew`.** Dans le `try` qui lit le body (là où `eligibilityAnswers` est parsé), ajouter :

```ts
  let forceNew = false;
  // (dans le même bloc try que le parse du body)
  //   const body = await req.json();
  //   eligibilityAnswers = parseEligibilityAnswers(body?.eligibilityAnswers);
  forceNew = body?.forceNew === true;
```

(Adapter : déclarer `let forceNew = false;` avant le `try`, l'assigner dans le `try` après le parse du body ; le `catch` laisse `forceNew=false`.)

- [ ] **Step 2 — POST : brancher la logique forceNew** JUSTE AVANT le bloc « Récupérer un run existant » (`const existingWhere = …`). Import en tête :

```ts
import { bundleRunHasProgress } from "@/lib/bundles/run-progress";
import { resolveForceNewAction, MAX_EDITABLE_RUNS_PER_BUNDLE } from "@/lib/bundles/run-creation";
```

Puis, avant le `existing`/reuse existant :

```ts
  if (forceNew) {
    const editable = await prisma.bundleRun.findMany({
      where: userId
        ? { bundleId: id, userId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } }
        : { bundleId: id, sessionId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } },
      select: { id: true, completedTemplateIds: true, eligibilityAnswers: true, payloads: true },
    });
    const action = resolveForceNewAction(
      editable.map((r) => ({ id: r.id, hasProgress: bundleRunHasProgress(r) })),
    );
    if (action.kind === "too_many") {
      return apiError(409, "Trop de demandes ouvertes pour ce dossier", { code: "too_many_runs" });
    }
    if (action.kind === "reuse") {
      const reused = await prisma.bundleRun.findUnique({ where: { id: action.runId } });
      if (reused) return apiOk({ ...reused, lifecycle: deriveBundleRunLifecycle(reused) });
    }
    // action.kind === "create" → on tombe sur la création plus bas en SAUTANT
    // la réutilisation. On matérialise ça avec un flag local.
  }
```

Pour « sauter la réutilisation » proprement : englober le bloc `const existing = …; if (existing) { … }` dans `if (!forceNew) { … }`. Ainsi, en `forceNew` avec `action.kind==="create"`, on tombe directement sur la génération du code de reprise + `create`.

- [ ] **Step 3 — abandon : ajouter le guard read-only.** Dans `app/api/bundles/runs/[runId]/route.ts`, en tête du `DELETE` (avant le `findUnique`) :

```ts
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
// … au début du DELETE :
  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;
```

- [ ] **Step 4 — build/typecheck** : `npx tsc --noEmit -p tsconfig.json` → 0 erreur.
- [ ] **Step 5 — vérif logique DB** (script tsx jetable dans scratchpad) : POST équivalent `forceNew` sur un dossier de test crée bien un 2ᵉ run quand le 1er a de la progression, et réutilise un run vide. (Optionnel si risque DB ; sinon se fier au typecheck + tests unitaires T1/T2.)
- [ ] **Step 6 — commit** : `git add app/api/documents/bundles/[id]/run/route.ts app/api/bundles/runs/[runId]/route.ts` → `feat(bundles): support forceNew run creation + guard abandon route`.

---

### Task 4: `runId` dans les demandes actives (`/mon-dossier` + home)

**Files:**
- Modify: `lib/landing/resume.ts` (type `ActiveBundleRun` + select + mapping)
- Modify: `app/mon-dossier/mon-dossier-client.tsx` (lien de `ActiveRunCard`, `key`)

**Interfaces:**
- Produces: `ActiveBundleRun.runId: string`.

- [ ] **Step 1 — resume.ts** : ajouter `runId` à l'interface, `id: true` au `select`, et `runId: run.id`… ⚠ le `select` actuel ne prend pas `id` ni ne relie l'`id` du run. Ajouter `id: true` au `select` du `findMany` et mapper.

Interface :

```ts
export interface ActiveBundleRun {
  runId: string;
  slug: string;
  name: string;
  color: string;
  completed: number;
  total: number;
  startedAt: string;
  lifecycle: Extract<BundleRunLifecycle, "in_progress" | "completed_editable">;
}
```

`select` : ajouter `id: true,` à côté de `startedAt: true`. Mapping (dans le `return [{ … }]`) : ajouter `runId: run.id,`.

- [ ] **Step 2 — mon-dossier-client.tsx** :
  - `ActiveRunCard` : changer le `href` de `` `${bundleHref(run.slug)}?demarrer=1` `` en `` `${bundleHref(run.slug)}?bundleRun=${encodeURIComponent(run.runId)}&demarrer=1` ``.
  - La `key` de la liste : remplacer `` key={`${run.slug}-${run.startedAt}`} `` par `key={run.runId}` (unique et stable).

- [ ] **Step 3 — typecheck** : `npx tsc --noEmit -p tsconfig.json` → 0 erreur (le champ `runId` requis force la mise à jour des deux fichiers, cohérence garantie).
- [ ] **Step 4 — commit** : `git add lib/landing/resume.ts app/mon-dossier/mon-dossier-client.tsx` → `feat(mon-dossier): thread runId through active demande cards`.

---

### Task 5: Résumés de demandes (pur) + i18n

**Files:**
- Create: `lib/bundles/demande-summary.ts`
- Test: `lib/bundles/__tests__/demande-summary.test.ts`
- Modify: `messages/fr.json` (namespace `public.dossier`, insertion SURGICALE)

**Interfaces:**
- Consumes: `deriveBundleRunLifecycle` (existant).
- Produces:
  - `interface DemandeSummary { runId: string; index: number; startedAtISO: string; completed: number; total: number; lifecycle: BundleRunLifecycle }`
  - `buildDemandeSummaries(runs: DemandeSummaryInput[], total: number): DemandeSummary[]` (triées récent→ancien ; `index` 1-based = ordre de création par `startedAt`).

- [ ] **Step 1 — test**

```ts
import { describe, it, expect } from "vitest";
import { buildDemandeSummaries } from "../demande-summary";

const R = (id: string, startedAt: string, completed: string[] = [], status = "in_progress", completedAt: string | null = null) =>
  ({ id, startedAt, completedTemplateIds: completed, status, completedAt });

describe("buildDemandeSummaries", () => {
  it("numérote par ordre de création (startedAt) et renvoie récent→ancien", () => {
    const out = buildDemandeSummaries(
      [R("b", "2026-07-02T10:00:00Z"), R("a", "2026-07-01T10:00:00Z"), R("c", "2026-07-03T10:00:00Z")],
      5,
    );
    expect(out.map((d) => [d.runId, d.index])).toEqual([["c", 3], ["b", 2], ["a", 1]]);
  });
  it("clampe la progression au total et calcule le lifecycle", () => {
    const out = buildDemandeSummaries([R("a", "2026-07-01T10:00:00Z", ["x", "y", "z"], "completed", "2026-07-01T12:00:00Z")], 2);
    expect(out[0].completed).toBe(2);
    expect(out[0].total).toBe(2);
    expect(out[0].lifecycle).toBe("completed_editable");
  });
});
```

- [ ] **Step 2 — implémentation**

```ts
import {
  deriveBundleRunLifecycle,
  type BundleRunLifecycle,
} from "./run-lifecycle";

export interface DemandeSummaryInput {
  id: string;
  startedAt: Date | string;
  completedTemplateIds: unknown;
  status: string;
  completedAt: Date | string | null;
  anonymizedAt?: Date | string | null;
}

export interface DemandeSummary {
  runId: string;
  /// Numéro d'ordre de CRÉATION (1-based), stable — sert le libellé « Demande n°N ».
  index: number;
  startedAtISO: string;
  completed: number;
  total: number;
  lifecycle: BundleRunLifecycle;
}

const toISO = (v: Date | string): string =>
  typeof v === "string" ? v : v.toISOString();

/// Construit les résumés affichables des demandes d'un dossier. `index` est
/// assigné par ordre de création (startedAt asc) ; la liste renvoyée est
/// ordonnée récent→ancien pour l'affichage.
export function buildDemandeSummaries(
  runs: DemandeSummaryInput[],
  total: number,
): DemandeSummary[] {
  const byCreation = [...runs].sort(
    (a, b) => toISO(a.startedAt).localeCompare(toISO(b.startedAt)),
  );
  const indexByRun = new Map<string, number>();
  byCreation.forEach((run, i) => indexByRun.set(run.id, i + 1));

  return [...runs]
    .sort((a, b) => toISO(b.startedAt).localeCompare(toISO(a.startedAt)))
    .map((run) => {
      const completedIds = Array.isArray(run.completedTemplateIds)
        ? (run.completedTemplateIds as string[])
        : [];
      return {
        runId: run.id,
        index: indexByRun.get(run.id) ?? 1,
        startedAtISO: toISO(run.startedAt),
        completed: Math.min(completedIds.length, total),
        total,
        lifecycle: deriveBundleRunLifecycle(run),
      };
    });
}
```

- [ ] **Step 3 — run** : `pnpm vitest run lib/bundles/__tests__/demande-summary.test.ts` → PASS.
- [ ] **Step 4 — i18n** : insérer dans `messages/fr.json`, dans l'objet `public.dossier`, les clés (insertion surgicale, garder CRLF ; NL/EN → fallback FR géré ailleurs, ne pas bloquer) :

```
"demandesTitle": "Mes demandes",
"demandesSubtitle": "Reprends une demande existante ou démarre-en une nouvelle.",
"demandeLabel": "Demande n°{index}",
"demandeStartedOn": "Démarrée le {date}",
"demandeProgress": "{completed}/{total} documents",
"demandeResume": "Reprendre",
"demandeReview": "Revoir",
"demandeAbandon": "Abandonner",
"demandeAbandonConfirm": "Abandonner cette demande ? Elle disparaîtra de ta liste (les données sont conservées).",
"demandeNew": "Nouvelle demande",
"demandeNewError": "Impossible de créer une nouvelle demande.",
"demandeTooMany": "Tu as trop de demandes ouvertes pour ce dossier."
```

- [ ] **Step 5 — i18n check** : `pnpm i18n:check` → pas de NOUVELLE erreur imputable (FR complet ; autres langues en fallback).
- [ ] **Step 6 — commit** : `git add lib/bundles/demande-summary.ts lib/bundles/__tests__/demande-summary.test.ts messages/fr.json` → `feat(bundles): demande summaries helper + i18n keys`.

---

### Task 6: Bouton « Nouvelle demande » (client)

**Files:**
- Create: `components/docbel/nouvelle-demande-button.tsx`

**Interfaces:**
- Consumes: route POST `/api/documents/bundles/[bundleId]/run` `{ forceNew: true }`.
- Produces: `<NouvelleDemandeButton bundleId slug variant? />`.

- [ ] **Step 1 — composant**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  bundleId: string;
  slug: string;
  variant?: "default" | "outline" | "ghost";
}

/// Crée une NOUVELLE demande (BundleRun dissocié) pour ce dossier puis navigue
/// dessus. Réutilise un run vide s'il en existe (garde-fou serveur).
export function NouvelleDemandeButton({ bundleId, slug, variant = "outline" }: Props) {
  const t = useTranslations("public.dossier");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createDemande() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/bundles/${encodeURIComponent(bundleId)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceNew: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) {
        toast.error(data?.code === "too_many_runs" ? t("demandeTooMany") : t("demandeNewError"));
        return;
      }
      router.push(`/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(data.id)}&demarrer=1`);
    } catch {
      toast.error(t("demandeNewError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant={variant} size="lg" className="min-h-11" onClick={createDemande} disabled={loading}>
      <Plus data-icon="inline-start" aria-hidden />
      {t("demandeNew")}
    </Button>
  );
}
```

- [ ] **Step 2 — typecheck** : `npx tsc --noEmit` → 0. (Le rendu réel est exercé en Task 8.)
- [ ] **Step 3 — commit** : `git add components/docbel/nouvelle-demande-button.tsx` → `feat(dossier): NouvelleDemandeButton`.

---

### Task 7: Écran « Mes demandes » (client)

**Files:**
- Create: `components/docbel/demande-list.tsx`

**Interfaces:**
- Consumes: `DemandeSummary` (T5) sérialisé, `NouvelleDemandeButton` (T6), `DELETE /api/bundles/runs/[runId]` (existant).
- Produces: `<DemandeList bundleId slug bundleName demandes={DemandeSummary[]} />`.

- [ ] **Step 1 — composant** (glass ; libellé « Demande n°N · Démarrée le … · x/total » ; Reprendre/Revoir + Abandonner + Nouvelle demande) :

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";
import { NouvelleDemandeButton } from "./nouvelle-demande-button";

interface Props {
  bundleId: string;
  slug: string;
  bundleName: string;
  demandes: DemandeSummary[];
}

export function DemandeList({ bundleId, slug, bundleName, demandes }: Props) {
  const t = useTranslations("public.dossier");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(demandes);
  const [busy, setBusy] = useState<string | null>(null);
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

  async function abandon(runId: string) {
    if (busy) return;
    if (!window.confirm(t("demandeAbandonConfirm"))) return;
    setBusy(runId);
    try {
      const res = await fetch(`/api/bundles/runs/${encodeURIComponent(runId)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        toast.error(t("demandeNewError"));
        return;
      }
      setItems((prev) => prev.filter((d) => d.runId !== runId));
      router.refresh();
    } catch {
      toast.error(t("demandeNewError"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="glass-surface flex flex-col gap-4 rounded-3xl p-4 sm:p-5" data-docbel-readable>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]" aria-hidden><FolderOpen /></span>
          <div>
            <h2 className="text-xl font-bold text-[color:var(--glass-ink)]">{t("demandesTitle")}</h2>
            <p className="mt-1 text-sm text-[color:var(--glass-ink-soft)]">{bundleName} · {t("demandesSubtitle")}</p>
          </div>
        </div>
        <NouvelleDemandeButton bundleId={bundleId} slug={slug} variant="default" />
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((d) => {
          const completed = d.lifecycle === "completed_editable";
          const percentage = completed ? 100 : d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0;
          return (
            <li key={d.runId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]" aria-hidden><FolderOpen className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[color:var(--glass-ink)]">{t("demandeLabel", { index: d.index })}</span>
                <span className="mt-0.5 block text-xs text-[color:var(--glass-ink)]/65">
                  {t("demandeStartedOn", { date: fmtDate(d.startedAtISO) })} · {t("demandeProgress", { completed: d.completed, total: d.total })}
                </span>
              </span>
              <span className="hidden w-24 flex-col gap-1 sm:flex">
                <span className="text-xs font-semibold text-[color:var(--glass-ink)]/70">{percentage}%</span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--glass-ink-line)]" aria-hidden>
                  <span className="block h-full rounded-full bg-[color:var(--glass-accent-deep)]" style={{ width: `${percentage}%` }} />
                </span>
              </span>
              <Button type="button" variant="ghost" size="sm" className="min-h-10 text-destructive" onClick={() => abandon(d.runId)} disabled={busy === d.runId} aria-label={t("demandeAbandon")}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
              <Button asChild={false} type="button" variant="outline" size="sm" className="min-h-10" onClick={() => router.push(`/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(d.runId)}&demarrer=1`)}>
                {completed ? t("demandeReview") : t("demandeResume")}
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

(NB : si `Button` ne supporte pas `asChild={false}`, retirer la prop — c'est le défaut. Vérifier la signature `Button` base-ui pendant l'exécution ; `render`/`asChild` cf. [[reference-ui-gotchas]].)

- [ ] **Step 2 — typecheck** : `npx tsc --noEmit` → 0.
- [ ] **Step 3 — commit** : `git add components/docbel/demande-list.tsx` → `feat(dossier): Mes demandes list screen`.

---

### Task 8: Branchement hybride sur `/d/[slug]` + bouton dans le runner

**Files:**
- Modify: `app/d/[slug]/page.tsx`
- Modify: `components/docbel/bundle-runner.tsx` (bouton « Nouvelle demande » sur l'écran mono-demande)

**Interfaces:**
- Consumes: `bundleRunHasProgress` (T1), `buildDemandeSummaries` (T5), `DemandeList` (T7), `NouvelleDemandeButton` (T6).

- [ ] **Step 1 — page : accepter `?bundleRun` + lister les runs.**
  - Étendre le type `searchParams` : `{ demarrer?: string; bundleRun?: string }`.
  - Remplacer la résolution mono-run (`findFirst`) par : charger TOUS les runs éditables du (bundle, user/session) en `findMany` (`orderBy startedAt desc`, `select` : `id, startedAt, status, completedAt, anonymizedAt, completedTemplateIds, eligibilityAnswers, payloads, resumeCode, resumeCodeExpiresAt, resumeEmail`).
  - Remplacer l'inline `runHasProgress` par `bundleRunHasProgress(run)` (import T1).
  - Runs « avec progression » = `allRuns.filter(bundleRunHasProgress)`.
  - Résolution du run courant :
    - si `bundleRun` param présent ET appartient à un run de `allRuns` non abandonné → `run = ce run` (ouverture directe).
    - sinon si `runsWithProgress.length >= 2` ET pas de `?bundleRun` ET pas de `?demarrer=1` → rendre `<DemandeList …>` (voir Step 3) et `return`.
    - sinon → `run = runsWithProgress[0] ?? null` (comportement actuel : 0/1).
  - Le reste (payloads, triggers, journey, runnerProps) reste basé sur `effectiveRun = run` (la garde `runHasProgress` devient : `run` est déjà « avec progression » par construction, ou le param a ciblé un run précis — garder `bundleRunHasProgress(run)` pour un run ciblé qui serait vide).

- [ ] **Step 2 — page : imports**

```ts
import { bundleRunHasProgress } from "@/lib/bundles/run-progress";
import { buildDemandeSummaries } from "@/lib/bundles/demande-summary";
import { DemandeList } from "@/components/docbel/demande-list";
```

- [ ] **Step 3 — page : branche « Mes demandes »** (avant la construction des runnerProps, quand 2+ et pas de sélection/démarrage) :

```tsx
  const summaries = buildDemandeSummaries(
    runsWithProgress.map((r) => ({
      id: r.id, startedAt: r.startedAt, completedTemplateIds: r.completedTemplateIds,
      status: r.status, completedAt: r.completedAt, anonymizedAt: r.anonymizedAt,
    })),
    bundle.items.length,
  );
  // (rendu dans le JSX, sous le breadcrumb)
  // return <DemandeList bundleId={bundle.id} slug={bundle.slug} bundleName={bundle.name} demandes={summaries} />;
```

Intégration : dans le `return (<div className="w-full"> … </div>)`, remplacer le bloc `{(() => { … })()}` par une garde : si `showDemandeList` → `<DemandeList … />`, sinon le IIFE existant. Définir `const showDemandeList = runsWithProgress.length >= 2 && !bundleRunParam && !autoStart;` où `bundleRunParam = (await searchParams).bundleRun`.

- [ ] **Step 4 — runner : bouton « Nouvelle demande » sur l'écran mono-demande.** Dans `components/docbel/bundle-runner.tsx`, là où la section documents est rendue avec un `runId` non nul (près du `completedCount`/en-tête, cf. lignes ~379), ajouter, quand `runId` existe :

```tsx
import { NouvelleDemandeButton } from "./nouvelle-demande-button";
// … dans le JSX, en tête ou pied de la section documents, quand runId :
{runId && (
  <NouvelleDemandeButton bundleId={bundle.id} slug={bundle.slug} variant="ghost" />
)}
```

(Placement discret ; s'assurer que `bundle.id` et `bundle.slug` sont dans les props `bundle` — ils y sont, cf. `serializedBundle`.)

- [ ] **Step 5 — typecheck + build** : `npx tsc --noEmit` → 0 ; `pnpm build` → OK (ou échec PRÉ-EXISTANT documenté slugs `[bundleRunId]`/`[id]` uniquement — vérifier que l'erreur, si présente, n'est PAS dans les fichiers touchés).
- [ ] **Step 6 — commit** : `git add app/d/[slug]/page.tsx components/docbel/bundle-runner.tsx` → `feat(dossier): hybrid multi-demande entry on /d/[slug] + runner button`.

---

### Task 9: Vérification finale

**Files:** (aucune modif ; vérif)

- [ ] **Step 1 — suite ciblée** : `pnpm vitest run lib/bundles` → tous verts (nouveaux helpers inclus).
- [ ] **Step 2 — typecheck global** : `npx tsc --noEmit -p tsconfig.json` → 0 erreur.
- [ ] **Step 3 — lint fichiers touchés** : `npx eslint <fichiers modifiés/créés>` → exit 0 (aucune nouvelle erreur).
- [ ] **Step 4 — build** : `pnpm build` → succès (ou uniquement l'échec PRÉ-EXISTANT connu, hors fichiers touchés).
- [ ] **Step 5 — vérif flux (script tsx jetable, scratchpad)** : sur un dossier de test, simuler : (a) créer un run + progression, (b) `resolveForceNewAction` → create, (c) 2 runs → `buildDemandeSummaries` renvoie 2 résumés numérotés, (d) `bundleRunHasProgress` cohérent. Confirmer par lecture DB.
- [ ] **Step 6 — commit final éventuel** (si ajustements) + rapport.

---

## Self-Review (couverture spec)

- Multi-run sans migration → Tasks 1-8 (aucune migration). ✔
- `forceNew` + garde vide + cap → Task 2/3. ✔
- Abandon soft-delete → réutilise `DELETE /api/bundles/runs/[runId]` (existant) + guard (Task 3). ✔
- `?bundleRun` + hybride 0/1/2+ → Task 8. ✔
- « Mes demandes » (libellé calculé, Reprendre/Revoir/Abandonner) → Task 5/7. ✔
- « Nouvelle demande » → Task 6, câblé Task 7/8. ✔
- `runId` dans `/mon-dossier` → Task 4. ✔
- Isolation (pas de prefill croisé) → acquis (aucune modif nécessaire). ✔
- Tests : helpers purs T1/T2/T5 ; typecheck garantit la cohérence des composants/pages. ✔

**Décisions prises seul (Oraliks absent) :** cap = 20 ; libellé « Demande n°N » + date + x/total ; bouton runner en `variant ghost` discret ; abandon = confirm() natif (pas de modale dédiée, cohérent avec le reset existant). Ajustables au retour.
