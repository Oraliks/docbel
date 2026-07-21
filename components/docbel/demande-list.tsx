"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, FolderOpen, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ProgressFeedback } from "@/components/docbel/progress-feedback";
import { formatDate } from "@/lib/i18n/format";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";
import { NouvelleDemandeButton } from "./nouvelle-demande-button";

interface Props {
  bundleId: string;
  slug: string;
  bundleName: string;
  demandes: DemandeSummary[];
}

export function DemandeList({ bundleId, slug, bundleName, demandes }: Props) {
  const t = useTranslations("public.dossier");
  const locale = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const [items, setItems] = useState(demandes);
  const [busy, setBusy] = useState<string | null>(null);

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
      setItems((prev) => prev.filter((item) => item.runId !== runId));
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
      <header className="flex flex-wrap items-center justify-between gap-3">
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
        <NouvelleDemandeButton
          bundleId={bundleId}
          slug={slug}
          variant="default"
        />
      </header>

      {items.length === 0 ? (
        <Empty className="min-h-44 border border-[color:var(--glass-border)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("mesDemarchesEmpty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((demarche) => {
            const completed = demarche.lifecycle === "completed_editable";
            const percentage = completed
              ? 100
              : demarche.total > 0
                ? Math.round((demarche.completed / demarche.total) * 100)
                : 0;
            const href = `/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(demarche.runId)}&demarrer=1`;

            return (
              <li
                key={demarche.runId}
                className="grid gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.35fr)_auto] sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
                    aria-hidden
                  >
                    <FolderOpen />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[color:var(--glass-ink)]">
                        {t("demandeLabel", { index: demarche.index })}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          completed
                            ? "border-[color:var(--success-border)] bg-[color:var(--success-subtle)] text-[color:var(--success-subtle-foreground)]"
                            : undefined
                        }
                      >
                        {completed
                          ? t("demandeStatusComplete")
                          : t("demandeStatusInProgress")}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-xs text-[color:var(--glass-ink-soft)]">
                      {t("demandeStartedOn", {
                        date: formatDate(demarche.startedAtISO, locale),
                      })}
                    </span>
                  </span>
                </div>

                <ProgressFeedback
                  label={t("demandeProgress", {
                    completed: demarche.completed,
                    total: demarche.total,
                  })}
                  value={percentage}
                  valueText={`${percentage}%`}
                  state={completed ? "done" : "current"}
                  compact
                />

                <div className="flex items-center gap-2 sm:justify-end">
                  <Button
                    render={<Link href={href} />}
                    nativeButton={false}
                    variant={completed ? "outline" : "default"}
                    size="sm"
                    className="min-h-10"
                  >
                    {completed ? t("demandeReview") : t("demandeResume")}
                    <ArrowRight data-icon="inline-end" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-10 text-destructive"
                    onClick={() => abandon(demarche.runId)}
                    disabled={busy === demarche.runId}
                    aria-label={t("demandeAbandon")}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
