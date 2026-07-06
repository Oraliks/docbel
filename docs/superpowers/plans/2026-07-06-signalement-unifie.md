# Système de signalement unifié — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les 5 signalements épars (bureaux, validation formulaire, formations, traductions, RioLex) par un modèle `Report` unique, une API générique, un composant réutilisable et une page admin `/admin/signalements`.

**Architecture:** Nouvelle table `Report` (type en `String` + registre applicatif extensible, pas d'enum Postgres). Moteur partagé (`lib/reports/engine.ts`) pour créer/lister/mettre à jour, consommé par une route publique unique et 3 routes admin. Les 4 UIs publiques existantes gardent leur markup et sont juste rebranchées sur la nouvelle route ; RioLex (actuellement `mailto:` sans DB) gagne un vrai formulaire via le nouveau composant `<ReportButton>`. Migration additive puis backfill des 4 anciennes tables une fois les sources rebranchées.

**Tech Stack:** Next.js 16 (App Router) · Prisma 5 / PostgreSQL (Neon) · Zod 4 · next-intl v4 · shadcn/ui (base-ui) · vitest · better-auth.

## Global Constraints

- Schéma DB : migration **additive et idempotente** (`CREATE TABLE/INDEX IF NOT EXISTS`) via `prisma db execute` — **jamais** `prisma db push` sur la Neon partagée.
- `status` en `String` documentée par commentaire (pas d'enum Postgres) — convention établie du projet (`BureauReport`, `FormValidationReport`, `TrainingReport`, `TranslationSuggestion` font toutes ainsi).
- `id` en `@default(cuid())` partout, comme les 4 modèles existants.
- Aucune FK sur `Report` (comme `TranslationSuggestion`/`TrainingReport` — évite les contraintes croisées fragiles).
- `params` est un `Promise` (Next 16). Réponses JSON en `charset=utf-8`.
- `requireAdminAuth` (`lib/auth-check.ts`) en tête de toute route admin. `ensureWriteAllowed` (`lib/admin/readonly-guard.ts`) en tête de toute route admin qui écrit (respect du mode lecture-seule impersonation).
- `git add` de chemins **explicites** uniquement (workdir partagé multi-agents) — jamais `-A`.
- `pnpm build` (typecheck), `pnpm test` (vitest), `pnpm i18n:check` doivent rester verts après chaque lot. `pnpm lint` : ne pas ajouter de nouvelles erreurs (74 préexistantes tolérées).
- Vérification manuelle finale (bout en bout, tous les points d'entrée) : faite par Oraliks, pas par l'agent.

**Écarts mineurs découverts pendant la recherche, par rapport au spec (`docs/superpowers/specs/2026-07-06-signalement-unifie-design.md`) :**
1. `status` est `String` (pas `enum ReportStatus`) — alignement sur la convention réelle du projet.
2. Les 4 UIs publiques existantes (bureaux, form-validation, formations, traductions) **gardent leur markup actuel** et sont seulement rebranchées côté fetch — `<ReportButton>` générique n'est utilisé que pour RioLex (seule intégration réellement neuve) et les futurs types. Réduit le risque visuel sur des UIs déjà en prod.
3. Accepter une suggestion de traduction déclenche un effet de bord (upsert `ContentTranslation`) préservé via un hook `onResolve` par type dans le registre.
4. Le rate-limit (5/h/IP) — qui n'existait déjà que pour bureaux et form-validation — est désormais appliqué uniformément aux 5 types pour les soumissions **anonymes** (pas pour les sessions authentifiées, jamais limitées aujourd'hui).

---

## File Structure

**Nouveaux fichiers :**
- `prisma/migrations/57_reports/migration.sql` — table `Report`
- `lib/reports/registry.ts` — config par type (schémas Zod, résolution de cible, garde, hook de résolution, catégories)
- `lib/reports/engine.ts` — `createReport`, `listReports`, `updateReport`, `mapLegacyStatus`
- `lib/reports/__tests__/registry.test.ts`, `lib/reports/__tests__/engine.test.ts`
- `app/api/reports/route.ts` — POST public unique
- `app/api/admin/reports/route.ts` — GET liste
- `app/api/admin/reports/[id]/route.ts` — PATCH
- `app/api/admin/reports/count/route.ts` — GET compteur
- `components/reports/use-report-submit.ts` — hook de soumission partagé
- `components/reports/report-button.tsx` — composant générique réutilisable
- `app/admin/signalements/page.tsx`, `app/admin/signalements/signalements-client.tsx`
- `scripts/backfill-reports.ts`

**Fichiers modifiés :**
- `prisma/schema.prisma` (+ modèle `Report`)
- `lib/activity-logger.ts` (+ `"report"` à `ActivityResource`)
- `components/nav-main.tsx`, `components/app-sidebar.tsx` (quick-link + badge)
- `app/outils/bureaux/_components/report-form.tsx` (rebranchement fetch)
- `components/pdf-forms/field-error-report.tsx` (rebranchement fetch)
- `app/formations/[slug]/training-detail-client.tsx` (rebranchement fetch de `ReportForm`)
- `components/i18n/suggest-correction.tsx` (rebranchement fetch)
- `components/reglementation/report-button.tsx` (mailto → vrai formulaire)
- `messages/fr.json` (+ namespace `public.reports.*`)

**Fichiers supprimés (au fil des lots, jamais en bloc) :**
- `app/api/bureaux/[id]/report/route.ts`, `app/api/form-validation/report/route.ts`, `app/api/formations/report/route.ts`, `app/api/translation-suggestions/route.ts`
- `app/admin/formations/signalements/**`, `app/admin/i18n/suggestions/page.tsx`, `components/admin/i18n/translation-suggestions-manager.tsx`, `components/admin/bureaux/reports-manager.tsx` (section reports)
- `app/api/admin/bureaux/reports/**`, `app/api/admin/formations/reports/**`, `app/api/admin/translation-suggestions/**`

**Hors de ce plan (suivi séparé, sur feu vert d'Oraliks) :** suppression des modèles Prisma `BureauReport`, `FormValidationReport`, `TrainingReport`, `TranslationSuggestion` — seule étape réellement irréversible.

---

### Task 1: Migration Prisma — table `Report`

**Files:**
- Modify: `prisma/schema.prisma` (ajouter le modèle, en fin de fichier)
- Create: `prisma/migrations/57_reports/migration.sql`

**Interfaces:**
- Produces: modèle Prisma `Report` avec les champs `id, type, status, message, targetId, targetLabel, targetUrl, payload, reporterEmail, reporterId, reporterOrg, ipHash, userAgent, adminNote, actionTaken, resolvedById, resolvedAt, createdAt, updatedAt` — consommé par `lib/reports/engine.ts` (Task 3).

- [ ] **Step 1: Ajouter le modèle dans `prisma/schema.prisma`**

Ajouter à la fin du fichier :

```prisma
/// Signalement unifié : remplace BureauReport, FormValidationReport,
/// TrainingReport, TranslationSuggestion (backfill en Task 17) + RioLex
/// (mailto, Task 16). `type` reste une String (pas un enum Postgres) :
/// ajouter un type ne doit jamais nécessiter de migration — cf.
/// lib/reports/registry.ts. `status` : pending | in_progress | resolved | dismissed.
model Report {
  id            String    @id @default(cuid())
  type          String
  status        String    @default("pending")

  message       String?
  targetId      String?
  targetLabel   String?
  targetUrl     String?

  payload       Json

  reporterEmail String?
  reporterId    String?
  reporterOrg   String?
  ipHash        String?
  userAgent     String?

  adminNote     String?
  actionTaken   String?
  resolvedById  String?
  resolvedAt    DateTime?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([type, status])
  @@index([targetId])
  @@index([createdAt(sort: Desc)])
}
```

- [ ] **Step 2: Écrire la migration SQL additive et idempotente**

Créer `prisma/migrations/57_reports/migration.sql` :

```sql
-- Migration 57 — Report : signalement unifié qui remplace BureauReport,
-- FormValidationReport, TrainingReport, TranslationSuggestion (backfill,
-- Task 17) + RioLex (mailto, Task 16). ADDITIVE & idempotente → sûre sur
-- la base Neon partagée. Via `prisma db execute`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "targetUrl" TEXT,
    "payload" JSONB NOT NULL,
    "reporterEmail" TEXT,
    "reporterId" TEXT,
    "reporterOrg" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "adminNote" TEXT,
    "actionTaken" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Report_type_status_idx" ON "Report"("type", "status");
CREATE INDEX IF NOT EXISTS "Report_targetId_idx" ON "Report"("targetId");
CREATE INDEX IF NOT EXISTS "Report_createdAt_idx" ON "Report"("createdAt" DESC);
```

- [ ] **Step 3: Arrêter le dev server**

Le régénérer pendant qu'il tourne provoque un lock Windows (EPERM). Vérifier qu'aucun `pnpm dev` ne tourne avant de continuer.

- [ ] **Step 4: Appliquer la migration sur Neon**

Run: `pnpm exec dotenv -e .env.local -- prisma db execute --file prisma/migrations/57_reports/migration.sql --schema prisma/schema.prisma`
Expected: pas d'erreur, la commande se termine sans sortie d'erreur.

- [ ] **Step 5: Marquer la migration comme appliquée dans l'historique Prisma**

Run: `pnpm exec dotenv -e .env.local -- prisma migrate resolve --applied 57_reports`
Expected: `Migration 57_reports marked as applied.`

- [ ] **Step 6: Régénérer le client Prisma**

Run: `pnpm exec dotenv -e .env.local -- prisma generate`
Expected: `Generated Prisma Client` sans erreur.

- [ ] **Step 7: Vérifier que le typecheck reconnaît le nouveau modèle**

Run: `pnpm build`
Expected: build réussi (confirme que `prisma.report` est bien typé).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/57_reports/migration.sql
git commit -m "feat(reports): migration additive table Report unifiée"
```

---

### Task 2: Registre des types (`lib/reports/registry.ts`)

**Files:**
- Create: `lib/reports/registry.ts`
- Test: `lib/reports/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `blockIfFlagOff` (`@/lib/formations/module-guard`)
- Produces: `export interface ReportTypeConfig { label: string; payloadSchema: z.ZodType; messageSchema: z.ZodType<string | undefined>; categories?: readonly {value: string; label: string}[]; guard?: () => Promise<{ blocked: false } | { blocked: true; status: number; error: string }>; resolveTarget: (targetId: string | undefined, payload: unknown) => Promise<{ ok: true; targetLabel: string | null; targetUrl: string | null } | { ok: false }>; onResolve?: (report: { id: string; targetId: string | null; payload: unknown }, resolvedBy: string) => Promise<void>; }`
  `export const REPORT_TYPES: Record<string, ReportTypeConfig>`
  `export function isKnownReportType(type: string): type is keyof typeof REPORT_TYPES`
  Consommé par `lib/reports/engine.ts` (Task 3) et les routes API (Tasks 4-6).

- [ ] **Step 1: Écrire le test des schémas Zod par type (échoue, le fichier n'existe pas encore)**

Créer `lib/reports/__tests__/registry.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { REPORT_TYPES, isKnownReportType } from "@/lib/reports/registry";

describe("isKnownReportType", () => {
  it("reconnaît les 5 types initiaux", () => {
    expect(isKnownReportType("bureau")).toBe(true);
    expect(isKnownReportType("form_validation")).toBe(true);
    expect(isKnownReportType("training")).toBe(true);
    expect(isKnownReportType("translation")).toBe(true);
    expect(isKnownReportType("riolex_article")).toBe(true);
  });
  it("rejette un type inconnu", () => {
    expect(isKnownReportType("inexistant")).toBe(false);
  });
});

describe("bureau payloadSchema", () => {
  it("accepte une catégorie valide", () => {
    const r = REPORT_TYPES.bureau.payloadSchema.safeParse({ category: "hours" });
    expect(r.success).toBe(true);
  });
  it("rejette une catégorie invalide", () => {
    const r = REPORT_TYPES.bureau.payloadSchema.safeParse({ category: "nope" });
    expect(r.success).toBe(false);
  });
});

describe("bureau messageSchema", () => {
  it("rejette un message trop court", () => {
    expect(REPORT_TYPES.bureau.messageSchema.safeParse("abc").success).toBe(false);
  });
  it("accepte un message de 5 à 1000 caractères", () => {
    expect(REPORT_TYPES.bureau.messageSchema.safeParse("abcde").success).toBe(true);
    expect(REPORT_TYPES.bureau.messageSchema.safeParse("a".repeat(1001)).success).toBe(false);
  });
});

describe("form_validation payloadSchema", () => {
  it("exige fieldId, fieldType, rejectedValue, errorMessage", () => {
    const r = REPORT_TYPES.form_validation.payloadSchema.safeParse({
      fieldId: "niss", fieldType: "niss", rejectedValue: "123", errorMessage: "Format invalide",
    });
    expect(r.success).toBe(true);
  });
  it("rejette si errorMessage manque", () => {
    const r = REPORT_TYPES.form_validation.payloadSchema.safeParse({
      fieldId: "niss", fieldType: "niss", rejectedValue: "123",
    });
    expect(r.success).toBe(false);
  });
});

describe("training payloadSchema", () => {
  it("accepte une raison valide", () => {
    expect(REPORT_TYPES.training.payloadSchema.safeParse({ reason: "prix_trompeur" }).success).toBe(true);
  });
  it("rejette une raison inconnue", () => {
    expect(REPORT_TYPES.training.payloadSchema.safeParse({ reason: "invalide" }).success).toBe(false);
  });
});

describe("translation payloadSchema", () => {
  it("accepte une cible DB (model+recordId+field)", () => {
    const r = REPORT_TYPES.translation.payloadSchema.safeParse({
      locale: "nl", model: "News", recordId: "abc", field: "title",
      sourceText: "Titre FR", suggestedText: "NL titel",
    });
    expect(r.success).toBe(true);
  });
  it("accepte une cible UI (uiKey)", () => {
    const r = REPORT_TYPES.translation.payloadSchema.safeParse({
      locale: "nl", uiKey: "public.home.heroTitle",
      sourceText: "Titre FR", suggestedText: "NL titel",
    });
    expect(r.success).toBe(true);
  });
  it("rejette si ni cible DB ni uiKey", () => {
    const r = REPORT_TYPES.translation.payloadSchema.safeParse({
      locale: "nl", sourceText: "Titre FR", suggestedText: "NL titel",
    });
    expect(r.success).toBe(false);
  });
});

describe("riolex_article payloadSchema", () => {
  it("exige loi et articleNumber", () => {
    expect(REPORT_TYPES.riolex_article.payloadSchema.safeParse({ loi: "AR 25/11/1991", articleNumber: "45" }).success).toBe(true);
    expect(REPORT_TYPES.riolex_article.payloadSchema.safeParse({ loi: "AR 25/11/1991" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm exec vitest run lib/reports/__tests__/registry.test.ts`
Expected: FAIL — `Cannot find module '@/lib/reports/registry'`

- [ ] **Step 3: Écrire `lib/reports/registry.ts`**

```ts
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { blockIfFlagOff } from "@/lib/formations/module-guard";

export interface ReportTypeConfig {
  label: string;
  payloadSchema: z.ZodType;
  messageSchema: z.ZodType<string | undefined>;
  categories?: readonly { value: string; label: string }[];
  /// Vérification globale avant toute création (ex. feature flag). Le
  /// moteur propage status/error tels quels — pas de NextResponse ici pour
  /// que lib/reports/engine.ts reste indépendant de next/server.
  guard?: () => Promise<{ blocked: false } | { blocked: true; status: number; error: string }>;
  /// Résolution best-effort du libellé/lien affichés en admin. `ok: false`
  /// signifie "cible obligatoire introuvable" → l'appelant renvoie 404.
  /// Les types qui n'ont jamais besoin de bloquer renvoient toujours `ok: true`.
  resolveTarget: (
    targetId: string | undefined,
    payload: unknown,
  ) => Promise<
    | { ok: true; targetLabel: string | null; targetUrl: string | null }
    | { ok: false }
  >;
  /// Effet de bord optionnel exécuté quand le statut passe à "resolved".
  onResolve?: (
    report: { id: string; targetId: string | null; payload: unknown },
    resolvedBy: string,
  ) => Promise<void>;
}

const emailOptional = z.string().trim().email().max(320).optional();

export const BUREAU_CATEGORIES = [
  { value: "hours", label: "Horaires incorrects" },
  { value: "address", label: "Adresse incorrecte" },
  { value: "phone", label: "Téléphone incorrect" },
  { value: "closed", label: "Bureau fermé / déplacé" },
  { value: "other", label: "Autre" },
] as const;

export const TRAINING_REASONS = [
  { value: "prix_trompeur", label: "Prix trompeur" },
  { value: "info_fausse", label: "Information fausse" },
  { value: "non_serieuse", label: "Formation non sérieuse" },
  { value: "probleme_partenaire", label: "Problème avec le partenaire" },
  { value: "contenu_inadapte", label: "Contenu inadapté" },
  { value: "lien_casse", label: "Lien cassé" },
  { value: "expiree", label: "Formation expirée" },
  { value: "probleme_inscription", label: "Problème d'inscription" },
  { value: "autre", label: "Autre" },
] as const;

export const REPORT_TYPES: Record<string, ReportTypeConfig> = {
  bureau: {
    label: "Bureaux",
    payloadSchema: z.object({
      category: z.enum(["hours", "address", "phone", "closed", "other"]),
    }),
    messageSchema: z.string().trim().min(5).max(1000),
    categories: BUREAU_CATEGORIES,
    resolveTarget: async (targetId) => {
      if (!targetId) return { ok: false };
      const bureau = await prisma.bureau.findUnique({
        where: { id: targetId },
        select: { name: true, postalCode: true, city: true },
      });
      if (!bureau) return { ok: false };
      return {
        ok: true,
        targetLabel: `${bureau.name} (${bureau.postalCode} ${bureau.city})`,
        targetUrl: "/outils/bureaux",
      };
    },
  },

  form_validation: {
    label: "Validation formulaire",
    payloadSchema: z.object({
      fieldId: z.string().trim().min(1).max(100),
      fieldType: z.string().trim().min(1).max(50),
      rejectedValue: z.string().max(500),
      errorMessage: z.string().trim().min(1).max(500),
      formSlug: z.string().max(200).optional(),
      locale: z.enum(["fr", "nl", "de"]).optional(),
    }),
    messageSchema: z.string().trim().max(1000).optional(),
    resolveTarget: async (targetId, payload) => {
      const p = payload as { fieldId: string; formSlug?: string };
      if (targetId) {
        const form = await prisma.pdfForm.findUnique({
          where: { id: targetId },
          select: { title: true, slug: true },
        });
        if (form) {
          return {
            ok: true,
            targetLabel: `${form.title} — champ ${p.fieldId}`,
            targetUrl: `/d/${form.slug}`,
          };
        }
      }
      if (p.formSlug) {
        return {
          ok: true,
          targetLabel: `${p.formSlug} — champ ${p.fieldId}`,
          targetUrl: `/d/${p.formSlug}`,
        };
      }
      // Jamais bloquant : le formulaire d'origine était déjà optionnel.
      return { ok: true, targetLabel: `Champ ${p.fieldId}`, targetUrl: null };
    },
  },

  training: {
    label: "Formations",
    payloadSchema: z.object({
      reason: z.enum([
        "prix_trompeur", "info_fausse", "non_serieuse", "probleme_partenaire",
        "contenu_inadapte", "lien_casse", "expiree", "probleme_inscription", "autre",
      ]),
    }),
    messageSchema: z.string().trim().max(2000).optional(),
    categories: TRAINING_REASONS,
    guard: async () => {
      const blocked = await blockIfFlagOff("catalog");
      return blocked
        ? { blocked: true, status: 404, error: "Fonctionnalité indisponible" }
        : { blocked: false };
    },
    resolveTarget: async (targetId) => {
      if (!targetId) return { ok: false };
      const training = await prisma.training.findUnique({
        where: { id: targetId },
        select: { title: true, slug: true },
      });
      if (!training) return { ok: false };
      return { ok: true, targetLabel: training.title, targetUrl: `/formations/${training.slug}` };
    },
  },

  translation: {
    label: "Traductions",
    payloadSchema: z
      .object({
        locale: z.string().trim().min(2).max(10),
        model: z.string().trim().min(1).max(80).optional(),
        recordId: z.string().trim().min(1).max(120).optional(),
        field: z.string().trim().min(1).max(80).optional(),
        uiKey: z.string().trim().min(1).max(200).optional(),
        sourceText: z.string().trim().min(1).max(20000),
        currentText: z.string().trim().max(20000).optional(),
        suggestedText: z.string().trim().min(1).max(20000),
      })
      .refine((d) => (!!d.model && !!d.recordId && !!d.field) || !!d.uiKey, {
        message: "Cible requise : (model + recordId + field) OU uiKey.",
        path: ["uiKey"],
      }),
    messageSchema: z.string().trim().max(2000).optional(),
    resolveTarget: async (targetId, payload) => {
      const p = payload as { model?: string; field?: string; uiKey?: string };
      const targetLabel = p.uiKey ? `UI · ${p.uiKey}` : `${p.model}#${targetId}.${p.field}`;
      return { ok: true, targetLabel, targetUrl: null };
    },
    onResolve: async (report, resolvedBy) => {
      const p = report.payload as {
        model?: string; recordId?: string; field?: string;
        suggestedText: string; locale: string;
      };
      if (!p.model || !p.recordId || !p.field) return; // cible UI : reporté manuellement par l'admin
      await prisma.contentTranslation.upsert({
        where: {
          model_recordId_field_locale: {
            model: p.model, recordId: p.recordId, field: p.field, locale: p.locale,
          },
        },
        update: { value: p.suggestedText, status: "reviewed", updatedBy: resolvedBy },
        create: {
          model: p.model, recordId: p.recordId, field: p.field, locale: p.locale,
          value: p.suggestedText, status: "reviewed", updatedBy: resolvedBy,
        },
      });
    },
  },

  riolex_article: {
    label: "Réglementation (RioLex)",
    payloadSchema: z.object({
      loi: z.string().trim().min(1).max(200),
      articleNumber: z.string().trim().min(1).max(50),
    }),
    messageSchema: z.string().trim().min(5).max(1000),
    resolveTarget: async (targetId, payload) => {
      const p = payload as { loi: string; articleNumber: string };
      return {
        ok: true,
        targetLabel: `${p.loi} art. ${p.articleNumber}`,
        targetUrl: targetId ? `/partenaire/reglementation/${targetId}` : null,
      };
    },
  },
};

export function isKnownReportType(type: string): type is keyof typeof REPORT_TYPES {
  return Object.prototype.hasOwnProperty.call(REPORT_TYPES, type);
}

export { emailOptional };
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `pnpm exec vitest run lib/reports/__tests__/registry.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 6: Commit**

```bash
git add lib/reports/registry.ts lib/reports/__tests__/registry.test.ts
git commit -m "feat(reports): registre des types de signalement"
```

---

### Task 3: Moteur (`lib/reports/engine.ts`)

**Files:**
- Create: `lib/reports/engine.ts`
- Test: `lib/reports/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: `REPORT_TYPES`, `isKnownReportType` (`@/lib/reports/registry`, Task 2), `prisma` (`@/lib/prisma`), `checkRateLimit`, `getClientIp`, `sha256Hex` (`@/lib/pdf-forms/security`)
- Produces:
  `export function mapLegacyStatus(legacy: "pending"|"new"|"in_progress"|"resolved"|"accepted"|"dismissed"|"rejected"): string`
  `export interface CreateReportInput { type: string; targetId?: string; message?: string; payload: unknown; reporterEmail?: string; session: { id: string; email?: string | null; partnerOrganization?: string | null; segment?: string | null; vatNumber?: string | null } | null; ip: string; userAgent: string | null }`
  `export async function createReport(input: CreateReportInput): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }>`
  `export async function listReports(params: { type?: string; status?: string; limit?: number }): Promise<Array<Awaited<ReturnType<typeof prisma.report.findUnique>>>>` (liste typée `Report[]`)
  `export async function updateReport(input: { id: string; status?: string; adminNote?: string; actionTaken?: string; resolvedBy: string }): Promise<{ ok: true; report: /* Report */ unknown } | { ok: false; status: number; error: string }>`
  Consommé par les routes API (Tasks 4-6).

- [ ] **Step 1: Écrire le test de `mapLegacyStatus` (échoue, fichier inexistant)**

Créer `lib/reports/__tests__/engine.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mapLegacyStatus } from "@/lib/reports/engine";

describe("mapLegacyStatus", () => {
  it("mappe les statuts identiques tels quels", () => {
    expect(mapLegacyStatus("pending")).toBe("pending");
    expect(mapLegacyStatus("in_progress")).toBe("in_progress");
    expect(mapLegacyStatus("resolved")).toBe("resolved");
    expect(mapLegacyStatus("dismissed")).toBe("dismissed");
  });
  it("mappe new (Training) vers pending", () => {
    expect(mapLegacyStatus("new")).toBe("pending");
  });
  it("mappe accepted (Translation) vers resolved", () => {
    expect(mapLegacyStatus("accepted")).toBe("resolved");
  });
  it("mappe rejected (Training, Translation) vers dismissed", () => {
    expect(mapLegacyStatus("rejected")).toBe("dismissed");
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm exec vitest run lib/reports/__tests__/engine.test.ts`
Expected: FAIL — `Cannot find module '@/lib/reports/engine'`

- [ ] **Step 3: Écrire `lib/reports/engine.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, sha256Hex } from "@/lib/pdf-forms/security";
import { REPORT_TYPES, isKnownReportType } from "@/lib/reports/registry";

export type LegacyStatus =
  | "pending" | "new" | "in_progress" | "resolved" | "accepted" | "dismissed" | "rejected";

/// Mappe les 3 vocabulaires de statut hérités vers le vocabulaire unifié
/// (pending | in_progress | resolved | dismissed) — utilisé par le backfill
/// (Task 17) pour préserver l'historique.
export function mapLegacyStatus(legacy: LegacyStatus): string {
  switch (legacy) {
    case "new":
      return "pending";
    case "accepted":
      return "resolved";
    case "rejected":
      return "dismissed";
    default:
      return legacy;
  }
}

export interface ReportSession {
  id: string;
  email?: string | null;
  partnerOrganization?: string | null;
  segment?: string | null;
  vatNumber?: string | null;
}

export interface CreateReportInput {
  type: string;
  targetId?: string;
  message?: string;
  payload: unknown;
  reporterEmail?: string;
  session: ReportSession | null;
  ip: string;
  userAgent: string | null;
}

export type CreateReportResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

/// Résout l'organisation à snapshotter sur le signalement pour une session
/// connectée : `partnerOrganization` pour les partenaires, sinon un libellé
/// dérivé du n° de TVA pour les employeurs (aucun nom d'entreprise en base
/// aujourd'hui), sinon null (admin ou compte sans organisation).
function resolveReporterOrg(session: ReportSession): string | null {
  if (session.partnerOrganization) return session.partnerOrganization;
  if (session.vatNumber) return `Employeur ${session.vatNumber}`;
  return null;
}

export async function createReport(input: CreateReportInput): Promise<CreateReportResult> {
  if (!isKnownReportType(input.type)) {
    return { ok: false, status: 400, error: `Type de signalement inconnu : ${input.type}` };
  }
  const config = REPORT_TYPES[input.type];

  if (config.guard) {
    const guardResult = await config.guard();
    if (guardResult.blocked) {
      return { ok: false, status: guardResult.status, error: guardResult.error };
    }
  }

  const isAnonymous = !input.session;
  if (isAnonymous) {
    const rl = checkRateLimit(`reports:${input.type}:${input.ip}`, { windowMs: 60 * 60_000, max: 5 });
    if (!rl.ok) {
      return { ok: false, status: 429, error: "Trop de signalements depuis cette adresse. Réessayez dans une heure." };
    }
  }

  const payloadCheck = config.payloadSchema.safeParse(input.payload);
  if (!payloadCheck.success) {
    return { ok: false, status: 400, error: "Payload invalide pour ce type de signalement" };
  }
  const messageCheck = config.messageSchema.safeParse(input.message);
  if (!messageCheck.success) {
    return { ok: false, status: 400, error: "Message invalide" };
  }

  const target = await config.resolveTarget(input.targetId, payloadCheck.data);
  if (!target.ok) {
    return { ok: false, status: 404, error: "Cible du signalement introuvable" };
  }

  const created = await prisma.report.create({
    data: {
      type: input.type,
      status: "pending",
      message: messageCheck.data ?? null,
      targetId: input.targetId ?? null,
      targetLabel: target.targetLabel,
      targetUrl: target.targetUrl,
      payload: payloadCheck.data as object,
      reporterEmail: isAnonymous ? (input.reporterEmail ?? null) : null,
      reporterId: input.session?.id ?? null,
      reporterOrg: input.session ? resolveReporterOrg(input.session) : null,
      ipHash: isAnonymous ? sha256Hex(input.ip).slice(0, 16) : null,
      userAgent: input.userAgent?.slice(0, 200) ?? null,
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}

export interface ListReportsParams {
  type?: string;
  status?: string;
  limit?: number;
}

export async function listReports(params: ListReportsParams) {
  const where: { type?: string; status?: string } = {};
  if (params.type && params.type !== "all") where.type = params.type;
  if (params.status && params.status !== "all") where.status = params.status;
  return prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 50, 200),
  });
}

export interface UpdateReportInput {
  id: string;
  status?: string;
  adminNote?: string;
  actionTaken?: string;
  resolvedBy: string;
}

export type UpdateReportResult =
  | { ok: true; report: Awaited<ReturnType<typeof prisma.report.update>> }
  | { ok: false; status: number; error: string };

export async function updateReport(input: UpdateReportInput): Promise<UpdateReportResult> {
  const existing = await prisma.report.findUnique({ where: { id: input.id } });
  if (!existing) {
    return { ok: false, status: 404, error: "Signalement introuvable" };
  }

  const data: {
    status?: string; adminNote?: string; actionTaken?: string;
    resolvedById?: string | null; resolvedAt?: Date | null;
  } = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.adminNote !== undefined) data.adminNote = input.adminNote;
  if (input.actionTaken !== undefined) data.actionTaken = input.actionTaken;

  if (input.status === "resolved" || input.status === "dismissed") {
    data.resolvedById = input.resolvedBy;
    data.resolvedAt = new Date();
  } else if (input.status === "pending" || input.status === "in_progress") {
    data.resolvedById = null;
    data.resolvedAt = null;
  }

  const updated = await prisma.report.update({ where: { id: input.id }, data });

  if (input.status === "resolved") {
    const config = REPORT_TYPES[existing.type];
    if (config?.onResolve) {
      await config.onResolve(
        { id: updated.id, targetId: updated.targetId, payload: updated.payload },
        input.resolvedBy,
      );
    }
  }

  return { ok: true, report: updated };
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `pnpm exec vitest run lib/reports/__tests__/engine.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 6: Commit**

```bash
git add lib/reports/engine.ts lib/reports/__tests__/engine.test.ts
git commit -m "feat(reports): moteur createReport/listReports/updateReport"
```

---

### Task 4: Route publique `POST /api/reports`

**Files:**
- Create: `app/api/reports/route.ts`

**Interfaces:**
- Consumes: `createReport` (`@/lib/reports/engine`, Task 3), `getClientIp` (`@/lib/pdf-forms/security`), `auth` (`@/lib/auth`), `headers` (`next/headers`)
- Produces: `POST /api/reports` — body `{ type, targetId?, message?, payload, reporterEmail? }` → `201 { ok: true, id }` ou erreur `{ error }`. Consommé par `useReportSubmit` (Task 7) et les 5 intégrations (Tasks 12-16).

- [ ] **Step 1: Écrire la route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/pdf-forms/security";
import { createReport } from "@/lib/reports/engine";

const json = { "Content-Type": "application/json; charset=utf-8" };

interface Body {
  type?: string;
  targetId?: string;
  message?: string;
  payload?: unknown;
  reporterEmail?: string;
}

/// POST /api/reports — point d'entrée unique pour tous les signalements
/// (remplace bureaux/form-validation/formations/translation-suggestions).
/// Anonyme si pas de session (email optionnel, rate-limité) ; identité
/// auto-remplie si connecté (partenaire/employeur/admin), jamais limité.
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }

  if (typeof body.type !== "string" || !body.type) {
    return NextResponse.json({ error: "type requis" }, { status: 400, headers: json });
  }

  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  const result = await createReport({
    type: body.type,
    targetId: typeof body.targetId === "string" ? body.targetId : undefined,
    message: typeof body.message === "string" ? body.message : undefined,
    payload: body.payload ?? {},
    reporterEmail: typeof body.reporterEmail === "string" ? body.reporterEmail : undefined,
    session: session?.user
      ? {
          id: session.user.id,
          email: session.user.email,
          partnerOrganization: (session.user as { partnerOrganization?: string | null }).partnerOrganization ?? null,
          segment: (session.user as { segment?: string | null }).segment ?? null,
          vatNumber: (session.user as { vatNumber?: string | null }).vatNumber ?? null,
        }
      : null,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: json });
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 201, headers: json });
}
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 3: Vérification manuelle**

