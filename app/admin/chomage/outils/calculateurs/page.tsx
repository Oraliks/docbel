import Link from "next/link";
import { ArrowLeft, CalculatorIcon, ChevronRight, FileCode2 } from "lucide-react";
import {
  getMethodologies,
  RELIABILITY_LABELS,
  RELIABILITY_COLORS,
} from "@/lib/calculators/_methodology";

/**
 * Vue d'ensemble admin des méthodologies de calculateurs.
 *
 * Accessible depuis /admin/chomage/outils (parent) via le bouton
 * "Méthodologie" de chaque card calc_*. Aussi accessible directement
 * via cette URL pour un audit transversal.
 *
 * On présente une vue COMPACTE (1 ligne par calc) avec le statut de
 * fiabilité ; le détail (formules, constantes, sources, limitations)
 * vit dans /admin/chomage/outils/calculateurs/[slug].
 *
 * Auth + role check : assurés par app/admin/layout.tsx.
 */
export const dynamic = "force-dynamic";

export default function CalculateursOverviewPage() {
  const methodologies = getMethodologies();
  const counts = methodologies.reduce(
    (acc, m) => {
      acc[m.reliability] = (acc[m.reliability] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Breadcrumb / retour ---------------------------------------- */}
      <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Link
          href="/admin/chomage/outils"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Tous les outils
        </Link>
        <span>/</span>
        <span>Méthodologies calculateurs</span>
      </nav>

      {/* En-tête ----------------------------------------------------- */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalculatorIcon className="size-5" />
          </span>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold leading-tight">
              Méthodologie des calculateurs
            </h1>
            <p className="text-sm text-muted-foreground">
              {methodologies.length} calculateurs — clique sur un outil pour
              voir formules, constantes et sources officielles.
            </p>
          </div>
        </div>

        {/* Stats fiabilité ------------------------------------------ */}
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-400">
            ✓ {counts.high ?? 0} fiables
          </span>
          <span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-700 dark:text-amber-400">
            ~ {counts.medium ?? 0} approximatifs
          </span>
          <span className="rounded-full bg-red-500/10 px-3 py-1 font-semibold text-red-700 dark:text-red-400">
            ! {counts.low ?? 0} à vérifier
          </span>
        </div>

        {/* Mode d'emploi ------------------------------------------- */}
        <div className="rounded-xl border border-border bg-card p-4 text-[13px] leading-relaxed text-muted-foreground">
          <div className="mb-1.5 flex items-center gap-2 font-semibold text-foreground">
            <FileCode2 className="size-4" />
            Comment se servir de cette page
          </div>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong className="font-semibold text-foreground">
                Statut « {RELIABILITY_LABELS.high} »
              </strong>{" "}
              : formule conforme aux textes officiels, chiffres à jour.
            </li>
            <li>
              <strong className="font-semibold text-foreground">
                Statut « {RELIABILITY_LABELS.medium} »
              </strong>{" "}
              : formule correcte mais simplifications volontaires
              (taux moyens, barème allégé).
            </li>
            <li>
              <strong className="font-semibold text-foreground">
                Statut « {RELIABILITY_LABELS.low} »
              </strong>{" "}
              : à auditer en priorité — les chiffres peuvent être obsolètes.
            </li>
            <li>
              Le titre et la description publique de chaque outil sont
              éditables côté{" "}
              <Link
                href="/admin/chomage/outils"
                className="font-medium text-foreground hover:underline"
              >
                /admin/chomage/outils
              </Link>
              . Les formules et constantes restent en code (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11.5px]">
                lib/calculators/*.ts
              </code>
              ).
            </li>
          </ul>
        </div>
      </header>

      {/* Liste compacte ---------------------------------------------- */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/60 text-left">
              <th className="px-4 py-2.5 font-semibold">Calculateur</th>
              <th className="px-4 py-2.5 font-semibold">Statut</th>
              <th className="px-4 py-2.5 font-semibold">Année</th>
              <th className="px-4 py-2.5 font-semibold">Fichier</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {methodologies.map((m) => {
              const color = RELIABILITY_COLORS[m.reliability];
              return (
                <tr
                  key={m.slug}
                  className="group border-t border-border odd:bg-background even:bg-muted/20 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/chomage/outils/calculateurs/${m.slug}`}
                      className="block"
                    >
                      <div className="font-semibold text-foreground group-hover:underline">
                        {m.title}
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground line-clamp-1">
                        {m.pitch}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                      style={{
                        background: `${color}1A`,
                        color,
                        border: `1px solid ${color}40`,
                      }}
                    >
                      {RELIABILITY_LABELS[m.reliability]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.year}</td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-[11px] text-muted-foreground">
                      {m.sourceFile}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/chomage/outils/calculateurs/${m.slug}`}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                    >
                      Détail
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
