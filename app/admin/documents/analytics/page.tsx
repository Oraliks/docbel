import Link from "next/link";
import { ArrowLeft, BarChart3, AlertTriangle, CheckCircle2, XCircle, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const events = await prisma.formAnalyticsEvent.findMany({
    where: { createdAt: { gte: since } },
    select: {
      templateId: true,
      sessionId: true,
      eventType: true,
      contextKey: true,
    },
  });

  const templateIds = Array.from(new Set(events.map((e) => e.templateId)));
  const templates = await prisma.documentTemplate.findMany({
    where: { id: { in: templateIds } },
    include: { tool: { select: { name: true, slug: true } } },
  });
  const tplMap = new Map(templates.map((t) => [t.id, t]));

  // Agréger par template
  const byTemplate = new Map<string, TemplateFunnel>();
  const sessionsByTemplate = new Map<string, Set<string>>();
  const fieldErrorsByTemplate = new Map<string, Map<string, number>>();

  for (const e of events) {
    const tpl = tplMap.get(e.templateId);
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
      case "started":
        funnel.started++;
        break;
      case "preview":
        funnel.preview++;
        break;
      case "signature_started":
        funnel.signatureStarted++;
        break;
      case "submitted":
        funnel.submitted++;
        break;
      case "abandoned":
        funnel.abandoned++;
        break;
      case "field_error":
        if (e.contextKey) {
          const map = fieldErrorsByTemplate.get(e.templateId)!;
          map.set(e.contextKey, (map.get(e.contextKey) || 0) + 1);
        }
        break;
    }
  }

  // Finaliser les funnels
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

  // Totaux globaux
  const totals = funnels.reduce(
    (acc, f) => {
      acc.started += f.started;
      acc.submitted += f.submitted;
      acc.abandoned += f.abandoned;
      acc.sessions += f.uniqueSessions;
      return acc;
    },
    { started: 0, submitted: 0, abandoned: 0, sessions: 0 }
  );
  const conversionRate = totals.started > 0 ? (totals.submitted / totals.started) * 100 : 0;
  const abandonRate = totals.started > 0 ? (totals.abandoned / totals.started) * 100 : 0;

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7" />
            Analytics formulaires
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Funnel et abandon sur les 30 derniers jours
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Sessions uniques
            </div>
            <div className="text-2xl font-bold">{totals.sessions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Démarrés</div>
            <div className="text-2xl font-bold">{totals.started}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              Conversion
            </div>
            <div className="text-2xl font-bold text-green-600">
              {conversionRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">{totals.submitted} générés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-amber-600" />
              Abandon
            </div>
            <div className="text-2xl font-bold text-amber-600">{abandonRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">{totals.abandoned} abandons</div>
          </CardContent>
        </Card>
      </div>

      {funnels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <BarChart3 className="w-10 h-10 mx-auto mb-3" />
            <p>Aucune donnée analytics encore.</p>
            <p className="text-xs mt-1">
              Les événements sont enregistrés dès qu&apos;un utilisateur ouvre un formulaire publié.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funnel par document</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Document</TableHead>
                  <TableHead className="text-right">Démarrés</TableHead>
                  <TableHead className="text-right">Aperçu</TableHead>
                  <TableHead className="text-right">Soumis</TableHead>
                  <TableHead className="text-right">Abandonnés</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                  <TableHead>Top erreurs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnels.map((f) => {
                  const conv = f.started > 0 ? (f.submitted / f.started) * 100 : 0;
                  return (
                    <TableRow key={f.templateId}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Link
                            href={`/outils/${f.templateSlug}`}
                            target="_blank"
                            className="font-medium hover:underline"
                          >
                            {f.templateName}
                          </Link>
                          <code className="text-xs text-muted-foreground block">/{f.templateSlug}</code>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{f.started}</TableCell>
                      <TableCell className="text-right">{f.preview}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {f.submitted}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">{f.abandoned}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            conv >= 60
                              ? "bg-green-50 text-green-700 border-green-300"
                              : conv >= 30
                                ? "bg-amber-50 text-amber-700 border-amber-300"
                                : "bg-red-50 text-red-700 border-red-300"
                          }
                        >
                          {conv.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {f.fieldErrors.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {f.fieldErrors.slice(0, 3).map((e) => (
                              <Badge
                                key={e.fieldId}
                                variant="outline"
                                className="text-[10px] gap-1 bg-red-50 text-red-700 border-red-300"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <code>{e.fieldId}</code> ({e.count})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
