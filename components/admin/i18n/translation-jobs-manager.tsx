"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Play,
  RotateCcw,
  Clock,
  Cog,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type JobStatus = "pending" | "processing" | "done" | "failed";

interface Job {
  id: string;
  model: string;
  recordId: string;
  field: string;
  locale: string;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

type Counts = Record<JobStatus, number>;

const STATUS_META: Record<
  JobStatus,
  { label: string; variant: "warning" | "secondary" | "success" | "destructive"; icon: typeof Clock }
> = {
  pending: { label: "En attente", variant: "warning", icon: Clock },
  processing: { label: "En cours", variant: "secondary", icon: Cog },
  done: { label: "Fait", variant: "success", icon: CheckCircle2 },
  failed: { label: "Échoué", variant: "destructive", icon: AlertTriangle },
};

const ORDER: JobStatus[] = ["pending", "processing", "failed", "done"];

function fmtDate(value: string) {
  return new Date(value).toLocaleString("fr-BE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function TranslationJobsManager() {
  const [counts, setCounts] = useState<Counts>({
    pending: 0,
    processing: 0,
    done: 0,
    failed: 0,
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<null | "process" | "retry">(null);

  const load = useCallback(async (f: JobStatus | "all") => {
    setLoading(true);
    try {
      const qs = f === "all" ? "" : `?status=${f}`;
      const res = await fetch(`/api/admin/translation-jobs${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as { counts: Counts; jobs: Job[] };
      setCounts(data.counts);
      setJobs(data.jobs);
    } catch {
      toast.error("Échec du chargement de la file.");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function run(action: "process" | "retry") {
    setActing(action);
    try {
      const res = await fetch("/api/admin/translation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("request failed");
      const r = (await res.json()) as {
        requeued: number;
        processed: number;
        done: number;
        failed: number;
      };
      if (r.processed === 0 && r.requeued === 0) {
        toast.info("Aucun job à traiter.");
      } else {
        const parts = [
          action === "retry" && r.requeued ? `${r.requeued} relancé(s)` : null,
          r.done ? `${r.done} traduit(s)` : null,
          r.failed ? `${r.failed} en échec` : null,
        ].filter(Boolean);
        toast.success(`File traitée — ${parts.join(" · ") || "rien à faire"}.`);
      }
      await load(filter);
    } catch {
      toast.error("Échec du traitement de la file.");
    } finally {
      setActing(null);
    }
  }

  const busy = acting !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* Compteurs cliquables (filtre la liste) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ORDER.map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(active ? "all" : s)}
              className={`rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
                active ? "border-primary ring-1 ring-primary/30" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Icon className="size-3.5" />
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{counts[s]}</p>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void run("process")}
            disabled={busy || counts.pending === 0}
          >
            {acting === "process" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Play />
            )}
            Traiter en attente
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void run("retry")}
            disabled={busy || (counts.failed === 0 && counts.processing === 0)}
          >
            {acting === "retry" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RotateCcw />
            )}
            Relancer les échoués
          </Button>
          {filter !== "all" ? (
            <Button size="sm" variant="ghost" onClick={() => setFilter("all")}>
              Tout afficher
            </Button>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void load(filter)}
          disabled={loading}
        >
          <RefreshCw className={loading ? "animate-spin" : undefined} />
          Rafraîchir
        </Button>
      </div>

      {/* Liste des jobs récents */}
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement…
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {filter === "all"
              ? "La file est vide. Les jobs apparaissent quand un contenu FR est sauvegardé."
              : `Aucun job « ${STATUS_META[filter as JobStatus].label} ».`}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Contenu</th>
                <th className="px-3 py-2 font-medium">Langue</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 text-center font-medium">Essais</th>
                <th className="px-3 py-2 font-medium">Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const meta = STATUS_META[j.status];
                return (
                  <tr key={j.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2">
                      <span className="font-medium">{j.model}</span>
                      <span className="text-muted-foreground">.{j.field}</span>
                      <div className="font-mono text-xs text-muted-foreground">
                        {j.recordId}
                      </div>
                      {j.status === "failed" && j.lastError ? (
                        <div className="mt-1 max-w-md truncate text-xs text-destructive" title={j.lastError}>
                          {j.lastError}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{j.locale.toUpperCase()}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                      {j.attempts}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {fmtDate(j.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
