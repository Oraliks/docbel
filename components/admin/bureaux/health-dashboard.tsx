"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  Globe,
  Copy,
  Link2,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";

interface HealthData {
  total: number;
  byType: Record<string, number>;
  missing: {
    latLng: Record<string, number>;
    phone: Record<string, number>;
    website: Record<string, number>;
  };
  verification: {
    notVerified: Record<string, number>;
  };
  stubs: {
    count: number;
    sample: Array<{ id: string; type: string; name: string; city: string; postalCode: string }>;
  };
  coverage: {
    totalCommunes: number;
    communesWithCpas: number;
    communesWithCommune: number;
    missingCpas: number;
    missingCommune: number;
  };
  reports: { pending: number; total: number };
  byRegion: Record<string, Record<string, number>>;
  integrity: {
    realDuplicates: number;
    cpCommuneMismatches: number;
    communesWithoutChomage: number;
    totalCommunes: number;
    assignmentsByService: Record<string, number>;
  };
}

/**
 * Dashboard santé des données bureaux.
 *
 * Objectif : voir d'un coup d'œil où sont les trous et pouvoir
 * cliquer pour aller corriger. Découpé en sections :
 *  1. Stats globales (total, % vérifiés, signalements)
 *  2. Couverture territoriale (CPAS + Communes vs total communes)
 *  3. Trous par type (lat/lng, phone, website manquants)
 *  4. Stubs (adresses placeholder à enrichir)
 *  5. Répartition par région
 */
const KNOWN_TYPES = ["CPAS", "COMMUNE", "ONEM", "SYNDICAT", "PERMANENCE", "AUTRE"];
const KNOWN_REGIONS = ["brussels", "wallonia", "flanders", "germanophone", "unknown"];

