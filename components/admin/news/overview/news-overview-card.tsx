"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Copy, ExternalLink, Eye, Star, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { NewsItem } from "./types";

interface NewsOverviewCardProps {
  item: NewsItem;
  onMutated: () => void;
}

/**
 * Map des couleurs Tailwind par statut. Utilisées pour le badge à droite et
 * le carré-icône à gauche de la card.
 *
 *   - published : emerald (état "vivant")
 *   - draft     : amber  (en cours)
 *   - scheduled : violet (futur)
 *   - archived  : slate  (neutre / hors actif)
 */
const STATUS_TONE: Record<
  string,
  {
    badge: string;
    iconBg: string;
    iconText: string;
  }
> = {
  published: {
    badge:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    iconText: "text-emerald-700 dark:text-emerald-300",
  },
  draft: {
    badge:
      "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    iconBg: "bg-amber-500/10 dark:bg-amber-500/15",
    iconText: "text-amber-700 dark:text-amber-300",
  },
  scheduled: {
    badge:
      "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
    iconBg: "bg-violet-500/10 dark:bg-violet-500/15",
    iconText: "text-violet-700 dark:text-violet-300",
  },
  archived: {
    badge:
      "bg-slate-500/10 text-slate-700 border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300",
    iconBg: "bg-slate-500/10 dark:bg-slate-500/15",
    iconText: "text-slate-700 dark:text-slate-300",
  },
};

/**
 * Format une date ISO en `dd/MM/yyyy` (fr-BE).
 * Renvoie "—" si la date est null/undefined.
 */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Card horizontale compacte d'un article dans la liste d'overview admin.
 *
 * Toute la card est cliquable (Link) et navigue vers /admin/news/[id] pour
 * l'édition. Le clic-droit ouvre un menu contextuel avec :
 *   - Voir le rendu public (nouvel onglet)
 *   - Dupliquer (POST /api/news avec slug suffixé)
 *   - Supprimer (DELETE /api/news/[id], confirmation type-to-confirm)
 *
 * Pattern aligné sur `calculateurs/overview/overview-card.tsx` — densité
 * verticale max, badge à droite, icône audience à gauche.
 */
export function NewsOverviewCard({ item, onMutated }: NewsOverviewCardProps) {
  const t = useTranslations("admin.news");
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  const tone = STATUS_TONE[item.status] ?? STATUS_TONE.draft;

  // Date pertinente selon le statut. Pour les planifiés on montre la date
  // de planification, sinon date de publication, sinon date de création.
  const dateLabel = (() => {
    if (item.status === "scheduled" && item.scheduledAt) {
      return t("dateScheduled", { date: formatDate(item.scheduledAt) });
    }
    if (item.publishedAt) {
      return t("datePublished", { date: formatDate(item.publishedAt) });
    }
    return t("dateCreated", { date: formatDate(item.createdAt) });
  })();

  async function handleDelete() {
    const ok = await confirm({
      title: t("deleteConfirmTitle", { title: item.title }),
      description: t("deleteConfirmDescription"),
      confirmText: t("deleteConfirmButton"),
      destructive: true,
      requireText: item.title,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/news/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? t("toastDeleteFailed"));
      }
      toast.success(t("toastDeleted"));
      onMutated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toastError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/news/${item.id}`);
      if (!res.ok) throw new Error(t("toastArticleNotFound"));
      const article = (await res.json()) as Record<string, unknown>;

      const create = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...article,
          title: t("duplicateTitleSuffix", { title: item.title }),
          slug: `${item.slug}-copy-${Date.now()}`,
          status: "draft",
        }),
      });
      if (!create.ok) {
        const j = (await create.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? t("toastDuplicateFailed"));
      }
      toast.success(t("toastDuplicated"));
      onMutated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toastError"));
    } finally {
      setBusy(false);
    }
  }

  function handlePreview() {
    window.open(`/actualites/${item.slug}`, "_blank", "noopener,noreferrer");
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block">
        <Link
          href={`/admin/news/${item.id}`}
          className={cn(
            "group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all",
            "hover:bg-muted/40 hover:border-primary/30 hover:shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {/* Tile icône (emoji) ------------------------------------------- */}
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg text-lg",
              tone.iconBg,
              tone.iconText,
            )}
            aria-hidden="true"
          >
            <span className="leading-none">{item.emoji}</span>
          </div>

          {/* Titre + sous-ligne ------------------------------------------- */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13.5px] font-semibold text-foreground group-hover:text-primary">
                {item.title}
              </p>
              {item.featured ? (
                <Star
                  className="size-3 shrink-0 fill-amber-400 text-amber-400"
                  aria-label={t("featuredLabel")}
                />
              ) : null}
            </div>
            <p className="line-clamp-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span
                className="inline-block size-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: item.categoryColor ?? item.color ?? "#7C3AED",
                }}
                aria-hidden="true"
              />
              <span className="truncate">{item.category}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{dateLabel}</span>
            </p>
          </div>

          {/* Badge statut + flèche ---------------------------------------- */}
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                tone.badge,
              )}
            >
              {t("status", { status: item.status })}
            </span>
            <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => router.push(`/admin/news/${item.id}`)}
        >
          <Eye className="size-3.5" />
          {t("contextEdit")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePreview}>
          <ExternalLink className="size-3.5" />
          {t("contextViewPublic")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDuplicate} disabled={busy}>
          <Copy className="size-3.5" />
          {t("contextDuplicate")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleDelete}
          disabled={busy}
          className="text-red-600 dark:text-red-400"
        >
          <Trash2 className="size-3.5" />
          {t("delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
