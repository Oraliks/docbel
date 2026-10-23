"use client";

import Link from "next/link";
import { PUBLIC_WRITES_PAUSED } from "@/lib/public-access";
import { TemporaryClosureNotice } from "./temporary-closure-notice";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ProgressFeedback } from "@/components/docbel/progress-feedback";
import { formatDate } from "@/lib/i18n/format";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";

interface Props {
  bundleId: string;
  slug: string;
  bundleName: string;
  demandes: DemandeSummary[];
}

export function DemandeList({ slug, bundleName, demandes }: Props) {
  const t = useTranslations("public.dossier");
  const td = useTranslations("public.design");
  const tp = useTranslations("public.temporaryClosure");
  const locale = useLocale();
  return (
    <section
      className="glass-surface flex flex-col gap-4 rounded-3xl p-4 sm:p-5"
      data-docbel-readable
    >
      {PUBLIC_WRITES_PAUSED && <TemporaryClosureNotice kind="existing" compact />}
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
              {bundleName}
            </p>
          </div>
        </div>
      </header>

      {demandes.length === 0 ? (
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
          {demandes.map((demarche) => {
            const completed = demarche.lifecycle === "completed_editable";
            const percentage = completed
              ? 100
              : demarche.total > 0
                ? Math.round((demarche.completed / demarche.total) * 100)
                : 0;
            const href = `/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(demarche.runId)}`;

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
                    className="h-auto min-h-11 whitespace-normal py-2 text-start"
                  >
                    {PUBLIC_WRITES_PAUSED ? tp("consult") : td("existingResume")}
                    <ArrowRight data-icon="inline-end" aria-hidden />
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