Démarrer le serveur (`pnpm dev`), puis :
```bash
curl -X POST http://localhost:3000/api/reports -H "Content-Type: application/json" -d "{\"type\":\"riolex_article\",\"targetId\":\"test-123\",\"message\":\"Article incohérent avec la version publiée.\",\"payload\":{\"loi\":\"AR test\",\"articleNumber\":\"1\"}}"
```
Expected : `{"ok":true,"id":"..."}` avec status 201. Vérifier en DB (`pnpm exec prisma studio` ou requête directe) qu'une ligne `Report` a été créée avec `type=riolex_article`, `status=pending`, `ipHash` renseigné.

- [ ] **Step 4: Commit**

```bash
git add app/api/reports/route.ts
git commit -m "feat(reports): route publique POST /api/reports"
```

---

### Task 5: Routes admin — liste + compteur

**Files:**
- Create: `app/api/admin/reports/route.ts`
- Create: `app/api/admin/reports/count/route.ts`

**Interfaces:**
- Consumes: `requireAdminAuth` (`@/lib/auth-check`), `listReports` (`@/lib/reports/engine`, Task 3), `prisma` (`@/lib/prisma`)
- Produces: `GET /api/admin/reports?type=&status=&limit=` → `{ items: Report[], total: number }`. `GET /api/admin/reports/count?status=pending` → `{ count: number }`. Consommé par la page admin (Tasks 9-10) et le badge sidebar (Task 11).

