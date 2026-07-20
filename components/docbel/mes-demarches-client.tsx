"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Download, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ResumeForm } from "@/components/docbel/onboarding/resume-form";
import { GLASS_POP_STYLE } from "@/lib/glass-classes";
import type { MesDemarchesGroup } from "@/lib/bundles/mes-demarches";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";

interface Props {
  groups: MesDemarchesGroup[];
}

/// Écran transversal « Mes démarches » (/mes-demarches, Lot 3 Task 3.2) : TOUS
/// les dossiers confondus, contrairement à `DemandeList`
/// (`components/docbel/demande-list.tsx`) qui liste les démarches d'UN SEUL
/// dossier. Parcours 100 % anonyme (cookie `beldoc-bundle-session` + code de
/// reprise) — ne JAMAIS proposer de connexion ici.
///
/// La grammaire visuelle de chaque ligne (icône, libellé "Démarche n°N",
/// barre de progression, Abandonner) reprend celle de `DemandeList` — mais
/// dupliquée en `DemarcheRow` (composant local ci-dessous) plutôt
/// qu'importée : cette vue ajoute une pastille d'état et une action
/// « Récupérer mes documents » que `DemandeList` n'a pas, et `DemandeList`
/// reste scopée à un seul dossier (bouton "Nouvelle demande" inclus dans son
/// header). Factoriser aurait complexifié les deux call-sites pour peu de
/// gain — cf. consigne de ne pas refactorer lourdement `demande-list.tsx`.
export function MesDemarchesClient({ groups: initialGroups }: Props) {
  const t = useTranslations("public.dossier");
  const router = useRouter();
  const confirm = useConfirm();
  const [groups, setGroups] = useState(initialGroups);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Même flux (confirm + DELETE + refresh) que `DemandeList.abandon` — seule
  // différence : on retire la démarche de SON groupe, et on efface le groupe
  // entier s'il ne lui reste plus aucune démarche.
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
          .map((g) => ({
            ...g,
            demarches: g.demarches.filter((d) => d.runId !== runId),
          }))
          .filter((g) => g.demarches.length > 0),
      );
      router.refresh();
    } catch {
      toast.error(t("demandeAbandonError"));
    } finally {
      setBusyId(null);
    }
  }

  const isEmpty = groups.length === 0;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="glass-display text-4xl font-semibold leading-tight sm:text-5xl">
            {t.rich("mesDemarchesTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink)]/70 sm:text-base">
            {t("mesDemarchesSubtitle")}
          </p>
        </div>
        <Button render={<Link href="/mon-dossier" />} size="lg" className="min-h-11">
          <Plus data-icon="inline-start" aria-hidden />
          {t("demandeNew")}
        </Button>
      </div>

      {isEmpty ? (
        <div
          className="glass-surface flex flex-col items-center gap-4 rounded-3xl p-10 text-center"
          data-docbel-readable
        >
          <span
            className="flex size-14 items-center justify-center rounded-2xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
            aria-hidden
          >
            <FolderOpen className="size-6" />
          </span>
          <p className="text-base font-semibold text-[color:var(--glass-ink)]">
            {t("mesDemarchesEmpty")}
          </p>
          <Button render={<Link href="/mon-dossier" />} size="lg">
            {t("mesDemarchesEmptyCta")}
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section
              key={g.bundle.id}
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
                  {g.bundle.name}
                </h2>
              </div>
              <ul className="flex flex-col gap-2">
                {g.demarches.map((d) => (
                  <DemarcheRow
                    key={d.runId}
                    demarche={d}
                    slug={g.bundle.slug}
                    busy={busyId === d.runId}
                    onAbandon={() => abandon(d.runId)}
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

/// Ligne d'une démarche — même grammaire visuelle que `DemandeList` (icône,
/// libellé, barre de progression, Abandonner) + pastille d'état et action
/// « Récupérer mes documents » (visible seulement si complète), absentes de
/// `DemandeList`.
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
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
        aria-hidden
      >
        <FolderOpen className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="block text-sm font-bold text-[color:var(--glass-ink)]">
            {t("demandeLabel", { index: demarche.index })}
          </span>
          <span
            className={
              completed
                ? "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
                : "rounded-full border border-[color:var(--glass-border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]"
            }
            style={completed ? GLASS_POP_STYLE : undefined}
          >
            {completed ? t("demandeStatusComplete") : t("demandeStatusInProgress")}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-[color:var(--glass-ink)]/65">
          {t("demandeStartedOn", { date: fmtDate(demarche.startedAtISO) })} ·{" "}
          {t("demandeProgress", { completed: demarche.completed, total: demarche.total })}
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
        onClick={onAbandon}
        disabled={busy}
        aria-label={t("demandeAbandon")}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      {completed ? (
        <Button
          render={
            <Link
              href={`/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(demarche.runId)}#recuperer-envoyer`}
            />
          }
          variant="outline"
          size="sm"
          className="min-h-10"
        >
          <Download className="size-4" aria-hidden />
          {t("mesDemarchesRetrieve")}
        </Button>
      ) : null}
      <Button
        render={
          <Link
            href={`/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(demarche.runId)}&demarrer=1`}
          />
        }
        variant="outline"
        size="sm"
        className="min-h-10"
      >
        {completed ? t("demandeReview") : t("demandeResume")}
        <ArrowRight data-icon="inline-end" aria-hidden />
      </Button>
    </li>
  );
}
