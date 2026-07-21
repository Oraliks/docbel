"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Download, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ProgressFeedback } from "@/components/docbel/progress-feedback";
import { ResumeForm } from "@/components/docbel/onboarding/resume-form";
import { formatDate } from "@/lib/i18n/format";
import type { MesDemarchesGroup } from "@/lib/bundles/mes-demarches";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";

interface Props {
  groups: MesDemarchesGroup[];
}

/** Cockpit transversal et anonyme de toutes les demarches en cours. */
export function MesDemarchesClient({ groups: initialGroups }: Props) {
  const t = useTranslations("public.dossier");
  const router = useRouter();
  const confirm = useConfirm();
  const [groups, setGroups] = useState(initialGroups);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function abandon(runId: string) {
    if (busyId) return;
    const ok = await confirm({
      title: t("demandeAbandon"),
      description: t("demandeAbandonConfirm"),
      confirmText: t("demandeAbandon"),
      destructive: true,
    });
    if (!ok) return;
    setBusyId(runId);
    try {
      const res = await fetch(`/api/bundles/runs/${encodeURIComponent(runId)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        toast.error(t("demandeAbandonError"));
        return;
      }
      setGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            demarches: group.demarches.filter((item) => item.runId !== runId),
          }))
          .filter((group) => group.demarches.length > 0),
      );
      router.refresh();
    } catch {
      toast.error(t("demandeAbandonError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="glass-display text-4xl font-semibold leading-tight sm:text-5xl">
            {t.rich("mesDemarchesTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)] sm:text-base">
            {t("mesDemarchesSubtitle")}
          </p>
        </div>
        {groups.length > 0 ? (
          <Button
            render={<Link href="/mon-dossier" />}
            nativeButton={false}
            variant="outline"
            size="lg"
            className="min-h-11"
          >
            <Plus data-icon="inline-start" aria-hidden />
            {t("demandeNew")}
          </Button>
        ) : null}
      </header>

      {groups.length === 0 ? (
        <Empty
          className="glass-surface min-h-64 rounded-3xl border border-[color:var(--glass-border)]"
          data-docbel-readable
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-[color:var(--glass-ink)]">
              {t("mesDemarchesEmpty")}
            </EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button
              render={<Link href="/mon-dossier" />}
              nativeButton={false}
              size="lg"
            >
              {t("mesDemarchesEmptyCta")}
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section
              key={group.bundle.id}
              className="glass-surface flex flex-col gap-4 rounded-3xl p-4 sm:p-5"
              data-docbel-readable
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
                  aria-hidden
                >
                  <FolderOpen />
                </span>
                <h2 className="text-xl font-bold text-[color:var(--glass-ink)]">
                  {group.bundle.name}
                </h2>
              </div>
              <ul className="flex flex-col gap-3">
                {group.demarches.map((demarche) => (
                  <DemarcheRow
                    key={demarche.runId}
                    demarche={demarche}
                    slug={group.bundle.slug}
                    busy={busyId === demarche.runId}
                    onAbandon={() => abandon(demarche.runId)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-[color:var(--glass-ink)]">
          {t("mesDemarchesOtherDevice")}
        </h2>
        <ResumeForm />
        <p className="text-xs text-[color:var(--glass-ink-faint)]">
          {t("mesDemarchesCodeHint")}
        </p>
      </section>

      <p className="text-xs text-[color:var(--glass-ink-faint)]">
        {t("mesDemarchesRetention")}
      </p>
    </section>
  );
}

function DemarcheRow({
  demarche,
  slug,
  busy,
  onAbandon,
}: {
  demarche: DemandeSummary;
  slug: string;
  busy: boolean;
  onAbandon: () => void;
}) {
  const t = useTranslations("public.dossier");
  const locale = useLocale();
  const completed = demarche.lifecycle === "completed_editable";
  const percentage = completed
    ? 100
    : demarche.total > 0
      ? Math.round((demarche.completed / demarche.total) * 100)
      : 0;
  const resumeHref = `/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(demarche.runId)}&demarrer=1`;
  const retrieveHref = `/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(demarche.runId)}#recuperer-envoyer`;

  return (
    <li className="grid gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.35fr)_auto] sm:items-center">
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

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {completed ? (
          <Button
            render={<Link href={retrieveHref} />}
            nativeButton={false}
            size="sm"
            className="min-h-10"
          >
            <Download data-icon="inline-start" aria-hidden />
            {t("mesDemarchesRetrieve")}
          </Button>
        ) : (
          <Button
            render={<Link href={resumeHref} />}
            nativeButton={false}
            size="sm"
            className="min-h-10"
          >
            {t("demandeResume")}
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        )}
        {completed ? (
          <Button
            render={<Link href={resumeHref} />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="min-h-10"
          >
            {t("demandeReview")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-10 text-destructive"
          onClick={onAbandon}
          disabled={busy}
          aria-label={t("demandeAbandon")}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}