export function HealthDashboard() {
  const t = useTranslations("admin.bureaux");
  const typeLabel = (type: string) =>
    KNOWN_TYPES.includes(type)
      ? t(`healthType_${type}` as Parameters<typeof t>[0])
      : type;
  const regionLabel = (region: string) =>
    KNOWN_REGIONS.includes(region)
      ? t(`healthRegion_${region}` as Parameters<typeof t>[0])
      : region;
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/admin/bureaux/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setData)
      .catch(() => toast.error(t("loadFailed")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        {t("analyzingData")}
      </div>
    );
  }
  if (!data) return null;

  const totalCoverage = data.coverage.totalCommunes || 1;
  const cpasPct = Math.round((data.coverage.communesWithCpas / totalCoverage) * 100);
  const communePct = Math.round((data.coverage.communesWithCommune / totalCoverage) * 100);

  return (
    <div className="space-y-6">
      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Database className="size-4" />}
          label={t("statActiveBureaus")}
          value={data.total}
          tone="neutral"
        />
        <StatCard
          icon={<ShieldCheck className="size-4" />}
          label={t("statVerified")}
          value={
            data.total -
            Object.values(data.verification.notVerified).reduce((s, x) => s + x, 0)
          }
          suffix={`/ ${data.total}`}
          tone="success"
        />
        <StatCard
          icon={<AlertTriangle className="size-4" />}
          label={t("statStubs")}
          value={data.stubs.count}
          tone={data.stubs.count > 0 ? "warn" : "success"}
        />
        <StatCard
          icon={<AlertCircle className="size-4" />}
          label={t("statPendingReports")}
          value={data.reports.pending}
          suffix={`/ ${data.reports.total}`}
          tone={data.reports.pending > 0 ? "warn" : "success"}
        />
      </div>

      {/* Couverture territoriale */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="size-4" /> {t("coverageTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("coverageDescription", { count: data.coverage.totalCommunes })}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <CoverageBar
            label={t("coverageCpas")}
            value={data.coverage.communesWithCpas}
            total={data.coverage.totalCommunes}
            missing={data.coverage.missingCpas}
            pct={cpasPct}
          />
          <CoverageBar
            label={t("coverageCommunes")}
            value={data.coverage.communesWithCommune}
            total={data.coverage.totalCommunes}
            missing={data.coverage.missingCommune}
            pct={communePct}
          />
        </CardContent>
      </Card>

      {/* Intégrité & liens (anti-dérive) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="size-4" /> {t("integrityTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("integrityDescription")}</p>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={<Copy className="size-4" />}
              label={t("integrityDuplicates")}
              value={data.integrity.realDuplicates}
              tone={data.integrity.realDuplicates > 0 ? "warn" : "success"}
            />
            <StatCard
              icon={<MapPin className="size-4" />}
              label={t("integrityCpMismatch")}
              value={data.integrity.cpCommuneMismatches}
              tone={data.integrity.cpCommuneMismatches > 0 ? "warn" : "success"}
            />
            <StatCard
              icon={<AlertTriangle className="size-4" />}
              label={t("integrityNoChomage")}
              value={data.integrity.communesWithoutChomage}
              suffix={`/ ${data.integrity.totalCommunes}`}
              tone={data.integrity.communesWithoutChomage > 0 ? "warn" : "success"}
            />
          </div>
          {/* Assignments par service */}
          <div className="rounded-md border p-3">
            <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-2">
              {t("integrityAssignments")}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.integrity.assignmentsByService)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([svc, count]) => (
                  <Badge key={svc} variant="outline" className="text-[11px] gap-1.5">
                    <span className="font-medium">{svc}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </Badge>
                ))}
              {Object.keys(data.integrity.assignmentsByService).length === 0 && (
                <span className="text-xs text-muted-foreground italic">{t("integrityNoAssignments")}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trous par type */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> {t("dataGapsTitle")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("dataGapsDescription")}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={load} className="text-xs gap-1.5">
            <RefreshCw className="size-3.5" /> {t("refresh")}
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-2">{t("colType")}</th>
                  <th className="text-right font-medium py-2">{t("colTotal")}</th>
                  <th className="text-right font-medium py-2 pr-2">
                    <MapPin className="size-3 inline" /> {t("colLatLng")}
                  </th>
                  <th className="text-right font-medium py-2 pr-2">
                    <Phone className="size-3 inline" /> {t("colPhoneShort")}
                  </th>
                  <th className="text-right font-medium py-2 pr-2">
                    <Globe className="size-3 inline" /> {t("colSite")}
                  </th>
                  <th className="text-right font-medium py-2">
                    <ShieldOff className="size-3 inline" /> {t("colNotVerified")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <tr key={type} className="border-b last:border-0">
                      <td className="py-2 font-medium">
                        {typeLabel(type)}
                      </td>
                      <td className="text-right py-2 tabular-nums">{count}</td>
                      <DataCell value={data.missing.latLng[type] ?? 0} total={count} />
                      <DataCell value={data.missing.phone[type] ?? 0} total={count} />
                      <DataCell value={data.missing.website[type] ?? 0} total={count} />
                      <DataCell
                        value={data.verification.notVerified[type] ?? 0}
                        total={count}
                      />
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stubs */}
      {data.stubs.count > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-orange-500" />
              {t("stubsTitle", { count: data.stubs.count })}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("stubsDescription")}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1 text-xs">
              {data.stubs.sample.slice(0, 10).map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-1 border-b last:border-0">
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {typeLabel(s.type)}
                  </Badge>
                  <span className="text-foreground truncate">{s.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">
                    {s.postalCode} {s.city}
                  </span>
                </li>
              ))}
            </ul>
            {data.stubs.count > 10 && (
              <p className="text-[11px] text-muted-foreground mt-2 italic">
                {t("stubsMore", { count: data.stubs.count - 10 })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Répartition par région */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="size-4" /> {t("byRegionTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("byRegionDescription")}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {Object.entries(data.byRegion).map(([region, types]) => (
              <div key={region} className="rounded-md border p-3 space-y-1.5">
                <p className="text-xs font-semibold">
                  {regionLabel(region)}
                </p>
                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                  {Object.entries(types)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, c]) => (
                      <li key={type} className="flex justify-between">
                        <span>{typeLabel(type)}</span>
                        <span className="tabular-nums">{c}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  suffix,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  tone?: "neutral" | "success" | "warn";
}) {
  const toneColor =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-orange-500 dark:text-orange-400"
        : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-1.5 text-[10px] uppercase font-semibold ${toneColor}`}>
          {icon} {label}
        </div>
        <p className="text-2xl font-bold mt-1 tabular-nums">
          {value.toLocaleString("fr-BE")}
          {suffix && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              {suffix}
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function CoverageBar({
  label,
  value,
  total,
  missing,
  pct,
}: {
  label: string;
  value: number;
  total: number;
  missing: number;
  pct: number;
}) {
  const good = pct >= 95;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value} / {total}{" "}
          {good ? (
            <CheckCircle2 className="size-3.5 inline text-emerald-500 ml-1" />
          ) : (
            <span className="text-orange-500">— {missing} manquant{missing > 1 ? "s" : ""}</span>
          )}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${good ? "bg-emerald-500" : "bg-orange-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DataCell({ value, total }: { value: number; total: number }) {
  if (value === 0) {
    return (
      <td className="text-right py-2 pr-2 tabular-nums text-emerald-600 dark:text-emerald-400">
        ✓
      </td>
    );
  }
  const pct = Math.round((value / Math.max(1, total)) * 100);
  const warn = pct >= 50;
  return (
    <td
      className={`text-right py-2 pr-2 tabular-nums ${warn ? "text-orange-500" : "text-foreground/80"}`}
    >
      {value} <span className="text-[10px] text-muted-foreground">({pct}%)</span>
    </td>
  );
}
