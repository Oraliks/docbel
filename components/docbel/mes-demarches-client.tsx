"use client";

import Link from "next/link";
import { TemporaryClosureNotice } from "./temporary-closure-notice";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Download, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ProgressFeedback } from "@/components/docbel/progress-feedback";
import { ResumeForm } from "@/components/docbel/onboarding/resume-form";
import { formatDate } from "@/lib/i18n/format";
import type { MesDemarchesGroup } from "@/lib/bundles/mes-demarches";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";

interface Props {
  groups: MesDemarchesGroup[];
}

/** Existing caller-owned démarches remain available for consultation in V1. */
export function MesDemarchesClient({ groups }: Props) {
  const tp = useTranslations("public.temporaryClosure");
  const t = useTranslations("public.dossier");
  const td = useTranslations("public.design");

  return (
    <section className="flex w-full flex-col gap-6">
      <TemporaryClosureNotice kind="existing" compact />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="glass-display text-4xl font-semibold leading-tight sm:text-5xl">
            {t.rich("mesDemarchesTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)] sm:text-base">
            {td("oldReadOnlyBody")}
          </p>
        </div>
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
              render={<Link href="/outils" />}
              nativeButton={false}
              size="lg"
            >
              {tp("tools")}
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


    </section>
  );
}

function DemarcheRow({
  demarche,
  slug,
}: {
  demarche: DemandeSummary;
  slug: string;
}) {
  const t = useTranslations("public.dossier");
  const td = useTranslations("public.design");
  const locale = useLocale();
  const completed = demarche.lifecycle === "completed_editable";
  const percentage = completed
    ? 100
    : demarche.total > 0
      ? Math.round((demarche.completed / demarche.total) * 100)
      : 0;
  const resumeHref = `/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(demarche.runId)}`;
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
            className="h-auto min-h-11 whitespace-normal py-2 text-start"
          >
            <Download data-icon="inline-start" aria-hidden />
            {t("mesDemarchesRetrieve")}
          </Button>
        ) : (
          <Button
            render={<Link href={resumeHref} />}
            nativeButton={false}
            size="sm"
            className="h-auto min-h-11 whitespace-normal py-2 text-start"
          >
            {td("existingResume")}
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        )}
        {completed ? (
          <Button
            render={<Link href={resumeHref} />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="h-auto min-h-11 whitespace-normal py-2 text-start"
          >
            {td("existingResume")}
          </Button>
        ) : null}

      </div>
    </li>
  );
}
