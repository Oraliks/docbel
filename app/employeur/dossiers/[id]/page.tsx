import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChecklistItemRow } from "@/components/docbel/employeur/checklist-item-row";
import { AlertCard } from "@/components/docbel/employeur/alert-card";
import { SourceBadge, ReliabilityBadge } from "@/components/docbel/employeur/badges";
import { LegalDisclaimerBox } from "@/components/docbel/employeur/legal-disclaimer-box";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { getScenarioDetail, getSourceMap, ownsScenario } from "@/lib/employeur/queries";
import {
  labelWorkerType,
  labelContractType,
  labelCategory,
  type AlertSeverity,
  type ItemPriority,
  type ItemStatus,
  type ReliabilityLevel,
} from "@/lib/employeur/constants";

export const metadata: Metadata = { title: "Dossier | Espace Employeur" };
export const dynamic = "force-dynamic";

interface StoredAlert {
  severity: AlertSeverity;
  message: string;
  sourceCode?: string;
}

function complexityLabel(reliability: ReliabilityLevel, alerts: StoredAlert[]): string {
  if (reliability === "needs_human_validation") return "À valider";
  const serious = alerts.filter((a) => a.severity !== "info").length;
  if (serious >= 3) return "Complexe";
  if (serious >= 1) return "Moyen";
  return "Simple";
}

export default async function DossierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const { id } = await params;
  const scenario = await getScenarioDetail(id);
  if (!scenario || !ownsScenario(scenario, user.id, user.isAdmin)) notFound();

  const sourceMap = await getSourceMap();
  const src = (code?: string | null) => (code ? sourceMap.get(code) : undefined);

  const alerts = (Array.isArray(scenario.alerts) ? scenario.alerts : []) as unknown as StoredAlert[];
  const reliability = (scenario.reliabilityScore ?? "medium") as ReliabilityLevel;
  const checklist = scenario.checklists[0];
  const items = checklist?.items ?? [];

  const usedCodes = Array.from(
    new Set(
      [
        ...items.map((i) => i.sourceCode),
        ...alerts.map((a) => a.sourceCode),
      ].filter((c): c is string => Boolean(c))
    )
  );

  return (
    <div className="w-full space-y-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href="/employeur/dossiers" />}>
        <ArrowLeft /> Mes dossiers
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{scenario.title}</h1>
          <p className="text-muted-foreground">
            {labelWorkerType(scenario.workerType)} · {labelContractType(scenario.contractType)}
          </p>
        </div>
        <Button
          variant="outline"
          render={
            <a href={`/api/employeur/scenarios/${scenario.id}/pdf`} target="_blank" rel="noopener noreferrer" />
          }
        >
          <FileDown /> Exporter PDF
        </Button>
      </div>

      <Tabs defaultValue="resume">
        <TabsList>
          <TabsTrigger value="resume">Résumé</TabsTrigger>
          <TabsTrigger value="checklist">Checklist ({items.length})</TabsTrigger>
          <TabsTrigger value="alertes">Alertes ({alerts.length})</TabsTrigger>
          <TabsTrigger value="sources">Sources ({usedCodes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="resume">
          <Card>
            <CardContent className="space-y-4 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <ReliabilityBadge level={reliability} />
                <span className="rounded-full border px-2.5 py-0.5 text-xs">
                  Complexité : {complexityLabel(reliability, alerts)}
                </span>
                {checklist ? (
                  <span className="rounded-full border px-2.5 py-0.5 text-xs">
                    {labelCategory(checklist.category)}
                  </span>
                ) : null}
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Row label="Commission paritaire" value={scenario.jointCommitteeNumber ?? "—"} />
                <Row
                  label="Salaire brut mensuel"
                  value={scenario.grossMonthlySalary ? `${scenario.grossMonthlySalary} €` : "—"}
                />
                <Row
                  label="Horaire"
                  value={scenario.weeklyHours ? `${scenario.weeklyHours} h/sem` : "—"}
                />
                <Row label="Fonction" value={scenario.functionTitle ?? "—"} />
                <Row
                  label="Date d'entrée prévue"
                  value={
                    scenario.plannedStartDate
                      ? new Date(scenario.plannedStartDate).toLocaleDateString("fr-BE")
                      : "—"
                  }
                />
                <Row label="Lieu de travail" value={scenario.workplace ?? "—"} />
              </dl>
              <LegalDisclaimerBox context="checklist" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist">
          <div className="space-y-2">
            {items.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucune tâche générée.
                </CardContent>
              </Card>
            ) : (
              items.map((item) => {
                const s = src(item.sourceCode);
                return (
                  <ChecklistItemRow
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    description={item.description}
                    priority={item.priority as ItemPriority}
                    initialStatus={item.status as ItemStatus}
                    tooltip={item.tooltip}
                    sourceCode={item.sourceCode}
                    sourceHref={s?.url}
                    sourceTitle={s?.title}
                  />
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="alertes">
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucune alerte. Aucune incohérence évidente détectée.
                </CardContent>
              </Card>
            ) : (
              alerts.map((a, i) => {
                const s = src(a.sourceCode);
                return (
                  <AlertCard
                    key={i}
                    severity={a.severity}
                    message={a.message}
                    sourceCode={a.sourceCode}
                    sourceHref={s?.url}
                    sourceTitle={s?.title}
                  />
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="sources">
          {usedCodes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucune source référencée.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {usedCodes.map((code) => {
                const s = src(code);
                return (
                  <li key={code} className="flex items-start gap-3 rounded-lg border p-3">
                    <SourceBadge code={code} href={s?.url} title={s?.title} />
                    <div className="min-w-0">
                      <p className="font-medium">{s?.title ?? code}</p>
                      {s?.institution ? (
                        <p className="text-xs text-muted-foreground">{s.institution}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed py-1 last:border-0 sm:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
