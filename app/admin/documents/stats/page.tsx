import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { DocumentStatsView } from "@/components/admin/documents/document-stats-view";

export const dynamic = "force-dynamic";

export default async function DocumentStatsPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Toutes les générations des 30 derniers jours
  const recent = await prisma.generatedDocument.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: {
      id: true,
      templateId: true,
      userId: true,
      createdAt: true,
      emailSentTo: true,
    },
  });

  // Agréger par template
  const templateIds = Array.from(new Set(recent.map((r) => r.templateId)));
  const templates = await prisma.documentTemplate.findMany({
    where: { id: { in: templateIds } },
    include: { tool: { select: { name: true, slug: true } } },
  });
  const templateMap = new Map(templates.map((t) => [t.id, t]));

  // Stats par template
  const byTemplate = new Map<string, { total: number; loggedIn: number; emailed: number; name: string; slug: string }>();
  for (const r of recent) {
    const t = templateMap.get(r.templateId);
    if (!t) continue;
    const key = r.templateId;
    const cur = byTemplate.get(key) || {
      total: 0,
      loggedIn: 0,
      emailed: 0,
      name: t.tool.name,
      slug: t.tool.slug,
    };
    cur.total++;
    if (r.userId) cur.loggedIn++;
    if (r.emailSentTo) cur.emailed++;
    byTemplate.set(key, cur);
  }
  const perTemplate = Array.from(byTemplate.values()).sort((a, b) => b.total - a.total);

  // Stats par jour (30 derniers jours)
  const byDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, 0);
  }
  for (const r of recent) {
    const key = r.createdAt.toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  const perDay = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Totaux
  const totals = {
    last30Days: recent.length,
    loggedIn: recent.filter((r) => r.userId).length,
    anonymous: recent.filter((r) => !r.userId).length,
    emailed: recent.filter((r) => r.emailSentTo).length,
    activeTemplates: perTemplate.length,
  };

  // Total all-time
  const allTime = await prisma.generatedDocument.count();

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold">Statistiques</h1>
      </div>

      <DocumentStatsView
        totals={totals}
        allTime={allTime}
        perTemplate={perTemplate}
        perDay={perDay}
      />
    </div>
  );
}