- [ ] **Step 1: Écrire `app/api/admin/reports/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { listReports } from "@/lib/reports/engine";

const json = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const sp = req.nextUrl.searchParams;
  const items = await listReports({
    type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? "pending",
    limit: Number(sp.get("limit")) || 50,
  });

  return NextResponse.json({ items, total: items.length }, { headers: json });
}
```

- [ ] **Step 2: Écrire `app/api/admin/reports/count/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// Alimente le badge sidebar (Task 11). Défaut : compte les "pending".
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const count = await prisma.report.count({ where: { status } });

  return NextResponse.json({ count }, { headers: json });
}
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 4: Vérification manuelle**

Connecté en admin dans le navigateur (pour avoir le cookie de session), ouvrir `http://localhost:3000/api/admin/reports?status=pending` et `http://localhost:3000/api/admin/reports/count` : les deux renvoient du JSON valide (pas 401). Sans session (navigation privée) : les deux renvoient 401.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/reports/route.ts app/api/admin/reports/count/route.ts
git commit -m "feat(reports): routes admin liste + compteur"
```

---

### Task 6: Route admin — PATCH (traitement)

**Files:**
- Create: `app/api/admin/reports/[id]/route.ts`
- Modify: `lib/activity-logger.ts:4` (ajouter `"report"` à `ActivityResource`)

**Interfaces:**
- Consumes: `requireAdminAuth` (`@/lib/auth-check`), `ensureWriteAllowed` (`@/lib/admin/readonly-guard`), `updateReport` (`@/lib/reports/engine`, Task 3), `logActivity` (`@/lib/activity-logger`)
- Produces: `PATCH /api/admin/reports/[id]` — body `{ status?, adminNote?, actionTaken? }` → `{ ok: true, report }`. Consommé par la page admin (Task 10).

- [ ] **Step 1: Ajouter `"report"` à `ActivityResource`**

Dans `lib/activity-logger.ts:4`, remplacer :
```ts
export type ActivityResource = "page" | "user" | "comment" | "setting" | "news" | "category" | "message" | "file" | "inbox" | "email" | "changelog" | "booking" | "employer" | "formation" | "training_session" | "enrollment" | "boussole" | "formation_org" | "formation_report" | "decision_tree";
```
par :
```ts
export type ActivityResource = "page" | "user" | "comment" | "setting" | "news" | "category" | "message" | "file" | "inbox" | "email" | "changelog" | "booking" | "employer" | "formation" | "training_session" | "enrollment" | "boussole" | "formation_org" | "formation_report" | "decision_tree" | "report";
```

- [ ] **Step 2: Écrire la route PATCH**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { updateReport } from "@/lib/reports/engine";

const json = { "Content-Type": "application/json; charset=utf-8" };

const bodySchema = z.object({
  status: z.enum(["pending", "in_progress", "resolved", "dismissed"]).optional(),
  adminNote: z.string().trim().max(2000).optional(),
  actionTaken: z.string().trim().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: json },
    );
  }

  const result = await updateReport({
    id,
    status: parsed.data.status,
    adminNote: parsed.data.adminNote,
    actionTaken: parsed.data.actionTaken,
    resolvedBy: auth.user.email || auth.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: json });
  }

  await logActivity(
    auth.user.name,
    parsed.data.status === "resolved" ? "approved" : parsed.data.status === "dismissed" ? "rejected" : "updated",
    "report",
    `Signalement ${result.report.type} ${id.slice(0, 8)}`,
    id,
    parsed.data.status ? `statut=${parsed.data.status}` : undefined,
  );

  return NextResponse.json({ ok: true, report: result.report }, { headers: json });
}
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 4: Vérification manuelle**

Reprendre l'id créé au Test 4 (curl POST) : `curl -X PATCH http://localhost:3000/api/admin/reports/<id> -H "Content-Type: application/json" -b "<cookie de session admin>" -d "{\"status\":\"resolved\",\"adminNote\":\"Vérifié, corrigé.\"}"` → `{"ok":true,"report":{...,"status":"resolved","resolvedAt":"...","resolvedById":"..."}}`. Vérifier dans `/admin/activity` qu'une entrée apparaît.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/reports/[id]/route.ts lib/activity-logger.ts
git commit -m "feat(reports): route admin PATCH traitement signalement"
```

---

### Task 7: Hook de soumission (`useReportSubmit`)

**Files:**
- Create: `components/reports/use-report-submit.ts`

**Interfaces:**
- Produces: `export function useReportSubmit(type: string): { submit: (input: { targetId?: string; message?: string; payload: unknown; reporterEmail?: string }) => Promise<{ ok: true } | { ok: false; error: string }>; status: "idle" | "submitting" | "done" | "error"; error: string | null; reset: () => void }`. Consommé par `<ReportButton>` (Task 8) et les 5 intégrations rebranchées (Tasks 12-16).

- [ ] **Step 1: Écrire le hook**

```ts
"use client";

