# Gating téléchargement documents compagnons C1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher le téléchargement d'un document (ex. le C1) tant que les documents compagnons qu'il déclenche (ex. C1C, C1A...) ne sont pas eux aussi complétés — verrou sur le dossier entier, pas juste un document désigné — puis offrir un écran final "Mes documents" avec téléchargement individuel (existant), zip groupé et envoi par mail.

**Architecture:** Un formulaire complété dans un dossier devient une "Validation" (sauvegarde du payload, aucun PDF généré) au lieu d'un téléchargement immédiat. Une nouvelle fonction pure `deriveMissingDocs` (réutilisant `computeItemStatuses` déjà testé) calcule si le dossier est complet ; elle est appelée côté serveur avant tout téléchargement/zip/mail pour un `bundleRunId` donné. Aucun PDF n'est stocké : zip et mail régénèrent chaque PDF à la volée depuis les payloads déjà validés dans `BundleRun.payloads`.

**Tech Stack:** Next.js 16 route handlers, Prisma 5, Zod 4, `adm-zip` (déjà une dépendance), `resend` (déjà utilisé pour les mails de `lib/booking/emails.ts`), vitest.

## Global Constraints

- Ne jamais utiliser `prisma db push` (base Neon partagée) — ce plan n'ajoute aucune migration de schéma, seulement du code.
- `git add` de chemins explicites uniquement (workdir multi-agents partagé).
- Max 3-5 fichiers par lot de commit — chaque tâche ci-dessous committe son propre périmètre.
- `pnpm lint` a ~74 erreurs pré-existantes à ne pas dépasser ; `pnpm test` doit rester vert (1330+ tests).
- Pas de nouvelle dépendance : `adm-zip`/`@types/adm-zip` et `resend` sont déjà dans `package.json`.
- RGPD : aucun PDF n'est stocké — toute génération est éphémère (mémoire), jamais écrite sur disque/DB.
- Toute nouvelle route qui reçoit un `bundleRunId` DOIT vérifier la propriété du run (`userId` de session, sinon cookie `beldoc-bundle-session`) avant de lire/générer quoi que ce soit — un `bundleRunId` deviné ne doit jamais exposer les documents d'un autre citoyen.

## File Structure

**Créés :**
- `lib/bundles/completion.ts` — calcul pur (`deriveMissingDocs`) + chargement DB avec vérification de propriété (`loadDossierState`).
- `lib/bundles/__tests__/completion.test.ts` — tests de `deriveMissingDocs`.
- `lib/bundles/regenerate-pdfs.ts` — régénère tous les PDF complétés d'un run (Buffers en mémoire), réutilisé par le zip et le mail.
- `app/api/documents/bundles/[bundleRunId]/download-all/route.ts` — zip de tous les documents complétés.
- `app/api/documents/bundles/[bundleRunId]/email/route.ts` — envoi par mail (Resend, pièces jointes).

