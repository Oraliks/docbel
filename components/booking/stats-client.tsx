"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { addDaysYmd, brusselsNowParts } from "@/lib/booking/dates";

interface Stats {
  from: string;
  to: string;
  total: number;
  byStatus: {
    pending_verification: number;
    pending_approval: number;
    confirmed: number;
    completed: number;
    no_show: number;
    rejected: number;
    cancelled: number;
  };
  noShowRate: number;
  avgLeadDays: number | null;
  topServices: { code: string; count: number }[];
  waitlistWaiting: number;
  monthBookings: number;
}

export function StatsClient({
  tenantId,
  isAdmin = false,
}: {
  tenantId: string;
  isAdmin?: boolean;
}) {
  const today = brusselsNowParts().ymd;
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/booking/partner/tenants/${tenantId}/stats?from=${from}&to=${to}`,
      );
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Erreur lors du chargement des statistiques");
        return;
      }
      setStats(d);
    } finally {
      setLoading(false);
    }
  }, [tenantId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h2 className="text-xl font-semibold">Statistiques</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Vue d&apos;ensemble de l&apos;activité de prise de rendez-vous.
        </p>
      </div>

      {/* Période */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Du</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Au</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFrom(`${today.slice(0, 7)}-01`);
            setTo(today);
          }}
        >
          Ce mois
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFrom(addDaysYmd(today, -30));
            setTo(today);
          }}
        >
          30 j
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFrom(addDaysYmd(today, -90));
            setTo(today);
          }}
        >
          90 j
        </Button>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="size-4" />
          Actualiser
        </Button>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => {
              window.location.href = `/api/booking/partner/tenants/${tenantId}/export-csv?from=${from}&to=${to}`;
            }}
          >
            <Download className="size-4" />
            Exporter CSV (période)
          </Button>
        )}
      </div>

      {loading || !stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total RDV" value={stats.total} />
            <StatCard label="Confirmés" value={stats.byStatus.confirmed} accent="text-emerald-700" />
            <StatCard
              label="En attente"
              value={stats.byStatus.pending_approval + stats.byStatus.pending_verification}
              accent="text-amber-700"
            />
            <StatCard label="Honorés" value={stats.byStatus.completed} accent="text-violet-700" />
            <StatCard label="Absents (no-show)" value={stats.byStatus.no_show} accent="text-orange-700" />
            <StatCard label="Taux d'absence" value={`${stats.noShowRate}%`} accent="text-orange-700" />
            <StatCard label="Annulés / refusés" value={stats.byStatus.cancelled + stats.byStatus.rejected} />
            <StatCard
              label="Délai moyen"
              value={stats.avgLeadDays != null ? `${stats.avgLeadDays} j` : "—"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="mb-1 text-sm font-semibold">Liste d&apos;attente active</p>
              <p className="text-2xl font-bold tabular-nums">{stats.waitlistWaiting}</p>
              <p className="text-xs text-muted-foreground">
                personnes en attente sur des créneaux à venir
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="mb-1 text-sm font-semibold">Réservations ce mois</p>
              <p className="text-2xl font-bold tabular-nums">{stats.monthBookings}</p>
              <p className="text-xs text-muted-foreground">
                créées depuis le 1ᵉʳ du mois (facturation)
              </p>
            </div>
          </div>

          {stats.topServices.length > 0 && (
            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold">Services les plus demandés</p>
              <div className="flex flex-col gap-2">
                {stats.topServices.map((s) => (
                  <div key={s.code} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{s.code}</span>
                    <span className="font-semibold tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent ?? "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