import { useCallback, useState } from "react";

export type ReportSubmitStatus = "idle" | "submitting" | "done" | "error";

export interface ReportSubmitInput {
  targetId?: string;
  message?: string;
  payload: unknown;
  reporterEmail?: string;
}

export type ReportSubmitResult = { ok: true } | { ok: false; error: string };

/// Logique de soumission partagée par toutes les intégrations de
/// signalement (composant générique + les 5 UIs existantes rebranchées).
/// Un seul endroit qui connaît l'URL /api/reports et la forme du body.
export function useReportSubmit(type: string) {
  const [status, setStatus] = useState<ReportSubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (input: ReportSubmitInput): Promise<ReportSubmitResult> => {
      setStatus("submitting");
      setError(null);
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, ...input }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          const message = body.error ?? "Échec de l'envoi du signalement.";
          setStatus("error");
          setError(message);
          return { ok: false, error: message };
        }
        setStatus("done");
        return { ok: true };
      } catch {
        const message = "Réseau indisponible. Réessayez.";
        setStatus("error");
        setError(message);
        return { ok: false, error: message };
      }
    },
    [type],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { submit, status, error, reset };
}
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 3: Commit**

```bash
git add components/reports/use-report-submit.ts
git commit -m "feat(reports): hook useReportSubmit partagé"
```

---

### Task 8: Composant générique `<ReportButton>`

**Files:**
- Create: `components/reports/report-button.tsx`
- Modify: `messages/fr.json` (+ namespace `public.reports`)

**Interfaces:**
- Consumes: `useReportSubmit` (`@/components/reports/use-report-submit`, Task 7), `REPORT_TYPES` categories (via props, pas d'import direct côté client — les catégories sont passées en props pour ne pas exposer `lib/reports/registry.ts` (server-only, dépend de `@/lib/prisma`) au bundle client)
- Produces: `export function ReportButton(props: { type: string; targetId?: string; categories?: readonly {value: string; label: string}[]; triggerLabel?: string; dialogTitle?: string }): JSX.Element`. Première consommation : RioLex (Task 16).

- [ ] **Step 1: Ajouter les clés i18n**

Dans `messages/fr.json`, sous la clé `"public"`, ajouter une nouvelle section `"reports"` :

```json
"reports": {
  "triggerLabel": "Signaler une erreur",
  "dialogTitle": "Signaler un problème",
  "dialogDescription": "Décrivez le problème constaté, on regarde de notre côté.",
  "categoryLabel": "Catégorie",
  "messageLabel": "Description",
  "messagePlaceholder": "Décrivez le problème constaté",
  "emailLabel": "Votre email (optionnel — pour qu'on vous réponde)",
  "emailPlaceholder": "vous@exemple.be",
  "submit": "Envoyer le signalement",
  "submitting": "Envoi…",
  "cancel": "Annuler",
  "close": "Fermer",
  "doneMessage": "Merci ! Votre signalement a bien été transmis.",
  "rateLimited": "Trop de signalements envoyés. Réessayez dans une heure."
}
```

- [ ] **Step 2: Écrire le composant**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportSubmit } from "@/components/reports/use-report-submit";