**Modifiés :**
- `app/api/pdf/[slug]/generate/route.ts` — nouveau mode `delivery: "save"` + verrou serveur sur `download`/`doccle` quand `bundleRunId` est fourni.
- `components/pdf-forms/document-page-layout.tsx` — transmet `bundleSlug` au runner (manquant aujourd'hui).
- `lib/pdf-forms/public-serializer.ts` — expose `triggers` sur `PublicForm` (absent aujourd'hui).
- `components/pdf-forms/pdf-form-runner.tsx` — CTA "Valider et continuer" en contexte dossier, notice standalone + en direct, redirection.
- `components/docbel/bundle-roadmap.tsx` — boutons "Tout télécharger (.zip)" et "Envoyer par mail".
- `components/docbel/bundle-runner.tsx` — passe `runId`/email de session à `BundleRoadmap`.
- `app/d/[slug]/page.tsx` — passe l'email de session à `BundleRunner`.
- `lib/dossiers/types.ts` — champ `responsibilityUrl?: Localized`.
- `lib/dossiers/allocations-insertion/index.ts` — lien Actiris sur l'A15.
- `messages/fr.json` — nouvelles clés (FR uniquement ; NL/DE/etc. restent en avertissement non-bloquant, cf. `pnpm i18n:check`).

**Non modifiés (vérifié, réutilisés tels quels) :** `lib/pdf-forms/triggers.ts` (`collectAllTriggeredSlugs`), `components/docbel/bundle-runner/compute.ts` (`computeItemStatuses`), `app/d/[slug]/page.tsx` (matérialisation des triggers, déjà correcte).

---

## Task 1: [MANUEL — action admin, aucun code] Publier les 7 formulaires compagnons

**Contexte :** vérifié en DB le 2026-07-10 (dry-run `scripts/apply-c1-improvements.ts` + requête statut) : `c1a`, `c1b`, `c1c`, `c46`, `c47`, `c1-partenaire`, `c1-regis` ont déjà les bons champs/triggers mais sont tous en statut `draft`. La requête de matérialisation des triggers (`app/d/[slug]/page.tsx:135`, filtre `status: "published", active: true`) les exclut donc tous — c'est la cause racine immédiate.

- [ ] **Étape 1 : Vérifier l'état actuel**

Lancer un dry-run pour confirmer l'état avant de publier :

```bash
pnpm tsx scripts/apply-c1-improvements.ts
```

Attendu : les 7 slugs (`c1a`, `c1b`, `c1c`, `c46`, `c47`, `c1-partenaire`, `c1-regis`) apparaissent avec `Triggers avant = Triggers après` (aucun changement de champs/triggers nécessaire — seul le statut doit changer).

- [ ] **Étape 2 : Publier chaque formulaire via l'admin**

Dans `/admin/pdf-forms`, pour chacun des 7 slugs : ouvrir le formulaire, vérifier l'aperçu (aucun champ cassé), puis passer le statut de `draft` à `published`.

- [ ] **Étape 3 : Vérifier en base**

```bash
cat > /tmp/check-status.ts << 'EOF'
import { prisma } from "@/lib/prisma";
async function main() {
  const slugs = ["c1a","c1b","c1c","c46","c47","c1-partenaire","c1-regis"];
  const forms = await prisma.pdfForm.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, status: true, active: true },
  });
  console.log(forms);
}
main().finally(() => prisma.$disconnect());
EOF
pnpm tsx /tmp/check-status.ts
rm /tmp/check-status.ts
```

Attendu : les 7 lignes affichent `status: 'published', active: true`.

- [ ] **Étape 4 : Vérification manuelle du parcours**

Visiter `/d/allocations-insertion`, démarrer/reprendre un dossier, ouvrir le C1, répondre `oui` à la question tremplin-indépendants + "pas déjà déclaré". Revenir au parcours (`/d/allocations-insertion`) : le C1C doit maintenant apparaître dans la liste des documents avec le badge "déclenché". (Aucun commit — ce n'est pas un changement de code.)

---

## Task 2: `deriveMissingDocs` — calcul pur de complétion + `loadDossierState`

**Files:**
- Create: `lib/bundles/completion.ts`
- Test: `lib/bundles/__tests__/completion.test.ts`

**Interfaces:**
- Consumes: `computeItemStatuses`, `type BundleItem`, `type ItemStatus` (`@/components/docbel/bundle-runner/compute`, existant, inchangé) ; `collectAllTriggeredSlugs`, `type BundleItemForTriggers` (`@/lib/pdf-forms/triggers`, existant) ; `BundleCondition` (`@/lib/bundles/conditions`) ; `getDossier` (`@/lib/dossiers/registry`) ; `selectDocuments` (`@/lib/dossiers/types`) ; `parseEligibilityAnswers` (`@/lib/bundles/eligibility`) ; `prisma` (`@/lib/prisma`).
- Produces: `export interface MissingDoc { slug: string; title: string }` ; `export function deriveMissingDocs(items: BundleItem[], completedTemplateIds: string[], payloads: Record<string, Record<string, unknown>>, applicableSlugs: string[] | null): { allRequiredDone: boolean; missing: MissingDoc[] }` (pur) ; `export interface DossierState { run: { id: string; bundleSlug: string }; allRequiredDone: boolean; missing: MissingDoc[]; items: BundleItem[]; completedTemplateIds: string[]; payloads: Record<string, Record<string, unknown>> }` ; `export async function loadDossierState(bundleRunId: string, ownership: { userId: string | null; sessionId: string | null }): Promise<DossierState | null>` — consommé par Task 3 (verrou generate), Task 6 (régénération), Task 7/8 (routes zip/mail).

- [ ] **Step 1: Write the failing test**

Create `lib/bundles/__tests__/completion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveMissingDocs } from "../completion";
import type { BundleItem } from "@/components/docbel/bundle-runner/compute";

function item(overrides: Partial<BundleItem> & { id: string }): BundleItem {
  return {
    id: overrides.id,
    templateId: null,
    pdfFormId: overrides.pdfFormId ?? `form-${overrides.id}`,
    order: overrides.order ?? 0,
    required: overrides.required ?? true,
    condition: overrides.condition ?? null,
    template: null,
    triggered: overrides.triggered,
    pdfForm: overrides.pdfForm ?? {
      id: overrides.pdfFormId ?? `form-${overrides.id}`,
      slug: overrides.id,
      title: `Doc ${overrides.id}`,
      description: null,
      issuer: null,
    },
  };
}

describe("deriveMissingDocs", () => {
  it("dossier complet : allRequiredDone=true, missing=[]", () => {
    const items = [item({ id: "c1" }), item({ id: "c1c", triggered: true })];
    const result = deriveMissingDocs(items, ["form-c1", "form-c1c"], {}, null);
    expect(result).toEqual({ allRequiredDone: true, missing: [] });
  });

  it("un document déclenché non complété bloque tout, y compris le document d'origine déjà rempli", () => {
    const items = [item({ id: "c1" }), item({ id: "c1c", triggered: true })];
    // Le C1 est complété mais PAS le C1C qu'il a déclenché : le dossier
    // reste incomplet (verrou dossier entier, pas juste le C1C).
    const result = deriveMissingDocs(items, ["form-c1"], {}, null);
    expect(result.allRequiredDone).toBe(false);
    expect(result.missing).toEqual([{ slug: "c1c", title: "Doc c1c" }]);
  });

  it("un document non requis manquant ne bloque pas", () => {
    const items = [
      item({ id: "c1" }),
      item({ id: "optionnel", required: false }),
    ];
    const result = deriveMissingDocs(items, ["form-c1"], {}, null);
    expect(result).toEqual({ allRequiredDone: true, missing: [] });
  });

  it("un document hors dossier (applicableSlugs) n'est jamais compté manquant", () => {
    const items = [item({ id: "c1" }), item({ id: "c109-36-etranger" })];
    const result = deriveMissingDocs(items, ["form-c1"], {}, ["c1"]);
    expect(result).toEqual({ allRequiredDone: true, missing: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/bundles/__tests__/completion.test.ts`
Expected: FAIL — `Cannot find module '../completion'` (le fichier n'existe pas encore).

- [ ] **Step 3: Write the module**

Create `lib/bundles/completion.ts`:

```ts
// Calcule si un dossier (BundleRun) est complet — tous les documents requis,
// de base ET déclenchés par les réponses données, sont-ils complétés ?
//
// Réutilisé par : la route generate (verrou download/doccle), la route
// download-all (zip), la route email — jamais dupliqué, un seul calcul.

import { prisma } from "@/lib/prisma";
import {
  computeItemStatuses,
  type BundleItem,
} from "@/components/docbel/bundle-runner/compute";
import {
  collectAllTriggeredSlugs,
  type BundleItemForTriggers,
} from "@/lib/pdf-forms/triggers";
import type { BundleCondition } from "@/lib/bundles/conditions";
import { parseEligibilityAnswers } from "@/lib/bundles/eligibility";
import { getDossier } from "@/lib/dossiers/registry";
import { selectDocuments, type DossierAnswers } from "@/lib/dossiers/types";

export interface MissingDoc {
  slug: string;
  title: string;
}

/// Calcul PUR : donné l'état déjà chargé d'un dossier, quels documents
/// requis (visibles, non exclus par condition/dossier) manquent encore ?
/// `allRequiredDone` vrai ⇔ `missing` vide.
export function deriveMissingDocs(
  items: BundleItem[],
  completedTemplateIds: string[],
  payloads: Record<string, Record<string, unknown>>,
  applicableSlugs: string[] | null,
): { allRequiredDone: boolean; missing: MissingDoc[] } {
  const { requiredVisible, allRequiredDone } = computeItemStatuses(
    items,
    completedTemplateIds,
    payloads,
    applicableSlugs,
  );
  const missing: MissingDoc[] = requiredVisible
    .filter((s) => !s.completed)
    .map((s) => ({
      slug: s.item.pdfForm?.slug ?? s.item.id,
      title: s.item.pdfForm?.title ?? "Document",
    }));
  return { allRequiredDone, missing };
}

export interface DossierState {
  run: { id: string; bundleSlug: string };
  allRequiredDone: boolean;
  missing: MissingDoc[];
  items: BundleItem[];
  completedTemplateIds: string[];
  payloads: Record<string, Record<string, unknown>>;
}

/// Charge un BundleRun + vérifie sa propriété (userId de session, sinon
/// cookie de session anonyme) + calcule sa complétion. Retourne `null` si le
/// run n'existe pas, n'est plus `in_progress`, OU n'appartient pas à
/// l'appelant — un seul cas `null` pour ne jamais distinguer "inexistant" de
/// "pas à toi" côté réponse HTTP (évite toute fuite d'existence).
export async function loadDossierState(
  bundleRunId: string,
  ownership: { userId: string | null; sessionId: string | null },
): Promise<DossierState | null> {
  const run = await prisma.bundleRun.findUnique({
    where: { id: bundleRunId },
    include: {
      bundle: {
        include: {
          items: {
            orderBy: { order: "asc" },
            include: {
              pdfForm: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  description: true,
                  issuer: true,
                  triggers: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!run || run.status !== "in_progress") return null;
  const owns = ownership.userId
    ? run.userId === ownership.userId
    : ownership.sessionId
      ? run.sessionId === ownership.sessionId
      : false;
  if (!owns) return null;

  const payloads = (run.payloads as Record<string, Record<string, unknown>>) || {};
  const completedTemplateIds = (run.completedTemplateIds as string[]) || [];

  const triggeredSlugsList = collectAllTriggeredSlugs(
    run.bundle.items.map(
      (it): BundleItemForTriggers => ({
        pdfFormId: it.pdfFormId,
        pdfFormSlug: it.pdfForm?.slug ?? null,
        rawTriggers: it.pdfForm?.triggers,
      }),
    ),
    payloads,
  );
  const triggeredSlugs = new Set(triggeredSlugsList);

  const triggeredForms =
    triggeredSlugs.size > 0
      ? await prisma.pdfForm.findMany({
          where: { slug: { in: [...triggeredSlugs] }, status: "published", active: true },
          select: { id: true, slug: true, title: true, description: true, issuer: true },
        })
      : [];

  const items: BundleItem[] = [
    ...run.bundle.items.map((it) => ({
      id: it.id,
      templateId: null,
      pdfFormId: it.pdfFormId,
      order: it.order,
      required: it.required,
      condition: (it.condition as unknown as BundleCondition) ?? null,
      template: null,
      triggered: false as const,
      pdfForm: it.pdfForm
        ? {
            id: it.pdfForm.id,
            slug: it.pdfForm.slug,
            title: it.pdfForm.title,
            description: it.pdfForm.description,
            issuer: it.pdfForm.issuer,
          }
        : null,
    })),
    ...triggeredForms.map((f, idx) => ({
      id: `triggered-${f.id}`,
      templateId: null,
      pdfFormId: f.id,
      order: run.bundle.items.length + idx,
      required: true,
      condition: null,
      template: null,
      triggered: true as const,
      pdfForm: { id: f.id, slug: f.slug, title: f.title, description: f.description, issuer: f.issuer },
    })),
  ];

  const dossier = getDossier(run.bundle.slug);
  const eligibilityAnswers = parseEligibilityAnswers(run.eligibilityAnswers);
  const selectedDocs = dossier
    ? selectDocuments(dossier, eligibilityAnswers as unknown as DossierAnswers)
    : null;
  const applicableSlugs = selectedDocs
    ? [...selectedDocs.map((d) => d.slug), ...triggeredSlugs]
    : null;

  const { allRequiredDone, missing } = deriveMissingDocs(
    items,
    completedTemplateIds,
    payloads,
    applicableSlugs,
  );

  return {
    run: { id: run.id, bundleSlug: run.bundle.slug },
    allRequiredDone,
    missing,
    items,
    completedTemplateIds,
    payloads,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/bundles/__tests__/completion.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run full test suite + build**

Run: `pnpm test && pnpm build`
Expected: PASS (aucune régression — nouveau fichier, rien d'existant modifié).

- [ ] **Step 6: Commit**

```bash
git add lib/bundles/completion.ts lib/bundles/__tests__/completion.test.ts
git commit -m "feat(bundles): deriveMissingDocs + loadDossierState (verrou dossier entier)"
```

---

## Task 3: Route generate — mode `save` + verrou serveur

**Files:**
- Modify: `app/api/pdf/[slug]/generate/route.ts`

**Interfaces:**
- Consumes: `loadDossierState`, `type MissingDoc` (Task 2, `@/lib/bundles/completion`).
- Produces: réponse `{ ok: true, saved: true, newlyTriggered: MissingDoc[] }` pour `delivery: "save"` ; réponse `409 { error: "dossier_incomplete", missing: MissingDoc[] }` quand `delivery` est `download`/`doccle`, qu'un `bundleRunId` est fourni, et que le dossier n'est pas complet — consommé par Task 5 (runner).

- [ ] **Step 1: Lire le fichier actuel pour repérer les points d'ancrage**

Le fichier actuel (`app/api/pdf/[slug]/generate/route.ts`) contient, après la résolution de `delivery` (ligne ~56) :

```ts
  const lang: Locale = isLocale(body.locale) ? body.locale : (form.defaultLocale as Locale);
  const delivery = body.delivery === "doccle" ? "doccle" : "download";
  if (delivery === "doccle" && !(form.allowDoccle && isDoccleConfigured())) {
    return NextResponse.json({ error: "Envoi Doccle indisponible" }, { status: 400, headers: json });
  }
  if (delivery === "download" && !form.allowDownload) {
    return NextResponse.json({ error: "Téléchargement désactivé" }, { status: 400, headers: json });
  }
```

et, plus loin, le bloc qui persiste le payload dans le `BundleRun` (ligne ~122-149) :

```ts
  const bundleRunId = typeof body.bundleRunId === "string" ? body.bundleRunId : null;
  if (bundleRunId) {
    try {
      const run = await prisma.bundleRun.findUnique({ where: { id: bundleRunId } });
      if (run && run.status === "in_progress") {
        const currentPayloads = (run.payloads as Record<string, unknown>) || {};
        const currentCompleted = (run.completedTemplateIds as string[]) || [];
        const newPayloads = { ...currentPayloads, [form.id]: validated };
        const newCompleted = currentCompleted.includes(form.id)
          ? currentCompleted
          : [...currentCompleted, form.id];
        await prisma.bundleRun.update({
          where: { id: bundleRunId },
          data: {
            payloads: newPayloads as unknown as Prisma.InputJsonValue,
            completedTemplateIds: newCompleted as unknown as Prisma.InputJsonValue,
          },
        });
      }
    } catch (err) {
      // Non-bloquant : la génération du PDF a déjà réussi ; on log juste.
      console.error("[pdf-generate] BundleRun update failed:", err);
    }
  }
```

- [ ] **Step 2: Ajouter le mode `save` et le verrou, écrire d'abord un test manuel de non-régression**

Avant de modifier, noter le comportement actuel à préserver : sans `bundleRunId`, ou avec `delivery` absent d'un contexte dossier, RIEN ne change. Ce fichier n'a pas de test automatisé existant (convention du projet : les routes API sont vérifiées manuellement/par build, seules les fonctions pures `lib/` sont testées en vitest) — la vérification se fera à l'Étape 5 (manuelle) et via `pnpm build` (typecheck).

- [ ] **Step 3: Modifier la résolution de `delivery` + le calcul de propriété**

Remplacer le bloc de l'Étape 1 (la partie `delivery`) :

```ts
  const lang: Locale = isLocale(body.locale) ? body.locale : (form.defaultLocale as Locale);
  const delivery: "download" | "doccle" | "save" =
    body.delivery === "doccle" ? "doccle" : body.delivery === "save" ? "save" : "download";
  if (delivery === "doccle" && !(form.allowDoccle && isDoccleConfigured())) {
    return NextResponse.json({ error: "Envoi Doccle indisponible" }, { status: 400, headers: json });
  }
  if (delivery === "download" && !form.allowDownload) {
    return NextResponse.json({ error: "Téléchargement désactivé" }, { status: 400, headers: json });
  }

  const bundleRunId = typeof body.bundleRunId === "string" ? body.bundleRunId : null;
```

(Le `const bundleRunId = ...` est déplacé plus haut — il sera retiré de son emplacement plus bas à l'Étape 5.)

- [ ] **Step 4: Ajouter l'import**

En haut du fichier, à la suite des imports existants :

```ts
import { loadDossierState } from "@/lib/bundles/completion";
```

- [ ] **Step 5: Ajouter le verrou avant génération + le mode `save` après validation**

Juste après le bloc de validation Zod existant (`const validated = result.data as FormPayload;`, ligne ~93) et AVANT `const source = await readSourcePdf(...)`, insérer :

```ts
  // Propriété du run (même logique que app/api/documents/bundles/[id]/run/route.ts) :
  // userId de session si connecté, sinon cookie de session anonyme.
  const session0 = await auth.api.getSession({ headers: await headers() });
  const ownerUserId = session0?.user?.id || null;
  const ownerSessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  // Mode "save" : valide + persiste, ne génère AUCUN PDF. Utilisé quand ce
  // formulaire est rempli à l'intérieur d'un dossier (bundleRunId fourni) —
  // le téléchargement se fait plus tard, groupé, une fois tout complété.
  if (delivery === "save") {
    if (!bundleRunId) {
      return NextResponse.json({ error: "bundleRunId requis pour delivery=save" }, { status: 400, headers: json });
    }
    const before = await loadDossierState(bundleRunId, { userId: ownerUserId, sessionId: ownerSessionId });
    if (!before) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404, headers: json });
    }
    await prisma.bundleRun.update({
      where: { id: bundleRunId },
      data: {
        payloads: { ...before.payloads, [form.id]: validated } as unknown as Prisma.InputJsonValue,
        completedTemplateIds: (before.completedTemplateIds.includes(form.id)
          ? before.completedTemplateIds
          : [...before.completedTemplateIds, form.id]) as unknown as Prisma.InputJsonValue,
      },
    });
    const after = await loadDossierState(bundleRunId, { userId: ownerUserId, sessionId: ownerSessionId });
    const beforeSlugs = new Set(before.missing.map((m) => m.slug));
    const newlyTriggered = (after?.missing ?? []).filter((m) => !beforeSlugs.has(m.slug) && m.slug !== form.slug);
    await logSubmission(form.id, form.version, lang, validated, "save", true, ip);
    return NextResponse.json({ ok: true, saved: true, newlyTriggered }, { headers: json });
  }

  // Verrou dossier entier : un téléchargement (download/doccle) demandé
  // depuis un dossier (bundleRunId fourni) est refusé tant que TOUS les
  // documents requis — de base ET déclenchés par les réponses données,
  // dans N'IMPORTE quel formulaire du dossier — ne sont pas complétés.
  if (bundleRunId) {
    const state = await loadDossierState(bundleRunId, { userId: ownerUserId, sessionId: ownerSessionId });
    if (state && !state.allRequiredDone) {
      return NextResponse.json(
        { error: "dossier_incomplete", missing: state.missing },
        { status: 409, headers: json },
      );
    }
  }
```

- [ ] **Step 6: Retirer la redéclaration devenue en double de `bundleRunId`**

L'Étape 3 a déplacé `const bundleRunId = ...` plus haut dans le fichier (avant le verrou). Le bloc de persistance existant (Étape 1, second extrait, lignes ~122-149) déclarait CE MÊME `const` juste avant son `if` — il faut retirer cette redéclaration devenue en double (sinon erreur TypeScript "Cannot redeclare block-scoped variable"), en gardant le corps du `if` intact. Remplacer :

```ts
  const bundleRunId = typeof body.bundleRunId === "string" ? body.bundleRunId : null;
  if (bundleRunId) {
    try {
      const run = await prisma.bundleRun.findUnique({ where: { id: bundleRunId } });
```

par :

```ts
  if (bundleRunId) {
    try {
      const run = await prisma.bundleRun.findUnique({ where: { id: bundleRunId } });
```

Le reste de ce bloc (persistance après génération réussie pour `download`/`doccle`) reste inchangé — il continue de s'exécuter pour ces deux modes puisque `delivery === "save"` retourne déjà plus haut.

- [ ] **Step 7: Ajouter les imports manquants en haut du fichier**

Vérifier que `headers` est déjà importé (`import { headers } from "next/headers";` — présent ligne 2) et que `auth` l'est aussi (`import { auth } from "@/lib/auth";` — présent ligne 5). Aucun nouvel import requis au-delà de celui de l'Étape 4.

- [ ] **Step 8: Vérifier la compilation**

Run: `pnpm build`
Expected: PASS (typecheck).

- [ ] **Step 9: Vérification manuelle**

```bash
pnpm dev
```

Avec un client HTTP (ou le navigateur + devtools), sur un dossier `allocations-insertion` existant avec un run `in_progress` :
1. POST `/api/pdf/c1-insertion/generate` avec `{ payload: {...}, consent: true, delivery: "save", bundleRunId: "<id>" }` → attendu `200 { ok: true, saved: true, newlyTriggered: [] ou [...] }`.
2. POST `/api/pdf/c1-insertion/generate` avec `delivery: "download"` et le même `bundleRunId`, alors qu'un document déclenché (ex. c1c) n'est pas encore complété → attendu `409 { error: "dossier_incomplete", missing: [...] }`.
3. Sans `bundleRunId` du tout → comportement inchangé (200, PDF stream).

- [ ] **Step 10: Commit**

```bash
git add app/api/pdf/\[slug\]/generate/route.ts
git commit -m "feat(pdf-forms): delivery=save + verrou serveur dossier entier sur generate"
```

---

## Task 4: Transmettre `bundleSlug` au runner

**Files:**
- Modify: `components/pdf-forms/document-page-layout.tsx`
- Modify: `components/pdf-forms/pdf-form-runner.tsx`

**Interfaces:**
- Produces: `PdfFormRunnerProps.bundleSlug?: string` — consommé par Task 5 (redirection après "Valider").

**Contexte :** `app/document/[...path]/page.tsx` passe déjà `bundleSlug` à `DocumentPageLayout` (ligne 276), mais celui-ci ne le retransmet pas à `PdfFormRunner` (ligne 99-104 actuelles) — il ne s'en sert que pour le fil d'Ariane. Aucun test automatisé ici (composants de layout, vérifiés manuellement).

- [ ] **Step 1: Modifier `document-page-layout.tsx`**

Remplacer :

```tsx
      <PdfFormRunner
        form={form}
        bundlePrefill={bundlePrefill}
        bundleRunId={bundleRunId}
        legacyLayout={legacyLayout}
      />
```

par :

```tsx
      <PdfFormRunner
        form={form}
        bundlePrefill={bundlePrefill}
        bundleRunId={bundleRunId}
        bundleSlug={bundleSlug}
        legacyLayout={legacyLayout}
      />
```

- [ ] **Step 2: Ajouter la prop dans `pdf-form-runner.tsx`**

Remplacer :

```ts
interface PdfFormRunnerProps {
  form: PublicForm;
  bundlePrefill?: PrefillMap;
  bundleRunId?: string;
  onValuesChange?: (values: FormPayload) => void;
  onLocaleChange?: (locale: Locale) => void;
  /// Filet de sécurité : force l'ancien rendu (grille dense + résumé
  /// détaillé) si true. Piloté par un env var serveur, cf. Task 12. Défaut
  /// false (nouveau rendu).
  legacyLayout?: boolean;
}

export function PdfFormRunner({ form, bundlePrefill, bundleRunId, onValuesChange, onLocaleChange, legacyLayout = false }: PdfFormRunnerProps) {
```

par :

```ts
interface PdfFormRunnerProps {
  form: PublicForm;
  bundlePrefill?: PrefillMap;
  bundleRunId?: string;
  /// Slug du dossier (bundle) ouvrant — présent uniquement quand le
  /// formulaire est rempli DANS un dossier. Sert à rediriger vers le
  /// parcours après une validation (delivery="save"), cf. submit().
  bundleSlug?: string;
  onValuesChange?: (values: FormPayload) => void;
  onLocaleChange?: (locale: Locale) => void;
  /// Filet de sécurité : force l'ancien rendu (grille dense + résumé
  /// détaillé) si true. Piloté par un env var serveur, cf. Task 12. Défaut
  /// false (nouveau rendu).
  legacyLayout?: boolean;
}

export function PdfFormRunner({ form, bundlePrefill, bundleRunId, bundleSlug, onValuesChange, onLocaleChange, legacyLayout = false }: PdfFormRunnerProps) {
```

- [ ] **Step 3: Vérifier la compilation**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/pdf-forms/document-page-layout.tsx components/pdf-forms/pdf-form-runner.tsx
git commit -m "fix(pdf-forms): transmettre bundleSlug au runner (manquant)"
```

---

## Task 5: Runner — mode "Valider" en contexte dossier + notice hors-dossier

**Files:**
- Modify: `lib/pdf-forms/public-serializer.ts`
- Modify: `components/pdf-forms/pdf-form-runner.tsx`
- Modify: `messages/fr.json`

**Interfaces:**
- Consumes: `PdfFormRunnerProps.bundleSlug` (Task 4) ; réponse `{ ok: true, saved: true, newlyTriggered: MissingDoc[] }` / `409 { missing }` de la route generate (Task 3) ; `activeTriggers` (`@/lib/pdf-forms/triggers`, existant, inchangé).
- Produces: `PublicForm.triggers: PdfFormTrigger[]` — consommé par Task 11 (notice en direct).

**Contexte :** une seule fonction `submit()` (lignes 343-498) est partagée par les deux rendus (`MacroRunnerBody`, `LegacyRunnerBody`) via prop `submit={submit}` — modifier `submit()` une fois suffit pour les deux layouts. La spec exige aussi une note non bloquante **hors dossier** (formulaire ouvert seul) quand la soumission déclenche un compagnon — ex. après avoir téléchargé le C1 seul avec tremplin=oui, rappeler "N'oublie pas de joindre aussi : C1C". Ceci nécessite que `PublicForm` expose `triggers` (absent aujourd'hui, vérifié : `grep triggers lib/pdf-forms/public-serializer.ts` ne renvoie rien) — `app/document/[...path]/page.tsx:64-65` charge déjà le `PdfForm` sans `select` restrictif, donc `form.triggers` est disponible côté serveur, il suffit de l'exposer dans le type public.

- [ ] **Step 1: Exposer `triggers` dans `PublicForm`**

Dans `lib/pdf-forms/public-serializer.ts`, remplacer l'import :

```ts
import { PdfFormField, Locale } from "./types";
```

par :

```ts
import { PdfFormField, Locale, PdfFormTrigger } from "./types";
```

remplacer :

```ts
export interface PublicForm {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  issuer: string | null;
  version: number;
  defaultLocale: Locale;
  locales: Locale[];
  allowDownload: boolean;
  allowDoccle: boolean;
  allowItsme: boolean;
  fields: PublicField[];
}
```

par :

```ts
export interface PublicForm {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  issuer: string | null;
  version: number;
  defaultLocale: Locale;
  locales: Locale[];
  allowDownload: boolean;
  allowDoccle: boolean;
  allowItsme: boolean;
  fields: PublicField[];
  /// Déclencheurs de sous-formulaires (cf. lib/pdf-forms/triggers.ts) — exposés
  /// pour permettre au runner d'annoncer en direct qu'une réponse ajoute un
  /// document (hors dossier : notice non bloquante ; dans un dossier : la
  /// matérialisation réelle vient du serveur, cf. Task 3 `newlyTriggered`).
  triggers: PdfFormTrigger[];
}
```

et remplacer la signature + le corps de `toPublicForm` :

```ts
export function toPublicForm(
  form: Pick<
    PdfForm,
    | "id" | "slug" | "title" | "description" | "issuer" | "version"
    | "defaultLocale" | "locales" | "allowDownload" | "allowDoccle" | "allowItsme" | "fields"
  >
): PublicForm {
  const fields = ((form.fields as unknown as PdfFormField[]) || [])
    // Les champs `hidden` (complétés par un tiers) ne sont jamais envoyés au
    // client : le citoyen ne les voit pas et ne les remplit pas.
    .filter((f) => !f.hidden)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(toPublicField);

  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    issuer: form.issuer,
    version: form.version,
    defaultLocale: (form.defaultLocale as Locale) || "fr",
    locales: ((form.locales as unknown as Locale[]) || ["fr"]),
    allowDownload: form.allowDownload,
    allowDoccle: form.allowDoccle,
    allowItsme: form.allowItsme,
    fields,
  };
}
```

par :

```ts
export function toPublicForm(
  form: Pick<
    PdfForm,
    | "id" | "slug" | "title" | "description" | "issuer" | "version"
    | "defaultLocale" | "locales" | "allowDownload" | "allowDoccle" | "allowItsme" | "fields" | "triggers"
  >
): PublicForm {
  const fields = ((form.fields as unknown as PdfFormField[]) || [])
    // Les champs `hidden` (complétés par un tiers) ne sont jamais envoyés au
    // client : le citoyen ne les voit pas et ne les remplit pas.
    .filter((f) => !f.hidden)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(toPublicField);

  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    issuer: form.issuer,
    version: form.version,
    defaultLocale: (form.defaultLocale as Locale) || "fr",
    locales: ((form.locales as unknown as Locale[]) || ["fr"]),
    allowDownload: form.allowDownload,
    allowDoccle: form.allowDoccle,
    allowItsme: form.allowItsme,
    fields,
    triggers: ((form.triggers as unknown as PdfFormTrigger[]) || []),
  };
}
```

- [ ] **Step 2: Vérifier les autres appelants de `toPublicForm`**

```bash
grep -rn "toPublicForm(" --include=*.ts --include=*.tsx app lib components
```

Pour chaque appelant, vérifier que l'objet passé porte bien un champ `triggers` (ex. vient d'un `prisma.pdfForm.findUnique(...)` sans `select` restrictif, ou avec un `select` auquel il faut ajouter `triggers: true`). Corriger le `select` manquant si un appelant en a un qui omet `triggers`.

- [ ] **Step 3: Ajouter les imports du router et de `activeTriggers`**

En haut du fichier, à la suite des imports existants (après la ligne `import { toast } from "sonner";`), ajouter :

```ts
import { useRouter } from "next/navigation";
```

et, à la suite de l'import existant `import { findListMatchErrors } from "@/lib/pdf-forms/list-match";`, ajouter :

```ts
import { activeTriggers } from "@/lib/pdf-forms/triggers";
```

- [ ] **Step 4: Initialiser le router dans le composant**

Juste après `const t = useTranslations("public.dossier");` (ligne 96), ajouter :

```ts
  const router = useRouter();
```

- [ ] **Step 5: Modifier le corps de `submit()` — remplacer l'appel fetch et son traitement**

Le bloc actuel (lignes 450-497) :

```ts
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pdf/${form.slug}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: signedValues,
          locale,
          delivery,
          consent: true,
          doccleRecipient: delivery === "doccle" ? { reference: doccleRef.trim() } : undefined,
          bundleRunId,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/pdf")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${form.slug}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        fetch(`/api/pdf/${form.slug}/draft`, { method: "DELETE" }).catch(() => {});
        setDone({ mode: "download" });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.delivery === "doccle") {
        fetch(`/api/pdf/${form.slug}/draft`, { method: "DELETE" }).catch(() => {});
        setDone({ mode: "doccle" });
        return;
      }
      if (res.status === 422 && Array.isArray(data.issues)) {
        const next: Record<string, string> = {};
        for (const i of data.issues) if (i.field) next[i.field] = i.message;
        setErrors(next);
        toast.error(t("runnerServerValidationFailed"));
        return;
      }
      toast.error(data.error || t("runnerGenerationFailed"));
    } catch {
      toast.error(t("runnerNetworkError"));
    } finally {
      setSubmitting(false);
    }
  }
```

Remplacer par :

```ts
    setSubmitting(true);
    // Dans un dossier (bundleRunId présent) : "Valider" — sauvegarde le
    // payload, aucun PDF généré. Le téléchargement se fait plus tard, groupé,
    // depuis l'écran "Mes documents" du parcours (cf. bundle-roadmap.tsx),
    // une fois tous les documents requis (dont ceux déclenchés) complétés.
    const effectiveDelivery: "download" | "doccle" | "save" = bundleRunId ? "save" : delivery;
    try {
      const res = await fetch(`/api/pdf/${form.slug}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: signedValues,
          locale,
          delivery: effectiveDelivery,
          consent: true,
          doccleRecipient: delivery === "doccle" ? { reference: doccleRef.trim() } : undefined,
          bundleRunId,
        }),
      });

      if (effectiveDelivery === "save") {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || t("runnerGenerationFailed"));
          return;
        }
        fetch(`/api/pdf/${form.slug}/draft`, { method: "DELETE" }).catch(() => {});
        const newlyTriggered: Array<{ slug: string; title: string }> = data.newlyTriggered || [];
        if (newlyTriggered.length > 0) {
          toast.info(
            t("runnerNewlyTriggered", {
              titles: newlyTriggered.map((d) => d.title).join(", "),
            }),
          );
        } else {
          toast.success(t("runnerSavedSuccess"));
        }
        if (bundleSlug) router.push(`/d/${bundleSlug}`);
        return;
      }

      // Hors dossier (bundleRunId absent) : la réponse au download/doccle
      // n'a pas de connaissance serveur du contexte dossier (pas de
      // BundleRun) — on annonce donc les triggers ACTIFS sur le payload
      // soumis, calculés côté client (`activeTriggers`, existant), à titre
      // purement informatif et non bloquant (le fichier est déjà généré).
      const standaloneTriggerNotice = () => {
        if (bundleRunId || !form.triggers || form.triggers.length === 0) return;
        const active = activeTriggers(form.triggers, signedValues);
        if (active.length === 0) return;
        const titles = active.map((tr) => tr.reason?.fr || tr.requiresFormSlug).join(", ");
        toast.info(t("runnerStandaloneTriggerNotice", { titles }));
      };

      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/pdf")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${form.slug}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        fetch(`/api/pdf/${form.slug}/draft`, { method: "DELETE" }).catch(() => {});
        setDone({ mode: "download" });
        standaloneTriggerNotice();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.delivery === "doccle") {
        fetch(`/api/pdf/${form.slug}/draft`, { method: "DELETE" }).catch(() => {});
        setDone({ mode: "doccle" });
        standaloneTriggerNotice();
        return;
      }
      if (res.status === 409 && data.error === "dossier_incomplete") {
        const titles = (data.missing || []).map((m: { title: string }) => m.title).join(", ");
        toast.error(t("runnerDossierIncomplete", { titles }));
        return;
      }
      if (res.status === 422 && Array.isArray(data.issues)) {
        const next: Record<string, string> = {};
        for (const i of data.issues) if (i.field) next[i.field] = i.message;
        setErrors(next);
        toast.error(t("runnerServerValidationFailed"));
        return;
      }
      toast.error(data.error || t("runnerGenerationFailed"));
    } catch {
      toast.error(t("runnerNetworkError"));
    } finally {
      setSubmitting(false);
    }
  }
