"use client";

/**
 * Card individuelle d'une KnowledgeSource.
 *
 * Affiche : kind icon + label, titre, summary ou contentPreview, tags, méta
 * (date, longueur), + menu d'actions (édit, toggle enabled, summarize, delete).
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  RefreshCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { KnowledgeSourceListItem } from "@/lib/chomage-ia/types";
import {
  fmtRelative,
  getKindColor,
  getKindIcon,
  getKindLabel,
  truncate,
} from "../_shared";
import { ConfirmDeleteDialog } from "../_shared-alerts";

interface SourceCardProps {
  item: KnowledgeSourceListItem;
  aiAvailable: boolean;
  onEdit: () => void;
  onToggleEnabled: () => void;
  /** Callback exécuté APRÈS confirmation par l'utilisateur. */
  onDelete: () => void | Promise<void>;
  onSummarize: () => void;
  /** Callback après réindexation réussie. Permet au parent de refresh. */
  onReindexed?: () => void;
}

/**
 * Statut d'indexation RAG dérivé de `indexedAt` / `indexError`.
 *
 * - `none` : jamais indexée (RAG pas configurée OU source jamais traitée)
 * - `pending` : reçu une fois mais content trop court / provider absent
 * - `ok` : indexée avec succès
 * - `error` : indexing a échoué (provider down, content trop long, etc.)
 */
type IndexStatus = "none" | "pending" | "ok" | "error";

function deriveIndexStatus(item: KnowledgeSourceListItem): IndexStatus {
  if (item.indexError) {
    // Si on a indexedAt et un message d'erreur "non-bloquant" (genre content trop court),
    // c'est plus un "pending" qu'une vraie erreur.
    if (
      item.indexedAt &&
      (item.indexError.includes("trop court") ||
        item.indexError.includes("trop courte") ||
        item.indexError.includes("Content vide") ||
        item.indexError.includes("rien à indexer"))
    ) {
      return "pending";
    }
    return "error";
  }
  if (item.indexedAt) return "ok";
  return "none";
}

/**
 * Détecte les sources "cassées" : extraction qui a échoué et n'a inséré que
 * le placeholder, ou content trop court pour être utile à l'IA.
 *
 * Cas typique : un PDF scanné (que des images) ou un parseur qui a planté
 * silencieusement. La source existe mais l'IA ne pourra rien en faire.
 */
function detectExtractionIssue(item: KnowledgeSourceListItem): string | null {
  if (
    item.contentPreview.startsWith("(Contenu") ||
    item.contentPreview.includes("non extrait automatiquement")
  ) {
    return "Extraction automatique échouée — édite manuellement ou re-uploade.";
  }
  if (
    item.contentLength < 200 &&
    item.kind !== "image_caption" &&
    item.kind !== "url"
  ) {
    return `Contenu très court (${item.contentLength} chars) — l'IA aura peu à exploiter.`;
  }
  return null;
}

/**
 * Format compact + lisible de la taille du content.
 */
