import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Calendar,
  Clock,
  Tag,
  Building2,
  User,
} from "lucide-react";
import {
  type CalcMethodology,
  getLastUpdatedAt,
  isReviewOverdue,
} from "@/lib/calculators/_methodology";
import type { CalculatorAsset } from "@/components/admin/calculateurs/assets-manager";
import { CopyButton } from "./copy-button";

export interface SidebarToolMeta {
  description?: string | null;
  active?: boolean;
  /** Date ISO de dernière revue (col `lastReviewedAt`). */
  lastReviewedAt?: string | null;
  /** Date ISO de prochaine revue prévue. */
  nextReviewDue?: string | null;
  /** Date ISO de création de l'entrée DB. */
  createdAt?: string | null;
  /** Date ISO de dernière modification de l'entrée DB. */
  updatedAt?: string | null;
}

interface MethodologySidebarProps {
  data: CalcMethodology;
  dbTool?: SidebarToolMeta | null;
  assets?: CalculatorAsset[];
  /** URL publique de l'outil (`/outils/{slug}`). */
  publicUrl: string;
  /** URL absolue à utiliser pour le snippet iframe (ex: https://docbel.be/outils/x). */
  publicAbsoluteUrl?: string;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

/**
 * Sidebar droite de la fiche méthodologie (zone 1/3 du design).
 *
 * Server component pur (sauf `<CopyButton/>` qui est client). Affiche 4 cards
 * empilées : Aperçu rapide, Informations pratiques, Public & intégration,
 * et "Tout est à jour" (statut santé de la fiche).
 *
 * Sticky en lg+ pour rester visible au scroll du contenu central.
 */
export function MethodologySidebar({
  data,
  dbTool,
  assets,
  publicUrl,
  publicAbsoluteUrl,
}: MethodologySidebarProps) {
  const sourcesCount = data.sources.length;
  const formulasCount = data.formulas.length;
  const constantsCount = data.constants.length;
  const pdfsCount = assets?.length ?? 0;
  const overdue = isReviewOverdue(data);
  const lastUpdated = fmtDate(getLastUpdatedAt(data));
  const nextReview = fmtDate(dbTool?.nextReviewDue);
  const created = fmtDate(dbTool?.createdAt);
  const updated = fmtDate(dbTool?.updatedAt);
  const absoluteUrl = publicAbsoluteUrl ?? publicUrl;
  const iframeSnippet = `<iframe src="${absoluteUrl}" width="100%" height="800" frameborder="0"></iframe>`;

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
      {/* Aperçu rapide -------------------------------------------- */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Aperçu rapide
        </h3>
        <ul className="flex flex-col divide-y divide-border">
          <SidebarCountRow label="Sources" value={sourcesCount} />
          <SidebarCountRow label="PDFs attachés" value={pdfsCount} />
          <SidebarCountRow label="Formules" value={formulasCount} />
          <SidebarCountRow label="Constantes" value={constantsCount} />
        </ul>
      </section>

      {/* Informations pratiques ----------------------------------- */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Informations pratiques
        </h3>
        <ul className="flex flex-col gap-2.5 text-[12.5px]">
          <SidebarInfoRow
            icon={<Calendar className="size-3.5" />}
            label="Dernière MAJ"
            value={lastUpdated}
          />
          {dbTool?.nextReviewDue ? (
            <SidebarInfoRow
              icon={<Clock className="size-3.5" />}
              label="Prochaine revue"
              value={nextReview}
            />
          ) : null}
          {dbTool?.createdAt ? (
            <SidebarInfoRow
              icon={<Calendar className="size-3.5" />}
              label="Créé"
              value={created}
            />
          ) : null}
          {dbTool?.updatedAt ? (
            <SidebarInfoRow
              icon={<User className="size-3.5" />}
              label="Modifié"
              value={updated}
            />
          ) : null}
          {data.category ? (
            <SidebarInfoRow
              icon={<Building2 className="size-3.5" />}
              label="Catégorie"
              value={data.category}
            />
          ) : null}
          {data.author ? (
            <SidebarInfoRow
              icon={<User className="size-3.5" />}
              label="Auteur"
              value={data.author}
            />
          ) : null}
        </ul>
        {data.tags && data.tags.length > 0 ? (
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-1.5 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              <Tag className="size-3" />
              Tags
            </div>
            <div className="flex flex-wrap gap-1">
              {data.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Public & intégration ------------------------------------- */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Public &amp; intégration
        </h3>
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              URL publique
            </div>
            <div className="flex items-center gap-1">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-[11px] text-foreground/90">
                {publicUrl}
              </code>
              <CopyButton value={absoluteUrl} title="Copier l'URL" />
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              Snippet iframe
            </div>
            <div className="relative">
              <pre className="overflow-hidden rounded bg-muted px-2 py-1.5 pr-9 font-mono text-[10.5px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all">
                {iframeSnippet}
              </pre>
              <div className="absolute right-1 top-1">
                <CopyButton value={iframeSnippet} title="Copier le snippet" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tout est à jour ------------------------------------------ */}
      <section
        className={`rounded-2xl border p-4 ${
          overdue
            ? "border-amber-300/60 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-950/20"
            : "border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-950/20"
        }`}
      >
        <h3
          className={`mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${
            overdue
              ? "text-amber-800 dark:text-amber-300"
              : "text-emerald-800 dark:text-emerald-300"
          }`}
        >
          {overdue ? (
            <AlertCircle className="size-3.5" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          {overdue ? "Vérification recommandée" : "Tout est à jour"}
        </h3>
        <ul className="flex flex-col gap-1.5 text-[12px]">
          <HealthCheckRow ok label={`Sources (${sourcesCount})`} />
          <HealthCheckRow ok label={`Formules (${formulasCount})`} />
          <HealthCheckRow
            ok={!overdue}
            label={`Barèmes ${data.year}`}
            hint={overdue ? "Plus de 12 mois" : undefined}
          />
          <HealthCheckRow
            ok={!!dbTool?.lastReviewedAt}
            label="Dernier contrôle"
            hint={
              dbTool?.lastReviewedAt
                ? fmtDate(dbTool.lastReviewedAt)
                : "jamais"
            }
          />
        </ul>
      </section>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function SidebarCountRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center justify-between py-1.5 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </li>
  );
}

function SidebarInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="truncate text-right font-medium text-foreground">
          {value}
        </span>
      </div>
    </li>
  );
}

function HealthCheckRow({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5">
        {ok ? (
          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400" />
        )}
        <span className="text-foreground">{label}</span>
      </span>
      {hint ? (
        <span className="text-[10.5px] text-muted-foreground">{hint}</span>
      ) : null}
    </li>
  );
}