```

- [ ] **Step 6: Ajouter les clés i18n (FR)**

Dans `messages/fr.json`, section `public.dossier` (repérer la ligne `"runnerNetworkError": "Erreur réseau. Vérifiez votre connexion.",` autour de la ligne 4831), ajouter juste après :

```json
      "runnerNetworkError": "Erreur réseau. Vérifiez votre connexion.",
      "runnerSavedSuccess": "Document enregistré dans votre dossier.",
      "runnerNewlyTriggered": "Ce choix ajoute un document obligatoire à votre dossier : {titles}",
      "runnerDossierIncomplete": "Complétez d'abord : {titles}",
      "runnerStandaloneTriggerNotice": "N'oublie pas de joindre aussi : {titles}",
```

(Remplace la ligne unique `"runnerNetworkError"` par ces 5 lignes — la clé existante est conservée, 4 nouvelles clés ajoutées à sa suite.)

- [ ] **Step 7: Vérifier la compilation + i18n**

Run: `pnpm build && pnpm i18n:check`
Expected: PASS (les 4 nouvelles clés manquent dans les 11 autres locales — AVERTISSEMENT non-bloquant, `exit(0)`, cf. `scripts/i18n-validate.ts:14`).

- [ ] **Step 8: Vérification manuelle**

`pnpm dev` :
1. Ouvrir `/d/allocations-insertion`, remplir le C1 avec tremplin-indépendants=oui (première fois). Le bouton final doit dire "Valider" (aucun téléchargement de fichier ne se déclenche). Après validation, un toast "Ce choix ajoute un document obligatoire..." apparaît, puis redirection vers `/d/allocations-insertion`. Le C1C apparaît dans la liste, non complété.
2. Ouvrir le C1 générique en STANDALONE (`/document/c1`, sans paramètre `bundleRun`), répondre tremplin=oui, télécharger : le PDF se télécharge normalement ET un toast "N'oublie pas de joindre aussi : ..." apparaît (non bloquant).

- [ ] **Step 9: Commit**

```bash
git add lib/pdf-forms/public-serializer.ts components/pdf-forms/pdf-form-runner.tsx messages/fr.json
git commit -m "feat(pdf-forms): mode Valider (save) en dossier + notice standalone des triggers actifs"
```

---

## Task 6: Régénération de tous les PDF complétés d'un run

**Files:**
- Create: `lib/bundles/regenerate-pdfs.ts`

**Interfaces:**
- Consumes: `loadDossierState`, `type DossierState` (Task 2) ; `fillForm` (`@/lib/pdf-forms/filler`) ; `resolveStamps` (`@/lib/pdf-forms/bindings/engine`) ; `getRulesForSlug` (`@/lib/pdf-forms/bindings/registry`) ; `readSourcePdf` (`@/lib/pdf-forms/storage`) ; `renderFilename` (`@/lib/pdf-forms/filename`) ; `PdfFormField`, `AcroFieldRaw`, `FormPayload` (`@/lib/pdf-forms/types`).
- Produces: `export interface RegeneratedDoc { filename: string; bytes: Buffer }` ; `export async function regenerateAllDocuments(bundleRunId: string, ownership: { userId: string | null; sessionId: string | null }): Promise<{ state: DossierState; docs: RegeneratedDoc[] } | null>` — consommé par Task 7 (zip) et Task 8 (mail). Retourne `null` si le run est introuvable/pas de la bonne propriété OU si `!state.allRequiredDone`.

**Note :** pas de test vitest ici (fonction async orchestrant Prisma + I/O fichier, comme la route `generate` elle-même — convention du projet : ces fonctions "glue" sont vérifiées manuellement, cf. Step 4).

- [ ] **Step 1: Écrire le module**

Create `lib/bundles/regenerate-pdfs.ts`:

```ts
// Régénère tous les PDF déjà complétés (visibles, requis) d'un BundleRun,
// depuis les payloads déjà validés — AUCUN PDF n'est jamais stocké (RGPD),
// donc zip et mail (Task 7/8) régénèrent à chaque appel, en mémoire.