export interface ReportButtonProps {
  type: string;
  targetId?: string;
  /// Catégories affichées en select (ex. raisons RioLex/formations). Absent
  /// = pas de select, juste le message libre.
  categories?: readonly { value: string; label: string }[];
  /// Payload additionnel fixe à joindre (ex. { loi, articleNumber } pour RioLex).
  extraPayload?: Record<string, unknown>;
  triggerLabel?: string;
  dialogTitle?: string;
}

/// Bouton + dialog de signalement générique, réutilisable pour toute
/// nouvelle fonctionnalité. Anonyme (email optionnel) ou auto-identifié
/// (aucun champ) selon la session — décidé serveur, pas ici : ce composant
/// envoie juste `reporterEmail` si rempli, le serveur l'ignore s'il y a une
/// session active.
export function ReportButton({
  type,
  targetId,
  categories,
  extraPayload,
  triggerLabel,
  dialogTitle,
}: ReportButtonProps) {
  const t = useTranslations("public.reports");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(categories?.[0]?.value ?? "");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const { submit, status, error } = useReportSubmit(type);

  async function handleSubmit() {
    const payload = { ...(extraPayload ?? {}), ...(categories ? { category } : {}) };
    await submit({ targetId, message: message.trim(), payload, reporterEmail: email.trim() || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground print:hidden"
          >
            <Flag className="size-4" aria-hidden />
            {triggerLabel ?? t("triggerLabel")}
          </button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle ?? t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        {status === "done" ? (
          <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-800 dark:text-green-300">
            {t("doneMessage")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {categories ? (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("categoryLabel")}</Label>
                <Select value={category} onValueChange={(v) => setCategory(v ?? categories[0].value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <Label htmlFor="report-message" className="text-xs">
                {t("messageLabel")}
              </Label>
              <Textarea
                id="report-message"
                rows={3}
                maxLength={1000}
                placeholder={t("messagePlaceholder")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="report-email" className="text-xs">
                {t("emailLabel")}
              </Label>
              <Input
                id="report-email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          {status === "done" ? (
            <Button type="button" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={status === "submitting"}>
                {status === "submitting" ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
                {status === "submitting" ? t("submitting") : t("submit")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 4: i18n check**

Run: `pnpm i18n:check`
Expected: signale les langues sans le nouveau namespace `public.reports.*` (attendu — à traduire dans les autres `messages/*.json` en suivant le même workflow que le reste du projet ; le FR source suffit pour que la fonctionnalité marche en attendant, fallback FR déjà en place partout ailleurs).

- [ ] **Step 5: Commit**

```bash
git add components/reports/report-button.tsx messages/fr.json
git commit -m "feat(reports): composant générique ReportButton"
```

---

### Task 9: Page admin `/admin/signalements` — liste + filtres

**Files:**
- Create: `app/admin/signalements/page.tsx`
- Create: `app/admin/signalements/signalements-client.tsx`

**Interfaces:**
- Consumes: `requireAdminAuth` (`@/lib/auth-check`), `listReports` (`@/lib/reports/engine`, Task 3), `REPORT_TYPES` (`@/lib/reports/registry`, Task 2, pour les libellés de filtre)
- Produces: page rendue en liste filtrable. Étendue en Task 10 (panneau détail + actions).

- [ ] **Step 1: Écrire la page serveur**

```tsx
import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth-check";
import { listReports } from "@/lib/reports/engine";
import { REPORT_TYPES } from "@/lib/reports/registry";
import { SignalementsClient } from "./signalements-client";

export const dynamic = "force-dynamic";

export default async function SignalementsPage() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  const reports = await listReports({ status: "pending", limit: 200 });
  const typeOptions = Object.entries(REPORT_TYPES).map(([key, cfg]) => ({ value: key, label: cfg.label }));

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Signalements</h1>
        <p className="mt-2 text-muted-foreground">
          Tous les signalements reçus (bureaux, formulaires, formations, traductions, réglementation), en un seul endroit.
        </p>
      </div>
      <SignalementsClient initialReports={reports} typeOptions={typeOptions} />
    </div>
  );
}
```

- [ ] **Step 2: Écrire le client — liste + filtres (le panneau détail arrive en Task 10)**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface ReportRow {
  id: string;
  type: string;
  status: string;
  message: string | null;
  targetId: string | null;
  targetLabel: string | null;
  targetUrl: string | null;
  payload: Record<string, unknown>;
  reporterEmail: string | null;
  reporterOrg: string | null;
  createdAt: string | Date;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "in_progress", label: "En cours" },
  { value: "resolved", label: "Résolu" },
  { value: "dismissed", label: "Rejeté" },
  { value: "all", label: "Tous" },
];

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "border-amber-500 text-amber-700",
  in_progress: "border-blue-500 text-blue-700",
  resolved: "border-green-500 text-green-700",
  dismissed: "border-gray-400 text-gray-500",
};

export function SignalementsClient({
  initialReports,
  typeOptions,
}: {
  initialReports: ReportRow[];
  typeOptions: { value: string; label: string }[];
}) {
  const [items, setItems] = useState<ReportRow[]>(initialReports);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ status: statusFilter, ...(typeFilter !== "all" ? { type: typeFilter } : {}) });
    fetch(`/api/admin/reports?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setItems(j.items ?? []);
      })
      .catch(() => toast.error("Échec du chargement des signalements."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [typeFilter, statusFilter]);

  const typeLabel = useMemo(() => {
    const map = new Map(typeOptions.map((t) => [t.value, t.label]));
    return (type: string) => map.get(type) ?? type;
  }, [typeOptions]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "pending")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Aucun signalement dans cette catégorie.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Émetteur</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40">
                <TableCell>
                  <Badge variant="outline">{typeLabel(r.type)}</Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {r.targetUrl ? (
                    <a href={r.targetUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {r.targetLabel ?? r.targetUrl}
                    </a>
                  ) : (
                    r.targetLabel ?? "—"
                  )}
                </TableCell>
                <TableCell className="max-w-md truncate text-sm">{r.message ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.reporterOrg ?? r.reporterEmail ?? "Anonyme"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleDateString("fr-BE")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_BADGE_CLASS[r.status] ?? ""}>
                    {STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 4: Vérification manuelle**

Se connecter en admin, ouvrir `/admin/signalements` : la liste affiche le signalement RioLex de test créé au Task 4 (type "Réglementation (RioLex)", statut "En attente"). Changer le filtre statut vers "Résolu" (si le Task 6 l'a marqué résolu) : la ligne apparaît. Changer vers "Tous les types" / "Rejeté" : liste vide avec message.

- [ ] **Step 5: Commit**

```bash
git add app/admin/signalements/page.tsx app/admin/signalements/signalements-client.tsx
git commit -m "feat(reports): page admin signalements - liste + filtres"
```

---

### Task 10: Panneau détail + actions de statut

**Files:**
- Modify: `app/admin/signalements/signalements-client.tsx`

**Interfaces:**
- Consumes: `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` (`@/components/ui/sheet`)
- Produces: clic sur une ligne → panneau latéral avec détail du `payload`, note admin, actions (marquer en cours/résolu/rejeté).

- [ ] **Step 1: Ajouter l'état de sélection et le panneau**

Dans `app/admin/signalements/signalements-client.tsx`, ajouter les imports :

```tsx
import { useState } from "react"; // déjà importé — vérifier qu'il l'est
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
```

Dans le composant `SignalementsClient`, ajouter l'état de sélection et le rafraîchissement :

```tsx
const [selected, setSelected] = useState<ReportRow | null>(null);
const [note, setNote] = useState("");
const [busy, setBusy] = useState(false);
const [refreshKey, setRefreshKey] = useState(0);
```

Ajouter `refreshKey` aux dépendances du `useEffect` existant (remplacer `[typeFilter, statusFilter]` par `[typeFilter, statusFilter, refreshKey]`).

Rendre chaque `<TableRow>` cliquable :

```tsx
<TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => { setSelected(r); setNote(""); }}>
```

- [ ] **Step 2: Ajouter la logique de mise à jour de statut**

Toujours dans `SignalementsClient`, avant le `return` :

```tsx
async function updateStatus(newStatus: string) {
  if (!selected) return;
  setBusy(true);
  try {
    const res = await fetch(`/api/admin/reports/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, adminNote: note.trim() || undefined }),
    });
    if (!res.ok) {
      toast.error("Échec de la mise à jour.");
      return;
    }
    toast.success("Signalement mis à jour.");
    setSelected(null);
    setRefreshKey((k) => k + 1);
  } finally {
    setBusy(false);
  }
}
```

- [ ] **Step 3: Ajouter un rendu générique du `payload`, avant le composant `SignalementsClient`**

Le contenu de `payload` varie par type (§4 du registre). Rendu par défaut : liste clé/valeur. Cas spécial traduction : bloc avant/après (`currentText` → `suggestedText`) plutôt qu'une liste illisible.

```tsx
function PayloadDetail({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  if (type === "translation") {
    const p = payload as { sourceText?: string; currentText?: string; suggestedText?: string; locale?: string };
    return (
      <div className="flex flex-col gap-2">
        <PayloadField label="Source (FR)" value={p.sourceText} />
        {p.currentText ? <PayloadField label="Traduction actuelle" value={p.currentText} /> : null}
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm whitespace-pre-wrap">
          {p.suggestedText}
        </div>
      </div>
    );
  }
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-1.5 text-xs">
      {entries.map(([key, value]) => (
        <PayloadField key={key} label={key} value={String(value)} />
      ))}
    </div>
  );
}

function PayloadField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="rounded-lg border bg-muted/40 px-2.5 py-2 text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}
```

- [ ] **Step 4: Ajouter le panneau, après la fermeture du `<Table>` (juste avant le `</div>` final)**

```tsx
<Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
  <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
    {selected ? (
      <>
        <SheetHeader>
          <SheetTitle>{typeLabel(selected.type)}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {selected.targetUrl ? (
            <a href={selected.targetUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
              Voir la page concernée ↗
            </a>
          ) : null}
          <div className="text-sm">
            <span className="text-muted-foreground">Émetteur : </span>
            {selected.reporterOrg ?? selected.reporterEmail ?? "Anonyme"}
          </div>
          {selected.message ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">{selected.message}</div>
          ) : null}
          <PayloadDetail type={selected.type} payload={selected.payload} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Note admin</label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne (optionnel)" />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("in_progress")}>
              En cours
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("resolved")}>
              Résolu
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("dismissed")}>
              Rejeté
            </Button>
          </div>
        </div>
      </>
    ) : null}
  </SheetContent>
</Sheet>
```

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 6: Vérification manuelle**

Sur `/admin/signalements`, cliquer une ligne "En attente" → le panneau s'ouvre avec le message, le lien vers la page concernée, et le détail du `payload` (ex. la catégorie pour un signalement bureau, ou le bloc avant/après pour une suggestion de traduction). Ajouter une note, cliquer "Résolu" → toast de succès, panneau se ferme, la ligne disparaît du filtre "En attente" (elle réapparaît en filtrant "Résolu").

- [ ] **Step 7: Commit**

```bash
git add app/admin/signalements/signalements-client.tsx
git commit -m "feat(reports): panneau détail + rendu payload + actions de statut"
```

---

### Task 11: Navigation — quick-link + badge compteur

**Files:**
- Modify: `components/nav-main.tsx`
- Modify: `components/app-sidebar.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/reports/count?status=pending` (Task 5)
- Produces: icône "Signalements" dans la rangée de quick-links, badge rouge si `count > 0`.

- [ ] **Step 1: Ajouter le quick-link dans `components/nav-main.tsx`**

Dans le tableau `QUICK_LINKS` (`components/nav-main.tsx:39`), ajouter une entrée et importer l'icône :

```tsx
import { FlagIcon } from "lucide-react" // ajouter à l'import lucide-react existant en tête de fichier

const QUICK_LINKS = [
  { label: "Dashboard", url: "/admin", icon: LayoutDashboardIcon },
  { label: "Utilisateurs", url: "/admin/users", icon: UsersIcon },
  { label: "Fichiers", url: "/admin?view=filemanager", icon: FolderIcon },
  { label: "Messagerie", url: "/admin/messagerie", icon: MailIcon },
  { label: "Signalements", url: "/admin/signalements", icon: FlagIcon },
  { label: "Activité", url: "/admin/activity", icon: ActivityIcon },
  { label: "Changelog", url: "/admin/changelog", icon: ScrollTextIcon },
]
```

- [ ] **Step 2: Généraliser le badge et le prop `unreadCount` → accepter aussi `pendingReportsCount`**

Dans `components/nav-main.tsx`, remplacer la signature de `NavMain` :

```tsx
export function NavMain({
  items,
  unreadCount = 0,
  pendingReportsCount = 0,
}: {
  items: NavItem[]
  unreadCount?: number
  pendingReportsCount?: number
}) {
```

Remplacer la ligne `const showBadge = item.label === "Messagerie" && unreadCount > 0` par :

```tsx
const badgeCount = item.label === "Messagerie" ? unreadCount : item.label === "Signalements" ? pendingReportsCount : 0
const showBadge = badgeCount > 0
```

Et les deux usages de `unreadCount` juste après (dans le `<span>` du badge et le `TooltipContent`) par `badgeCount`.

- [ ] **Step 3: Récupérer le compteur dans `components/app-sidebar.tsx`**

Ajouter l'état et l'effet, juste après ceux de `unreadCount` (`components/app-sidebar.tsx`, dans le bloc `useEffect` existant pour `fetchUnreadCount`) :

```tsx
const [pendingReportsCount, setPendingReportsCount] = useState(0)
```

Ajouter un second effet (même structure que celui de `unreadCount`, dupliqué pour une ressource différente) :

```tsx
useEffect(() => {
  let cancelled = false
  async function fetchPendingReports() {
    try {
      const response = await fetch("/api/admin/reports/count?status=pending")
      if (cancelled) return
      if (response.ok) {
        const data = await response.json()
        setPendingReportsCount(data.count || 0)
      }
    } catch (error) {
      console.error("Failed to fetch pending reports count:", error)
    }
  }

  void fetchPendingReports()
  const interval = window.setInterval(() => {
    if (document.visibilityState === "visible") void fetchPendingReports()
  }, 30_000)
  const onVisibility = () => {
    if (document.visibilityState === "visible") void fetchPendingReports()
  }
  document.addEventListener("visibilitychange", onVisibility)

  return () => {
    cancelled = true
    window.clearInterval(interval)
    document.removeEventListener("visibilitychange", onVisibility)
  }
}, [])
```

Passer le prop à `<NavMain>` :

```tsx
<NavMain items={navMain} unreadCount={unreadCount} pendingReportsCount={pendingReportsCount} />
```

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 5: Vérification manuelle**

Avec au moins un signalement "pending" en base (créé au Task 4), recharger `/admin` : l'icône drapeau "Signalements" dans la rangée du haut affiche un badge rouge avec le nombre. Cliquer dessus → navigue vers `/admin/signalements`. Marquer tous les signalements comme résolus → dans les 30s (ou après un focus de l'onglet), le badge disparaît.

- [ ] **Step 6: Commit**

```bash
git add components/nav-main.tsx components/app-sidebar.tsx
git commit -m "feat(reports): badge compteur signalements dans la sidebar admin"
```

---

### Task 12: Rebranchement — Bureaux

**Files:**
- Modify: `app/outils/bureaux/_components/report-form.tsx`
- Delete: `app/api/bureaux/[id]/report/route.ts`

**Interfaces:**
- Consumes: `useReportSubmit` (`@/components/reports/use-report-submit`, Task 7)

- [ ] **Step 1: Rebrancher le formulaire sur le moteur unifié**

Dans `app/outils/bureaux/_components/report-form.tsx`, remplacer l'import et la fonction `submit` :

```tsx
import { useReportSubmit } from '@/components/reports/use-report-submit'
```

Remplacer le corps du composant (garder tout le JSX identique) :

```tsx
export function ReportForm({ bureauId, onClose }: Props) {
  const t = useTranslations('public.outils')
  const [category, setCategory] = useState<
    'hours' | 'address' | 'phone' | 'closed' | 'other'
  >('hours')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const { submit, status } = useReportSubmit('bureau')
  const submitting = status === 'submitting'
  const done = status === 'done'

  const handleSubmit = async () => {
    if (message.trim().length < 5) {
      setErr(t('rfErrTooShort'))
      return
    }
    setErr(null)
    const result = await submit({
      targetId: bureauId,
      message: message.trim(),
      payload: { category },
      reporterEmail: email.trim() || undefined,
    })
    if (result.ok) {
      setTimeout(onClose, 1500)
    } else {
      setErr(result.error)
    }
  }
```

Puis, plus bas dans le JSX, remplacer `onClick={submit}` par `onClick={handleSubmit}` et `disabled={submitting}` reste inchangé (variable déjà dérivée ci-dessus). Supprimer les anciens `useState` `submitting`/`done` (remplacés par `status` du hook) et l'ancien `try/catch fetch` s'il en restait.

- [ ] **Step 2: Supprimer l'ancienne route**

```bash
git rm app/api/bureaux/[id]/report/route.ts
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès (plus aucune référence à l'ancienne route)

- [ ] **Step 4: Vérification manuelle**

Sur `/outils/bureaux`, ouvrir un bureau, cliquer "Signaler une erreur", remplir catégorie + message (≥5 caractères), envoyer : confirmation affichée, formulaire se ferme après 1.5s. Vérifier en DB : une ligne `Report` avec `type=bureau`, `targetId=<id du bureau>`, `targetLabel` contenant le nom du bureau, `payload={"category":"..."}`. Tester le cas d'erreur (message < 5 caractères) : message d'erreur affiché, pas de requête envoyée.

- [ ] **Step 5: Commit**

```bash
git add app/outils/bureaux/_components/report-form.tsx
git commit -m "refactor(reports): rebrancher signalement bureaux sur /api/reports"
```

---

### Task 13: Rebranchement — Validation formulaire

**Files:**
- Modify: `components/pdf-forms/field-error-report.tsx`
- Delete: `app/api/form-validation/report/route.ts`

**Interfaces:**
- Consumes: `useReportSubmit` (`@/components/reports/use-report-submit`, Task 7)

- [ ] **Step 1: Rebrancher `ReportDialogTrigger` sur le moteur unifié**

Dans `components/pdf-forms/field-error-report.tsx`, remplacer l'import `toast` reste, ajouter :

```tsx
import { useReportSubmit } from "@/components/reports/use-report-submit";
```

Dans `ReportDialogTrigger`, remplacer la fonction `submit` :

```tsx
const { submit: submitReport, status } = useReportSubmit("form_validation");
const submitting = status === "submitting";

async function submit() {
  if (!consent) {
    toast.error(t("ferConsentRequired"));
    return;
  }
  const result = await submitReport({
    targetId: formId,
    message: userMessage.trim() || undefined,
    payload: { fieldId, fieldType, rejectedValue: valueAsString, errorMessage, formSlug, locale },
    reporterEmail: email.trim() || undefined,
  });
  if (!result.ok) {
    if (result.error.includes("Trop de signalements")) {
      toast.error(t("ferRateLimited"));
    } else {
      toast.error(result.error || t("ferSendFailed"));
    }
    return;
  }
  setDone(true);
  toast.success(t("ferSendSuccess"));
}
```

Retirer l'ancien `useState` `submitting` (remplacé par `status === "submitting"` du hook) et l'ancien bloc `try/fetch/catch/finally`.

- [ ] **Step 2: Supprimer l'ancienne route**

```bash
git rm app/api/form-validation/report/route.ts
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 4: Vérification manuelle**

Ouvrir un formulaire PDF (`/d/<slug>`), déclencher une erreur de validation sur un champ (ex. NISS invalide), cliquer "Signaler un problème de validation", cocher le consentement, envoyer : confirmation affichée. Vérifier en DB : `Report` avec `type=form_validation`, `payload.fieldId`/`fieldType`/`rejectedValue`/`errorMessage` renseignés. Renvoyer 6 fois de suite depuis la même IP : le 6ᵉ affiche le message de rate-limit.

- [ ] **Step 5: Commit**

```bash
git add components/pdf-forms/field-error-report.tsx
git commit -m "refactor(reports): rebrancher signalement validation formulaire sur /api/reports"
```

---

### Task 14: Rebranchement — Formations

**Files:**
- Modify: `app/formations/[slug]/training-detail-client.tsx`
- Delete: `app/api/formations/report/route.ts`

**Interfaces:**
- Consumes: `useReportSubmit` (`@/components/reports/use-report-submit`, Task 7)

- [ ] **Step 1: Rebrancher la fonction interne `ReportForm`**

Dans `app/formations/[slug]/training-detail-client.tsx`, ajouter l'import en tête de fichier :

```tsx
import { useReportSubmit } from "@/components/reports/use-report-submit";
```

Remplacer la fonction `ReportForm` (lignes ~546-604) :

```tsx
function ReportForm({ trainingId, onDone }: { trainingId: string; onDone: () => void }) {
  const t = useTranslations("public.formations");
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [message, setMessage] = useState("");
  const { submit, status } = useReportSubmit("training");
  const submitting = status === "submitting";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await submit({
      targetId: trainingId,
      message: message || undefined,
      payload: { reason },
    });
    if (!result.ok) {
      toast.error(t("reportFailed"));
      return;
    }
    toast.success(t("reportSuccess"));
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="glass-surface flex flex-col gap-2.5 p-5">
      <p className="text-[13px] font-bold">{t("reportTitle")}</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="glass-surface-strong h-11 w-full rounded-xl border-0 px-3 text-[13px] text-[color:var(--glass-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
      >
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {REPORT_REASON_LABELS[r]}
          </option>
        ))}
      </select>
      <textarea
        className="glass-surface-strong min-h-[64px] w-full rounded-xl border-0 px-3.5 py-2.5 text-[13px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
        placeholder={t("reportDetailsOptional")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="glass-cta rounded-full px-4 py-2 text-[12.5px] font-bold disabled:opacity-60">
          {submitting ? t("sending") : t("reportSubmit")}
        </button>
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)]">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Supprimer l'ancienne route**

```bash
git rm app/api/formations/report/route.ts
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 4: Vérification manuelle**

Sur `/formations/<slug>`, ouvrir le formulaire de signalement, choisir une raison, envoyer : toast de succès. Vérifier en DB : `Report` avec `type=training`, `targetId=<id formation>`, `targetLabel=<titre formation>`, `targetUrl=/formations/<slug>`, `payload={"reason":"..."}`. Connecté en tant qu'utilisateur : vérifier que `reporterId` est rempli.

- [ ] **Step 5: Commit**

```bash
git add app/formations/[slug]/training-detail-client.tsx
git commit -m "refactor(reports): rebrancher signalement formations sur /api/reports"
```

---

### Task 15: Rebranchement — Traductions

**Files:**
- Modify: `components/i18n/suggest-correction.tsx`
- Delete: `app/api/translation-suggestions/route.ts`

**Interfaces:**
- Consumes: `useReportSubmit` (`@/components/reports/use-report-submit`, Task 7)

- [ ] **Step 1: Rebrancher `SuggestCorrection`**

Dans `components/i18n/suggest-correction.tsx`, ajouter l'import :

```tsx
import { useReportSubmit } from "@/components/reports/use-report-submit";
```

Remplacer `handleSubmit` :

```tsx
const { submit, status } = useReportSubmit("translation");
const submitting = status === "submitting";

async function handleSubmit() {
  const value = suggested.trim();
  if (!value) {
    toast.error("Merci de saisir votre correction.");
    return;
  }
  const result = await submit({
    targetId: uiKey ?? recordId,
    message: comment.trim() || undefined,
    payload: {
      locale: targetLocale,
      model: uiKey ? undefined : model,
      recordId: uiKey ? undefined : recordId,
      field: uiKey ? undefined : field,
      uiKey,
      sourceText,
      currentText: currentText || undefined,
      suggestedText: value,
    },
    reporterEmail: email.trim() || undefined,
  });
  if (!result.ok) {
    toast.error(result.error || "Échec de l'envoi. Réessayez plus tard.");
    return;
  }
  toast.success("Merci ! Votre proposition a bien été envoyée.");
  setOpen(false);
  setComment("");
  setEmail("");
}
```

Retirer l'ancien `useState` `submitting` (remplacé par `status`) et l'ancien bloc `try/fetch/catch/finally`. Dans le JSX, les usages de `disabled={submitting}` restent valides (variable dérivée ci-dessus).

- [ ] **Step 2: Supprimer l'ancienne route**

```bash
git rm app/api/translation-suggestions/route.ts
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 4: Vérification manuelle**

Basculer la locale sur NL (ou toute langue non-FR), sur une page avec `<SuggestCorrection>`, cliquer "Proposer une correction", remplir et envoyer : toast de succès. Vérifier en DB : `Report` avec `type=translation`, `payload.sourceText`/`suggestedText` renseignés. Marquer "Résolu" depuis `/admin/signalements` sur une suggestion ciblant du contenu DB (model+recordId+field) : vérifier qu'une ligne `ContentTranslation` correspondante est créée/mise à jour (`status=reviewed`).

- [ ] **Step 5: Commit**

```bash
git add components/i18n/suggest-correction.tsx
git commit -m "refactor(reports): rebrancher suggestions de traduction sur /api/reports"
```

---

### Task 16: RioLex — remplacer le mailto par un vrai signalement

**Files:**
- Modify: `components/reglementation/report-button.tsx`

**Interfaces:**
- Consumes: `ReportButton` générique (`@/components/reports/report-button`, Task 8)

- [ ] **Step 1: Remplacer l'implémentation mailto par le composant générique**

Remplacer tout le contenu de `components/reglementation/report-button.tsx` :

```tsx
"use client";

import { ReportButton as GenericReportButton } from "@/components/reports/report-button";

/// « Signaler une erreur » sur un article — persiste désormais dans Report
/// (type "riolex_article") au lieu d'un mailto sans trace (cf. migration 57).
export function ReportButton({
  riolexId,
  loi,
  articleNumber,
  label,
}: {
  riolexId: string;
  loi: string;
  articleNumber: string;
  label: string;
}) {
  return (
    <GenericReportButton
      type="riolex_article"
      targetId={riolexId}
      extraPayload={{ loi, articleNumber }}
      triggerLabel={label}
    />
  );
}
```

- [ ] **Step 2: Mettre à jour l'appelant pour passer `riolexId`**

Seul appelant du composant : `app/partenaire/reglementation/[riolexId]/page.tsx:322-327`. Remplacer :

```tsx
<ReportButton
  adminEmail={adminEmail}
  loi={meta.loi ?? ""}
  articleNumber={meta.articleNumber ?? ""}
  label={t("reglReport")}
/>
```

par (le composant n'a plus besoin de `adminEmail`, il n'envoie plus de mailto ; `riolexId` est déjà en scope dans ce fichier, issu de `params`) :

```tsx
<ReportButton
  riolexId={riolexId}
  loi={meta.loi ?? ""}
  articleNumber={meta.articleNumber ?? ""}
  label={t("reglReport")}
/>
```

Si le typecheck (Step 3) signale que `adminEmail` n'est plus utilisé ailleurs dans ce fichier après ce retrait, retirer aussi sa déclaration/son calcul associé.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 4: Vérification manuelle**

Sur une fiche article dans `/partenaire/reglementation/<riolexId>`, cliquer "Signaler une erreur" : un dialog s'ouvre désormais (au lieu d'ouvrir le client mail), remplir un message, envoyer : confirmation affichée. Vérifier en DB : `Report` avec `type=riolex_article`, `targetId=<riolexId>`, `targetUrl=/partenaire/reglementation/<riolexId>`, `payload={"loi":"...","articleNumber":"..."}`, `reporterId` rempli (utilisateur connecté), `reporterOrg` rempli si partenaire.

- [ ] **Step 5: Commit**

```bash
git add components/reglementation/report-button.tsx
git commit -m "feat(reports): RioLex - remplacer mailto par signalement persisté"
```

---

### Task 17: Backfill des données historiques

**Files:**
- Create: `scripts/backfill-reports.ts`
- Modify: `package.json` (script `backfill:reports`)

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `mapLegacyStatus` (`@/lib/reports/engine`, Task 3)

- [ ] **Step 1: Écrire le script**

```ts
import { prisma } from "@/lib/prisma";
import { mapLegacyStatus } from "@/lib/reports/engine";

/// Copie non destructive des 4 anciennes tables vers Report. Les anciennes
/// tables ne sont ni vidées ni supprimées. Idempotent : ré-exécutable sans
/// dupliquer (vérifie l'absence d'un Report déjà backfillé via un marqueur
/// dans payload._legacyId avant insertion).
async function alreadyBackfilled(legacyId: string): Promise<boolean> {
  const existing = await prisma.report.findFirst({
    where: { payload: { path: ["_legacyId"], equals: legacyId } },
    select: { id: true },
  });
  return !!existing;
}

async function backfillBureauReports() {
  const rows = await prisma.bureauReport.findMany();
  let created = 0;
  for (const r of rows) {
    if (await alreadyBackfilled(r.id)) continue;
    await prisma.report.create({
      data: {
        type: "bureau",
        status: mapLegacyStatus(r.status as never),
        message: r.message,
        targetId: r.bureauId,
        payload: { category: r.category, _legacyId: r.id },
        reporterEmail: r.reporterEmail,
        ipHash: r.ipHash,
        userAgent: r.userAgent,
        adminNote: r.adminNotes,
        resolvedById: r.resolvedBy,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    created++;
  }
  console.log(`BureauReport → Report : ${created}/${rows.length} créés`);
}

async function backfillFormValidationReports() {
  const rows = await prisma.formValidationReport.findMany();
  let created = 0;
  for (const r of rows) {
    if (await alreadyBackfilled(r.id)) continue;
    await prisma.report.create({
      data: {
        type: "form_validation",
        status: mapLegacyStatus(r.status as never),
        message: r.userMessage,
        targetId: r.formId,
        payload: {
          fieldId: r.fieldId, fieldType: r.fieldType, rejectedValue: r.rejectedValue,
          errorMessage: r.errorMessage, formSlug: r.formSlug, locale: r.locale, _legacyId: r.id,
        },
        reporterEmail: r.reporterEmail,
        ipHash: r.ipHash,
        userAgent: r.userAgent,
        adminNote: r.adminNotes,
        resolvedById: r.resolvedBy,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    created++;
  }
  console.log(`FormValidationReport → Report : ${created}/${rows.length} créés`);
}

async function backfillTrainingReports() {
  const rows = await prisma.trainingReport.findMany();
  let created = 0;
  for (const r of rows) {
    if (await alreadyBackfilled(r.id)) continue;
    await prisma.report.create({
      data: {
        type: "training",
        status: mapLegacyStatus(r.status as never),
        message: r.message,
        targetId: r.trainingId,
        payload: { reason: r.reason, _legacyId: r.id },
        reporterEmail: r.reporterEmail,
        reporterId: r.reporterId,
        adminNote: r.adminNote,
        actionTaken: r.actionTaken,
        resolvedById: r.resolvedById,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    created++;
  }
  console.log(`TrainingReport → Report : ${created}/${rows.length} créés`);
}

async function backfillTranslationSuggestions() {
  const rows = await prisma.translationSuggestion.findMany();
  let created = 0;
  for (const r of rows) {
    if (await alreadyBackfilled(r.id)) continue;
    await prisma.report.create({
      data: {
        type: "translation",
        status: mapLegacyStatus(r.status as never),
        message: r.comment,
        targetId: r.uiKey ?? r.recordId,
        payload: {
          locale: r.locale, model: r.model, recordId: r.recordId, field: r.field,
          uiKey: r.uiKey, sourceText: r.sourceText, currentText: r.currentText,
          suggestedText: r.suggestedText, _legacyId: r.id,
        },
        reporterEmail: r.submittedBy,
        resolvedById: r.reviewedBy,
        resolvedAt: r.reviewedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    created++;
  }
  console.log(`TranslationSuggestion → Report : ${created}/${rows.length} créés`);
}

async function main() {
  await backfillBureauReports();
  await backfillFormValidationReports();
  await backfillTrainingReports();
  await backfillTranslationSuggestions();
  console.log("Backfill terminé.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Ajouter le script npm**

Dans `package.json`, à côté de `"backfill:resume-hash"` :

```json
"backfill:reports": "dotenv -e .env.local -- tsx scripts/backfill-reports.ts",
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès

- [ ] **Step 4: Exécuter le backfill**

Run: `pnpm backfill:reports`
Expected: 4 lignes de log avec les compteurs, puis "Backfill terminé." Ré-exécuter une seconde fois : tous les compteurs affichent `0/N créés` (idempotence).

- [ ] **Step 5: Vérification manuelle**

Sur `/admin/signalements`, filtrer "Tous les types" + "Tous" les statuts : le nombre total correspond à la somme des 4 anciennes tables + les signalements de test déjà créés (bureau/form_validation/training/translation/riolex_article des tâches précédentes). Ouvrir un signalement backfillé (ex. un ancien `BureauReport` résolu) : statut "Résolu" correctement mappé, message/catégorie corrects.

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-reports.ts package.json
git commit -m "feat(reports): script de backfill des 4 anciennes tables"
```

---

### Task 18: Nettoyage des anciennes pages/routes admin

**Files:**
- Delete: `app/admin/formations/signalements/page.tsx`, `app/admin/formations/signalements/signalements-client.tsx`
- Delete: `app/admin/i18n/suggestions/page.tsx`, `components/admin/i18n/translation-suggestions-manager.tsx`
- Delete: `app/api/admin/formations/reports/[id]/route.ts`
- Delete: `app/api/admin/translation-suggestions/route.ts`, `app/api/admin/translation-suggestions/[id]/route.ts`
- Delete: `app/api/admin/bureaux/reports/route.ts`, `app/api/admin/bureaux/reports/[id]/route.ts`
- Modify: `components/admin/bureaux-admin-workspace.tsx` (retrait de l'onglet "reports" + import mort)
- Delete: `components/admin/bureaux/reports-manager.tsx`
- Modify: `components/app-sidebar.tsx` (retrait de l'entrée nav `formationsSignalements` devenue morte, retrait de l'entrée `traductions` si elle ne pointait que vers les suggestions — à vérifier, `/admin/i18n` peut couvrir d'autres usages)
- Modify: `app/admin/pdf/analytics/page.tsx` (retrait du compteur `pendingReports`, remplacé par un lien vers `/admin/signalements?type=form_validation`)

**Interfaces:** aucune (nettoyage pur, pas de nouvelle interface produite)

- [ ] **Step 1: Confirmer que le backfill (Task 17) est vérifié en prod avant de continuer**

Ne pas exécuter ce Task tant que Task 17 Step 5 n'a pas été validé manuellement par Oraliks — cette suppression rend les anciennes pages inutilisables comme filet de sécurité.

- [ ] **Step 2: Supprimer les pages/composants admin formations et i18n**

```bash
git rm app/admin/formations/signalements/page.tsx app/admin/formations/signalements/signalements-client.tsx
git rm app/admin/i18n/suggestions/page.tsx components/admin/i18n/translation-suggestions-manager.tsx
git rm app/api/admin/formations/reports/[id]/route.ts
git rm app/api/admin/translation-suggestions/route.ts app/api/admin/translation-suggestions/[id]/route.ts
git rm app/api/admin/bureaux/reports/route.ts app/api/admin/bureaux/reports/[id]/route.ts
```

- [ ] **Step 3: Retirer l'onglet "reports" de `components/admin/bureaux-admin-workspace.tsx`**

`ReportsManager` est utilisé comme onglet dans `BureauxAdminWorkspace` (pas directement dans `page.tsx`). Dans `components/admin/bureaux-admin-workspace.tsx` :

1. Retirer l'import (ligne 10) : `import { ReportsManager } from "./bureaux/reports-manager";`
2. Retirer `AlertCircle` de l'import lucide-react (ligne 5) — devient inutilisé une fois l'entrée `reports` retirée de `TABS` : remplacer
   `import { Activity, Building2, Eye, MapPinned, AlertCircle } from "lucide-react";`
   par
   `import { Activity, Building2, Eye, MapPinned } from "lucide-react";`
3. Retirer `"reports"` du type `Tab` (ligne 14) : remplacer
   `type Tab = "sante" | "preview" | "annuaire" | "services" | "onem" | "reports";`
   par
   `type Tab = "sante" | "preview" | "annuaire" | "services" | "onem";`
4. Retirer l'entrée `reports` du tableau `TABS` (lignes 52-57) :
   ```tsx
   {
     value: "reports",
     label: "Signalements",
     icon: AlertCircle,
     help: "Erreurs remontées par les utilisateurs publics",
   },
   ```
5. Retirer l'état et l'effet `pendingReports` (lignes 62, 84-97) — le compteur global vit désormais dans la sidebar (Task 11) :
   - Retirer `const [pendingReports, setPendingReports] = useState<number | null>(null);`
   - Retirer le bloc `useEffect` commenté `// Badge sur "Signalements" pour les pending` (fetch vers `/api/admin/bureaux/reports?status=pending`)
6. Retirer le badge conditionnel dans le rendu de `TabsTrigger` (lignes 111-118) : remplacer
   ```tsx
   <TabsTrigger key={t.value} value={t.value} className="gap-1.5 flex-1 min-w-fit">
     <Icon className="h-3.5 w-3.5" />
     <span className="hidden sm:inline">{t.label}</span>
     <span className="sm:hidden">{t.label.split(" ")[0]}</span>
     {t.value === "reports" && pendingReports !== null && pendingReports > 0 && (
       <Badge
         variant="destructive"
         className="h-4 px-1 text-[10px] ml-1"
       >
         {pendingReports}
       </Badge>
     )}
   </TabsTrigger>
   ```
   par
   ```tsx
   <TabsTrigger key={t.value} value={t.value} className="gap-1.5 flex-1 min-w-fit">
     <Icon className="h-3.5 w-3.5" />
     <span className="hidden sm:inline">{t.label}</span>
     <span className="sm:hidden">{t.label.split(" ")[0]}</span>
   </TabsTrigger>
   ```
   Si `Badge` (`@/components/ui/badge`) n'est plus utilisé ailleurs dans ce fichier après ce retrait, retirer aussi son import.
7. Retirer le bloc `<TabsContent value="reports" className="mt-0"><ReportsManager /></TabsContent>` (lignes 148-150).

Supprimer ensuite le fichier du composant :

```bash
git rm components/admin/bureaux/reports-manager.tsx
```

- [ ] **Step 4: Nettoyer la sidebar admin**

Dans `components/app-sidebar.tsx`, dans le groupe `formations` (`items` de l'entrée `title: t("formations")`), retirer la ligne :

```tsx
{ title: t("formationsSignalements"), url: "/admin/formations/signalements" },
```

Dans le groupe `bureaux`, retirer la ligne :

```tsx
{ title: t("signalements"), url: "/admin/bureaux#reports" },
```

- [ ] **Step 5: Retirer le compteur mort de `/admin/pdf/analytics`**

Dans `app/admin/pdf/analytics/page.tsx` : retirer `pendingReports` et `pendingReportRows`/`reportsByFieldType` du `Promise.all` et du `viewModel` si plus rien d'autre ne les utilise dans `PdfAnalyticsDashboard` — vérifier d'abord (`grep -n "pendingReports\|reportsByFieldType" app/admin/pdf/analytics/page.tsx components/admin/pdf-forms/analytics-dashboard.tsx`) que le composant dashboard ne s'en sert pas ailleurs avant de les retirer des deux côtés.

- [ ] **Step 6: Build**

Run: `pnpm build`
Expected: succès (aucune référence résiduelle aux fichiers supprimés — le typecheck l'aurait signalé)

- [ ] **Step 7: Tests + lint**

Run: `pnpm test`
Expected: tous verts (aucun test ne référence les fichiers supprimés — vérifié par `grep -rln "reports-manager\|translation-suggestions-manager\|signalements-client" --include="*.test.ts*"` avant suppression si doute)

Run: `pnpm lint`
Expected: pas de nouvelle erreur par rapport à la référence (74 préexistantes)

- [ ] **Step 8: Vérification manuelle**

Naviguer `/admin/bureaux`, `/admin/formations`, `/admin/i18n`, `/admin/pdf/analytics` : aucun lien mort, aucune section vide béante. `/admin/signalements` reste l'unique endroit pour tous les signalements.

- [ ] **Step 9: Commit**

```bash
git add components/admin/bureaux-admin-workspace.tsx components/app-sidebar.tsx app/admin/pdf/analytics/page.tsx
git commit -m "chore(reports): retirer les anciennes pages/routes admin de signalement"
```

---

## Suivi hors de ce plan

- Suppression des modèles Prisma `BureauReport`, `FormValidationReport`, `TrainingReport`, `TranslationSuggestion` (migration additive de suppression) — à ajouter à `CLEANUP_QUEUE.md`, sous supervision explicite d'Oraliks, une fois le système validé en prod pendant une période raisonnable.
- Traduction du namespace `public.reports.*` (Task 8) dans les 13 autres langues — suit le workflow i18n existant du projet, hors périmètre de ce plan de code.
