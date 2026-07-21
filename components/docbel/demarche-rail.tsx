"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  FolderOpen,
  Lock,
} from "lucide-react";
import { ProgressFeedback } from "@/components/docbel/progress-feedback";
import { GLASS_INPUT } from "@/lib/glass-classes";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";
import type { DemarcheRailModel, RailDoc, RailStepState } from "@/lib/bundles/rail-model";

/// Données sérialisables du rail quand il est construit côté SERVEUR
/// (page /document) puis passé au client à travers DocumentPageLayout.
export interface DemarcheRailData {
  bundleName: string;
  bundleSlug: string;
  runId: string;
  model: DemarcheRailModel;
}

interface DemarcheRailProps {
  bundleName: string;
  bundleSlug: string;
  runId: string | null;
  model: DemarcheRailModel;
  /// Démarches du même dossier — sélecteur affiché si ≥ 2 (et runId connu).
  demandes?: DemandeSummary[];
  /// Slug du document actuellement ouvert (/document) : surligné, non cliquable.
  activeDocSlug?: string | null;
  /// Cible du lien « Mes démarches » (décision produit : /mes-demarches).
  demarchesHref?: string;
  /// Bannière code de reprise (connue uniquement dans la session de création — /d).
  resumeSlot?: React.ReactNode;
  /// Bouton « Nouvelle démarche » (NouvelleDemandeButton — /d uniquement).
  newDemarcheSlot?: React.ReactNode;
  /// Conseils contextuels embarqués (/document : ContextHelpPanel embedded).
  helpSlot?: React.ReactNode;
}

