"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";
import { NouvelleDemandeButton } from "./nouvelle-demande-button";

interface Props {
  bundleId: string;
  slug: string;
  bundleName: string;
  demandes: DemandeSummary[];
}

/// Écran « Mes demandes » : liste les demandes (BundleRun) d'un dossier quand il
/// y en a plusieurs. Chaque ligne = libellé calculé (Demande n°N · date ·
/// progression), Reprendre/Revoir, Abandonner (soft-delete). + Nouvelle demande.
export function DemandeList({ bundleId, slug, bundleName, demandes }: Props) {
  const t = useTranslations("public.dossier");
  const locale = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const [items, setItems] = useState(demandes);
  const [busy, setBusy] = useState<string | null>(null);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));

  async function abandon(runId: string) {
    if (busy) return;
    const ok = await confirm({
      title: t("demandeAbandon"),
      description: t("demandeAbandonConfirm"),
      confirmText: t("demandeAbandon"),
      destructive: true,
    });
    if (!ok) return;
    setBusy(runId);
    try {
      const res = await fetch(`/api/bundles/runs/${encodeURIComponent(runId)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        toast.error(t("demandeAbandonError"));
        return;
      }
      setItems((prev) => prev.filter((d) => d.runId !== runId));
      router.refresh();
    } catch {
      toast.error(t("demandeAbandonError"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="glass-surface flex flex-col gap-4 rounded-3xl p-4 sm:p-5"
      data-docbel-readable
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
            aria-hidden
          >
            <FolderOpen />
          </span>
          <div>
            <h2 className="text-xl font-bold text-[color:var(--glass-ink)]">
              {t("demandesTitle")}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--glass-ink-soft)]">
              {bundleName} · {t("demandesSubtitle")}
            </p>
          </div>
        </div>
        <NouvelleDemandeButton bundleId={bundleId} slug={slug} variant="default" />
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((d) => {
          const completed = d.lifecycle === "completed_editable";
          const percentage = completed
            ? 100
            : d.total > 0
              ? Math.round((d.completed / d.total) * 100)
              : 0;
          return (
            <li
              key={d.runId}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-3"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
                aria-hidden
              >
                <FolderOpen className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[color:var(--glass-ink)]">
                  {t("demandeLabel", { index: d.index })}
                </span>
                <span className="mt-0.5 block text-xs text-[color:var(--glass-ink)]/65">
                  {t("demandeStartedOn", { date: fmtDate(d.startedAtISO) })} ·{" "}
                  {t("demandeProgress", { completed: d.completed, total: d.total })}
                </span>
              </span>
              <span className="hidden w-24 flex-col gap-1 sm:flex">
                <span className="text-xs font-semibold text-[color:var(--glass-ink)]/70">
                  {percentage}%
                </span>
                <span
                  className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--glass-ink-line)]"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-[color:var(--glass-accent-deep)]"
                    style={{ width: `${percentage}%` }}
                  />
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-10 text-destructive"
                onClick={() => abandon(d.runId)}
                disabled={busy === d.runId}
                aria-label={t("demandeAbandon")}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() =>
                  router.push(
                    `/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(d.runId)}&demarrer=1`,
                  )
                }
              >
                {completed ? t("demandeReview") : t("demandeResume")}
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
