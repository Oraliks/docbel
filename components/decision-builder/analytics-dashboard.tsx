"use client";

/// Rendu du dashboard analytics (données agrégées passées en props par la page
/// server). Stat cards + funnel (recharts) + tables demande/recherches.

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DecisionAnalytics } from "@/lib/decision-builder/analytics-queries";

const AVAIL_LABEL: Record<string, { label: string; tone: string }> = {
  disponible: { label: "Disponible", tone: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" },
  a_creer: { label: "À créer", tone: "border-amber-500/40 text-amber-700 dark:text-amber-300" },
  orientation_externe: { label: "Externe", tone: "border-sky-500/40 text-sky-700 dark:text-sky-300" },
  inconnu: { label: "Inconnu", tone: "border-muted text-muted-foreground" },
};

export function AnalyticsDashboard({ data }: { data: DecisionAnalytics }) {
  const { funnel, demand, noResult, admin } = data;
  const completionRate =
    funnel.started > 0
      ? Math.round((funnel.bundleOpened / funnel.started) * 100)
      : 0;
  const abandonRate =
    funnel.started > 0
      ? Math.round((funnel.abandoned / funnel.started) * 100)
      : 0;

  const funnelChart = [
    { step: "Démarré", value: funnel.started },
    { step: "Question", value: funnel.stepCompleted },
    { step: "Résultat", value: funnel.resultShown },
    { step: "Dossier ouvert", value: funnel.bundleOpened },
    { step: "Run créé", value: funnel.runCreated },
  ];

  const orphanCount = demand.byAvailability
    .filter((a) => a.availability === "a_creer" || a.availability === "orientation_externe")
    .reduce((s, a) => s + a.count, 0);

  const toBuild = demand.topSlugs.filter((s) => s.availability === "a_creer");

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Wizards démarrés" value={funnel.started} />
        <Stat label="Taux d'aboutissement" value={`${completionRate}%`} tone="emerald" />
        <Stat label="Taux d'abandon" value={`${abandonRate}%`} tone="amber" />
        <Stat label="Demande orpheline" value={orphanCount} tone="sky" hint="résultats sans dossier prêt" />
      </div>

      {/* Funnel */}
      <Section title="Parcours d'orientation (funnel)">
        {funnel.started === 0 ? (
          <Empty>Aucun parcours enregistré sur la période.</Empty>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelChart} layout="vertical" margin={{ left: 8, right: 32 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="step"
                  width={110}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {funnelChart.map((_, i) => (
                    <Cell key={i} fill="var(--primary)" fillOpacity={1 - i * 0.13} />
                  ))}
                  <LabelList dataKey="value" position="right" className="fill-foreground text-xs" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      {/* Demande par dossier */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Dossiers à construire en priorité" subtitle="résultats « à créer » les plus atteints">
          {toBuild.length === 0 ? (
            <Empty>Aucune demande sur un dossier « à créer ».</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dossier</TableHead>
                  <TableHead className="text-right">Atteintes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {toBuild.map((s) => (
                  <TableRow key={s.slug}>
                    <TableCell className="font-mono text-xs">{s.slug}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section title="Recherches sans résultat" subtitle="trous de contenu sur /mon-dossier">
          {noResult.length === 0 ? (
            <Empty>Aucune recherche infructueuse.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requête</TableHead>
                  <TableHead className="text-right">Occurrences</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {noResult.map((q) => (
                  <TableRow key={q.query}>
                    <TableCell>{q.query}</TableCell>
                    <TableCell className="text-right tabular-nums">{q.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>

      {/* Répartition demande + activité admin */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Répartition de la demande">
          {demand.byAvailability.length === 0 ? (
            <Empty>Pas encore de données.</Empty>
          ) : (
            <div className="flex flex-wrap gap-2">
              {demand.byAvailability.map((a) => {
                const cfg = AVAIL_LABEL[a.availability] ?? AVAIL_LABEL.inconnu;
                return (
                  <Badge key={a.availability} variant="outline" className={cfg.tone}>
                    {cfg.label} · {a.count}
                  </Badge>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Activité admin (Decision Builder)">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Publications · {admin.published}</Badge>
            <Badge variant="outline">Simulations · {admin.simulated}</Badge>
            <Badge variant="outline">Restaurations · {admin.restored}</Badge>
            <Badge variant="outline">Validations échouées · {admin.validationFailed}</Badge>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "slate",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "slate" | "emerald" | "amber" | "sky";
  hint?: string;
}) {
  const border =
    tone === "emerald"
      ? "border-l-emerald-500"
      : tone === "amber"
        ? "border-l-amber-500"
        : tone === "sky"
          ? "border-l-sky-500"
          : "border-l-muted-foreground/40";
  return (
    <div className={`rounded-lg border border-l-4 bg-card p-4 ${border}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}
