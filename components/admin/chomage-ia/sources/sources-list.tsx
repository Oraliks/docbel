"use client";

/**
 * Liste des sources de la KB.
 *
 * Affiche soit une grille de cards (>= md), soit une liste compacte (mobile).
 * Skeleton de chargement, état vide explicite avec CTA "Créer une source".
 */

import { Loader2, Inbox } from "lucide-react";
import type { KnowledgeSourceListItem } from "@/lib/chomage-ia/types";
import { SourceCard } from "./source-card";

interface SourcesListProps {
  items: KnowledgeSourceListItem[];
  loading: boolean;
  aiAvailable: boolean;
  onEdit: (id: string) => void;
  onToggleEnabled: (id: string, current: boolean) => void;
  onDelete: (id: string, title: string) => void;
  onSummarize: (id: string) => void;
  /** Appelé après une réindexation réussie pour rafraîchir la liste. */
  onReindexed?: () => void;
}

export function SourcesList({
  items,
  loading,
  aiAvailable,
  onEdit,
  onToggleEnabled,
  onDelete,
  onSummarize,
  onReindexed,
}: SourcesListProps) {
  if (loading && items.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-[12.5px]">Chargement…</span>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Inbox className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-[14px] font-bold">Aucune source pour l&apos;instant</h3>
          <p className="max-w-md text-[12.5px] text-muted-foreground">
            Crée ta première source (texte, URL, tutoriel, transcript, PDF, image) pour
            alimenter la knowledge base. L&apos;IA pourra ensuite citer ces sources
            dans ses réponses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <SourceCard
            item={item}
            aiAvailable={aiAvailable}
            onEdit={() => onEdit(item.id)}
            onToggleEnabled={() => onToggleEnabled(item.id, item.enabled)}
            onDelete={() => onDelete(item.id, item.title)}
            onSummarize={() => onSummarize(item.id)}
            onReindexed={onReindexed}
          />
        </li>
      ))}
    </ul>
  );
}
