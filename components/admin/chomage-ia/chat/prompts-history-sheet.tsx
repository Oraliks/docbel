"use client";

/**
 * Drawer gauche (Shadcn Sheet) qui liste l'historique des prompts générés via
 * le mode "wand" du chat (POST /api/chomage-ia/prompt-builder, persisté dans
 * GeneratedPrompt).
 *
 * Click sur un item → ouvert dans la conversation courante (callback parent
 * pour ré-injecter une bulle `kind: "generated_prompt"`).
 *
 * Pas de "détail complet" séparé : on charge le détail à la sélection puis
 * on l'injecte directement comme bulle dans le thread courant.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  History,
  Loader2,
  MessageSquareWarning,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtRelative, truncate } from "../_shared";
import { ConfirmDeleteDialog } from "../_shared-alerts";
import { cn } from "@/lib/utils";

interface PromptHistoryItem {
  id: string;
  title: string;
  brief: string;
  citedCount: number;
  createdAt: string;
}

export interface InjectablePrompt {
  id: string;
  title: string;
  brief: string;
  output: string;
  citedSourceIds: string[];
  citedSources: {
    id: string;
    title: string;
    kind: string;
    sourceUrl: string | null;
    summary: string | null;
  }[];
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  /** Callback appelé après chargement d'un prompt depuis l'historique.
   *  Le parent peut injecter le prompt comme bulle dans la conversation. */
  onInject: (prompt: InjectablePrompt) => void;
  /** Trigger un re-fetch quand la valeur change (ex: après nouvelle génération). */
  revalidateKey?: string | number;
}

export function PromptsHistorySheet({
  open,
  onOpenChange,
  domain,
  onInject,
  revalidateKey,
}: Props) {
  const [items, setItems] = useState<PromptHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const deleteTarget = useMemo(
    () => items.find((it) => it.id === deleteTargetId) ?? null,
    [items, deleteTargetId]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/chomage-ia/prompts?domain=${encodeURIComponent(domain)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: PromptHistoryItem[] };
      setItems(data.items);
    } catch (e) {
      toast.error("Impossible de charger l'historique des prompts", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [domain]);

  // (Re)charge à l'ouverture et quand revalidateKey change.
  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, revalidateKey]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(t) ||
        it.brief.toLowerCase().includes(t),
    );
  }, [items, q]);

  async function openPrompt(id: string) {
    setOpeningId(id);
    try {
      const res = await fetch(`/api/chomage-ia/prompts/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as InjectablePrompt & {
        citedSources?: InjectablePrompt["citedSources"];
      };
      onInject({
        id: data.id,
        title: data.title,
        brief: data.brief,
        output: data.output,
        // certaines vues renvoient `citedSourceIds`, d'autres juste `citedSources` :
        // on reconstruit `citedSourceIds` depuis `citedSources` si manquant.
        citedSourceIds:
          (data as { citedSourceIds?: string[] }).citedSourceIds ??
          (data.citedSources ?? []).map((s) => s.id),
        citedSources: data.citedSources ?? [],
        createdAt: data.createdAt,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Impossible d'ouvrir ce prompt", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOpeningId(null);
    }
  }

  async function deletePrompt(id: string) {
    try {
      const res = await fetch(`/api/chomage-ia/prompts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Prompt supprimé");
      refresh();
    } catch (e) {
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[360px] sm:max-w-[360px]">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <History className="size-4" />
            Historique des prompts ({items.length})
          </SheetTitle>
          <SheetDescription>
            Prompts Claude Code générés via le mode <Wand2 className="inline size-3" /> de la barre
            de chat. Click pour ré-afficher dans la conversation courante.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b border-border bg-background/60 px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrer (titre, brief)…"
              className="pl-8"
              disabled={loading && items.length === 0}
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <li className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </li>
          ) : items.length === 0 ? (
            <li className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
              <MessageSquareWarning className="size-6 opacity-50" />
              <p className="max-w-xs text-[11.5px] leading-relaxed">
                Pas encore de prompt généré. Utilise le bouton{" "}
                <Wand2 className="inline size-3" /> dans la barre de chat pour
                lancer ton premier brief.
              </p>
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">
              Aucun résultat pour « {q} »
            </li>
          ) : (
            filtered.map((it) => {
              const isOpening = it.id === openingId;
              return (
                <li
                  key={it.id}
                  className={cn(
                    "group flex cursor-pointer items-start gap-2 border-b border-border/50 px-3 py-2 last:border-b-0 transition-colors hover:bg-muted/40",
                    isOpening && "bg-primary/5 opacity-60"
                  )}
                  onClick={() => openPrompt(it.id)}
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <Wand2 className="size-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold leading-snug text-foreground">
                      {it.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {it.brief}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">
                      {fmtRelative(it.createdAt)}
                      {it.citedCount > 0
                        ? ` · ${it.citedCount} source${it.citedCount > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isOpening ? (
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetId(it.id);
                        }}
                        title="Supprimer"
                        aria-label="Supprimer"
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(v) => !v && setDeleteTargetId(null)}
          title="Supprimer ce prompt ?"
          description={
            deleteTarget
              ? `« ${truncate(deleteTarget.title, 80)} » sera supprimé définitivement de l'historique.`
              : "Cette action est irréversible."
          }
          onConfirm={async () => {
            if (deleteTargetId) {
              await deletePrompt(deleteTargetId);
              setDeleteTargetId(null);
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
