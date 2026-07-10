"use client";

import { useMemo, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, FileCheck, Send, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  DailySubmissionPoint,
  FieldTypeCount,
} from "@/lib/pdf-forms/analytics";

/**
 * View-model agrégé passé par la page server `/admin/pdf/analytics`. Tout est
 * déjà calculé côté serveur (Prisma + fonctions pures de lib/pdf-forms/analytics)
 * : ce composant ne fait que présenter.
 */
export interface PdfAnalyticsViewModel {
  /// Cartes KPI.
  publishedForms: number;
  draftForms: number;
  archivedForms: number;
  submissions30d: number;
  successRate30d: number; // ratio 0..1
  activeDrafts: number;
  draftsExpiringSoon: number; // < 48 h
  pendingReports: number;
  /// Fenêtre de la série quotidienne (jours), pour les libellés.
  windowDays: number;
  /// Graphes.
  dailySubmissions: DailySubmissionPoint[];
  reportsByFieldType: FieldTypeCount[];
}

interface Props {
  data: PdfAnalyticsViewModel;
}

/** Formate une clé de jour ISO (YYYY-MM-DD) en libellé court "JJ/MM". */
function shortDay(isoDay: string): string {
  const [, month, day] = isoDay.split("-");
  return `${day}/${month}`;
}

/// Style commun aux tooltips recharts.
const tooltipContentStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
} as const;

const tooltipLabelStyle = { color: "var(--muted-foreground)" } as const;

// ─────────────────────────────────────────────────────────────────
// Cartes KPI
// ─────────────────────────────────────────────────────────────────

type Accent = "violet" | "emerald" | "amber" | "rose";

const ACCENT: Record<Accent, { icon: string; value: string }> = {
  violet: {
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    value: "text-foreground",
  },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    value: "text-foreground",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    value: "text-foreground",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    value: "text-foreground",
  },
};

interface KpiCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  accent: Accent;
}

/** Carte KPI : libellé, gros chiffre, sous-texte et icône colorée à droite. */
function KpiCard({ label, value, hint, icon: Icon, accent }: KpiCardProps) {
  const styles = ACCENT[accent];
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              styles.icon
            )}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <span className={cn("text-3xl font-bold tabular-nums", styles.value)}>
          {value}
        </span>
        <span className="min-h-4 text-xs text-muted-foreground">
          {hint ?? ""}
        </span>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// État vide réutilisable pour les graphes
// ─────────────────────────────────────────────────────────────────

/** Placeholder propre quand un graphe n'a aucune donnée. */
function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────

/**
 * Dashboard analytics PDF Forms (client). Affiche 4 cartes KPI + 2 graphiques
 * recharts (soumissions/jour empilées par canal, signalements par type de
 * champ). Tout en données déjà agrégées côté serveur ; aucun fetch ici.
 */
export function PdfAnalyticsDashboard({ data }: Props) {
  const t = useTranslations("admin.pdf");
  const successPct = Math.round(data.successRate30d * 100);

  // Données du graphe quotidien, avec un libellé court par point.
  const dailySeries = useMemo(
    () =>
      data.dailySubmissions.map((p) => ({ ...p, label: shortDay(p.date) })),
    [data.dailySubmissions]
  );

  const hasSubmissions = dailySeries.some((p) => p.total > 0);
  const reports = data.reportsByFieldType;
  const hasReports = reports.length > 0;

  // Hauteur du bar-chart horizontal : ~36 px par barre, plancher raisonnable.
  const reportsHeight = Math.max(260, reports.length * 36 + 24);

  return (
    <div className="flex flex-col gap-6">
      {/* Cartes KPI ------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("kpiPublishedForms")}
          value={data.publishedForms}
          hint={t("kpiPublishedHint", { drafts: data.draftForms, archived: data.archivedForms })}
          icon={FileCheck}
          accent="violet"
        />
        <KpiCard
          label={t("kpiSubmissions", { days: data.windowDays })}
          value={data.submissions30d}
          hint={
            data.submissions30d > 0
              ? t("kpiSuccessHint", { pct: successPct })
              : t("kpiNoSubmissions")
          }
          icon={Send}
          accent="emerald"
        />
        <KpiCard
          label={t("kpiActiveDrafts")}
          value={data.activeDrafts}
          hint={
            data.draftsExpiringSoon > 0
              ? t("kpiExpiringHint", { count: data.draftsExpiringSoon })
              : t("kpiDraftsGdpr")
          }
          icon={Clock}
          accent="amber"
        />
        <KpiCard
          label={t("kpiPendingReports")}
          value={data.pendingReports}
          hint={
            data.pendingReports > 0
              ? t("kpiReportsToReview")
              : t("kpiNoReports")
          }
          icon={TriangleAlert}
          accent="rose"
        />
      </div>

      {/* Graphiques ------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Soumissions par jour, empilées download/doccle ---------- */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold">{t("chartSubmissionsTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("chartSubmissionsSubtitle", { days: data.windowDays })}</p>
            </div>
            {hasSubmissions ? (
              <ResponsiveContainer width="100%" height={260}>
                <RBarChart
                  data={dailySeries}
                  margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Bar
                    dataKey="download"
                    name={t("legendDownload")}
                    stackId="delivery"
                    fill="var(--chart-1)"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="doccle"
                    name={t("legendDoccle")}
                    stackId="delivery"
                    fill="var(--chart-2)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </RBarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message={t("chartNoSubmissions")} />
            )}
            {hasSubmissions ? (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <LegendDot color="var(--chart-1)" label={t("legendDownload")} />
                <LegendDot color="var(--chart-2)" label={t("legendDoccle")} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Signalements de validation par type de champ (bar horizontal) */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold">{t("chartReportsTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("chartReportsSubtitle")}</p>
            </div>
            {hasReports ? (
              <ResponsiveContainer width="100%" height={reportsHeight}>
                <RBarChart
                  layout="vertical"
                  data={reports}
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="var(--border)"
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="fieldType"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={88}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value) => [value as number, t("reportsTooltipName")]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={26}>
                    {reports.map((entry) => (
                      <Cell key={entry.fieldType} fill="var(--chart-4)" />
                    ))}
                  </Bar>
                </RBarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message={t("chartNoReports")} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Pastille de légende colorée + libellé. */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
