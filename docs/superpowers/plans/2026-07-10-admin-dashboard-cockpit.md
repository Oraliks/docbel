# Admin Dashboard Cockpit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le dashboard `/admin` par un cockpit 2 étages (file opérationnelle + analytics produit) alimenté par des agrégats SQL server-side, dans la grammaire visuelle compacte validée (spec `docs/superpowers/specs/2026-07-10-admin-dashboard-cockpit-design.md`).

**Architecture:** Un module serveur `lib/admin/dashboard-stats.ts` (agrégats Prisma + `$queryRaw date_trunc`, tout dédupliqué par `react` `cache()`), des helpers purs testés dans `lib/admin/dashboard-stats-helpers.ts`, et `app/admin/page.tsx` refondu en RSC avec un `<Suspense>` par étage. Composants dans `components/admin/dashboard/` ; seuls le chart recharts, le sélecteur de période et la carte santé API sont client.

**Tech Stack:** Next 16 (RSC, `searchParams: Promise`), Prisma 5 + Neon (`withDbRetry`), recharts (dynamic import existant), Tailwind 4 + shadcn, vitest, lucide-react v1.

## Global Constraints

- ❌ JAMAIS `prisma db push` (DB Neon partagée) — ce plan ne touche PAS au schéma, aucune migration.
- `git add` de chemins EXPLICITES uniquement (workdir partagé multi-agents), jamais `-A`.
- Commandes git/test/build via Bash avec `dangerouslyDisableSandbox: true` (le sandbox revert les fichiers trackés).
- Pas de nouvelle dépendance. Pas de `setState` synchrone dans un `useEffect`. Pas de `bg-white` en dur.
- ESLint : ~74 erreurs pré-existantes, ne pas en ajouter. `pnpm build` = typecheck (pas de `pnpm typecheck`).
- Textes UI : français en dur, cohérent avec le dashboard actuel (i18n admin hors périmètre).
- `findMany` toujours borné (`take`), agrégats seulement — jamais de listes massives vers le client.
- Toutes les requêtes Prisma passent par `withDbRetry` (import `@/lib/prisma`).
- Hrefs vérifiés : `/admin/signalements`, `/admin/chomage/ia/gaps`, `/admin/i18n`, `/admin/messagerie`, `/admin/booking`, `/admin/baremes`, `/admin/users`, `/admin/formations`, `/admin/chomage/ia/chat`, `/admin/employeurs/stats`, `/admin/pages`.
- Tables sans `@@map` → noms SQL = noms de modèles : `"PageView"`, `"BundleRun"`, `"PdfFormSubmissionLog"`, `"Booking"`, `"User"`.
- Validation par tâche : `pnpm test` puis `pnpm build`. Écran final : `/admin` (vérif manuelle par Oraliks, session admin requise).

---

### Task 1: Helpers purs + tests

**Files:**
- Create: `lib/admin/dashboard-stats-helpers.ts`
- Test: `lib/admin/__tests__/dashboard-stats-helpers.test.ts`

**Interfaces:**
- Produces: `type Period = "7d" | "30d" | "90d"`, `PERIOD_DAYS`, `parsePeriod(raw?: string | null): Period`, `periodBounds(period, now?): { start: Date; prevStart: Date; end: Date; days: number }`, `computeDelta(current, previous): number | null`, `computeRate(num, den): number`, `belgianDay(date?): string` (YYYY-MM-DD Europe/Brussels), `type DayCount = { day: string; count: number }`, `zeroFillDays(rows, days, now?): DayCount[]`, `stepConversions(stages: number[]): (number | null)[]`.

- [ ] **Step 1: Écrire les tests (rouges)**

```ts
// lib/admin/__tests__/dashboard-stats-helpers.test.ts
import { describe, expect, it } from "vitest";
import {
  belgianDay,
  computeDelta,
  computeRate,
  parsePeriod,
  periodBounds,
  stepConversions,
  zeroFillDays,
} from "../dashboard-stats-helpers";

describe("parsePeriod", () => {
  it("accepte 7d et 90d", () => {
    expect(parsePeriod("7d")).toBe("7d");
    expect(parsePeriod("90d")).toBe("90d");
  });
  it("retombe sur 30d pour tout le reste", () => {
    expect(parsePeriod("30d")).toBe("30d");
    expect(parsePeriod(undefined)).toBe("30d");
    expect(parsePeriod("x")).toBe("30d");
    expect(parsePeriod(null)).toBe("30d");
  });
});

describe("periodBounds", () => {
  it("calcule start / prevStart / days", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const b = periodBounds("7d", now);
    expect(b.days).toBe(7);
    expect(b.end).toEqual(now);
    expect(b.start).toEqual(new Date("2026-07-03T12:00:00Z"));
    expect(b.prevStart).toEqual(new Date("2026-06-26T12:00:00Z"));
  });
});

describe("computeDelta", () => {
  it("delta % arrondi", () => {
    expect(computeDelta(110, 100)).toBe(10);
    expect(computeDelta(90, 100)).toBe(-10);
    expect(computeDelta(1, 3)).toBe(-67);
  });
  it("null si précédent nul et courant non nul (non significatif)", () => {
    expect(computeDelta(5, 0)).toBeNull();
  });
  it("0 si tout est nul", () => {
    expect(computeDelta(0, 0)).toBe(0);
  });
});

describe("computeRate", () => {
  it("taux % arrondi", () => {
    expect(computeRate(187, 342)).toBe(55);
  });
  it("0 si dénominateur nul", () => {
    expect(computeRate(5, 0)).toBe(0);
  });
});

describe("belgianDay", () => {
  it("format YYYY-MM-DD en Europe/Brussels", () => {
    // 23:30 UTC le 9 = 01:30 le 10 à Bruxelles (été, UTC+2)
    expect(belgianDay(new Date("2026-07-09T23:30:00Z"))).toBe("2026-07-10");
    expect(belgianDay(new Date("2026-07-09T12:00:00Z"))).toBe("2026-07-09");
  });
});

describe("zeroFillDays", () => {
  it("complète les jours vides jusqu'à aujourd'hui inclus", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const out = zeroFillDays([{ day: "2026-07-09", count: 3 }], 3, now);
    expect(out).toEqual([
      { day: "2026-07-08", count: 0 },
      { day: "2026-07-09", count: 3 },
      { day: "2026-07-10", count: 0 },
    ]);
  });
});

describe("stepConversions", () => {
  it("conversion % entre étapes consécutives", () => {
    expect(stepConversions([1240, 610, 342, 187])).toEqual([49, 56, 55]);
  });
  it("null quand l'étape précédente est vide", () => {
    expect(stepConversions([0, 5])).toEqual([null]);
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `pnpm vitest run lib/admin/__tests__/dashboard-stats-helpers.test.ts`
Expected: FAIL (module `../dashboard-stats-helpers` introuvable).

- [ ] **Step 3: Implémenter les helpers**

```ts
// lib/admin/dashboard-stats-helpers.ts
/// Helpers PURS du dashboard admin (aucun import Prisma) — testés en vitest.

export type Period = "7d" | "30d" | "90d";

export const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

const DAY_MS = 24 * 60 * 60 * 1000;

export function parsePeriod(raw: string | undefined | null): Period {
  return raw === "7d" || raw === "90d" ? raw : "30d";
}

