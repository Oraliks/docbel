import { Suspense } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { PeriodSelector } from "@/components/admin/dashboard/period-selector"
import { StatusStrip } from "@/components/admin/dashboard/status-strip"
import { OpsQueue } from "@/components/admin/dashboard/ops-queue"
import { UsageKpis } from "@/components/admin/dashboard/usage-kpis"
import { BundleFunnel } from "@/components/admin/dashboard/bundle-funnel"
import { TopLists } from "@/components/admin/dashboard/top-lists"
import { ModuleCards } from "@/components/admin/dashboard/module-cards"
import { RecentActivity } from "@/components/admin/dashboard/recent-activity"
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

      <Suspense fallback={<KpiCardsSkeleton count={4} />}>
        <StatusStrip />
      </Suspense>

      <Suspense fallback={<KpiCardsSkeleton count={4} />}>
        <OpsQueue />
      </Suspense>

      <Suspense fallback={<KpiCardsSkeleton count={6} />}>
        <UsageKpis period={period} />
      </Suspense>

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

      <Suspense fallback={<KpiCardsSkeleton count={4} />}>
        <ModuleCards period={period} />
      </Suspense>

      <Suspense fallback={null}>
        <RecentActivity />
      </Suspense>
    </div>
  )
}
