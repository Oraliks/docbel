# API Health & Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la « santé API » fragile (ping client de 6 endpoints, faux « Dégradé » dès qu'une route est lente) par un vrai système de santé serveur, doter la couche API de primitives de durcissement (erreurs standardisées, `Retry-After`, helpers de réponse), et livrer une page admin de monitoring `/admin/monitoring`.

**Architecture :** Un module serveur `lib/health/` fait UN seul vrai appel réseau (ping DB `SELECT 1`) et lit la configuration pour toutes les autres dépendances (aucun hammering d'API externe). Un endpoint public `/api/health` renvoie un résumé caché ; la carte du dashboard le lit en une requête (fini le fan-out). Des primitives `lib/api/` (réponses + rate-limit headers) standardisent la couche. Une page RSC `/admin/monitoring` affiche le détail serveur. Une partie optionnelle (Part D) ajoute l'historique persistant.

**Tech Stack :** Next 16 (RSC, route handlers), Prisma 5 + Neon (`withDbRetry`, `$queryRaw`), vitest, Tailwind 4 + shadcn, lucide-react v1, next-intl 4.

## Global Constraints

- ❌ JAMAIS `prisma db push` (DB Neon partagée détruit pgvector + tables PDF). Parts A/B/C = **zéro migration**. Part D (optionnelle) = SQL **additif** via `prisma db execute`, jamais `db push`.
- `git add` de chemins EXPLICITES uniquement (workdir partagé multi-agents), jamais `-A`.
- Commandes git/test/build via Bash avec `dangerouslyDisableSandbox: true` (le sandbox revert les fichiers trackés à HEAD).
- Pas de nouvelle dépendance (le rate-limiting reste in-memory ; Redis/Upstash = hors périmètre, noté comme évolution). Pas de `setState` synchrone dans un `useEffect`. Pas de `bg-white` en dur.
- ESLint : ~74 erreurs pré-existantes, ne pas en ajouter. `pnpm build` = typecheck (pas de `pnpm typecheck`).
- Textes UI en français en dur côté composants ; libellés de navigation via i18n `admin.nav` (clé FR minimum, fallback auto pour les autres langues — cf. `i18n/request.ts` deepMerge).
- Toutes les requêtes Prisma passent par `withDbRetry` (`@/lib/prisma`) SAUF le ping de santé, qui utilise un timeout court dédié (on veut mesurer l'échec, pas le masquer par retry).
- Le module de santé ne fait **qu'un seul I/O réseau** : le ping DB. Les autres dépendances sont évaluées par **présence de configuration** (helpers existants), jamais par un appel réseau à l'API externe.
- Nom de la page : `/admin/monitoring` (le terme « ops » est déjà pris par `components/admin/dashboard/ops-queue.tsx` et `getStatusStrip().ops`).
- Validation par tâche : `pnpm test` puis `pnpm build`. Écran final : `/admin` (carte Santé) + `/admin/monitoring`, vérif manuelle par Oraliks.

## Faits de contexte (vérifiés par exploration du code)

- **Pas de `/api/health`** aujourd'hui (404). Seul `app/api/admin/bureaux/health/route.ts` existe (métier, admin-only).
- **DB** : `lib/prisma.ts` exporte `prisma` (auto-retry P1001/P1002/P1008/P1017) et `withDbRetry`. Datasource `DATABASE_URL` (+ `DIRECT_URL`). Pas de ping générique existant.
- **Helpers de détection de config déjà présents** : `isBlobsEnabled()` (`lib/storage/blob-storage.ts`), `isKboConfigured()` (`lib/be-companies/kbo-etl.ts`), `readImapConfig()` → `null` si incomplet (`lib/inbox/imap.ts`), `getEmbeddingProvider()` → `"voyage"|"openai"|null` (`lib/chomage-ia/embeddings.ts`), `isWebSearchAvailable()` (`lib/chomage-ia/web-search.ts`). Reste = `!!process.env.X` (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`).
- **Feature flags** : table `AppSetting` (clé/valeur) via `lib/app-settings.ts` (`getSetting`, `setSetting`, `getAllSettings`, `SETTING_KEYS`, `DEFAULTS`). Flags Formations JSON via `lib/formations/module.ts`.
- **Pas d'observabilité externe** : ni Sentry, ni BetterStack, ni `VERCEL_LOGS_URL` → ne pas les inclure. Vercel runtime lu en lecture seule : `VERCEL`, `VERCEL_ENV`, `VERCEL_REGION`, `NEXT_PUBLIC_BUILD_ID`, `NODE_ENV`.
- **Erreurs API** : disparates. Seul îlot standardisé = `lib/decision-builder/api-helpers.ts` (`jsonError(status, message, extra?)`, `jsonOk(body, status)`), utilisé par 9 routes. Convention de facto = `{ error: string }` + status. `Content-Type` posé de façon inégale.
- **Rate-limit** : maison, en mémoire, `lib/utils/rate-limit.ts` (`checkRateLimit(key, {windowMs, max})` → `{allowed, resetAt, remaining?}`, `getClientIp(req)`), sur 41 routes, **sans `Retry-After`**, non distribué. Pas de `middleware.ts`.
- **Auth** : `lib/auth-check.ts` mûr — `requireAdminAuth()` (401 sans session, 403 non-admin) renvoie `{ isAuthorized, user, error }`.
- **Zod** : `safeParse` sur ~20 % des routes.
- **Tests** : `vitest.config.ts` restreint `include` à `lib/**/*.test.ts` + `components/**/__tests__/**`. **Zéro test sur `app/api`**. Pattern = tests unitaires purs (`describe/it/expect`, alias `@`).
- **Page admin standard** : `export const dynamic = "force-dynamic"` + `const auth = await requireAdminAuth(); if (!auth.isAuthorized) redirect("/login")` + conteneur `flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6` + `<h1 className="text-3xl font-bold tracking-tight">`. Pas de composant `PageHeader`.
- **Sidebar** : `components/app-sidebar.tsx`, tableau `navMain` (items `{ title: t("clé"), url, icon: <Icon className="size-4" /> }`), namespace i18n `admin.nav` dans `messages/fr.json`. Icônes lucide importées ligne ~21.
- **Carte actuelle** : `components/admin/dashboard/api-health-card.tsx` (client, ping 6 endpoints, timeout 5 s, tout non-2xx = échec → **cause racine du « toujours dégradé »**). `status-strip.tsx` (RSC) utilise `getStatusStrip()` (`lib/admin/dashboard-stats.ts`) + `<ApiHealthCard />`.

---

## Vue d'ensemble des parties

- **Part A (3 tâches)** — Cœur santé fiable + carte corrigée. **Résout le « toujours dégradé ».**
- **Part B (2 tâches)** — Primitives de durcissement API (réponses standard, `Retry-After`) + doc.
- **Part C (2 tâches)** — Page `/admin/monitoring` + entrée sidebar + i18n.
- **Part D (2 tâches, OPTIONNELLE)** — Historique persistant (table additive + cron + sparkline). À ne lancer qu'après validation d'Oraliks (implique une migration additive Neon).

Chaque tâche finit par `pnpm test` + `pnpm build` verts et un commit.

---

# PART A — Cœur santé fiable

### Task A1 : Module santé — types + classification pure (testé)

**Files:**
- Create: `lib/health/types.ts`
- Create: `lib/health/classify.ts`
- Test: `lib/health/__tests__/classify.test.ts`

**Interfaces:**
- Produces:
  - `type HealthStatus = "ok" | "degraded" | "down"`
  - `type DbHealth = { status: "up" | "down"; latencyMs: number | null; error?: string }`
  - `type DependencyKind = "critical" | "optional"`
  - `type DependencyHealth = { key: string; label: string; kind: DependencyKind; configured: boolean; detail: string }`
  - `type HealthReport = { status: HealthStatus; db: DbHealth; dependencies: DependencyHealth[]; runtime: RuntimeInfo; checkedAt: string }`
  - `type RuntimeInfo = { env: string; vercelEnv: string | null; region: string | null; buildId: string | null; nodeVersion: string }`
  - `type HealthSummary = { status: HealthStatus; db: DbHealth; checkedAt: string }`
  - `SLOW_DB_MS = 2000`
  - `classifyOverall(db: DbHealth, slowMs?: number): HealthStatus`

- [ ] **Step 1: Écrire les tests (rouges)**

```ts
// lib/health/__tests__/classify.test.ts
import { describe, expect, it } from "vitest";
import { classifyOverall, SLOW_DB_MS } from "../classify";

describe("classifyOverall", () => {
  it("down si la DB est down", () => {
    expect(classifyOverall({ status: "down", latencyMs: null })).toBe("down");
  });
  it("ok si la DB répond vite", () => {
    expect(classifyOverall({ status: "up", latencyMs: 15 })).toBe("ok");
  });
  it("degraded si la DB répond au-delà du seuil", () => {
    expect(classifyOverall({ status: "up", latencyMs: SLOW_DB_MS + 1 })).toBe("degraded");
  });
  it("ok exactement au seuil", () => {
    expect(classifyOverall({ status: "up", latencyMs: SLOW_DB_MS })).toBe("ok");
  });
  it("seuil paramétrable", () => {
    expect(classifyOverall({ status: "up", latencyMs: 600 }, 500)).toBe("degraded");
  });
  it("une DB up sans mesure de latence reste ok (mesure best-effort)", () => {
    expect(classifyOverall({ status: "up", latencyMs: null })).toBe("ok");
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm vitest run lib/health/__tests__/classify.test.ts`
Expected: FAIL (module `../classify` introuvable).

- [ ] **Step 3: Implémenter `types.ts`**

```ts
// lib/health/types.ts
/// Types partagés du système de santé (module serveur `lib/health`).

export type HealthStatus = "ok" | "degraded" | "down";

export interface DbHealth {
  status: "up" | "down";
  /** Latence du ping SELECT 1 en ms. null si l'échec est survenu avant la mesure. */
  latencyMs: number | null;
  /** Message d'erreur court si status === "down". */
  error?: string;
}

export type DependencyKind = "critical" | "optional";

/**
 * État d'une dépendance NON pingée en direct : on rapporte sa PRÉSENCE DE
 * CONFIGURATION (clé d'env / helper de détection), pas sa liveness. Le seul
 * vrai I/O réseau du health check est le ping DB (cf. DbHealth).
 */
export interface DependencyHealth {
  key: string;
  label: string;
  kind: DependencyKind;
  configured: boolean;
  detail: string;
}

export interface RuntimeInfo {
  env: string;
  vercelEnv: string | null;
  region: string | null;
  buildId: string | null;
  nodeVersion: string;
}

export interface HealthReport {
  status: HealthStatus;
  db: DbHealth;
  dependencies: DependencyHealth[];
  runtime: RuntimeInfo;
  /** ISO 8601. */
  checkedAt: string;
}

/** Charge utile publique minimale de /api/health (pas de détail sensible). */
export interface HealthSummary {
  status: HealthStatus;
  db: DbHealth;
  checkedAt: string;
}
```

- [ ] **Step 4: Implémenter `classify.ts`**

```ts
// lib/health/classify.ts
/// Classification PURE de l'état global à partir de la santé DB. Aucun I/O.
/// Testé en vitest. La DB est la seule dépendance CRITIQUE : elle seule fait
/// basculer l'état global. Les dépendances optionnelles sont informatives.

import type { DbHealth, HealthStatus } from "./types";

/** Au-delà de cette latence DB (ms), on considère le service "dégradé". */
export const SLOW_DB_MS = 2000;

export function classifyOverall(db: DbHealth, slowMs: number = SLOW_DB_MS): HealthStatus {
  if (db.status === "down") return "down";
  if (db.latencyMs !== null && db.latencyMs > slowMs) return "degraded";
  return "ok";
}
```

- [ ] **Step 5: Vérifier le vert**

Run: `pnpm vitest run lib/health/__tests__/classify.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/health/types.ts lib/health/classify.ts lib/health/__tests__/classify.test.ts
git commit -m "feat(health): types + classification pure de la sante (DB = seule dependance critique)"
```

---

### Task A2 : Checks serveur — ping DB + inventaire des dépendances

**Files:**
- Create: `lib/health/checks.ts`

**Interfaces:**
- Consumes: `classifyOverall`, types (A1) ; `prisma` (`@/lib/prisma`) ; helpers de détection existants.
- Produces:
  - `pingDatabase(timeoutMs?): Promise<DbHealth>` (mémoïsé `cache()`)
  - `collectDependencies(): DependencyHealth[]` (synchrone, présence de config)
  - `collectRuntime(): RuntimeInfo`
  - `getHealthReport(): Promise<HealthReport>` (mémoïsé `cache()`)
  - `getHealthSummary(): Promise<HealthSummary>` (mémoïsé `cache()`)

- [ ] **Step 1: Implémenter `checks.ts`**

Note : les imports de détection sont enveloppés en try/catch défensif par check (une dépendance ne doit jamais faire planter le rapport). On importe seulement des helpers SÛRS et synchrones. `readImapConfig()` renvoie `null` si incomplet ; les autres sont des `!!process.env`.

```ts
// lib/health/checks.ts
/// Exécution serveur des checks de santé. UN SEUL I/O réseau : le ping DB.
/// Tout le reste = présence de configuration (helpers existants / env), instantané.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { classifyOverall } from "./classify";
import type {
  DbHealth,
  DependencyHealth,
  HealthReport,
  HealthSummary,
  RuntimeInfo,
} from "./types";

/** Ping DB avec timeout dédié — on veut MESURER l'échec, pas le masquer par retry. */
export const pingDatabase = cache(async (timeoutMs = 3000): Promise<DbHealth> => {
  const start = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timeout ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return { status: "up", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: null,
      error: err instanceof Error ? err.message : "erreur inconnue",
    };
  }
});

/** true/false sans jamais throw (une détection cassée ne casse pas le rapport). */
function safeBool(fn: () => boolean | null | undefined): boolean {
  try {
    return Boolean(fn());
  } catch {
    return false;
  }
}

/**
 * Présence de configuration des dépendances. On lit les helpers de détection
 * existants de façon paresseuse (require dynamique dans le try) pour qu'un
 * module absent/en erreur n'invalide jamais le rapport global.
 */
export function collectDependencies(): DependencyHealth[] {
  const deps: DependencyHealth[] = [];

  const emailConfigured = safeBool(() => !!process.env.RESEND_API_KEY);
  deps.push({
    key: "email",
    label: "Email (Resend)",
    kind: "optional",
    configured: emailConfigured,
    detail: emailConfigured ? "Clé API présente" : "RESEND_API_KEY absente",
  });

  const imapConfigured = safeBool(() => {
    // Import paresseux : readImapConfig renvoie null si incomplet.
    const { readImapConfig } = require("@/lib/inbox/imap") as {
      readImapConfig: () => unknown;
    };
    return readImapConfig() !== null;
  });
  deps.push({
    key: "imap",
    label: "IMAP (réception inbox)",
    kind: "optional",
    configured: imapConfigured,
    detail: imapConfigured ? "Config OVH complète" : "CONTACT_IMAP_* incomplète",
  });

  const anthropic = safeBool(() => !!process.env.ANTHROPIC_API_KEY);
  deps.push({
    key: "anthropic",
    label: "IA Claude (Anthropic)",
    kind: "optional",
    configured: anthropic,
    detail: anthropic ? "Clé API présente" : "ANTHROPIC_API_KEY absente",
  });

  const embeddings = (() => {
    try {
      const { getEmbeddingProvider } = require("@/lib/chomage-ia/embeddings") as {
        getEmbeddingProvider: () => string | null;
      };
      return getEmbeddingProvider();
    } catch {
      return null;
    }
  })();
  deps.push({
    key: "embeddings",
    label: "Embeddings RAG",
    kind: "optional",
    configured: embeddings !== null,
    detail: embeddings ? `Provider : ${embeddings}` : "Aucun provider (Voyage/OpenAI)",
  });

  const webSearch = safeBool(() => {
    const { isWebSearchAvailable } = require("@/lib/chomage-ia/web-search") as {
      isWebSearchAvailable: () => boolean;
    };
    return isWebSearchAvailable();
  });
  deps.push({
    key: "web-search",
    label: "Recherche web (Brave)",
    kind: "optional",
    configured: webSearch,
    detail: webSearch ? "Clé + flag actifs" : "Clé ou flag manquant",
  });

  const blob = safeBool(() => {
    const { isBlobsEnabled } = require("@/lib/storage/blob-storage") as {
      isBlobsEnabled: () => boolean;
    };
    return isBlobsEnabled();
  });
  deps.push({
    key: "blob",
    label: "Stockage fichiers (Vercel Blob)",
    kind: "optional",
    configured: blob,
    detail: blob ? "Token présent" : "Repli disque local",
  });

  const kbo = safeBool(() => {
    const { isKboConfigured } = require("@/lib/be-companies/kbo-etl") as {
      isKboConfigured: () => boolean;
    };
    return isKboConfigured();
  });
  deps.push({
    key: "kbo",
    label: "KBO / BCE (entreprises)",
    kind: "optional",
    configured: kbo,
    detail: kbo ? "Identifiants présents" : "KBO_OPEN_DATA_* absents",
  });

  const stripe = safeBool(() => !!process.env.STRIPE_SECRET_KEY);
  deps.push({
    key: "stripe",
    label: "Paiement (Stripe)",
    kind: "optional",
    configured: stripe,
    detail: stripe ? "Clé secrète présente" : "STRIPE_SECRET_KEY absente",
  });

  return deps;
}

export function collectRuntime(): RuntimeInfo {
  return {
    env: process.env.NODE_ENV ?? "unknown",
    vercelEnv: process.env.VERCEL_ENV ?? null,
    region: process.env.VERCEL_REGION ?? null,
    buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? null,
    nodeVersion: process.version,
  };
}

export const getHealthReport = cache(async (): Promise<HealthReport> => {
  const db = await pingDatabase();
  return {
    status: classifyOverall(db),
    db,
    dependencies: collectDependencies(),
    runtime: collectRuntime(),
    checkedAt: new Date().toISOString(),
  };
});

export const getHealthSummary = cache(async (): Promise<HealthSummary> => {
  const db = await pingDatabase();
  return { status: classifyOverall(db), db, checkedAt: new Date().toISOString() };
});
```

> Note technique : `require(...)` dans un module TS compilé par Next fonctionne en runtime Node (les route handlers/RSC tournent en Node). Si le worker préfère des imports statiques, remplacer chaque `require` par un `import` en tête de fichier — les 5 helpers (`readImapConfig`, `getEmbeddingProvider`, `isWebSearchAvailable`, `isBlobsEnabled`, `isKboConfigured`) sont tous exportés et sûrs à importer. Le `require` paresseux est choisi ici uniquement pour l'isolation défensive (un throw à l'import d'un module ne casse pas le rapport). Conserver le `safeBool`/try-catch dans les deux cas.

- [ ] **Step 2: Smoke test contre la vraie base**

Écrire un script jetable dans `scripts/_smoke-health.ts` :

```ts
import { getHealthReport } from "@/lib/health/checks";
getHealthReport().then((r) => {
  console.log(JSON.stringify({ status: r.status, db: r.db, deps: r.dependencies.map((d) => `${d.key}:${d.configured}`), runtime: r.runtime }, null, 2));
  process.exit(0);
}).catch((e) => { console.error("SMOKE FAIL", e); process.exit(1); });
```

Run (dangerouslyDisableSandbox) : `pnpm tsx scripts/_smoke-health.ts` puis `rm -f scripts/_smoke-health.ts`
Expected : JSON avec `status: "ok"`, `db.status: "up"` + latence, et la liste des dépendances avec `configured` true/false. Aucune erreur. Si P1001 (Neon endormi), relancer une fois.

- [ ] **Step 3: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts.

- [ ] **Step 4: Commit**

```bash
git add lib/health/checks.ts
git commit -m "feat(health): checks serveur (ping DB unique + inventaire config des dependances)"
```

---

### Task A3 : Endpoint `/api/health` + carte corrigée + wiring status-strip

**Files:**
- Create: `app/api/health/route.ts`
- Rewrite: `components/admin/dashboard/api-health-card.tsx`
- Modify: `components/admin/dashboard/status-strip.tsx`
- Modify: `lib/admin/dashboard-stats.ts` (`getStatusStrip` réutilise `pingDatabase`)

**Interfaces:**
- Consumes: `getHealthSummary`, `pingDatabase` (A2).
- Produces: `GET /api/health` → `HealthSummary` (public, caché 10 s) ; `ApiHealthCard` (client, lit `/api/health`).

- [ ] **Step 1: Créer l'endpoint public**

```ts
// app/api/health/route.ts
import { NextResponse } from "next/server";
import { getHealthSummary } from "@/lib/health/checks";
import { memoCache } from "@/lib/memo-cache";

// Public, minimal (pas de détail sensible). Cache 10 s : les uptime monitors
// et la carte dashboard pingent en boucle sans re-taper la DB à chaque fois.
export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await memoCache("health:summary", 10_000, getHealthSummary);
  // 200 même si "degraded" (l'API répond) ; 503 seulement si "down" (DB KO)
  // pour que les uptime monitors externes déclenchent une alerte.
  const httpStatus = summary.status === "down" ? 503 : 200;
  return NextResponse.json(summary, {
    status: httpStatus,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
```

- [ ] **Step 2: Réécrire la carte (fin du fan-out et du 4xx-intolérant)**

```tsx
// components/admin/dashboard/api-health-card.tsx
"use client";

// Carte "Santé API" : lit l'endpoint serveur unique /api/health (résumé caché),
// refresh 60 s. Plus de fan-out client, plus de 4xx compté comme échec, plus
// de timeout batch arbitraire — l'état vient d'un vrai check serveur.
import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/lib/health/types";

interface CardState {
  status: HealthStatus | "pending" | "unreachable";
  dbLatencyMs: number | null;
}

export function ApiHealthCard() {
  const [state, setState] = useState<CardState>({ status: "pending", dbLatencyMs: null });

  const run = useCallback(async () => {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch("/api/health", { signal: ac.signal, cache: "no-store" });
      const data = (await r.json()) as { status: HealthStatus; db: { latencyMs: number | null } };
      setState({ status: data.status, dbLatencyMs: data.db.latencyMs });
    } catch {
      // Réseau/timeout : l'endpoint lui-même est injoignable → "unreachable"
      // (distinct de "down" qui vient du check DB serveur).
      setState({ status: "unreachable", dbLatencyMs: null });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void run();
    const interval = setInterval(() => void run(), 60_000);
    return () => clearInterval(interval);
  }, [run]);

  const label = {
    ok: "OK",
    degraded: "Dégradé",
    down: "Incident",
    unreachable: "Injoignable",
    pending: "…",
  }[state.status];

  const valueCls = {
    ok: "text-emerald-600 dark:text-emerald-400",
    degraded: "text-amber-600 dark:text-amber-400",
    down: "text-rose-600 dark:text-rose-400",
    unreachable: "text-rose-600 dark:text-rose-400",
    pending: "text-muted-foreground",
  }[state.status];

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Santé API</p>
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Activity className="size-3.5" />
        </span>
      </div>
      <p className={cn("mt-1 text-xl font-medium", valueCls)}>{label}</p>
      <p className="font-mono text-[11px] text-muted-foreground">
        {state.dbLatencyMs !== null ? `DB ${state.dbLatencyMs} ms` : "—"}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: `getStatusStrip` réutilise `pingDatabase`**

Dans `lib/admin/dashboard-stats.ts`, remplacer le bloc `try { await prisma.$queryRaw\`SELECT 1\`; ... }` de `getStatusStrip` par un appel à `pingDatabase()` (dédup + cohérence avec la carte). Ajouter en tête l'import :

```ts
import { pingDatabase } from "@/lib/health/checks";
```

Puis, dans `getStatusStrip`, remplacer :

```ts
  const t0 = Date.now();
  let db: StatusStrip["db"] = { ok: false, latencyMs: null };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true, latencyMs: Date.now() - t0 };
  } catch {
    // db reste { ok: false } — la carte affiche l'état dégradé, jamais bloquant.
  }
```

par :

```ts
  const ping = await pingDatabase();
  const db: StatusStrip["db"] = { ok: ping.status === "up", latencyMs: ping.latencyMs };
```

(Le reste de `getStatusStrip` — `traffic24h`, `ops` — est inchangé.)

- [ ] **Step 4: Vérifier que `status-strip.tsx` n'a pas besoin de changement**

`status-strip.tsx` importe déjà `<ApiHealthCard />` et l'affiche en 1ʳᵉ carte : aucun changement requis. Le confirmer visuellement (lecture) sans éditer.

- [ ] **Step 5: Build + tests + smoke endpoint**

Run: `pnpm test` puis `pnpm build`
Expected: verts.

Smoke (optionnel, nécessite dev server) : lancer `pnpm dev`, puis `curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://localhost:3000/api/health` → `200` rapide (< 1 s à chaud). Arrêter le dev server.

- [ ] **Step 6: Commit**

```bash
git add app/api/health/route.ts components/admin/dashboard/api-health-card.tsx lib/admin/dashboard-stats.ts
git commit -m "feat(health): endpoint public /api/health + carte lisant un check serveur unique (fin des faux Degrade)"
```

---

# PART B — Durcissement des primitives API

### Task B1 : Helpers de réponse standard + `Retry-After` (testés)

**Files:**
- Create: `lib/api/response.ts`
- Create: `lib/api/rate-limit-response.ts`
- Test: `lib/api/__tests__/response.test.ts`
- Test: `lib/api/__tests__/rate-limit-response.test.ts`

**Interfaces:**
- Consumes: `checkRateLimit` retour `{ allowed, resetAt, remaining? }` (`lib/utils/rate-limit.ts`).
- Produces:
  - `type ApiErrorBody = { error: string; code?: string; details?: unknown }`
  - `apiError(status: number, message: string, opts?: { code?: string; details?: unknown; headers?: Record<string,string> }): NextResponse`
  - `apiOk<T>(data: T, opts?: { status?: number; headers?: Record<string,string> }): NextResponse`
  - `rateLimitHeaders(input: { limit: number; remaining: number; resetAt: number }): Record<string,string>`
  - `tooManyRequests(input: { limit: number; resetAt: number; message?: string }): NextResponse`

- [ ] **Step 1: Écrire les tests (rouges)**

```ts
// lib/api/__tests__/response.test.ts
import { describe, expect, it } from "vitest";
import { apiError, apiOk } from "../response";

async function body(res: Response) {
  return JSON.parse(await res.text());
}

describe("apiError", () => {
  it("pose status, body {error} et Content-Type JSON", async () => {
    const res = apiError(404, "Introuvable");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await body(res)).toEqual({ error: "Introuvable" });
  });
  it("ajoute code et details quand fournis", async () => {
    const res = apiError(409, "Conflit", { code: "slug_conflict", details: { slug: "x" } });
    expect(await body(res)).toEqual({ error: "Conflit", code: "slug_conflict", details: { slug: "x" } });
  });
  it("fusionne les headers custom", () => {
    const res = apiError(400, "x", { headers: { "X-Test": "1" } });
    expect(res.headers.get("x-test")).toBe("1");
  });
});

describe("apiOk", () => {
  it("renvoie le corps brut en 200 par défaut", async () => {
    const res = apiOk({ hello: "world" });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ hello: "world" });
  });
  it("respecte le status custom (201)", () => {
    expect(apiOk({ id: 1 }, { status: 201 }).status).toBe(201);
  });
});
```

```ts
// lib/api/__tests__/rate-limit-response.test.ts
import { describe, expect, it } from "vitest";
import { rateLimitHeaders, tooManyRequests } from "../rate-limit-response";

describe("rateLimitHeaders", () => {
  it("émet X-RateLimit-* et Retry-After (secondes, arrondi haut)", () => {
    const resetAt = Date.now() + 4200; // ~4.2 s
    const h = rateLimitHeaders({ limit: 10, remaining: 3, resetAt });
    expect(h["X-RateLimit-Limit"]).toBe("10");
    expect(h["X-RateLimit-Remaining"]).toBe("3");
    expect(Number(h["Retry-After"])).toBeGreaterThanOrEqual(4);
    expect(Number(h["Retry-After"])).toBeLessThanOrEqual(5);
  });
  it("Retry-After jamais négatif si resetAt est passé", () => {
    const h = rateLimitHeaders({ limit: 5, remaining: 0, resetAt: Date.now() - 1000 });
    expect(Number(h["Retry-After"])).toBe(0);
  });
});

describe("tooManyRequests", () => {
  it("renvoie 429 avec Retry-After et un body {error}", async () => {
    const res = tooManyRequests({ limit: 5, resetAt: Date.now() + 2000 });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    const b = JSON.parse(await res.text());
    expect(typeof b.error).toBe("string");
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm vitest run lib/api/__tests__/response.test.ts lib/api/__tests__/rate-limit-response.test.ts`
Expected: FAIL (modules introuvables).

- [ ] **Step 3: Implémenter `response.ts`**

```ts
// lib/api/response.ts
/// Helpers de réponse API standardisés. Généralise l'îlot
/// lib/decision-builder/api-helpers.ts à tout le repo. Convention retenue :
///  - Erreur : toujours { error: string, code?: string, details?: unknown } + Content-Type JSON.
///  - Succès : corps brut (compat avec la convention de facto existante).
/// Opt-in : les nouvelles routes et celles qu'on touche utilisent ces helpers ;
/// pas de migration forcée des 300+ routes existantes.

import { NextResponse } from "next/server";

const JSON_CT = { "Content-Type": "application/json; charset=utf-8" };

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
}

export function apiError(
  status: number,
  message: string,
  opts?: { code?: string; details?: unknown; headers?: Record<string, string> },
): NextResponse {
  const body: ApiErrorBody = { error: message };
  if (opts?.code) body.code = opts.code;
  if (opts?.details !== undefined) body.details = opts.details;
  return NextResponse.json(body, {
    status,
    headers: { ...JSON_CT, ...(opts?.headers ?? {}) },
  });
}

export function apiOk<T>(
  data: T,
  opts?: { status?: number; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(data, {
    status: opts?.status ?? 200,
    headers: { ...JSON_CT, ...(opts?.headers ?? {}) },
  });
}
```

- [ ] **Step 4: Implémenter `rate-limit-response.ts`**

```ts
// lib/api/rate-limit-response.ts
/// Standardise les en-têtes de rate-limiting. Le limiter existant
/// (lib/utils/rate-limit.ts) renvoie { allowed, resetAt, remaining? } mais
/// aucune route n'émet Retry-After ni X-RateLimit-* : ces helpers comblent ça.

import { apiError } from "./response";

export function rateLimitHeaders(input: {
  limit: number;
  remaining: number;
  resetAt: number;
}): Record<string, string> {
  const retryAfterSec = Math.max(0, Math.ceil((input.resetAt - Date.now()) / 1000));
  return {
    "X-RateLimit-Limit": String(input.limit),
    "X-RateLimit-Remaining": String(Math.max(0, input.remaining)),
    "X-RateLimit-Reset": String(Math.floor(input.resetAt / 1000)),
    "Retry-After": String(retryAfterSec),
  };
}

export function tooManyRequests(input: {
  limit: number;
  resetAt: number;
  message?: string;
}) {
  return apiError(429, input.message ?? "Trop de requêtes, réessayez plus tard.", {
    code: "rate_limited",
    headers: rateLimitHeaders({ limit: input.limit, remaining: 0, resetAt: input.resetAt }),
  });
}
```

- [ ] **Step 5: Vérifier le vert**

Run: `pnpm vitest run lib/api/__tests__/response.test.ts lib/api/__tests__/rate-limit-response.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/api/response.ts lib/api/rate-limit-response.ts lib/api/__tests__/response.test.ts lib/api/__tests__/rate-limit-response.test.ts
git commit -m "feat(api): helpers de reponse standard (apiOk/apiError) + Retry-After sur 429"
```

---

### Task B2 : Adoption exemplaire + documentation de la convention

**Files:**
- Modify: `app/api/newsletter/route.ts` (route publique exemplaire déjà rate-limitée)
- Modify: `docs/context/API_SECURITY_RULES.md` (section convention)

**Interfaces:**
- Consumes: `apiError`, `apiOk`, `tooManyRequests` (B1).

**But :** convertir UNE route publique représentative pour servir de référence (ne PAS migrer les 300+ routes — c'est une adoption incrémentale documentée). La newsletter est idéale : GET (liste), POST (inscription, rate-limité 429), PATCH, DELETE.

- [ ] **Step 1: Lire la route actuelle**

Run: lire `app/api/newsletter/route.ts` en entier pour repérer chaque `NextResponse.json(...)`.

- [ ] **Step 2: Convertir les réponses**

Remplacer les constructions manuelles par les helpers, en conservant EXACTEMENT les status codes et messages actuels :
- `return NextResponse.json(subscribers)` → `return apiOk(subscribers)`
- `return NextResponse.json({ error: "..." }, { status: 500 })` → `return apiError(500, "...")`
- `return NextResponse.json({ error: "Email invalide" }, { status: 400 })` → `return apiError(400, "Email invalide")`
- Le 429 : là où `checkRateLimit` échoue, remplacer par `return tooManyRequests({ limit: <max utilisé>, resetAt: <resetAt retourné> })` (récupérer `resetAt` du retour de `checkRateLimit`).
- Succès de création `NextResponse.json(subscriber, { status: 201 })` → `apiOk(subscriber, { status: 201 })`.
- `{ success: true }` (DELETE) → `apiOk({ success: true })`.

Ajouter en tête : `import { apiError, apiOk } from "@/lib/api/response";` et `import { tooManyRequests } from "@/lib/api/rate-limit-response";`. Retirer l'import `NextResponse` s'il n'est plus utilisé (sinon ESLint no-unused-vars).

- [ ] **Step 3: Documenter la convention**

Ajouter à la fin de `docs/context/API_SECURITY_RULES.md` :

```markdown
## Convention de réponse API (2026-07)

Helpers dans `lib/api/` — à utiliser pour toute NOUVELLE route et toute route qu'on modifie (adoption incrémentale, pas de migration de masse) :

- Erreur : `apiError(status, message, { code?, details?, headers? })` → body `{ error, code?, details? }` + `Content-Type` JSON.
- Succès : `apiOk(data, { status?, headers? })` → corps brut (convention de facto conservée).
- Rate-limit : sur un refus `checkRateLimit`, renvoyer `tooManyRequests({ limit, resetAt })` (émet `Retry-After` + `X-RateLimit-*`). Ne jamais renvoyer un 429 nu sans `Retry-After`.

Auth : toujours via `lib/auth-check.ts` (`requireAdminAuth`, etc.), pattern `if (!x.isAuthorized) return x.error`.
Rate-limiting : `lib/utils/rate-limit.ts` (in-memory, per-instance). Limite connue : non distribué entre lambdas Vercel. Évolution possible (hors périmètre actuel) : store Redis/Upstash.
```

- [ ] **Step 4: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts. Vérifier que le comportement de la newsletter est inchangé (mêmes status/messages).

- [ ] **Step 5: Commit**

```bash
git add app/api/newsletter/route.ts docs/context/API_SECURITY_RULES.md
git commit -m "refactor(api): newsletter adopte apiOk/apiError/Retry-After (route de reference) + doc convention"
```

---

# PART C — Page de monitoring `/admin/monitoring`

### Task C1 : Composants de présentation du monitoring

**Files:**
- Create: `components/admin/monitoring/overall-banner.tsx`
- Create: `components/admin/monitoring/dependency-grid.tsx`
- Create: `components/admin/monitoring/runtime-panel.tsx`
- Create: `components/admin/monitoring/flags-panel.tsx`

**Interfaces:**
- Consumes: types `HealthReport`, `DependencyHealth`, `RuntimeInfo` (A1).
- Produces: composants RSC purs (props) — `OverallBanner`, `DependencyGrid`, `RuntimePanel`, `FlagsPanel`.

- [ ] **Step 1: `overall-banner.tsx`** (bandeau d'état global, façon la référence Nerqis)

```tsx
// components/admin/monitoring/overall-banner.tsx
import { CircleCheck, TriangleAlert, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/lib/health/types";

const MAP: Record<HealthStatus, { label: string; sub: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  ok: { label: "Tous les systèmes opérationnels", sub: "Aucun incident détecté", icon: CircleCheck, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  degraded: { label: "Service dégradé", sub: "Latence base de données élevée", icon: TriangleAlert, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  down: { label: "Incident en cours", sub: "Base de données injoignable", icon: CircleX, cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30" },
};

export function OverallBanner({ status, dbLatencyMs, checkedAt }: { status: HealthStatus; dbLatencyMs: number | null; checkedAt: string }) {
  const m = MAP[status];
  const Icon = m.icon;
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3", m.cls)}>
      <Icon className="size-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{m.label}</p>
        <p className="text-[12px] opacity-80">{m.sub}</p>
      </div>
      <div className="text-right font-mono text-[11px] opacity-80">
        <div>{dbLatencyMs !== null ? `DB ${dbLatencyMs} ms` : "DB —"}</div>
        <div>{new Date(checkedAt).toLocaleTimeString("fr-BE")}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `dependency-grid.tsx`**

```tsx
// components/admin/monitoring/dependency-grid.tsx
import { cn } from "@/lib/utils";
import type { DependencyHealth } from "@/lib/health/types";

function Dot({ configured, kind }: { configured: boolean; kind: DependencyHealth["kind"] }) {
  // critique non configuré = rouge ; optionnel non configuré = gris (neutre, pas une erreur).
  const cls = configured
    ? "bg-emerald-500"
    : kind === "critical"
      ? "bg-rose-500"
      : "bg-muted-foreground/40";
  return <span className={cn("size-2 shrink-0 rounded-full", cls)} />;
}

export function DependencyGrid({ dependencies }: { dependencies: DependencyHealth[] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-xs font-semibold">Dépendances &amp; intégrations</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {dependencies.map((d) => (
          <div key={d.key} className="flex items-start gap-2.5 rounded-lg border bg-background/40 px-3 py-2">
            <span className="mt-1.5">
              <Dot configured={d.configured} kind={d.kind} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium">{d.label}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{d.detail}</p>
            </div>
            <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
              {d.configured ? "configuré" : "inactif"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `runtime-panel.tsx`**

```tsx
// components/admin/monitoring/runtime-panel.tsx
import type { RuntimeInfo } from "@/lib/health/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t py-1.5 text-[12px] first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-[11px]">{value}</span>
    </div>
  );
}

export function RuntimePanel({ runtime }: { runtime: RuntimeInfo }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 text-xs font-semibold">Runtime</h2>
      <Row label="Environnement" value={runtime.env} />
      <Row label="Vercel env" value={runtime.vercelEnv ?? "hors Vercel"} />
      <Row label="Région" value={runtime.region ?? "—"} />
      <Row label="Build" value={runtime.buildId ?? "dev"} />
      <Row label="Node" value={runtime.nodeVersion} />
    </section>
  );
}
```

- [ ] **Step 4: `flags-panel.tsx`** (props uniquement — la donnée est chargée par la page en C2)

```tsx
// components/admin/monitoring/flags-panel.tsx
import { cn } from "@/lib/utils";

export interface FlagRow {
  key: string;
  enabled: boolean;
}

export function FlagsPanel({ flags }: { flags: FlagRow[] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 text-xs font-semibold">Feature flags</h2>
      {flags.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-muted-foreground">Aucun flag</p>
      ) : (
        flags.map((f, i) => (
          <div key={f.key} className={cn("flex items-center justify-between gap-2 py-1.5 text-[12px]", i > 0 && "border-t")}>
            <span className="truncate font-mono text-[11px] text-muted-foreground">{f.key}</span>
            <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", f.enabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
              {f.enabled ? "on" : "off"}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
```

- [ ] **Step 5: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts (les composants ne sont pas encore montés, mais doivent compiler — ils sont importés en C2 ; ce build valide juste le typecheck des fichiers créés une fois la page ajoutée. Si build « unused »/orphan gêne, enchaîner directement C2 avant de builder).

> Pour éviter un build intermédiaire sur des composants non montés, il est acceptable de FUSIONNER le build/commit de C1 dans C2. Dans ce cas, committer C1 sans build ici et builder à la fin de C2.

- [ ] **Step 6: Commit**

```bash
git add components/admin/monitoring/overall-banner.tsx components/admin/monitoring/dependency-grid.tsx components/admin/monitoring/runtime-panel.tsx components/admin/monitoring/flags-panel.tsx
git commit -m "feat(monitoring): composants de presentation (bandeau global, deps, runtime, flags)"
```

---

### Task C2 : Page `/admin/monitoring` + entrée sidebar + i18n

**Files:**
- Create: `app/admin/monitoring/page.tsx`
- Create: `app/admin/monitoring/loading.tsx`
- Modify: `components/app-sidebar.tsx` (item de nav)
- Modify: `messages/fr.json` (clé `admin.nav.monitoring`)

**Interfaces:**
- Consumes: `getHealthReport` (A2), `getAllSettings` (`lib/app-settings.ts`), composants C1.

- [ ] **Step 1: Créer la page RSC**

```tsx
// app/admin/monitoring/page.tsx
import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth-check";
import { getHealthReport } from "@/lib/health/checks";
import { getAllSettings, SETTING_KEYS } from "@/lib/app-settings";
import { OverallBanner } from "@/components/admin/monitoring/overall-banner";
import { DependencyGrid } from "@/components/admin/monitoring/dependency-grid";
import { RuntimePanel } from "@/components/admin/monitoring/runtime-panel";
import { FlagsPanel, type FlagRow } from "@/components/admin/monitoring/flags-panel";

export const dynamic = "force-dynamic";

// Crons connus (source : vercel.json). Statique et documenté — on n'a pas
// d'API Vercel pour interroger l'état d'exécution ; on liste le planning.
const CRONS: { path: string; label: string }[] = [
  { path: "/api/inbox/sync", label: "Synchro inbox IMAP" },
  { path: "/api/documents/cron/purge", label: "Purge dossiers (RGPD)" },
  { path: "/api/admin/pdf/cron/purge-drafts", label: "Purge brouillons PDF" },
  { path: "/api/chomage-ia/ingestion/cron", label: "Veille / ingestion IA" },
  { path: "/api/chomage-ia/sources/cron-obsolescence", label: "Obsolescence sources IA" },
  { path: "/api/cron/kbo-refresh", label: "Rafraîchissement KBO" },
];

export default async function MonitoringPage() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  const [report, settings] = await Promise.all([getHealthReport(), getAllSettings()]);

  // Flags booléens de AppSetting (on ne montre que les toggles "true"/"false").
  const boolKeys = Object.values(SETTING_KEYS).filter(
    (k) => settings[k] === "true" || settings[k] === "false",
  );
  const flags: FlagRow[] = boolKeys.map((k) => ({ key: k, enabled: settings[k] === "true" }));

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoring</h1>
        <p className="mt-2 text-muted-foreground">
          Santé des systèmes, dépendances et configuration runtime.
        </p>
      </div>

      <OverallBanner status={report.status} dbLatencyMs={report.db.latencyMs} checkedAt={report.checkedAt} />

      <DependencyGrid dependencies={report.dependencies} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RuntimePanel runtime={report.runtime} />
        <FlagsPanel flags={flags} />
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-xs font-semibold">Tâches planifiées</h2>
          {CRONS.map((c, i) => (
            <div key={c.path} className={i > 0 ? "border-t py-1.5" : "py-1.5"}>
              <p className="text-[12px] font-medium">{c.label}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{c.path}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Créer le `loading.tsx`**

```tsx
// app/admin/monitoring/loading.tsx
import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <PageHeaderSkeleton actions={0} />
      <CardGridSkeleton />
    </div>
  );
}
```

> Vérifier au préalable que `CardGridSkeleton` est bien exporté par `components/ui/skeletons.tsx` (rapport d'exploration : oui, lignes 156-186). Sinon, remplacer par `<ChartSkeleton />`.

- [ ] **Step 3: Ajouter l'entrée sidebar**

Dans `components/app-sidebar.tsx` :
1. Importer une icône lucide dans le bloc d'import (~ligne 21) : ajouter `ActivityIcon` (ou `HeartPulseIcon`) à la liste — vérifier le nom exact disponible en lucide v1 (`Activity` existe ; l'alias `ActivityIcon` aussi). Utiliser `Activity`.
2. Ajouter un item au tableau `navMain`, après l'item Traductions (~ligne 222) :

```tsx
    {
      title: t("monitoring"),
      url: "/admin/monitoring",
      icon: <Activity className="size-4" />,
    },
```

- [ ] **Step 4: Ajouter la clé i18n**

Dans `messages/fr.json`, sous `admin.nav`, ajouter (à côté de `"traductions"`) :

```json
"monitoring": "Monitoring",
```

(FR suffit : les autres langues retombent sur FR via `deepMerge` de `i18n/request.ts`.)

- [ ] **Step 5: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts. Vérifier dans la sortie build que `/admin/monitoring` apparaît comme route dynamique `ƒ`.

- [ ] **Step 6: Vérification visuelle (dev server)**

Lancer `pnpm dev`, ouvrir `/admin/monitoring` avec une session admin (ou vérifier via `curl` le HTML SSR contient « Monitoring » et « Runtime »). Vérifier le bandeau vert « Tous les systèmes opérationnels » quand la DB répond. Arrêter le dev server.

- [ ] **Step 7: Commit**

```bash
git add app/admin/monitoring/page.tsx app/admin/monitoring/loading.tsx components/app-sidebar.tsx messages/fr.json
git commit -m "feat(monitoring): page /admin/monitoring (sante, deps, runtime, flags, crons) + nav + i18n"
```

---

# PART D — Historique persistant (OPTIONNELLE — valider avec Oraliks avant de lancer)

> ⚠️ Cette partie implique une **migration additive Neon** (nouvelle table) + un **cron**. Ne la lancer qu'après accord explicite d'Oraliks. Elle n'est PAS requise pour résoudre le « toujours dégradé » (réglé en Part A). SQL **additif** via `prisma db execute` — JAMAIS `db push`.

### Task D1 : Table `ApiHealthSnapshot` (migration additive) + enregistrement

**Files:**
- Modify: `prisma/schema.prisma` (nouveau modèle)
- Create: `prisma/manual-migrations/<NN>-api-health-snapshot.sql`
- Modify: `lib/health/checks.ts` (fonction `recordSnapshot` + `getRecentSnapshots`)

- [ ] **Step 1: Ajouter le modèle au schéma** (pour que le client Prisma le type)

```prisma
/// Historique de santé (Part D monitoring). Écrit par le cron health-snapshot.
/// Purge conseillée : garder ~30 jours (cron de purge ou TTL applicatif).
model ApiHealthSnapshot {
  id          String   @id @default(cuid())
  status      String   // "ok" | "degraded" | "down"
  dbUp        Boolean
  dbLatencyMs Int?
  createdAt   DateTime @default(now())

  @@index([createdAt(sort: Desc)])
}
```

- [ ] **Step 2: Écrire la migration SQL additive**

```sql
-- prisma/manual-migrations/<NN>-api-health-snapshot.sql
CREATE TABLE IF NOT EXISTS "ApiHealthSnapshot" (
  "id"          TEXT PRIMARY KEY,
  "status"      TEXT NOT NULL,
  "dbUp"        BOOLEAN NOT NULL,
  "dbLatencyMs" INTEGER,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ApiHealthSnapshot_createdAt_idx"
  ON "ApiHealthSnapshot" ("createdAt" DESC);
```

- [ ] **Step 3: Appliquer la migration (additif, jamais db push)**

⚠️ Arrêter tout `pnpm dev` avant `prisma generate`. Commandes (dangerouslyDisableSandbox) :

```bash
pnpm prisma db execute --file prisma/manual-migrations/<NN>-api-health-snapshot.sql --schema prisma/schema.prisma
pnpm prisma generate
```

Vérifier : `pnpm tsx -e "import {prisma} from '@/lib/prisma'; prisma.apiHealthSnapshot.count().then(c=>{console.log('count',c);process.exit(0)})"` → `count 0` sans erreur.

- [ ] **Step 4: Ajouter `recordSnapshot` + `getRecentSnapshots` à `lib/health/checks.ts`**

```ts
export async function recordSnapshot(): Promise<void> {
  const summary = await getHealthSummary();
  try {
    await prisma.apiHealthSnapshot.create({
      data: {
        status: summary.status,
        dbUp: summary.db.status === "up",
        dbLatencyMs: summary.db.latencyMs,
      },
    });
  } catch (err) {
    console.error("[health] recordSnapshot failed:", err);
  }
}

export interface SnapshotPoint {
  status: string;
  dbLatencyMs: number | null;
  createdAt: Date;
}

export const getRecentSnapshots = cache(async (limit = 96): Promise<SnapshotPoint[]> => {
  const rows = await prisma.apiHealthSnapshot.findMany({
    select: { status: true, dbLatencyMs: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.reverse();
});
```

- [ ] **Step 5: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/manual-migrations/<NN>-api-health-snapshot.sql lib/health/checks.ts
git commit -m "feat(health): table ApiHealthSnapshot (migration additive) + record/getRecent"
```

### Task D2 : Cron d'enregistrement + sparkline sur la page

**Files:**
- Create: `app/api/cron/health-snapshot/route.ts`
- Modify: `vercel.json` (entrée cron)
- Create: `components/admin/monitoring/health-history.tsx`
- Modify: `app/admin/monitoring/page.tsx` (monter l'historique)

- [ ] **Step 1: Route cron protégée**

```ts
// app/api/cron/health-snapshot/route.ts
import { NextRequest } from "next/server";
import { recordSnapshot } from "@/lib/health/checks";
import { apiError, apiOk } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Protégé par CRON_SECRET (même convention que les autres crons du repo).
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return apiError(401, "Unauthorized");
  }
  await recordSnapshot();
  return apiOk({ ok: true });
}
```

> Vérifier la convention exacte d'auth cron dans un cron existant (ex. `app/api/inbox/sync/route.ts`) et s'y aligner (header `authorization: Bearer <CRON_SECRET>` est le standard Vercel Cron).

- [ ] **Step 2: Enregistrer le cron dans `vercel.json`**

Ajouter au tableau `crons` (ex. toutes les 15 min) :

```json
{ "path": "/api/cron/health-snapshot", "schedule": "*/15 * * * *" }
```

- [ ] **Step 3: Composant sparkline d'historique**

```tsx
// components/admin/monitoring/health-history.tsx
import type { SnapshotPoint } from "@/lib/health/checks";

export function HealthHistory({ points }: { points: SnapshotPoint[] }) {
  if (points.length < 2) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-xs font-semibold">Historique 24 h</h2>
        <p className="py-3 text-center text-[11px] text-muted-foreground">Pas encore de données</p>
      </section>
    );
  }
  const max = Math.max(...points.map((p) => p.dbLatencyMs ?? 0), 1);
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 24 - ((p.dbLatencyMs ?? 0) / max) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const incidents = points.filter((p) => p.status === "down").length;
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold">Latence DB — {points.length} points</h2>
        <span className="text-[11px] text-muted-foreground">{incidents} incident(s)</span>
      </div>
      <svg width="100%" height="26" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={coords} fill="none" stroke="var(--primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </section>
  );
}
```

- [ ] **Step 4: Monter l'historique dans la page**

Dans `app/admin/monitoring/page.tsx` : importer `getRecentSnapshots` et `HealthHistory`, charger `snapshots` dans le `Promise.all`, et insérer `<HealthHistory points={snapshots} />` sous le `OverallBanner`.

- [ ] **Step 5: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/health-snapshot/route.ts vercel.json components/admin/monitoring/health-history.tsx app/admin/monitoring/page.tsx
git commit -m "feat(monitoring): cron d'historique de sante + sparkline latence 24h"
```

---

## Validation finale

- [ ] `pnpm test` — tous verts (base : 1330+ après Part A/B).
- [ ] `pnpm build` — OK.
- [ ] `pnpm lint` — pas de NOUVELLE erreur (74 pré-existantes tolérées).
- [ ] `/admin` — la carte « Santé API » affiche **OK** en fonctionnement normal (plus de faux « Dégradé »). Elle ne fait qu'UNE requête `/api/health`.
- [ ] `/api/health` — `200` rapide en JSON `{ status, db, checkedAt }` ; `503` seulement si DB réellement injoignable.
- [ ] `/admin/monitoring` — bandeau global + grille dépendances (configuré/inactif) + runtime + flags + crons ; entrée « Monitoring » dans la sidebar.
- [ ] (Part D) l'historique se remplit après quelques exécutions du cron.

## Décisions & risques

- **Cause racine réglée en Part A** : la santé ne dépend plus que d'UN ping DB serveur, pas de la latence de 6 endpoints pingés côté client avec un budget de 5 s. Un 4xx n'est plus jamais compté comme échec.
- **Honnêteté** : les dépendances optionnelles rapportent leur *configuration*, pas leur *liveness* (on ne martèle pas les API externes). Seule la DB est pingée en direct. C'est explicite dans l'UI (« configuré / inactif »).
- **Pas de sur-ingénierie** : rate-limiting reste in-memory (pas de nouvelle dépendance) ; la standardisation des réponses est *opt-in* (pas de migration des 300+ routes).
- **Neon cold start** : le ping DB a un timeout de 3 s ; un cold-start peut donner un « degraded » ponctuel au premier hit, qui repasse « ok » ensuite (comportement correct et honnête, plus le faux-positif permanent d'avant).
- **Part D** : seule partie touchant le schéma. Migration **additive** via `db execute` (jamais `db push`), `prisma generate` avec dev server arrêté. À valider séparément.