export interface PeriodBounds {
  start: Date;
  prevStart: Date;
  end: Date;
  days: number;
}

export function periodBounds(period: Period, now: Date = new Date()): PeriodBounds {
  const days = PERIOD_DAYS[period];
  return {
    start: new Date(now.getTime() - days * DAY_MS),
    prevStart: new Date(now.getTime() - 2 * days * DAY_MS),
    end: now,
    days,
  };
}

/** Delta % arrondi vs période précédente. null = non significatif (précédent nul). */
export function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Taux % arrondi (ex. complétion). 0 si dénominateur nul. */
export function computeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/** Jour courant côté Belgique au format YYYY-MM-DD (fr-CA = ISO). */
export function belgianDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export interface DayCount {
  day: string;
  count: number;
}

/** Complète les jours sans données (count 0) sur `days` jours, aujourd'hui inclus. */
export function zeroFillDays(rows: DayCount[], days: number, now: Date = new Date()): DayCount[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = belgianDay(new Date(now.getTime() - i * DAY_MS));
    out.push({ day, count: byDay.get(day) ?? 0 });
  }
  return out;
}

/** Conversions étape par étape d'un funnel : out[i] = stages[i+1] / stages[i] en %. */
export function stepConversions(stages: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    out.push(stages[i] === 0 ? null : Math.round((stages[i + 1] / stages[i]) * 100));
  }
  return out;
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `pnpm vitest run lib/admin/__tests__/dashboard-stats-helpers.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/dashboard-stats-helpers.ts lib/admin/__tests__/dashboard-stats-helpers.test.ts
git commit -m "feat(admin): helpers purs du dashboard cockpit (periodes, deltas, zero-fill, funnel)"
```

---

### Task 2: Cœur stats — `getUsageKpis` + `getDailySeries`

**Files:**
- Create: `lib/admin/dashboard-stats.ts`

**Interfaces:**
- Consumes: helpers de Task 1 ; `prisma`, `withDbRetry` de `@/lib/prisma`.
- Produces:
  - `interface KpiStat { value: number; delta: number | null; series: number[] }`
  - `interface UsageKpis { visitors: KpiStat; runsStarted: KpiStat; completion: { value: number; deltaPts: number }; pdfGenerated: KpiStat; bookings: KpiStat; signups: KpiStat }`
  - `getUsageKpis(period: Period): Promise<UsageKpis>` (mémoïsé `cache()`)
  - `interface DailyPoint { day: string; visitors: number; runs: number }`
  - `getDailySeries(period: Period): Promise<DailyPoint[]>` (mémoïsé `cache()`)

- [ ] **Step 1: Implémenter le module**

```ts
// lib/admin/dashboard-stats.ts
/// Agrégats server-side du dashboard admin cockpit. Tout passe par withDbRetry
/// (Neon cold start) et cache() de React (dédup par requête RSC). Aucune liste
/// massive : counts, groupBy et date_trunc uniquement.

import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import {
  type DayCount,
  type Period,
  computeDelta,
  computeRate,
  periodBounds,
  zeroFillDays,
} from "./dashboard-stats-helpers";

// ── Comptes journaliers (sparklines + chart) ────────────────────────────────
// Identifiants SQL en whitelist (pas de @@map dans le schéma → noms de modèles).

const DAILY_SOURCES = {
  pageView: { table: Prisma.raw(`"PageView"`), column: Prisma.raw(`"createdAt"`) },
  bundleRun: { table: Prisma.raw(`"BundleRun"`), column: Prisma.raw(`"startedAt"`) },
  pdfLog: { table: Prisma.raw(`"PdfFormSubmissionLog"`), column: Prisma.raw(`"createdAt"`) },
  booking: { table: Prisma.raw(`"Booking"`), column: Prisma.raw(`"createdAt"`) },
  user: { table: Prisma.raw(`"User"`), column: Prisma.raw(`"createdAt"`) },
} as const;

type DailySource = keyof typeof DAILY_SOURCES;

const dailyCounts = cache(async (source: DailySource, period: Period): Promise<DayCount[]> => {
  const { start, days } = periodBounds(period);
  const src = DAILY_SOURCES[source];
  const rows = await withDbRetry(() =>
    prisma.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(${src.column} AT TIME ZONE 'Europe/Brussels', 'YYYY-MM-DD') AS day,
             count(*)::int AS count
      FROM ${src.table}
      WHERE ${src.column} >= ${start}
      GROUP BY 1
      ORDER BY 1
    `,
  );
  return zeroFillDays(rows, days);
});

// ── KPI usage ───────────────────────────────────────────────────────────────

export interface KpiStat {
  value: number;
  /** Delta % vs période précédente — null si non significatif. */
  delta: number | null;
  /** Comptes journaliers de la période courante (sparkline). */
  series: number[];
}

export interface UsageKpis {
  visitors: KpiStat;
  runsStarted: KpiStat;
  /** Taux de complétion (%) + delta en points vs période précédente. */
  completion: { value: number; deltaPts: number };
  pdfGenerated: KpiStat;
  bookings: KpiStat;
  signups: KpiStat;
}

export const getUsageKpis = cache(async (period: Period): Promise<UsageKpis> => {
  const { start, prevStart } = periodBounds(period);
  const cur = { gte: start };
  const prev = { gte: prevStart, lt: start };

  const [
    visitorsNow,
    visitorsPrev,
    visitorsSeries,
    runsNow,
    runsPrev,
    runsSeries,
    completedNow,
    completedPrev,
    // NB : la sparkline PDF compte tous les logs ; le KPI ne compte que success=true.
    pdfNow,
    pdfPrev,
    pdfSeries,
    bookingsNow,
    bookingsPrev,
    bookingsSeries,
    signupsNow,
    signupsPrev,
    signupsSeries,
  ] = await Promise.all([
    withDbRetry(() => prisma.pageView.count({ where: { createdAt: cur } })),
    withDbRetry(() => prisma.pageView.count({ where: { createdAt: prev } })),
    dailyCounts("pageView", period),
    withDbRetry(() => prisma.bundleRun.count({ where: { startedAt: cur } })),
    withDbRetry(() => prisma.bundleRun.count({ where: { startedAt: prev } })),
    dailyCounts("bundleRun", period),
    withDbRetry(() =>
      prisma.bundleRun.count({ where: { startedAt: cur, status: "completed" } }),
    ),
    withDbRetry(() =>
      prisma.bundleRun.count({ where: { startedAt: prev, status: "completed" } }),
    ),
    withDbRetry(() =>
      prisma.pdfFormSubmissionLog.count({ where: { createdAt: cur, success: true } }),
    ),
    withDbRetry(() =>
      prisma.pdfFormSubmissionLog.count({ where: { createdAt: prev, success: true } }),
    ),
    dailyCounts("pdfLog", period),
    withDbRetry(() => prisma.booking.count({ where: { createdAt: cur } })),
    withDbRetry(() => prisma.booking.count({ where: { createdAt: prev } })),
    dailyCounts("booking", period),
    withDbRetry(() => prisma.user.count({ where: { createdAt: cur } })),
    withDbRetry(() => prisma.user.count({ where: { createdAt: prev } })),
    dailyCounts("user", period),
  ]);

  const completionNow = computeRate(completedNow, runsNow);
  const completionPrev = computeRate(completedPrev, runsPrev);

  const stat = (value: number, previous: number, series: DayCount[]): KpiStat => ({
    value,
    delta: computeDelta(value, previous),
    series: series.map((d) => d.count),
  });

  return {
    visitors: stat(visitorsNow, visitorsPrev, visitorsSeries),
    runsStarted: stat(runsNow, runsPrev, runsSeries),
    completion: { value: completionNow, deltaPts: completionNow - completionPrev },
    pdfGenerated: stat(pdfNow, pdfPrev, pdfSeries),
    bookings: stat(bookingsNow, bookingsPrev, bookingsSeries),
    signups: stat(signupsNow, signupsPrev, signupsSeries),
  };
});

