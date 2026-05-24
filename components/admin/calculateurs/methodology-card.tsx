import Link from "next/link";
import { ExternalLink, FileCode2, AlertTriangle, ListChecks, Info } from "lucide-react";
import {
  type CalcMethodology,
  RELIABILITY_LABELS,
  RELIABILITY_COLORS,
} from "@/lib/calculators/_methodology";

/**
 * Carte de méthodologie pour un calculateur.
 *
 * Server component pur — pas de state, pas d'interactivité (les détails se
 * replient via <details>/<summary> natifs). Conçu pour la page
 * /admin/calculateurs : l'admin (expert métier) peut vérifier d'un coup d'œil
 * chaque chiffre et chaque hypothèse.
 */
export function MethodologyCard({ data }: { data: CalcMethodology }) {
  const color = RELIABILITY_COLORS[data.reliability];
  const reliabilityLabel = RELIABILITY_LABELS[data.reliability];

  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Header --------------------------------------------------------- */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold leading-tight">{data.title}</h2>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{
                background: `${color}1A`,
                color,
                border: `1px solid ${color}40`,
              }}
            >
              {reliabilityLabel}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {data.year}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{data.pitch}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-xs">
          <Link
            href={`/outils/${data.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Voir l&apos;outil public <ExternalLink className="size-3" />
          </Link>
          <code className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 font-mono text-[10.5px] text-muted-foreground">
            <FileCode2 className="size-3" />
            {data.sourceFile}
          </code>
        </div>
      </header>

      {/* Note de fiabilité --------------------------------------------- */}
      <div
        className="mt-4 flex items-start gap-2 rounded-lg p-3 text-[12.5px] leading-relaxed"
        style={{
          background: `${color}10`,
          border: `1px solid ${color}30`,
        }}
      >
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0"
          style={{ color }}
        />
        <span className="text-foreground">
          <strong className="font-semibold">Statut « {reliabilityLabel} »</strong> —{" "}
          {data.reliabilityNote}
        </span>
      </div>

      {/* Inputs --------------------------------------------------------- */}
      <section className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <ListChecks className="size-3.5" />
          Ce que demande l&apos;outil
        </h3>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {data.inputs.map((inp, i) => (
            <li
              key={i}
              className="rounded-md bg-muted/40 px-3 py-1.5 text-[12.5px] text-foreground"
            >
              {inp}
            </li>
          ))}
        </ul>
      </section>

      {/* Formules ------------------------------------------------------- */}
      <section className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Formules appliquées
        </h3>
        <ol className="flex flex-col gap-2 border-l-2 border-border pl-3">
          {data.formulas.map((f, i) => (
            <li key={i} className="text-[13px]">
              <div className="font-semibold text-foreground">{f.label}</div>
              <code className="block whitespace-pre-wrap break-words rounded bg-muted px-2 py-1.5 font-mono text-[12px] text-foreground/90">
                {f.expression}
              </code>
            </li>
          ))}
        </ol>
      </section>

      {/* Constantes (table) -------------------------------------------- */}
      <section className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Constantes &amp; barèmes
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-muted/60 text-left">
                <th className="px-3 py-2 font-semibold">Constante</th>
                <th className="px-3 py-2 font-semibold">Valeur</th>
                <th className="px-3 py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.constants.map((c, i) => (
                <tr
                  key={i}
                  className="border-t border-border odd:bg-background even:bg-muted/20"
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    {c.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-foreground/90">
                    {c.value}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sources -------------------------------------------------------- */}
      <section className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Sources officielles
        </h3>
        <ul className="flex flex-col gap-1.5">
          {data.sources.map((s, i) => (
            <li key={i}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12.5px] text-primary hover:underline"
              >
                {s.name}
                <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Limitations (collapsed) --------------------------------------- */}
      <details className="mt-5 rounded-lg border border-amber-300/30 bg-amber-50/30 dark:border-amber-500/30 dark:bg-amber-950/20">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[12.5px] font-semibold text-amber-900 hover:bg-amber-100/40 dark:text-amber-200 dark:hover:bg-amber-900/20">
          <Info className="size-3.5" />
          Ce que le calcul ne fait PAS ({data.limitations.length} points)
        </summary>
        <ul className="border-t border-amber-300/30 px-4 py-3 text-[12.5px] text-amber-900/90 dark:border-amber-500/30 dark:text-amber-100/80">
          {data.limitations.map((l, i) => (
            <li key={i} className="flex gap-2 py-0.5">
              <span className="select-none">·</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