/// Rail latéral permanent de la démarche : nom du dossier, sélecteur de
/// démarche, 3 grandes étapes (situation / documents / récupérer & envoyer),
/// annonce du verrou tout-ou-rien, code de reprise, lien « Mes démarches ».
/// Desktop : colonne sticky à gauche. Mobile : barre repliable en haut
/// (« 2/3 documents · Voir le détail »).
export function DemarcheRail(props: DemarcheRailProps) {
  const t = useTranslations("public.dossier");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { completedCount, totalCount } = props.model.documents;

  return (
    <div className="min-w-0">
      {/* ---- Mobile : barre repliable ---- */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
          className="glass-surface flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[color:var(--glass-ink)]">
              {props.bundleName}
            </span>
            <span className="block text-xs text-[color:var(--glass-ink-soft)]">
              {t("railDocsProgress", { completed: completedCount, total: totalCount })}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[color:var(--glass-accent-deep)]">
            {mobileOpen ? t("railMobileHide") : t("railMobileShow")}
            {mobileOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </span>
        </button>
        {mobileOpen && (
          <div className="mt-2 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] p-4">
            <RailBody {...props} showName={false} />
          </div>
        )}
      </div>

      {/* ---- Desktop : rail permanent sticky ---- */}
      <aside
        aria-label={t("railAriaLabel")}
        className="hidden flex-col gap-4 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] p-4 lg:flex lg:sticky lg:top-6"
      >
        <RailBody {...props} showName />
      </aside>
    </div>
  );
}

function RailBody({
  bundleName,
  bundleSlug,
  runId,
  model,
  demandes,
  activeDocSlug,
  demarchesHref = "/mes-demarches",
  resumeSlot,
  newDemarcheSlot,
  helpSlot,
  showName,
}: DemarcheRailProps & { showName: boolean }) {
  const t = useTranslations("public.dossier");
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      {showName && (
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
          >
            <FolderOpen className="size-4" />
          </span>
          <p className="min-w-0 truncate text-sm font-bold text-[color:var(--glass-ink)]">{bundleName}</p>
        </div>
      )}

      {/* Sélecteur de démarche — natif (cf. gotcha Select base-ui « _none ») */}
      {runId && (demandes?.length ?? 0) >= 2 && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
            {t("railDemarcheSelectorLabel")}
          </span>
          <select
            className={`${GLASS_INPUT} h-9 w-full border px-2 text-sm`}
            value={runId}
            onChange={(e) =>
              router.push(
                `/d/${encodeURIComponent(bundleSlug)}?bundleRun=${encodeURIComponent(e.target.value)}`,
              )
            }
          >
            {demandes!.map((d) => (
              <option key={d.runId} value={d.runId}>
                {t("railDemarcheOption", { index: d.index, completed: d.completed, total: d.total })}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Les 3 grandes étapes */}
      <ol className="flex flex-col gap-3">
        <RailStep index={1} state={model.situation.state} title={t("railStepSituation")} />
        <RailStep
          index={2}
          state={model.documents.state}
          title={t("railStepDocuments")}
          meta={t("railDocsProgress", {
            completed: model.documents.completedCount,
            total: model.documents.totalCount,
          })}
        >
          <ProgressFeedback
            label={t("railDocsProgress", {
              completed: model.documents.completedCount,
              total: model.documents.totalCount,
            })}
            value={model.documents.completedCount}
            max={Math.max(1, model.documents.totalCount)}
            state={model.documents.state === "done" ? "done" : "current"}
            compact
            labelMode="sr-only"
            className="mt-2"
          />
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {model.documents.docs.map((doc) => (
              <RailDocRow
                key={doc.key}
                doc={doc}
                active={doc.slug === activeDocSlug}
                href={
                  runId && doc.state !== "pending" && doc.slug !== activeDocSlug
                    ? `/document/${doc.slug}?bundleRun=${encodeURIComponent(runId)}&bundleSlug=${encodeURIComponent(bundleSlug)}`
                    : null
                }
              />
            ))}
          </ul>
        </RailStep>
        <RailStep index={3} state={model.retrieve.state} title={t("railStepRetrieve")}>
          {model.retrieve.state === "locked" ? (
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-[color:var(--glass-ink-soft)]">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{t("railLockAnnouncement", { count: model.retrieve.requiredCount })}</span>
            </p>
          ) : runId ? (
            <Link
              href={`/d/${encodeURIComponent(bundleSlug)}?bundleRun=${encodeURIComponent(runId)}#recuperer-envoyer`}
              className="mt-1 inline-flex text-[13px] font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
            >
              {t("railUnlockedCta")}
            </Link>
          ) : null}
        </RailStep>
      </ol>

      {resumeSlot}
      {newDemarcheSlot && <div className="flex">{newDemarcheSlot}</div>}

      {helpSlot && (
        <div className="border-t border-[color:var(--glass-border)] pt-3.5">{helpSlot}</div>
      )}

      <div className="border-t border-[color:var(--glass-border)] pt-3.5">
        <Link
          href={demarchesHref}
          className="text-[13px] font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
        >
          {t("railMyDemarches")}
        </Link>
      </div>
    </div>
  );
}

function RailStep({
  index,
  state,
  title,
  meta,
  children,
}: {
  index: number;
  state: RailStepState;
  title: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("public.dossier");
  const badge =
    state === "done" ? (
      <CheckCircle2 className="size-5 shrink-0 text-[color:var(--success)]" aria-hidden />
    ) : state === "locked" ? (
      <Lock className="size-4 shrink-0 text-[color:var(--glass-ink-faint)]" aria-hidden />
    ) : (
      <span
        aria-hidden
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          state === "current"
            ? "bg-[color:var(--glass-accent-deep)] text-white"
            : "bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
        }`}
      >
        {index}
      </span>
    );
  const srState =
    state === "done"
      ? t("railStepStateDone")
      : state === "current"
        ? t("railStepStateCurrent")
        : state === "locked"
          ? t("railStepStateLocked")
          : t("railStepStateUpcoming");
  return (
    <li aria-current={state === "current" ? "step" : undefined}>
      <div className="flex items-center gap-2">
        {badge}
        <span
          className={`text-sm ${
            state === "current"
              ? "font-bold text-[color:var(--glass-ink)]"
              : "font-semibold text-[color:var(--glass-ink-soft)]"
          }`}
        >
          {title}
        </span>
        {meta && <span className="ml-auto text-xs text-[color:var(--glass-ink-soft)]">{meta}</span>}
        <span className="sr-only">{srState}</span>
      </div>
      {children && <div className="pl-7">{children}</div>}
    </li>
  );
}

function RailDocRow({ doc, href, active }: { doc: RailDoc; href: string | null; active: boolean }) {
  const t = useTranslations("public.dossier");
  const icon =
    doc.state === "done" ? (
      <CheckCircle2 className="size-3.5 shrink-0 text-[color:var(--success)]" aria-hidden />
    ) : doc.state === "pending" ? (
      <Clock className="size-3.5 shrink-0 text-[color:var(--glass-ink-faint)]" aria-hidden />
    ) : (
      <Circle className="size-3.5 shrink-0 text-[color:var(--glass-ink-faint)]" aria-hidden />
    );
  const content = (
    <>
      {icon}
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          active
            ? "font-semibold text-[color:var(--glass-accent-deep)]"
            : "text-[color:var(--glass-ink-soft)]"
        }`}
      >
        {doc.title}
      </span>
      {doc.state === "pending" && (
        <span className="shrink-0 text-[10px] italic text-[color:var(--glass-ink-faint)]">
          {t("railDocPending")}
        </span>
      )}
      {!doc.required && (
        <span className="shrink-0 text-[10px] text-[color:var(--glass-ink-faint)]">{t("optional")}</span>
      )}
    </>
  );
  if (href) {
    return (
      <li>
        <Link
          href={href}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-[color:var(--glass-pop-bg)]/40"
        >
          {content}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <span
        className="flex items-center gap-2 px-1.5 py-1"
        aria-current={active ? "page" : undefined}
      >
        {content}
      </span>
    </li>
  );
}