// ── Séries journalières du chart principal ──────────────────────────────────

export interface DailyPoint {
  day: string;
  visitors: number;
  runs: number;
}

export const getDailySeries = cache(async (period: Period): Promise<DailyPoint[]> => {
  const [visitors, runs] = await Promise.all([
    dailyCounts("pageView", period),
    dailyCounts("bundleRun", period),
  ]);
  return visitors.map((v, i) => ({
    day: v.day,
    visitors: v.count,
    runs: runs[i]?.count ?? 0,
  }));
});
```

- [ ] **Step 2: Vérifier contre la vraie base (smoke test one-shot)**

Run (dangerouslyDisableSandbox, depuis la racine) :
```bash
pnpm tsx --env-file=.env -e "import('./lib/admin/dashboard-stats.ts').then(m => m.getDailySeries('7d')).then(r => console.log(JSON.stringify(r.slice(0, 3))))"
```
Expected: un tableau JSON de 3 objets `{"day":"2026-07-0X","visitors":N,"runs":N}` sans erreur SQL. Si `relation does not exist` → vérifier la casse du nom de table dans `DAILY_SOURCES` contre la base (`\dt` ou `prisma db execute`). Si P1001 (Neon endormi) → relancer une fois.

- [ ] **Step 3: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: tests verts (aucune régression), build OK.

- [ ] **Step 4: Commit**

```bash
git add lib/admin/dashboard-stats.ts
git commit -m "feat(admin): agregats usage du cockpit (KPI + series journalieres, cache + withDbRetry)"
```

---

### Task 3: Page cockpit — header, période, KPI, chart

**Files:**
- Modify: `app/admin/page.tsx`
- Create: `components/admin/dashboard/period-selector.tsx`
- Create: `components/admin/dashboard/usage-kpis.tsx`
- Create: `components/admin/dashboard/daily-chart-lazy.tsx`
- Create: `components/admin/dashboard/daily-chart.tsx`

**Interfaces:**
- Consumes: `getUsageKpis`, `getDailySeries`, `parsePeriod`, `type Period` (Tasks 1-2) ; `KpiCardsSkeleton`, `ChartSkeleton` de `@/components/ui/skeletons`.
- Produces: `PeriodSelector({ period })` (client), `UsageKpis({ period })` (RSC async), `DailyChartLazy({ data: DailyPoint[] })` (client, dynamic ssr:false) + section RSC locale `ChartSection` définie dans `page.tsx`. Grammaire de carte partagée : `rounded-xl border bg-card`.

- [ ] **Step 1: Créer `period-selector.tsx`**

```tsx
// components/admin/dashboard/period-selector.tsx
"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/admin/dashboard-stats-helpers";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 j" },
  { value: "30d", label: "30 j" },
  { value: "90d", label: "90 j" },
];