function fmtContentLen(n: number): string {
  if (n < 1000) return `${n} chars`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K chars`;
  return `${(n / 1_000_000).toFixed(1)}M chars`;
}

export function SourceCard({
  item,
  aiAvailable,
  onEdit,
  onToggleEnabled,
  onDelete,
  onSummarize,
  onReindexed,
}: SourceCardProps) {
  const Icon = getKindIcon(item.kind);
  const color = getKindColor(item.kind);
  const preview = item.summary || item.contentPreview;
  const issue = detectExtractionIssue(item);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const indexStatus = deriveIndexStatus(item);

  async function handleReindex() {
    if (reindexing) return;
    setReindexing(true);
    try {
      const res = await fetch(`/api/chomage-ia/sources/${item.id}/reindex`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data.indexError) {
        toast.warning("Indexation partielle", {
          description: data.indexError,
        });
      } else {
        toast.success(
          `Indexation OK · ${data.reindexedCount ?? 0} chunk(s) (re)embeddés`,
        );
      }
      onReindexed?.();
    } catch (e) {
      toast.error("Échec indexation", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setReindexing(false);
    }
  }

  return (
    <article
      className={`group flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors ${
        item.enabled
          ? "border-border hover:border-primary/30"
          : "border-dashed border-border opacity-70 hover:opacity-90"
      }`}
    >
      {/* Header : kind badge + status */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
          style={{
            background: `${color}1A`,
            color,
            border: `1px solid ${color}40`,
          }}
        >
          <Icon className="size-3" />
          {getKindLabel(item.kind)}
        </span>
        <div className="flex items-center gap-1.5">
          {/* Indicateur d'indexation RAG (migration 19) */}
          <IndexStatusBadge status={indexStatus} indexError={item.indexError} />
          {item.enabled ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
              <EyeOff className="size-3" />
              Désactivée
            </span>
          )}
        </div>
      </div>

      {/* Titre */}
      <h3 className="text-[14px] font-bold leading-tight">
        {truncate(item.title, 100)}
      </h3>

      {/* Alerte extraction échouée */}
      {issue ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-800 dark:text-amber-200">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <span className="leading-snug">{issue}</span>
        </div>
      ) : null}

      {/* Aperçu (summary ou content) */}
      <p className="flex-1 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">
        {truncate(preview, 200) || "(pas d'aperçu)"}
      </p>

      {/* Source URL */}
      {item.sourceUrl ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 truncate text-[11.5px] font-medium text-primary hover:underline"
          title={item.sourceUrl}
        >
          <ExternalLink className="size-3 shrink-0" />
          <span className="truncate">{item.sourceUrl}</span>
        </a>
      ) : null}

      {/* Tags */}
      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 5).map((t) => (
            <span
              key={t}
              className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
            >
              {t}
            </span>
          ))}
          {item.tags.length > 5 ? (
            <span className="text-[10.5px] text-muted-foreground">
              +{item.tags.length - 5}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Méta + actions */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-[10.5px] text-muted-foreground">
        <span>
          {fmtRelative(item.updatedAt)} · {fmtContentLen(item.contentLength)}
        </span>
        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
          {aiAvailable ? (
            <Button
              variant="ghost"
              size="icon-xs"
              title="Générer un résumé court (IA)"
              onClick={onSummarize}
            >
              <Sparkles className="size-3" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            title={item.enabled ? "Désactiver" : "Activer"}
            onClick={onToggleEnabled}
          >
            {item.enabled ? (
              <EyeOff className="size-3" />
            ) : (
              <Eye className="size-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title={
              indexStatus === "error"
                ? `Réindexer (erreur : ${item.indexError ?? "inconnue"})`
                : indexStatus === "none"
                  ? "Indexer pour la recherche sémantique"
                  : "Réindexer"
            }
            onClick={handleReindex}
            disabled={reindexing}
          >
            {reindexing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCcw className="size-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Éditer"
            onClick={onEdit}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Supprimer"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer cette source ?"
        description={`« ${truncate(item.title, 80)} » sera supprimée définitivement de la knowledge base. Les conversations qui la citaient garderont les références (mais les pills seront grisées).`}
        onConfirm={async () => {
          await onDelete();
        }}
      />
    </article>
  );
}

/**
 * Badge d'état d'indexation RAG.
 *   - `ok`     : pastille verte discrète "Indexée"
 *   - `none`   : pastille neutre "À indexer"
 *   - `pending`: même chose que none (cas où l'indexer a tourné mais skip
 *                — content trop court / pas de provider)
 *   - `error`  : pastille orange "Erreur" avec tooltip
 *
 * Volontairement compact (1 mot + icône) pour ne pas alourdir la card.
 */
function IndexStatusBadge({
  status,
  indexError,
}: {
  status: IndexStatus;
  indexError: string | null;
}) {
  if (status === "ok") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10.5px] font-medium text-sky-700 dark:text-sky-300"
        title="Source indexée pour la recherche sémantique (RAG)"
      >
        <Database className="size-3" />
        Indexée
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-700 dark:text-amber-400"
        title={indexError ?? "Erreur d'indexation"}
      >
        <AlertTriangle className="size-3" />
        Index ?
      </span>
    );
  }
  // none + pending : même affichage discret
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground/80"
      title={
        indexError ??
        "Pas encore indexée pour la recherche sémantique (le chat utilise le fallback complet)"
      }
    >
      <Database className="size-3 opacity-50" />
      À indexer
    </span>
  );
}