import { prisma } from "@/lib/prisma";
import { loadDossierState, type DossierState } from "@/lib/bundles/completion";
import { fillForm } from "@/lib/pdf-forms/filler";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { renderFilename } from "@/lib/pdf-forms/filename";
import type { PdfFormField, AcroFieldRaw, FormPayload } from "@/lib/pdf-forms/types";

export interface RegeneratedDoc {
  filename: string;
  bytes: Buffer;
}

/// Régénère tous les documents complétés (requis, visibles) d'un run — dans
/// le même ordre que `state.items`. Retourne `null` si le run n'est pas
/// accessible (propriété) OU si le dossier n'est pas encore complet (le
/// verrou s'applique aussi ici, pas seulement sur le téléchargement
/// individuel).
export async function regenerateAllDocuments(
  bundleRunId: string,
  ownership: { userId: string | null; sessionId: string | null },
): Promise<{ state: DossierState; docs: RegeneratedDoc[] } | null> {
  const state = await loadDossierState(bundleRunId, ownership);
  if (!state || !state.allRequiredDone) return null;

  const completedIds = new Set(state.completedTemplateIds);
  const toRegenerate = state.items.filter(
    (it) => it.pdfFormId && completedIds.has(it.pdfFormId) && it.pdfForm,
  );

  const forms = await prisma.pdfForm.findMany({
    where: { id: { in: toRegenerate.map((it) => it.pdfFormId as string) } },
    select: {
      id: true,
      slug: true,
      sourceStoragePath: true,
      sourceFileName: true,
      fields: true,
      technicalSchema: true,
    },
  });
  const formsById = new Map(forms.map((f) => [f.id, f]));

  const docs: RegeneratedDoc[] = [];
  for (const item of toRegenerate) {
    const form = formsById.get(item.pdfFormId as string);
    if (!form) continue;
    const payload = (state.payloads[form.id] as FormPayload) || {};
    const source = await readSourcePdf(form.sourceStoragePath, form.sourceFileName);
    if (!source) continue;
    const fields = (form.fields as unknown as PdfFormField[]) || [];
    const technicalSchema = (form.technicalSchema as unknown as AcroFieldRaw[]) || [];
    const extraStamps = resolveStamps(payload, getRulesForSlug(form.slug));
    const { bytes } = await fillForm(source, fields, payload, { technicalSchema, extraStamps });
    docs.push({ filename: renderFilename(form.slug, payload), bytes });
  }

  return { state, docs };
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/bundles/regenerate-pdfs.ts
git commit -m "feat(bundles): regenerateAllDocuments (zip/mail — aucun stockage)"
```

*(La vérification fonctionnelle de ce module se fait via Task 7/8, qui l'exercent réellement.)*

---

## Task 7: Route zip — "Tout télécharger"

**Files:**
- Create: `app/api/documents/bundles/[bundleRunId]/download-all/route.ts`

**Interfaces:**
- Consumes: `regenerateAllDocuments` (Task 6) ; `checkRateLimit`, `getClientIp` (`@/lib/pdf-forms/security`).
- Produces: `GET /api/documents/bundles/[bundleRunId]/download-all` → `200` stream `application/zip` (nom `documents-<bundleSlug>.zip`) si complet, `404` si run introuvable/pas de la bonne propriété, `409 { error: "dossier_incomplete", missing }` si incomplet.

- [ ] **Step 1: Écrire la route**

Create `app/api/documents/bundles/[bundleRunId]/download-all/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import AdmZip from "adm-zip";
import { auth } from "@/lib/auth";
import { regenerateAllDocuments } from "@/lib/bundles/regenerate-pdfs";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET → zip de tous les documents complétés d'un dossier, régénérés à la
/// volée (aucun PDF n'est jamais stocké). Verrouillé tant que le dossier
/// n'est pas entièrement complété (cf. lib/bundles/completion.ts).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bundleRunId: string }> },
) {
  const { bundleRunId } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-download-all:${ip}:${bundleRunId}`, { windowMs: 60_000, max: 5 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  const result = await regenerateAllDocuments(bundleRunId, { userId, sessionId });
  if (!result) {
    return NextResponse.json({ error: "Dossier introuvable ou incomplet" }, { status: 404, headers: json });
  }
  if (result.docs.length === 0) {
    return NextResponse.json({ error: "Aucun document à télécharger" }, { status: 404, headers: json });
  }

  const zip = new AdmZip();
  for (const doc of result.docs) {
    zip.addFile(doc.filename, doc.bytes);
  }
  const zipBytes = zip.toBuffer();

  return new NextResponse(new Uint8Array(zipBytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="documents-${result.state.run.bundleSlug}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Vérification manuelle**

`pnpm dev`, compléter entièrement un dossier de test (tous les documents requis, y compris tout compagnon déclenché), puis :

```bash
curl -i "http://localhost:3000/api/documents/bundles/<bundleRunId>/download-all" -b "beldoc-bundle-session=<cookie-valeur>"
```

Attendu : `200`, `Content-Type: application/zip`, corps non vide. Avec un dossier incomplet : `404`.

- [ ] **Step 4: Commit**

```bash
git add app/api/documents/bundles/\[bundleRunId\]/download-all/route.ts
git commit -m "feat(bundles): route zip download-all (verrouillee dossier entier)"
```

---

## Task 8: Route email — "Envoyer par mail"

**Files:**
- Create: `app/api/documents/bundles/[bundleRunId]/email/route.ts`

**Interfaces:**
- Consumes: `regenerateAllDocuments` (Task 6) ; `checkRateLimit`, `getClientIp` (`@/lib/pdf-forms/security`) ; `Resend` (paquet `resend`, déjà utilisé par `lib/booking/emails.ts`).
- Produces: `POST /api/documents/bundles/[bundleRunId]/email` body `{ to: string; consent: true }` → `200 { ok: true }` / `400` (consentement manquant, email invalide, RESEND_API_KEY absente) / `404` (run introuvable/incomplet) / `429` (rate-limit).

- [ ] **Step 1: Écrire la route**

Create `app/api/documents/bundles/[bundleRunId]/email/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import { auth } from "@/lib/auth";
import { regenerateAllDocuments } from "@/lib/bundles/regenerate-pdfs";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// POST → envoie tous les documents complétés d'un dossier par email
/// (pièces jointes régénérées en mémoire, jamais stockées). Verrouillé tant
/// que le dossier n'est pas entièrement complété.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bundleRunId: string }> },
) {
  const { bundleRunId } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-email:${ip}:${bundleRunId}`, { windowMs: 60_000, max: 3 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  let body: { to?: unknown; consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: "Consentement RGPD requis" }, { status: 400, headers: json });
  }
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400, headers: json });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.CONTACT_EMAIL_FROM;
  if (!apiKey || !fromAddress) {
    return NextResponse.json({ error: "Envoi par email indisponible" }, { status: 400, headers: json });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  const result = await regenerateAllDocuments(bundleRunId, { userId, sessionId });
  if (!result) {
    return NextResponse.json({ error: "Dossier introuvable ou incomplet" }, { status: 404, headers: json });
  }
  if (result.docs.length === 0) {
    return NextResponse.json({ error: "Aucun document à envoyer" }, { status: 404, headers: json });
  }

  try {
    const resend = new Resend(apiKey);
    const res = await resend.emails.send({
      from: fromAddress,
      to,
      subject: `Vos documents — ${result.state.run.bundleSlug}`,
      text: `Bonjour,\n\nVoici les ${result.docs.length} document(s) complété(s) de votre dossier.\n\nCeci est un envoi automatique, ne pas répondre.`,
      attachments: result.docs.map((d) => ({ filename: d.filename, content: d.bytes })),
    });
    if (res.error) {
      console.error("[bundles/email] envoi échoué:", res.error);
      return NextResponse.json({ error: "Échec de l'envoi" }, { status: 502, headers: json });
    }
  } catch (err) {
    console.error("[bundles/email] exception:", err);
    return NextResponse.json({ error: "Échec de l'envoi" }, { status: 502, headers: json });
  }

  return NextResponse.json({ ok: true }, { headers: json });
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Vérification manuelle**

Avec `RESEND_API_KEY`/`CONTACT_EMAIL_FROM` configurées en local et un dossier de test complet :

```bash
curl -i -X POST "http://localhost:3000/api/documents/bundles/<bundleRunId>/email" \
  -H "Content-Type: application/json" \
  -b "beldoc-bundle-session=<cookie-valeur>" \
  -d '{"to":"test@example.com","consent":true}'
```

Attendu : `200 { ok: true }`, email reçu avec les PDF en pièce jointe. Sans consentement → `400`.

- [ ] **Step 4: Commit**

```bash
git add app/api/documents/bundles/\[bundleRunId\]/email/route.ts
git commit -m "feat(bundles): route email pour envoyer tous les documents completes"
```

---

## Task 9: Écran "Mes documents" — boutons zip + mail

**Files:**
- Modify: `components/docbel/bundle-roadmap.tsx`
- Modify: `components/docbel/bundle-runner.tsx`
- Modify: `app/d/[slug]/page.tsx`
- Modify: `messages/fr.json`

**Interfaces:**
- Consumes: `GET .../download-all` (Task 7), `POST .../email` (Task 8).
- Produces: aucune nouvelle interface exportée (UI uniquement) — `BundleRoadmapProps` gagne `bundleRunId: string | null` et `userEmail: string | null`.

**Contexte :** `BundleRoadmap` (déjà l'écran de sortie du dossier, affiché quand `allRequiredDone && requiredVisible.length > 0`) liste déjà chaque document avec un lien "Revoir/télécharger" (réutilise le flux existant de réouverture de formulaire — pas de nouvelle route nécessaire pour le téléchargement individuel). Cette tâche ajoute seulement les 2 actions groupées.

- [ ] **Step 1: Ajouter les props à `BundleRoadmap`**

Dans `components/docbel/bundle-roadmap.tsx`, remplacer :

```tsx
interface BundleRoadmapProps {
  documents: RoadmapDocument[];
  externalDocuments: RoadmapExternalDocument[];
  resumeCode: string | null;
}
```

par :

```tsx
interface BundleRoadmapProps {
  documents: RoadmapDocument[];
  externalDocuments: RoadmapExternalDocument[];
  resumeCode: string | null;
  /// Id du BundleRun — nécessaire pour les actions groupées (zip, mail).
  /// `null` ne devrait pas arriver ici (la feuille de route n'apparaît
  /// qu'avec un run existant) mais reste défensif.
  bundleRunId: string | null;
  /// Email de la session connectée, pré-rempli dans le dialogue d'envoi.
  userEmail: string | null;
}
```

- [ ] **Step 2: Ajouter les imports et le state du dialogue d'envoi**

Remplacer l'en-tête d'imports :

```tsx
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ExternalLink,
  Landmark,
  ListChecks,
  Paperclip,
  Printer,
  ShieldAlert,
  Signature,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
```

par (le fichier a déjà `"use client";` en ligne 1, avant ce bloc d'imports — ne pas la dupliquer) :

```tsx
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { toast } from "sonner";
import {
  Archive,
  ExternalLink,
  Landmark,
  ListChecks,
  Mail,
  Paperclip,
  Printer,
  ShieldAlert,
  Signature,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
```

- [ ] **Step 3: Étendre la signature du composant + ajouter la logique d'envoi**

Remplacer :

```tsx
export function BundleRoadmap({
  documents,
  externalDocuments,
  resumeCode,
}: BundleRoadmapProps) {
  const t = useTranslations("public.dossier");

  const requiredExternal = externalDocuments.filter((d) => d.required);

  const steps: RoadmapStep[] = [];
```

par :

```tsx
export function BundleRoadmap({
  documents,
  externalDocuments,
  resumeCode,
  bundleRunId,
  userEmail,
}: BundleRoadmapProps) {
  const t = useTranslations("public.dossier");
  const [emailTo, setEmailTo] = useState(userEmail ?? "");
  const [emailConsent, setEmailConsent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  async function sendByEmail() {
    if (!bundleRunId) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/documents/bundles/${bundleRunId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo.trim(), consent: emailConsent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || t("roadmapEmailError"));
        return;
      }
      toast.success(t("roadmapEmailSuccess"));
      setEmailDialogOpen(false);
    } catch {
      toast.error(t("roadmapEmailError"));
    } finally {
      setSendingEmail(false);
    }
  }

  const requiredExternal = externalDocuments.filter((d) => d.required);

  const steps: RoadmapStep[] = [];
```

- [ ] **Step 4: Ajouter les 2 boutons dans la section "docs"**

Remplacer le bloc `steps.push({ key: "docs", ...})` :

```tsx
  if (documents.length > 0) {
    steps.push({
      key: "docs",
      icon: <Signature className="w-4 h-4" />,
      title: t("roadmapStepDocs"),
      body: t("roadmapStepDocsHint"),
      content: (
        <ul className="space-y-1.5 mt-2">
          {documents.map((d) => (
            <li key={d.slug} className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{d.title}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                render={<Link href={d.href} />}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                {t("roadmapReview")}
              </Button>
            </li>
          ))}
        </ul>
      ),
    });
  }
```

par :

```tsx
  if (documents.length > 0) {
    steps.push({
      key: "docs",
      icon: <Signature className="w-4 h-4" />,
      title: t("roadmapStepDocs"),
      body: t("roadmapStepDocsHint"),
      content: (
        <>
          <ul className="space-y-1.5 mt-2">
            {documents.map((d) => (
              <li key={d.slug} className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{d.title}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  render={<Link href={d.href} />}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  {t("roadmapReview")}
                </Button>
              </li>
            ))}
          </ul>
          {bundleRunId && documents.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap mt-3 print:hidden">
              <Button
                size="sm"
                variant="default"
                className="h-8 text-xs"
                render={<a href={`/api/documents/bundles/${bundleRunId}/download-all`} />}
              >
                <Archive className="w-3.5 h-3.5 mr-1" />
                {t("roadmapDownloadAll")}
              </Button>
              <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogTrigger
                  render={
                    <Button size="sm" variant="outline" className="h-8 text-xs">
                      <Mail className="w-3.5 h-3.5 mr-1" />
                      {t("roadmapSendByEmail")}
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("roadmapSendByEmail")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="roadmap-email-to">{t("roadmapEmailToLabel")}</Label>
                      <Input
                        id="roadmap-email-to"
                        type="email"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="vous@exemple.be"
                      />
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="roadmap-email-consent"
                        checked={emailConsent}
                        onCheckedChange={(c) => setEmailConsent(c === true)}
                      />
                      <Label htmlFor="roadmap-email-consent" className="text-xs font-normal leading-snug">
                        {t("roadmapEmailConsent")}
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={sendByEmail}
                      disabled={sendingEmail || !emailConsent || !emailTo.trim()}
                    >
                      {sendingEmail ? t("roadmapEmailSending") : t("roadmapSendByEmail")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </>
      ),
    });
  }
```

- [ ] **Step 5: Vérifier la compilation (types base-ui)**

Run: `pnpm build`
Expected: PASS. `components/ui/dialog.tsx` confirme que `DialogTrigger` accepte les props de `@base-ui/react/dialog` (`DialogPrimitive.Trigger.Props`), qui supportent `render` (même convention que `Button`/`Badge` dans ce projet) — le JSX de l'Étape 4 est donc correct tel quel.

- [ ] **Step 6: Passer `bundleRunId`/`userEmail` depuis `bundle-runner.tsx`**

Dans `components/docbel/bundle-runner.tsx`, remplacer :

```tsx
interface BundleRunnerProps {
  bundle: Bundle;
  runId: string | null;
  resumeCode: string | null;
  resumeCodeExpiresAt: string | null;
  resumeEmail: string | null;
  eligibilityAnswers: EligibilityAnswers;
  completedTemplateIds: string[];
  payloads: CollectedPayloads;
  templateNames: Record<string, string>;
  fieldLabels: Record<string, string>;
  applicableSlugs?: string[] | null;
  externalDocuments?: ExternalDocument[];
}
```

par :

```tsx
interface BundleRunnerProps {
  bundle: Bundle;
  runId: string | null;
  resumeCode: string | null;
  resumeCodeExpiresAt: string | null;
  resumeEmail: string | null;
  eligibilityAnswers: EligibilityAnswers;
  completedTemplateIds: string[];
  payloads: CollectedPayloads;
  templateNames: Record<string, string>;
  fieldLabels: Record<string, string>;
  applicableSlugs?: string[] | null;
  externalDocuments?: ExternalDocument[];
  /// Email de la session connectée (pré-remplissage du dialogue d'envoi).
  userEmail?: string | null;
}
```

et dans la signature de la fonction, remplacer :

```tsx
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
}: BundleRunnerProps) {
```

par :

```tsx
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
  userEmail = null,
}: BundleRunnerProps) {
```

et dans le rendu de `<BundleRoadmap>`, remplacer :

```tsx
            <BundleRoadmap
              documents={visibleItems.flatMap(
                ({ item, completed }): RoadmapDocument[] =>
                  completed && item.pdfForm
                    ? [
                        {
                          slug: item.pdfForm.slug,
                          title: itemTitle(item),
                          href: `/document/${item.pdfForm.slug}?bundleRun=${encodeURIComponent(runId ?? "")}&bundleSlug=${encodeURIComponent(bundle.slug)}`,
                        },
                      ]
                    : []
              )}
              externalDocuments={externalDocuments}
              resumeCode={resumeCode}
            />
```

par :

```tsx
            <BundleRoadmap
              documents={visibleItems.flatMap(
                ({ item, completed }): RoadmapDocument[] =>
                  completed && item.pdfForm
                    ? [
                        {
                          slug: item.pdfForm.slug,
                          title: itemTitle(item),
                          href: `/document/${item.pdfForm.slug}?bundleRun=${encodeURIComponent(runId ?? "")}&bundleSlug=${encodeURIComponent(bundle.slug)}`,
                        },
                      ]
                    : []
              )}
              externalDocuments={externalDocuments}
              resumeCode={resumeCode}
              bundleRunId={runId}
              userEmail={userEmail}
            />
```

- [ ] **Step 7: Passer l'email de session depuis `app/d/[slug]/page.tsx`**

Dans ce fichier, `BundleRunner` est rendu via un objet `runnerProps` spread (`<BundleRunner {...runnerProps} />`). Remplacer :

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

par :

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
          userEmail: session?.user?.email ?? null,
        };
```

(`session` est déjà chargé plus haut dans ce fichier, ligne 75 : `const session = await auth.api.getSession({ headers: await headers() });` — réutilisé tel quel, aucun nouvel appel.)

- [ ] **Step 8: Ajouter les clés i18n (FR)**

Dans `messages/fr.json`, section `public.dossier`, à la suite de `"roadmapReview": "Revoir / télécharger",` (repérer cette ligne, autour de 4634), ajouter :

```json
      "roadmapReview": "Revoir / télécharger",
      "roadmapDownloadAll": "Tout télécharger (.zip)",
      "roadmapSendByEmail": "Envoyer par mail",
      "roadmapEmailToLabel": "Adresse email",
      "roadmapEmailConsent": "J'accepte que mes documents soient envoyés par email à l'adresse ci-dessus.",
      "roadmapEmailSending": "Envoi en cours…",
      "roadmapEmailSuccess": "Documents envoyés par email.",
      "roadmapEmailError": "L'envoi a échoué. Réessayez.",
```

- [ ] **Step 9: Vérifier la compilation + i18n**

Run: `pnpm build && pnpm i18n:check`
Expected: PASS.

- [ ] **Step 10: Vérification manuelle**

`pnpm dev`, compléter un dossier de test entièrement (≥ 2 documents) : les boutons "Tout télécharger (.zip)" et "Envoyer par mail" apparaissent sur l'écran final ; le zip télécharge, le dialogue mail envoie (si `RESEND_API_KEY` configurée localement, sinon vérifier le message d'erreur explicite).

- [ ] **Step 11: Commit**

```bash
git add components/docbel/bundle-roadmap.tsx components/docbel/bundle-runner.tsx "app/d/[slug]/page.tsx" messages/fr.json
git commit -m "feat(dossier): boutons zip + email sur l'ecran Mes documents"
```

---

## Task 10: Lien cliquable sur les documents tiers (A15)

**Files:**
- Modify: `lib/dossiers/types.ts`
- Modify: `lib/dossiers/allocations-insertion/index.ts`
- Modify: `components/docbel/bundle-runner.tsx`
- Modify: `app/d/[slug]/page.tsx`

**Interfaces:**
- Produces: `DossierDocument.responsibilityUrl?: Localized` ; `ExternalDocument.responsibilityUrl?: string | null` (composant).

- [ ] **Step 1: Ajouter le champ au type**

Dans `lib/dossiers/types.ts`, juste après le champ `responsibilityNote?: Localized;` et son commentaire (repérer `/// Note explicative affichée quand \`responsibility ≠ "user"\` ...`), ajouter :

```ts
  /// Lien externe optionnel expliquant comment obtenir le document (ex. A15
  /// → page Actiris). Affiché en complément de `responsibilityNote`, jamais
  /// à sa place — le lien peut casser (page tierce), la note reste la
  /// source d'info stable.
  responsibilityUrl?: Localized;
```

- [ ] **Step 2: Renseigner le lien pour l'A15**

Dans `lib/dossiers/allocations-insertion/index.ts`, remplacer :

```ts
    {
      slug: "attestation-inscription-a15",
      title: "Attestation d'inscription comme demandeur d'emploi (A15 – historique)",
      titleKey: "insertion.doc.a15.title",
      issuer: "ACTIRIS / Forem / VDAB / ADG",
      required: true,
      responsibility: "external",
      responsibilityNote: {
        fr: "À demander à ton service régional de l'emploi : ACTIRIS (Bruxelles), Forem (Wallonie), VDAB (Flandre) ou ADG (Communauté germanophone). Toujours à joindre à ta demande.",
      },
      internalRef: "A15 historique — attestation d'inscription. Toujours requise.",
      fields: [],
    },
```

par :

```ts
    {
      slug: "attestation-inscription-a15",
      title: "Attestation d'inscription comme demandeur d'emploi (A15 – historique)",
      titleKey: "insertion.doc.a15.title",
      issuer: "ACTIRIS / Forem / VDAB / ADG",
      required: true,
      responsibility: "external",
      responsibilityNote: {
        fr: "À demander à ton service régional de l'emploi : ACTIRIS (Bruxelles), Forem (Wallonie), VDAB (Flandre) ou ADG (Communauté germanophone). Toujours à joindre à ta demande.",
      },
      responsibilityUrl: {
        fr: "https://www.actiris.brussels/fr/citoyens/",
      },
      internalRef: "A15 historique — attestation d'inscription. Toujours requise.",
      fields: [],
    },
```

*(URL générique de la page citoyen Actiris — à faire valider/ajuster par Oraliks vers la page exacte "attestation d'inscription" si elle existe séparément ; ne pas inventer une URL plus profonde sans confirmation.)*

- [ ] **Step 3: Propager le champ jusqu'au composant**

Dans `components/docbel/bundle-runner.tsx`, remplacer :

```tsx
export interface ExternalDocument {
  slug: string;
  title: string;
  issuer: string;
  required: boolean;
  responsibility: "employer" | "onem" | "external";
  responsibilityNote: string | null;
}
```

par :

```tsx
export interface ExternalDocument {
  slug: string;
  title: string;
  issuer: string;
  required: boolean;
  responsibility: "employer" | "onem" | "external";
  responsibilityNote: string | null;
  responsibilityUrl: string | null;
}
```

et, dans le rendu de la carte document tiers, remplacer :

```tsx
                      {d.responsibilityNote && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {d.responsibilityNote}
                        </p>
                      )}
```

par :

```tsx
                      {d.responsibilityNote && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {d.responsibilityNote}
                        </p>
                      )}
                      {d.responsibilityUrl && (
                        <a
                          href={d.responsibilityUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline underline-offset-2 mt-1 inline-block"
                        >
                          {t("runnerResponsibilityLinkLabel")}
                        </a>
                      )}
```

- [ ] **Step 4: Alimenter la donnée depuis `app/d/[slug]/page.tsx`**

Repérer dans ce fichier la construction du tableau `externalDocuments` (autour des lignes 243-258 vues précédemment) :

```ts
  const externalDocuments =
    selectedDocs
      ?.flatMap((d) => {
        const r = d.responsibility;
        if (!r || r === "user") return [];
        return [
          {
            slug: d.slug,
            title: d.title,
            issuer: d.issuer,
            required: d.required ?? true,
            responsibility: r,
            responsibilityNote: d.responsibilityNote?.fr ?? null,
          },
        ];
      }) ?? [];
```

Remplacer par :

```ts
  const externalDocuments =
    selectedDocs
      ?.flatMap((d) => {
        const r = d.responsibility;
        if (!r || r === "user") return [];
        return [
          {
            slug: d.slug,
            title: d.title,
            issuer: d.issuer,
            required: d.required ?? true,
            responsibility: r,
            responsibilityNote: d.responsibilityNote?.fr ?? null,
            responsibilityUrl: d.responsibilityUrl?.fr ?? null,
          },
        ];
      }) ?? [];
```

- [ ] **Step 5: Ajouter la clé i18n (FR)**

Dans `messages/fr.json`, section `public.dossier`, à la suite de la clé `"runnerExternalDocsNote"` (existante — la localiser avant modification), ajouter juste après :

```json
      "runnerResponsibilityLinkLabel": "Comment l'obtenir →",
```

- [ ] **Step 6: Vérifier la compilation + i18n**

Run: `pnpm build && pnpm i18n:check`
Expected: PASS.

- [ ] **Step 7: Vérification manuelle**

`/d/allocations-insertion` : la carte A15 affiche désormais un lien "Comment l'obtenir →" ouvrant la page Actiris dans un nouvel onglet.

- [ ] **Step 8: Commit**

```bash
git add lib/dossiers/types.ts lib/dossiers/allocations-insertion/index.ts components/docbel/bundle-runner.tsx "app/d/[slug]/page.tsx" messages/fr.json
git commit -m "feat(dossier): lien cliquable optionnel sur les documents a charge d'un tiers (A15)"
```

---

## Task 11: [Optionnel, polish] Notice en direct pendant le remplissage du C1

**Files:**
- Modify: `components/pdf-forms/pdf-form-runner.tsx`
- Modify: `messages/fr.json`

**Interfaces:**
- Consumes: `activeTriggers` (`@/lib/pdf-forms/triggers`, existant, inchangé) ; `form.triggers` — déjà exposé par `PublicForm`/`toPublicForm` depuis Task 5 (Step 1), et déjà importé dans ce fichier depuis Task 5 (Step 3) — aucun nouvel import ici.

**Note :** tâche indépendante des Tasks 1-10 (le verrou fonctionne sans elle) — à faire en dernier, sautable sans bloquer le reste du plan. Dépend techniquement de Task 5 (réutilise `form.triggers` et l'import de `activeTriggers` qu'elle introduit).

- [ ] **Step 1: Calculer les triggers actifs à chaque changement de valeur**

Dans `components/pdf-forms/pdf-form-runner.tsx`, après la définition de `values` (state), ajouter un calcul mémoïsé :

```ts
  const liveTriggers = useMemo(
    () => (form.triggers.length > 0 ? activeTriggers(form.triggers, values) : []),
    [form.triggers, values],
  );
```

- [ ] **Step 2: Afficher la notice**

Dans le rendu (choisir un emplacement visible en permanence, ex. juste au-dessus du bouton de soumission final, dans `MacroRunnerBody` et `LegacyRunnerBody` — les deux call sites), ajouter :

```tsx
{liveTriggers.length > 0 && (
  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
    {t("runnerLiveTriggerNotice", {
      titles: liveTriggers.map((tr) => tr.reason?.fr || tr.requiresFormSlug).join(", "),
    })}
  </p>
)}
```

*(`liveTriggers` doit être passé en prop à `MacroRunnerBody`/`LegacyRunnerBody` comme `submit`/`delivery` le sont déjà — suivre exactement le même pattern de threading de props que le reste du fichier.)*

- [ ] **Step 3: Ajouter la clé i18n (FR)**

```json
      "runnerLiveTriggerNotice": "Cette réponse ajoutera un document à votre dossier : {titles}",
```

- [ ] **Step 4: Vérifier la compilation**

Run: `pnpm build && pnpm i18n:check`
Expected: PASS.

- [ ] **Step 5: Vérification manuelle**

Répondre "oui" à tremplin-indépendants dans le C1 : la notice apparaît avant même de valider l'étape.

- [ ] **Step 6: Commit**

```bash
git add components/pdf-forms/pdf-form-runner.tsx messages/fr.json
git commit -m "feat(pdf-forms): notice en direct des documents declenches pendant le remplissage"
```

---

## Self-Review Notes (pour l'exécutant)

- **Task 1 est un pré-requis dur** pour observer tout effet des Tasks 2-11 en conditions réelles (sans elle, les compagnons restent invisibles quel que soit le code livré) — mais aucune des tâches suivantes n'en dépend techniquement (le code fonctionne dès qu'un compagnon existe et est publié).
- **Déviation assumée par rapport à la spec écrite** (`docs/superpowers/specs/2026-07-10-c1-companion-documents-gating-design.md`) : la spec envisageait une "nouvelle route légère" pour le téléchargement individuel. En marge de ce plan, il s'est avéré que `components/docbel/bundle-roadmap.tsx` fournit déjà ce téléchargement individuel (réouverture du formulaire pré-rempli, existant, gated de fait car cet écran n'apparaît que quand `allRequiredDone`). Cette route a donc été retirée du plan (YAGNI) ; seuls le zip et l'email sont des routes réellement nouvelles.
- **Finding hors périmètre, à traiter séparément** : `app/document/[...path]/page.tsx` (`loadBundleSharedValues`) charge un `BundleRun` par `bundleRunId` SANS vérifier la propriété (userId/sessionId) — contrairement à `/api/documents/bundles/[id]/run` (PATCH) qui le fait. Un `bundleRunId` deviné y expose des valeurs de préremplissage (NISS, adresse...) d'un autre dossier. Pré-existant, pas introduit par ce plan — à signaler séparément (spawn_task) plutôt que corrigé ici (hors scope).