export function PeriodSelector({ period }: { period: Period }) {
  const router = useRouter();
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5 text-xs">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => router.replace(`/admin?period=${p.value}`, { scroll: false })}
          className={cn(
            "rounded-md px-2.5 py-1 tabular-nums transition-colors",
            period === p.value
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Créer `usage-kpis.tsx`** (RSC async — une carte, grille hairline, sparklines SVG pur)

```tsx
// components/admin/dashboard/usage-kpis.tsx
import { getUsageKpis } from "@/lib/admin/dashboard-stats";
import { PERIOD_DAYS, type Period } from "@/lib/admin/dashboard-stats-helpers";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("fr-BE");

function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) return null;
  const max = Math.max(...series, 1);
  const points = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * 100;
      const y = 13 - (v / max) * 11;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height="14"
      viewBox="0 0 100 14"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-1"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DeltaBadge({ delta, suffix = " %" }: { delta: number | null; suffix?: string }) {
  if (delta === null) return <span className="text-[11px] text-muted-foreground">—</span>;
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[11px] font-medium tabular-nums",
        positive
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
      )}
    >
      {positive ? "+" : ""}
      {delta}
      {suffix}
    </span>
  );
}

function KpiCell({
  label,
  value,
  delta,
  series,
  suffix,
}: {
  label: string;
  value: string;
  delta: number | null;
  series?: number[];
  suffix?: string;
}) {
  return (
    <div className="bg-card px-4 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="text-lg font-medium tabular-nums">{value}</span>
        <DeltaBadge delta={delta} suffix={suffix} />
      </div>
      {series ? <Sparkline series={series} /> : null}
    </div>
  );
}

export async function UsageKpis({ period }: { period: Period }) {
  const k = await getUsageKpis(period);
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="px-4 pb-2 pt-3">
        <h2 className="text-xs font-semibold">Usage — {PERIOD_DAYS[period]} jours</h2>
      </div>
      <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-3">
        <KpiCell
          label="Visiteurs"
          value={nf.format(k.visitors.value)}
          delta={k.visitors.delta}
          series={k.visitors.series}
        />
        <KpiCell
          label="Dossiers démarrés"
          value={nf.format(k.runsStarted.value)}
          delta={k.runsStarted.delta}
          series={k.runsStarted.series}
        />
        <KpiCell
          label="Complétion"
          value={`${k.completion.value} %`}
          delta={k.completion.deltaPts}
          suffix=" pts"
        />
        <KpiCell
          label="PDF générés"
          value={nf.format(k.pdfGenerated.value)}
          delta={k.pdfGenerated.delta}
          series={k.pdfGenerated.series}
        />
        <KpiCell
          label="RDV pris"
          value={nf.format(k.bookings.value)}
          delta={k.bookings.delta}
          series={k.bookings.series}
        />
        <KpiCell
          label="Nouveaux comptes"
          value={nf.format(k.signups.value)}
          delta={k.signups.delta}
          series={k.signups.series}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Créer `daily-chart.tsx` + `daily-chart-lazy.tsx`**

```tsx
// components/admin/dashboard/daily-chart.tsx
"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/admin/dashboard-stats";

function dayLabel(day: string): string {
  // "2026-07-10" → "10/07"
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

export function DailyChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="cockpit-visitors" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis
          dataKey="day"
          tickFormatter={dayLabel}
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          labelFormatter={(d) => dayLabel(String(d))}
          cursor={{ stroke: "var(--border)" }}
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 11,
            padding: "4px 8px",
          }}
        />
        <Area
          type="monotone"
          dataKey="visitors"
          name="Visiteurs"
          stroke="var(--primary)"
          strokeWidth={1.5}
          fill="url(#cockpit-visitors)"
        />
        <Area
          type="monotone"
          dataKey="runs"
          name="Dossiers"
          stroke="#0d9488"
          strokeWidth={1.5}
          fill="transparent"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

```tsx
// components/admin/dashboard/daily-chart-lazy.tsx
"use client";

// recharts (~300 Ko) sort du bundle initial : même pattern dynamic ssr:false
// que l'ancien overview, avec un skeleton de forme proche.
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/skeletons";
import type { DailyPoint } from "@/lib/admin/dashboard-stats";

const DailyChart = dynamic(
  () => import("./daily-chart").then((m) => ({ default: m.DailyChart })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export function DailyChartLazy({ data }: { data: DailyPoint[] }) {
  return <DailyChart data={data} />;
}
```

- [ ] **Step 4: Refondre `app/admin/page.tsx`**

Remplacer intégralement le fichier :

```tsx
// app/admin/page.tsx
import { Suspense } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { PeriodSelector } from "@/components/admin/dashboard/period-selector"
import { UsageKpis } from "@/components/admin/dashboard/usage-kpis"
import { DailyChartLazy } from "@/components/admin/dashboard/daily-chart-lazy"
import { getDailySeries } from "@/lib/admin/dashboard-stats"
import { parsePeriod, type Period } from "@/lib/admin/dashboard-stats-helpers"
import { ChartSkeleton, KpiCardsSkeleton } from "@/components/ui/skeletons"

async function ChartSection({ period }: { period: Period }) {
  const data = await getDailySeries(period)
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold">Trafic &amp; dossiers</h2>
        <span className="text-[11px] text-muted-foreground">
          <span className="text-primary">●</span> Visiteurs (pages éditoriales)&nbsp;&nbsp;
          <span className="text-teal-600">●</span> Dossiers
        </span>
      </div>
      <DailyChartLazy data={data} />
    </section>
  )
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; view?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()
  const userRole = (session.user as { role?: string }).role
  if (userRole !== "admin") notFound()

  const { period: rawPeriod, view } = await searchParams

  // Vues alternatives (?view=filemanager|activity|changelog|users) : branche
  // legacy inchangée — les props massives disparaîtront en Task 8.
  if (view) {
    const [rawPages, rawUsers, rawSections] = await Promise.all([
      prisma.page.findMany({
        select: { id: true, title: true, slug: true, status: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.user.findMany({
        select: {
          id: true, name: true, email: true, role: true, status: true,
          lastLoginAt: true, createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.toolSection.findMany({
        include: { tools: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      }),
    ])
    const pages = rawPages.map((p) => ({
      id: p.id, title: p.title, slug: p.slug, status: p.status,
      createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    }))
    const users = rawUsers.map((u) => ({
      id: u.id, name: u.name ?? "", email: u.email, role: u.role, status: u.status,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString(),
    }))
    const sections = rawSections.map((s) => ({
      id: s.id, name: s.name, description: s.description, icon: s.icon ?? undefined,
      order: s.order,
      tools: s.tools.map((tool) => ({
        id: tool.id, name: tool.name, slug: tool.slug, description: tool.description,
        type: tool.type, icon: tool.icon ?? undefined, popular: tool.popular,
        timeMin: tool.timeMin ?? undefined, order: tool.order,
      })),
      createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
    }))
    return (
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <AdminDashboard pages={pages} users={users} sections={sections} />
      </div>
    )
  }

  const period = parsePeriod(rawPeriod)

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">Tableau de bord</h1>
        <PeriodSelector period={period} />
      </div>

      <Suspense fallback={<KpiCardsSkeleton count={6} />}>
        <UsageKpis period={period} />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <ChartSection period={period} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 5: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts. Vérifier dans la sortie build que `/admin` compile en RSC dynamique sans erreur.

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx components/admin/dashboard/period-selector.tsx components/admin/dashboard/usage-kpis.tsx components/admin/dashboard/daily-chart.tsx components/admin/dashboard/daily-chart-lazy.tsx
git commit -m "feat(admin): page cockpit - header periode, carte KPI hairline, chart trafic/dossiers"
```

---

### Task 4: File de travail (ops queue)

**Files:**
- Modify: `lib/admin/dashboard-stats.ts` (ajout `getOpsQueue`)
- Create: `components/admin/dashboard/ops-queue.tsx`
- Modify: `app/admin/page.tsx` (insertion de la section)

**Interfaces:**
- Produces: `interface OpsQueue { reports: number; gaps: number; translationsPending: number; translationsFailed: number; inboxUnread: number; bookingsToday: number; bookingsPendingApproval: number; baremesPending: number; total: number; activeQueues: number }`, `getOpsQueue(): Promise<OpsQueue>` (mémoïsé `cache()`, sans argument — Task 5 le réutilise).

- [ ] **Step 1: Ajouter `getOpsQueue` à `lib/admin/dashboard-stats.ts`**

Ajouter en fin de fichier (imports : ajouter `BookingStatus` à l'import `@prisma/client`, et `belgianDay` à l'import des helpers) :

```ts
// ── File de travail (« à traiter ») ─────────────────────────────────────────

export interface OpsQueue {
  reports: number;
  gaps: number;
  translationsPending: number;
  translationsFailed: number;
  inboxUnread: number;
  bookingsToday: number;
  bookingsPendingApproval: number;
  baremesPending: number;
  /** Somme des 6 compteurs affichés. */
  total: number;
  /** Nombre de files avec au moins 1 élément. */
  activeQueues: number;
}

export const getOpsQueue = cache(async (): Promise<OpsQueue> => {
  const today = belgianDay();
  const [
    reports,
    gaps,
    translationsPending,
    translationsFailed,
    inboxUnread,
    bookingsToday,
    bookingsPendingApproval,
    baremesPending,
  ] = await Promise.all([
    withDbRetry(() => prisma.report.count({ where: { status: "pending" } })),
    withDbRetry(() => prisma.knowledgeGap.count({ where: { status: "open" } })),
    withDbRetry(() => prisma.translationJob.count({ where: { status: "pending" } })),
    withDbRetry(() => prisma.translationJob.count({ where: { status: "failed" } })),
    withDbRetry(() =>
      prisma.inboxEmail.count({ where: { folder: "INBOX", isRead: false } }),
    ),
    withDbRetry(() =>
      prisma.booking.count({
        where: {
          date: today,
          status: { in: [BookingStatus.pending_approval, BookingStatus.confirmed] },
        },
      }),
    ),
    withDbRetry(() =>
      prisma.booking.count({ where: { status: BookingStatus.pending_approval } }),
    ),
    withDbRetry(() =>
      prisma.baremeFile.count({ where: { status: { in: ["draft", "pending_approval"] } } }),
    ),
  ]);

  const counters = [reports, gaps, translationsPending, inboxUnread, bookingsToday, baremesPending];
  return {
    reports,
    gaps,
    translationsPending,
    translationsFailed,
    inboxUnread,
    bookingsToday,
    bookingsPendingApproval,
    baremesPending,
    total: counters.reduce((a, b) => a + b, 0),
    activeQueues: counters.filter((c) => c > 0).length,
  };
});
```

- [ ] **Step 2: Créer `ops-queue.tsx`**

```tsx
// components/admin/dashboard/ops-queue.tsx
import Link from "next/link";
import {
  Calendar,
  CircleHelp,
  ClipboardCheck,
  Flag,
  Languages,
  Mail,
} from "lucide-react";
import { getOpsQueue } from "@/lib/admin/dashboard-stats";
import { cn } from "@/lib/utils";

interface QueueItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  /** Détail optionnel affiché sous le libellé (11px muted). */
  hint?: string;
}

function QueueTile({ item }: { item: QueueItem }) {
  const pending = item.count > 0;
  return (
    <Link href={item.href} className="group flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
          pending
            ? "bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20 dark:text-amber-400"
            : "bg-muted text-muted-foreground",
        )}
      >
        <item.icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-tight tabular-nums">
          {item.count}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {item.label}
          {item.hint ? ` · ${item.hint}` : ""}
        </span>
      </span>
    </Link>
  );
}

export async function OpsQueue() {
  const q = await getOpsQueue();
  const items: QueueItem[] = [
    { href: "/admin/signalements", icon: Flag, label: "Signalements", count: q.reports },
    { href: "/admin/chomage/ia/gaps", icon: CircleHelp, label: "Gaps IA", count: q.gaps },
    {
      href: "/admin/i18n",
      icon: Languages,
      label: "Traductions",
      count: q.translationsPending,
      hint: q.translationsFailed > 0 ? `${q.translationsFailed} en échec` : undefined,
    },
    { href: "/admin/messagerie", icon: Mail, label: "Inbox", count: q.inboxUnread },
    {
      href: "/admin/booking",
      icon: Calendar,
      label: "RDV du jour",
      count: q.bookingsToday,
      hint:
        q.bookingsPendingApproval > 0 ? `${q.bookingsPendingApproval} à approuver` : undefined,
    },
    { href: "/admin/baremes", icon: ClipboardCheck, label: "Barèmes", count: q.baremesPending },
  ];

  return (
    <section className="rounded-xl border bg-card px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-xs font-semibold">File de travail</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {q.total} au total
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <QueueTile key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Insérer la section dans `app/admin/page.tsx`**

Ajouter l'import `import { OpsQueue } from "@/components/admin/dashboard/ops-queue"` puis, dans le return cockpit, entre le header et `<UsageKpis>` :

```tsx
      <Suspense fallback={<KpiCardsSkeleton count={4} />}>
        <OpsQueue />
      </Suspense>
```

- [ ] **Step 4: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/dashboard-stats.ts components/admin/dashboard/ops-queue.tsx app/admin/page.tsx
git commit -m "feat(admin): file de travail du cockpit (6 files pending, liens sections)"
```

---

### Task 5: Rangée statut

**Files:**
- Modify: `lib/admin/dashboard-stats.ts` (ajout `getStatusStrip`)
- Create: `components/admin/dashboard/api-health-card.tsx`
- Create: `components/admin/dashboard/status-strip.tsx`
- Modify: `app/admin/page.tsx` (insertion en 1ʳᵉ position)

**Interfaces:**
- Consumes: `getOpsQueue` (Task 4, mémoïsé — pas de double requête).
- Produces: `interface StatusStrip { db: { ok: boolean; latencyMs: number | null }; traffic24h: number; trafficPrev24h: number; ops: { total: number; activeQueues: number } }`, `getStatusStrip(): Promise<StatusStrip>` ; `ApiHealthCard()` (client, autonome).

- [ ] **Step 1: Ajouter `getStatusStrip` à `lib/admin/dashboard-stats.ts`**

```ts
// ── Rangée statut ───────────────────────────────────────────────────────────

export interface StatusStrip {
  db: { ok: boolean; latencyMs: number | null };
  traffic24h: number;
  trafficPrev24h: number;
  ops: { total: number; activeQueues: number };
}

export const getStatusStrip = cache(async (): Promise<StatusStrip> => {
  const now = Date.now();
  const h24 = new Date(now - 24 * 60 * 60 * 1000);
  const h48 = new Date(now - 48 * 60 * 60 * 1000);

  const t0 = Date.now();
  let db: StatusStrip["db"] = { ok: false, latencyMs: null };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true, latencyMs: Date.now() - t0 };
  } catch {
    // db reste { ok: false } — la carte affiche l'état dégradé, jamais bloquant.
  }

  const [traffic24h, trafficPrev24h, ops] = await Promise.all([
    withDbRetry(() => prisma.pageView.count({ where: { createdAt: { gte: h24 } } })),
    withDbRetry(() =>
      prisma.pageView.count({ where: { createdAt: { gte: h48, lt: h24 } } }),
    ),
    getOpsQueue(),
  ]);

  return {
    db,
    traffic24h,
    trafficPrev24h,
    ops: { total: ops.total, activeQueues: ops.activeQueues },
  };
});
```

- [ ] **Step 2: Créer `api-health-card.tsx`** (client, autonome — reprend la logique de check de `api-health-check.tsx`, qui sera supprimé en Task 8)

```tsx
// components/admin/dashboard/api-health-card.tsx
"use client";

// Carte compacte « Santé API » : ping des mêmes endpoints critiques que
// l'ancien bandeau ApiHealthCheck (supprimé en Task 8), refresh 60 s.
import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const ENDPOINTS = [
  "/api/bureaux/resolve?cp=1000",
  "/api/admin/bureaux/health",
  "/api/lookup/search?q=s01",
  "/api/activities?limit=1",
  "/api/inbox/stats",
  "/api/documents/organismes",
];

type Overall = "ok" | "degraded" | "down" | "pending";

interface HealthState {
  overall: Overall;
  avgMs: number | null;
  failing: number;
}

async function checkAll(signal: AbortSignal): Promise<HealthState> {
  const results = await Promise.allSettled(
    ENDPOINTS.map(async (url) => {
      const start = performance.now();
      const r = await fetch(url, { signal, cache: "no-store" });
      return { ok: r.ok, ms: Math.round(performance.now() - start) };
    }),
  );
  let okCount = 0;
  let msSum = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) {
      okCount++;
      msSum += r.value.ms;
    }
  }
  const failing = ENDPOINTS.length - okCount;
  const overall: Overall = failing === 0 ? "ok" : failing < ENDPOINTS.length ? "degraded" : "down";
  return { overall, avgMs: okCount > 0 ? Math.round(msSum / okCount) : null, failing };
}

export function ApiHealthCard() {
  const [state, setState] = useState<HealthState>({
    overall: "pending",
    avgMs: null,
    failing: 0,
  });

  const run = useCallback(async () => {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5000);
    try {
      setState(await checkAll(ac.signal));
    } catch {
      setState({ overall: "down", avgMs: null, failing: ENDPOINTS.length });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void run();
    const interval = setInterval(() => void run(), 60_000);
    return () => clearInterval(interval);
  }, [run]);

  const value = { ok: "OK", degraded: "Dégradé", down: "Incident", pending: "…" }[state.overall];
  const valueCls = {
    ok: "text-emerald-600 dark:text-emerald-400",
    degraded: "text-amber-600 dark:text-amber-400",
    down: "text-rose-600 dark:text-rose-400",
    pending: "text-muted-foreground",
  }[state.overall];

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Santé API</p>
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Activity className="size-3.5" />
        </span>
      </div>
      <p className={cn("mt-1 text-xl font-medium", valueCls)}>{value}</p>
      <p className="font-mono text-[11px] text-muted-foreground">
        {state.avgMs !== null ? `${ENDPOINTS.length - state.failing}/${ENDPOINTS.length} · ${state.avgMs} ms` : `${ENDPOINTS.length} endpoints`}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Créer `status-strip.tsx`** (RSC async)

```tsx
// components/admin/dashboard/status-strip.tsx
import { Database, Inbox, Users } from "lucide-react";
import { getStatusStrip } from "@/lib/admin/dashboard-stats";
import { computeDelta } from "@/lib/admin/dashboard-stats-helpers";
import { cn } from "@/lib/utils";
import { ApiHealthCard } from "./api-health-card";

const nf = new Intl.NumberFormat("fr-BE");

function StatusCard({
  label,
  value,
  valueClassName,
  sub,
  subMono = false,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sub: string;
  subMono?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            iconClassName,
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className={cn("mt-1 text-xl font-medium tabular-nums", valueClassName)}>{value}</p>
      <p className={cn("text-[11px] text-muted-foreground", subMono && "font-mono")}>{sub}</p>
    </div>
  );
}

export async function StatusStrip() {
  const s = await getStatusStrip();
  const trafficDelta = computeDelta(s.traffic24h, s.trafficPrev24h);

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <ApiHealthCard />
      <StatusCard
        label="Base de données"
        value={s.db.ok ? "Prêt" : "Indispo"}
        valueClassName={s.db.ok ? undefined : "text-rose-600 dark:text-rose-400"}
        sub={s.db.latencyMs !== null ? `Neon · ${s.db.latencyMs} ms` : "Neon · —"}
        subMono
        icon={Database}
        iconClassName="bg-teal-500/10 text-teal-600 dark:text-teal-400"
      />
      <StatusCard
        label="À traiter"
        value={nf.format(s.ops.total)}
        valueClassName={s.ops.total > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        sub={`${s.ops.activeQueues} file${s.ops.activeQueues > 1 ? "s" : ""} active${s.ops.activeQueues > 1 ? "s" : ""}`}
        icon={Inbox}
        iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
      />
      <StatusCard
        label="Trafic 24 h"
        value={nf.format(s.traffic24h)}
        sub={
          trafficDelta === null
            ? "vs 24 h précédentes : —"
            : `${trafficDelta >= 0 ? "+" : ""}${trafficDelta} % vs 24 h précédentes`
        }
        icon={Users}
        iconClassName="bg-primary/10 text-primary"
      />
    </section>
  );
}
```

- [ ] **Step 4: Insérer dans `app/admin/page.tsx`**

Import `import { StatusStrip } from "@/components/admin/dashboard/status-strip"`, puis en PREMIÈRE section du cockpit (avant `<OpsQueue>`) :

```tsx
      <Suspense fallback={<KpiCardsSkeleton count={4} />}>
        <StatusStrip />
      </Suspense>
```

- [ ] **Step 5: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/dashboard-stats.ts components/admin/dashboard/api-health-card.tsx components/admin/dashboard/status-strip.tsx app/admin/page.tsx
git commit -m "feat(admin): rangee statut du cockpit (sante API, ping DB, a-traiter, trafic 24h)"
```

---

### Task 6: Funnel dossiers + listes actionnables

**Files:**
- Modify: `lib/admin/dashboard-stats.ts` (ajout `getBundleFunnel` + `getTopLists`)
- Create: `components/admin/dashboard/bundle-funnel.tsx`
- Create: `components/admin/dashboard/top-lists.tsx`
- Modify: `app/admin/page.tsx` (grille chart + funnel, puis tops)

**Interfaces:**
- Consumes: `getNoResultQueries(days, limit)` de `@/lib/decision-builder/analytics-queries` (existant — retourne `{ query: string; count: number }[]`) ; `stepConversions` (Task 1).
- Produces: `interface BundleFunnel { searches: number; opened: number; created: number; completed: number }`, `getBundleFunnel(period): Promise<BundleFunnel>` ; `interface TopLists { pages: { slug: string; count: number }[]; bundles: { name: string; count: number }[]; noResult: { query: string; count: number }[] }`, `getTopLists(period): Promise<TopLists>`.

- [ ] **Step 1: Ajouter les deux fonctions à `lib/admin/dashboard-stats.ts`**

Ajouter l'import `import { getNoResultQueries } from "@/lib/decision-builder/analytics-queries";` puis :

```ts
// ── Funnel dossiers ─────────────────────────────────────────────────────────
// Événements best-effort (feature flag "analytics") : des zéros partout
// signifient probablement flag off → l'UI affiche un état vide explicite.

export interface BundleFunnel {
  searches: number;
  opened: number;
  created: number;
  completed: number;
}

export const getBundleFunnel = cache(async (period: Period): Promise<BundleFunnel> => {
  const { start } = periodBounds(period);
  const [events, completed] = await Promise.all([
    withDbRetry(() =>
      prisma.bundleAnalyticsEvent.groupBy({
        by: ["eventType"],
        where: {
          createdAt: { gte: start },
          eventType: { in: ["search_performed", "bundle_opened", "run_created"] },
        },
        _count: { _all: true },
      }),
    ),
    withDbRetry(() => prisma.bundleRun.count({ where: { completedAt: { gte: start } } })),
  ]);
  const m = new Map(events.map((e) => [e.eventType, e._count._all]));
  return {
    searches: m.get("search_performed") ?? 0,
    opened: m.get("bundle_opened") ?? 0,
    created: m.get("run_created") ?? 0,
    completed,
  };
});

// ── Listes actionnables ─────────────────────────────────────────────────────

export interface TopLists {
  pages: { slug: string; count: number }[];
  bundles: { name: string; count: number }[];
  noResult: { query: string; count: number }[];
}

export const getTopLists = cache(async (period: Period): Promise<TopLists> => {
  const { start, days } = periodBounds(period);
  const [pageRows, runRows, noResult] = await Promise.all([
    withDbRetry(() =>
      prisma.pageView.groupBy({
        by: ["slug"],
        where: { createdAt: { gte: start } },
        _count: { _all: true },
        orderBy: { _count: { slug: "desc" } },
        take: 5,
      }),
    ),
    withDbRetry(() =>
      prisma.bundleRun.groupBy({
        by: ["bundleId"],
        where: { startedAt: { gte: start } },
        _count: { _all: true },
        orderBy: { _count: { bundleId: "desc" } },
        take: 5,
      }),
    ),
    getNoResultQueries(days, 5),
  ]);

  const bundleIds = runRows.map((r) => r.bundleId);
  const bundleNames = bundleIds.length
    ? await withDbRetry(() =>
        prisma.documentBundle.findMany({
          where: { id: { in: bundleIds } },
          select: { id: true, name: true },
        }),
      )
    : [];
  const nameById = new Map(bundleNames.map((b) => [b.id, b.name]));

  return {
    pages: pageRows.map((r) => ({ slug: r.slug, count: r._count._all })),
    bundles: runRows.map((r) => ({
      name: nameById.get(r.bundleId) ?? r.bundleId,
      count: r._count._all,
    })),
    noResult,
  };
});
```

- [ ] **Step 2: Créer `bundle-funnel.tsx`**

```tsx
// components/admin/dashboard/bundle-funnel.tsx
import { getBundleFunnel } from "@/lib/admin/dashboard-stats";
import { stepConversions, type Period } from "@/lib/admin/dashboard-stats-helpers";

const nf = new Intl.NumberFormat("fr-BE");

export async function BundleFunnel({ period }: { period: Period }) {
  const f = await getBundleFunnel(period);
  const stages = [
    { label: "Recherches", count: f.searches },
    { label: "Dossiers ouverts", count: f.opened },
    { label: "Runs créés", count: f.created },
    { label: "Complétés", count: f.completed },
  ];
  const conversions = stepConversions(stages.map((s) => s.count));
  const max = Math.max(...stages.map((s) => s.count), 1);
  const empty = stages.every((s) => s.count === 0);

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-2.5 text-xs font-semibold">Funnel dossiers</h2>
      {empty ? (
        <p className="py-6 text-center text-[11px] text-muted-foreground">
          Aucun événement sur la période — vérifier le feature flag « analytics ».
        </p>
      ) : (
        <div className="text-[11.5px]">
          {stages.map((stage, i) => (
            <div key={stage.label}>
              {i > 0 ? (
                <p className="my-1 text-[11px] tabular-nums text-muted-foreground">
                  ↓ {conversions[i - 1] === null ? "—" : `${conversions[i - 1]} %`}
                </p>
              ) : null}
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-muted-foreground">{stage.label}</span>
                <span className="font-medium tabular-nums">{nf.format(stage.count)}</span>
              </div>
              <div
                className="h-2 rounded-sm bg-primary"
                style={{ width: `${Math.max((stage.count / max) * 100, 2)}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Créer `top-lists.tsx`**

```tsx
// components/admin/dashboard/top-lists.tsx
import { getTopLists } from "@/lib/admin/dashboard-stats";
import type { Period } from "@/lib/admin/dashboard-stats-helpers";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("fr-BE");

function RankedList({
  title,
  rows,
  mono = false,
  badge,
  accent = false,
  emptyLabel,
}: {
  title: string;
  rows: { label: string; count: number }[];
  mono?: boolean;
  badge?: string;
  accent?: boolean;
  emptyLabel: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className={cn("rounded-xl border bg-card p-4", accent && "border-primary/40")}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold">{title}</h2>
        {badge ? (
          <span className="rounded-full bg-primary/10 px-1.5 py-px text-[11px] text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground">{emptyLabel}</p>
      ) : (
        rows.map((row, i) => (
          <div key={row.label} className={cn(i > 0 && "mt-1.5")}>
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span
                className={cn("min-w-0 truncate text-muted-foreground", mono && "font-mono text-[11px]")}
              >
                {row.label}
              </span>
              <span className="font-medium tabular-nums">{nf.format(row.count)}</span>
            </div>
            <div className="mt-0.5 h-[3px] rounded-full bg-muted">
              <div
                className="h-[3px] rounded-full bg-primary"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export async function TopLists({ period }: { period: Period }) {
  const t = await getTopLists(period);
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <RankedList
        title="Pages les plus vues"
        rows={t.pages.map((p) => ({ label: `/${p.slug}`.replace("//", "/"), count: p.count }))}
        mono
        emptyLabel="Aucune vue sur la période"
      />
      <RankedList
        title="Dossiers démarrés"
        rows={t.bundles.map((b) => ({ label: b.name, count: b.count }))}
        emptyLabel="Aucun dossier démarré"
      />
      <RankedList
        title="Recherches sans résultat"
        rows={t.noResult.map((n) => ({ label: n.query, count: n.count }))}
        accent
        badge="à créer"
        emptyLabel="Aucune recherche orpheline 🎉"
      />
    </section>
  );
}
```

- [ ] **Step 4: Réorganiser `app/admin/page.tsx`**

Imports : `BundleFunnel`, `TopLists`. Remplacer la section chart seule par une grille chart + funnel, puis ajouter les tops :

```tsx
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Suspense fallback={<ChartSkeleton />}>
            <ChartSection period={period} />
          </Suspense>
        </div>
        <div className="lg:col-span-2">
          <Suspense fallback={<ChartSkeleton />}>
            <BundleFunnel period={period} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<KpiCardsSkeleton count={3} />}>
        <TopLists period={period} />
      </Suspense>
```

- [ ] **Step 5: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/dashboard-stats.ts components/admin/dashboard/bundle-funnel.tsx components/admin/dashboard/top-lists.tsx app/admin/page.tsx
git commit -m "feat(admin): funnel dossiers + tops (pages, dossiers, recherches sans resultat)"
```

---

### Task 7: Modules + activité récente

**Files:**
- Modify: `lib/admin/dashboard-stats.ts` (ajout `getModuleStats` + `getRecentActivity`)
- Create: `components/admin/dashboard/module-cards.tsx`
- Create: `components/admin/dashboard/recent-activity.tsx`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Produces: `interface ModuleStats { rdv: { upcoming7d: number; activeTenants: number }; formations: { enrollments: number; upcomingSessions: number }; ia: { sessions: number; openGaps: number }; employeur: { simulations: number; drafts: number } }`, `getModuleStats(period): Promise<ModuleStats>` ; `interface RecentActivityItem { id: string; user: string; action: string; resourceName: string; createdAt: Date }`, `getRecentActivity(limit?): Promise<RecentActivityItem[]>`.

- [ ] **Step 1: Ajouter les fonctions à `lib/admin/dashboard-stats.ts`**

```ts
// ── Modules secondaires ─────────────────────────────────────────────────────

export interface ModuleStats {
  rdv: { upcoming7d: number; activeTenants: number };
  formations: { enrollments: number; upcomingSessions: number };
  ia: { sessions: number; openGaps: number };
  employeur: { simulations: number; drafts: number };
}

export const getModuleStats = cache(async (period: Period): Promise<ModuleStats> => {
  const { start } = periodBounds(period);
  const now = new Date();
  const today = belgianDay(now);
  const in7days = belgianDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

  const [
    upcoming7d,
    activeTenants,
    enrollments,
    upcomingSessions,
    sessions,
    openGaps,
    simulations,
    drafts,
  ] = await Promise.all([
    withDbRetry(() =>
      prisma.booking.count({
        where: {
          date: { gte: today, lt: in7days },
          status: { in: [BookingStatus.pending_approval, BookingStatus.confirmed] },
        },
      }),
    ),
    withDbRetry(() => prisma.bookingTenant.count({ where: { active: true } })),
    withDbRetry(() => prisma.trainingEnrollment.count({ where: { createdAt: { gte: start } } })),
    withDbRetry(() =>
      prisma.trainingSession.count({
        where: { startsAt: { gte: now }, status: { in: ["scheduled", "open"] } },
      }),
    ),
    withDbRetry(() => prisma.chatSession.count({ where: { createdAt: { gte: start } } })),
    withDbRetry(() => prisma.knowledgeGap.count({ where: { status: "open" } })),
    withDbRetry(() => prisma.costSimulation.count({ where: { createdAt: { gte: start } } })),
    withDbRetry(() => prisma.documentDraft.count({ where: { status: "draft" } })),
  ]);

  return {
    rdv: { upcoming7d, activeTenants },
    formations: { enrollments, upcomingSessions },
    ia: { sessions, openGaps },
    employeur: { simulations, drafts },
  };
});

// ── Activité admin récente ──────────────────────────────────────────────────

export interface RecentActivityItem {
  id: string;
  user: string;
  action: string;
  resourceName: string;
  createdAt: Date;
}

export const getRecentActivity = cache(async (limit = 6): Promise<RecentActivityItem[]> => {
  return withDbRetry(() =>
    prisma.activity.findMany({
      select: { id: true, user: true, action: true, resourceName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  );
});
```

- [ ] **Step 2: Créer `module-cards.tsx`**

```tsx
// components/admin/dashboard/module-cards.tsx
import Link from "next/link";
import { Briefcase, Calendar, GraduationCap, Sparkles } from "lucide-react";
import { getModuleStats } from "@/lib/admin/dashboard-stats";
import type { Period } from "@/lib/admin/dashboard-stats-helpers";

const nf = new Intl.NumberFormat("fr-BE");

function ModuleCard({
  href,
  icon: Icon,
  title,
  stats,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  stats: { value: number; label: string }[];
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/40"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </span>
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <div className="flex gap-5">
        {stats.map((s) => (
          <span key={s.label}>
            <span className="block text-base font-medium leading-tight tabular-nums">
              {nf.format(s.value)}
            </span>
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}

export async function ModuleCards({ period }: { period: Period }) {
  const m = await getModuleStats(period);
  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <ModuleCard
        href="/admin/booking"
        icon={Calendar}
        title="RDV"
        stats={[
          { value: m.rdv.upcoming7d, label: "à venir 7 j" },
          { value: m.rdv.activeTenants, label: "tenants" },
        ]}
      />
      <ModuleCard
        href="/admin/formations"
        icon={GraduationCap}
        title="Formations"
        stats={[
          { value: m.formations.enrollments, label: "inscriptions" },
          { value: m.formations.upcomingSessions, label: "sessions" },
        ]}
      />
      <ModuleCard
        href="/admin/chomage/ia/chat"
        icon={Sparkles}
        title="Assistant IA"
        stats={[
          { value: m.ia.sessions, label: "sessions" },
          { value: m.ia.openGaps, label: "gaps" },
        ]}
      />
      <ModuleCard
        href="/admin/employeurs/stats"
        icon={Briefcase}
        title="Employeur"
        stats={[
          { value: m.employeur.simulations, label: "simulations" },
          { value: m.employeur.drafts, label: "brouillons" },
        ]}
      />
    </section>
  );
}
```

- [ ] **Step 3: Créer `recent-activity.tsx`**

```tsx
// components/admin/dashboard/recent-activity.tsx
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getRecentActivity } from "@/lib/admin/dashboard-stats";

function relativeShort(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export async function RecentActivity() {
  const items = await getRecentActivity(6);
  return (
    <section className="rounded-xl border bg-card px-4 py-2">
      <div className="flex items-center justify-between py-1.5">
        <h2 className="text-xs font-semibold">Activité admin</h2>
        <Link
          href="/admin?view=activity"
          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Tout <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground">Pas d'activité</p>
      ) : (
        items.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-2 border-t py-1.5 text-[11.5px]"
          >
            <p className="min-w-0 flex-1 truncate">
              <span className="font-medium">{a.user}</span>{" "}
              <span className="text-muted-foreground">{a.action}</span>{" "}
              <span className="text-foreground/80">{a.resourceName}</span>
            </p>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {relativeShort(a.createdAt)}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
```

- [ ] **Step 4: Insérer dans `app/admin/page.tsx`** (après `<TopLists>`)

```tsx
      <Suspense fallback={<KpiCardsSkeleton count={4} />}>
        <ModuleCards period={period} />
      </Suspense>

      <Suspense fallback={null}>
        <RecentActivity />
      </Suspense>
```

- [ ] **Step 5: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/dashboard-stats.ts components/admin/dashboard/module-cards.tsx components/admin/dashboard/recent-activity.tsx app/admin/page.tsx
git commit -m "feat(admin): modules secondaires (RDV, formations, IA, employeur) + activite compacte"
```

---

### Task 8: Nettoyage — vues legacy allégées

**Files:**
- Modify: `components/admin/admin-dashboard.tsx`
- Modify: `app/admin/page.tsx`
- Delete: `components/admin/admin-dashboard-overview.tsx`
- Delete: `components/admin/api-health-check.tsx`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: `AdminDashboard({ view, users })` — nouvelle signature : `view: string`, `users` optionnel (seulement pour `view === "users"`). Plus de props `pages`/`sections`.

- [ ] **Step 1: Alléger `components/admin/admin-dashboard.tsx`**

- Supprimer les imports devenus inutiles : `dynamic`, `KpiCardsSkeleton`, `ChartSkeleton`, et le bloc `AdminDashboardOverview = dynamic(...)`.
- Supprimer les interfaces `Tool` et `ToolSection` et l'interface `Page`.
- Nouvelle signature et branche par défaut :

```tsx
interface AdminDashboardProps {
  view: string;
  /** Uniquement pour view === "users". */
  users?: User[];
}

export function AdminDashboard({ view, users = [] }: AdminDashboardProps) {
```

- Supprimer `const searchParams = useSearchParams()` et la dérivation de `view` (la page passe `view` en prop) ; retirer l'import `useSearchParams`.
- La branche finale (vue par défaut) devient :

```tsx
  // Vue inconnue : rien (le cockpit est rendu par app/admin/page.tsx).
  return null;
```

- Le reste (filemanager / activity / changelog / users) est conservé tel quel, y compris le fetch `/api/activities`.

- [ ] **Step 2: Adapter la branche `view` de `app/admin/page.tsx`**

Remplacer tout le bloc `if (view) { ... }` par :

```tsx
  if (view) {
    // Seule la vue "users" a besoin de données (bornées, server-side).
    const users =
      view === "users"
        ? (
            await prisma.user.findMany({
              select: {
                id: true, name: true, email: true, role: true, status: true,
                lastLoginAt: true, createdAt: true, updatedAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 500,
            })
          ).map((u) => ({
            id: u.id, name: u.name ?? "", email: u.email, role: u.role, status: u.status,
            lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
            createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString(),
          }))
        : undefined
    return (
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <AdminDashboard view={view} users={users} />
      </div>
    )
  }
```

- [ ] **Step 3: Supprimer les fichiers morts**

```bash
git rm components/admin/admin-dashboard-overview.tsx components/admin/api-health-check.tsx
```

Puis vérifier qu'aucune autre référence ne subsiste :
Run: `rg -l "admin-dashboard-overview|ApiHealthCheck" --glob '!docs/**'`
Expected: aucun fichier (ou uniquement des docs).

- [ ] **Step 4: Build + tests**

Run: `pnpm test` puis `pnpm build`
Expected: verts. Les 4 vues `?view=` compilent, le cockpit est la vue par défaut.

- [ ] **Step 5: Commit**

```bash
git add components/admin/admin-dashboard.tsx app/admin/page.tsx
git commit -m "refactor(admin): retire l'ancien overview + bandeau API, vue users sur fetch dedie"
```

---

## Validation finale

- [ ] `pnpm test` — tous verts (base : 1311+).
- [ ] `pnpm build` — OK.
- [ ] `pnpm lint` — pas de NOUVELLE erreur (74 pré-existantes tolérées).
- [ ] Écran `/admin` (session admin, clair + sombre, mobile 2 colonnes) — vérification manuelle par Oraliks : rangée statut, file de travail, KPI, chart+funnel, tops, modules, activité ; sélecteur 7 j/30 j/90 j recharge les sections ; `?view=activity|users|filemanager|changelog` fonctionnent.
- [ ] Cas « données vides » : funnel affiche l'état explicite, tops affichent leurs libellés vides, compteurs à zéro en état neutre.
