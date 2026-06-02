import Link from "next/link";
import { ArrowLeft, BarChart3, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { AnalyticsTabs } from "@/components/admin/documents/analytics-tabs";

export const dynamic = "force-dynamic";

interface TemplateFunnel {
  templateId: string;
  templateName: string;
  templateSlug: string;
  started: number;
  preview: number;
  signatureStarted: number;
  submitted: number;
  abandoned: number;
  uniqueSessions: number;
  fieldErrors: { fieldId: string; count: number }[];
}

export default async function AnalyticsPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // === Funnel events (Phase 14) ===
  const events = await prisma.formAnalyticsEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { templateId: true, sessionId: true, eventType: true, contextKey: true },
  });

  const evtTemplateIds = Array.from(new Set(events.map((e) => e.templateId)));
  const evtTemplates = await prisma.documentTemplate.findMany({
    where: { id: { in: evtTemplateIds } },
    include: { tool: { select: { name: true, slug: true } } },
  });
  const evtTplMap = new Map(evtTemplates.map((t) => [t.id, t]));

  const byTemplate = new Map<string, TemplateFunnel>();
  const sessionsByTemplate = new Map<string, Set<string>>();
  const fieldErrorsByTemplate = new Map<string, Map<string, number>>();

  for (const e of events) {
    const tpl = evtTplMap.get(e.templateId);
    if (!tpl) continue;
    let funnel = byTemplate.get(e.templateId);
    if (!funnel) {
      funnel = {
        templateId: e.templateId,
        templateName: tpl.tool.name,
        templateSlug: tpl.tool.slug,
        started: 0,
        preview: 0,
        signatureStarted: 0,
        submitted: 0,
        abandoned: 0,
        uniqueSessions: 0,
        fieldErrors: [],
      };
      byTemplate.set(e.templateId, funnel);
      sessionsByTemplate.set(e.templateId, new Set());
      fieldErrorsByTemplate.set(e.templateId, new Map());
    }
    sessionsByTemplate.get(e.templateId)!.add(e.sessionId);
    switch (e.eventType) {
      case "started": funnel.started++; break;
      case "preview": funnel.preview++; break;
      case "signature_started": funnel.signatureStarted++; break;
      case "submitted": funnel.submitted++; break;
      case "abandoned": funnel.abandoned++; break;
      case "field_error":
        if (e.contextKey) {
          const map = fieldErrorsByTemplate.get(e.templateId)!;
          map.set(e.contextKey, (map.get(e.contextKey) || 0) + 1);
        }
        break;
    }
  }
  const funnels = Array.from(byTemplate.values()).map((f) => {
    f.uniqueSessions = sessionsByTemplate.get(f.templateId)?.size ?? 0;
    const errMap = fieldErrorsByTemplate.get(f.templateId);
    if (errMap) {
      f.fieldErrors = Array.from(errMap.entries())
        .map(([fieldId, count]) => ({ fieldId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }
    return f;
  });
  funnels.sort((a, b) => b.started - a.started);

  // === Stats générations (ancien stats page) ===
  const recent = await prisma.generatedDocument.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, templateId: true, userId: true, createdAt: true, emailSentTo: true },
  });
  const genTemplateIds = Array.from(new Set(recent.map((r) => r.templateId)));
  const genTemplates = await prisma.documentTemplate.findMany({
    where: { id: { in: genTemplateIds } },
    include: { tool: { select: { name: true, slug: true } } },
  });
  const genTplMap = new Map(genTemplates.map((t) => [t.id, t]));

  const genByTemplate = new Map<string, { total: number; loggedIn: number; emailed: number; name: string; slug: string }>();
  for (const r of recent) {
    const t = genTplMap.get(r.templateId);
    if (!t) continue;
    const cur = genByTemplate.get(r.templateId) || {
      total: 0, loggedIn: 0, emailed: 0, name: t.tool.name, slug: t.tool.slug,
    };
    cur.total++;
    if (r.userId) cur.loggedIn++;
    if (r.emailSentTo) cur.emailed++;
    genByTemplate.set(r.templateId, cur);
  }
  const perTemplate = Array.from(genByTemplate.values()).sort((a, b) => b.total - a.total);

  const byDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of recent) {
    const k = r.createdAt.toISOString().slice(0, 10);
    if (byDay.has(k)) byDay.set(k, (byDay.get(k) || 0) + 1);
  }
  const perDay = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const genTotals = {
    last30Days: recent.length,
    loggedIn: recent.filter((r) => r.userId).length,
    anonymous: recent.filter((r) => !r.userId).length,
    emailed: recent.filter((r) => r.emailSentTo).length,
    activeTemplates: perTemplate.length,
  };
  const allTime = await prisma.generatedDocument.count();

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7" />
            Analytics & statistiques
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Funnel, abandon, générations sur les 30 derniers jours
          </p>
        </div>
        <Button
          render={
            <a href="/api/documents/analytics/export?days=30" download>
              <Download className="w-4 h-4 mr-2" />
              Exporter CSV
            </a>
          }
          variant="outline"
          size="sm"
        />
      </div>

      <AnalyticsTabs
        funnels={funnels}
        genTotals={genTotals}
        allTime={allTime}
        perTemplate={perTemplate}
        perDay={perDay}
      />
    </div>
  );
}
