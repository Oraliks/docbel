"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  RefreshCwIcon,
  WrenchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MediaFallback } from "@/components/ui/smart-image";
import type { DeadImage, StoredScan } from "@/lib/media/dead-image-scan";

interface DeadImagesClientProps {
  initial: StoredScan | null;
}

/** Libellé humain du motif d'échec. */
function reasonLabel(item: DeadImage): string {
  switch (item.reason) {
    case "timeout":
      return "Timeout";
    case "network":
      return "Injoignable";
    case "not-an-image":
      return "Pas une image";
    default:
      if (item.reason.startsWith("http-")) return `Erreur ${item.status}`;
      return item.reason;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-BE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DeadImagesClient({ initial }: DeadImagesClientProps) {
  const [data, setData] = useState<StoredScan | null>(initial);
  const [scanning, setScanning] = useState(false);

  async function runScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/dead-images", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { last: StoredScan };
      setData(json.last);
      const { deadCount, suspectCount } = json.last.result;
      if (deadCount + suspectCount === 0) {
        toast.success("Scan terminé — aucune image cassée 🎉");
      } else {
        toast.success(
          `Scan terminé — ${deadCount} cassée(s), ${suspectCount} suspecte(s)`,
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Le scan a échoué. Réessayez.");
    } finally {
      setScanning(false);
    }
  }

  const result = data?.result ?? null;
  const items = result?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Barre d'action + méta du dernier scan */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {data ? (
            <>
              Dernier scan&nbsp;:{" "}
              <span className="font-medium text-foreground">
                {formatDate(data.updatedAt)}
              </span>
              {data.updatedBy ? ` · ${data.updatedBy}` : null}
              {result ? ` · ${result.durationMs} ms` : null}
            </>
          ) : (
            "Aucun scan effectué pour le moment."
          )}
        </div>
        <Button onClick={runScan} disabled={scanning}>
          {scanning ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-4" />
          )}
          {scanning ? "Scan en cours…" : "Lancer un scan"}
        </Button>
      </div>

      {/* Bandeau de stats */}
      {result && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="URLs vérifiées" value={result.totalChecked} />
          <StatCard label="Valides" value={result.okCount} tone="ok" />
          <StatCard label="Cassées" value={result.deadCount} tone="dead" />
          <StatCard label="Suspectes" value={result.suspectCount} tone="suspect" />
        </div>
      )}

      {/* Répartition par source (uniquement celles qui ont des problèmes / erreurs) */}
      {result && (
        <div className="flex flex-wrap gap-2">
          {result.bySource
            .filter((s) => s.dead + s.suspect > 0 || s.error)
            .map((s) => (
              <Badge
                key={s.id}
                variant="outline"
                className="gap-1.5 font-normal"
                title={s.error ?? undefined}
              >
                {s.label}
                {s.error ? (
                  <span className="text-amber-600">⚠ lecture KO</span>
                ) : (
                  <span className="text-muted-foreground">
                    {s.dead + s.suspect}/{s.checked}
                  </span>
                )}
              </Badge>
            ))}
        </div>
      )}

      {/* Table des images problématiques */}
      {!result ? (
        <EmptyState
          icon={<RefreshCwIcon className="size-6" />}
          title="Lancez un premier scan"
          desc="Le scan parcourt tous les champs image de la base et vérifie chaque URL."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2Icon className="size-6 text-emerald-500" />}
          title="Aucune image cassée"
          desc={`${result.totalChecked} URL(s) vérifiée(s), toutes valides.`}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Aperçu</TableHead>
                <TableHead>Élément</TableHead>
                <TableHead className="hidden md:table-cell">Source</TableHead>
                <TableHead className="hidden lg:table-cell">URL</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[100px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={`${item.sourceId}:${item.recordId}`}>
                  <TableCell>
                    <div className="size-11 overflow-hidden rounded-md">
                      <MediaFallback type={item.type} compact />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium leading-tight">
                      {item.recordLabel}
                    </div>
                    {item.slug ? (
                      <div className="text-xs text-muted-foreground">
                        {item.slug}
                      </div>
                    ) : null}
                    {/* Source en mobile (colonne dédiée masquée) */}
                    <div className="mt-1 text-xs text-muted-foreground md:hidden">
                      {item.sourceLabel}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary" className="font-normal">
                      {item.sourceLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[260px] truncate font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        title={item.url}
                      >
                        {item.url}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(item.url);
                          toast.success("URL copiée");
                        }}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Copier l'URL"
                      >
                        <CopyIcon className="size-3.5" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.severity === "dead" ? "destructive" : "outline"}
                      className={
                        item.severity === "suspect"
                          ? "border-amber-400 text-amber-600"
                          : undefined
                      }
                    >
                      {reasonLabel(item)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      render={<Link href={item.adminUrl} />}
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                    >
                      <WrenchIcon className="size-3.5" />
                      Corriger
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "dead" | "suspect";
}) {
  const toneClass =
    tone === "dead"
      ? "text-red-600"
      : tone === "suspect"
        ? "text-amber-600"
        : tone === "ok"
          ? "text-emerald-600"
          : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <div className="font-medium">{title}</div>
      <div className="max-w-sm text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}
