"use client";

/**
 * Table des IngestionSource configurées (zone 1 du workspace veille).
 *
 * Colonnes : nom + URL, type, dernier check, pending count, toggle enabled,
 * actions (check now / edit / delete). Extrait du workspace pour respecter
 * la limite 250 LOC.
 */

import {
  ExternalLink,
  Loader2,
  Pencil,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { fmtRelative } from "../_shared";
import type { IngestionSourceListItem } from "@/lib/chomage-ia/types";

interface Props {
  items: IngestionSourceListItem[];
  loading: boolean;
  checkingId: string | null;
  onToggleEnabled: (s: IngestionSourceListItem) => void | Promise<void>;
  onCheckNow: (s: IngestionSourceListItem) => void | Promise<void>;
  onEdit: (s: IngestionSourceListItem) => void;
  onDelete: (s: IngestionSourceListItem) => void;
}

export function IngestionSourcesTable({
  items,
  loading,
  checkingId,
  onToggleEnabled,
  onCheckNow,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <table className="w-full text-[12.5px]">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Nom</th>
            <th className="px-3 py-2 text-left font-semibold w-[80px]">
              Type
            </th>
            <th className="px-3 py-2 text-right font-semibold w-[110px]">
              Dernier check
            </th>
            <th className="px-3 py-2 text-right font-semibold w-[80px]">
              En attente
            </th>
            <th className="px-3 py-2 text-right font-semibold w-[70px]">
              Actif
            </th>
            <th className="px-3 py-2 text-right font-semibold w-[170px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                Chargement…
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                Aucune source. Ajoute par exemple
                « https://www.onem.be » ou un flux RSS du Moniteur belge.
              </td>
            </tr>
          ) : (
            items.map((s) => (
              <tr
                key={s.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-semibold">{s.name}</span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[10.5px] text-muted-foreground hover:text-primary"
                    >
                      {s.url}
                      <ExternalLink className="ml-1 inline size-2.5" />
                    </a>
                  </div>
                </td>
                <td className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.kind}
                </td>
                <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">
                  {s.lastCheckedAt ? (
                    <span title={s.lastError ?? "OK"}>
                      {fmtRelative(s.lastCheckedAt)}
                      {s.lastError ? " ⚠" : ""}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {s.pendingCount > 0 ? (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      {s.pendingCount}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={() => onToggleEnabled(s)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={checkingId === s.id || !s.enabled}
                      onClick={() => onCheckNow(s)}
                      title="Vérifier maintenant"
                    >
                      {checkingId === s.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <PlayCircle className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(s)}
                      title="Éditer"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(s)}
                      title="Supprimer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
