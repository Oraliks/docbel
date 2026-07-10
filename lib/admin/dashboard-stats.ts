/// Agrégats server-side du dashboard admin cockpit. Tout passe par withDbRetry
/// (Neon cold start) et cache() de React (dédup par requête RSC). Aucune liste
/// massive : counts, groupBy et date_trunc uniquement.

import { cache } from "react";
import { BookingStatus, Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import {
  type DayCount,
  type Period,
  belgianDay,
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
