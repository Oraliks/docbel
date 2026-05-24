import Link from "next/link";
import {
  ExternalLink,
  FileCode2,
  AlertTriangle,
  ListChecks,
  Info,
  Sparkles,
  Wrench,
  Calendar,
  FileText,
  Image as ImageIcon,
  Link2,
} from "lucide-react";
import {
  type CalcMethodology,
  RELIABILITY_LABELS,
  RELIABILITY_COLORS,
  getLastUpdatedAt,
  isReviewOverdue,
} from "@/lib/calculators/_methodology";
import { type CalculatorAsset } from "./assets-manager";

/**
 * Carte de méthodologie pour un calculateur.
 *
 * Server component pur — pas de state, pas d'interactivité (les détails se
 * replient via <details>/<summary> natifs). Conçu pour la page
 * /admin/chomage/outils/calculateurs/[slug] : l'admin (expert métier) peut
 * vérifier d'un coup d'œil chaque chiffre et chaque hypothèse, et savoir
 * où / quand mettre à jour.
 */
export function MethodologyCard({
  data,
  assets,
}: {
  data: CalcMethodology;
  /**
   * Sources officielles attachées au calc via l'AssetsManager. Optionnel —
   * si présentes, elles s'affichent en complément de `data.sources`
   * (URLs hard-codées dans methodology) avec liens vers les PDFs uploadés.
   */
  assets?: CalculatorAsset[];
}) {
  const color = RELIABILITY_COLORS[data.reliability];
  const reliabilityLabel = RELIABILITY_LABELS[data.reliability];
  const lastUpdated = getLastUpdatedAt(data);
  const overdue = isReviewOverdue(data);

  // Format date FR-BE.
  const formattedDate = new Date(lastUpdated).toLocaleDateString("fr-BE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

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
            {(data.badges ?? []).map((b) => (
              <span
                key={b}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
              >
                {b}
              </span>
            ))}
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

      {/* Alerte révision annuelle (si overdue) -------------------------- */}
      {overdue ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-300/40 bg-red-50/50 p-3 text-[12.5px] text-red-900 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">Révision annuelle due.</strong>{" "}
            La dernière mise à jour date du {formattedDate} (plus de 12 mois).
            Vérifie les sources officielles (SPF Finances, Securex, etc.) pour
            les éventuels nouveaux barèmes.
          </span>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
          <Calendar className="size-3.5" />
          <span>
            Dernière mise à jour : <strong className="font-semibold text-foreground">{formattedDate}</strong>
          </span>
        </div>
      )}

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

      {/* Intro pédagogique -------------------------------------------- */}
      {data.pedagogyIntro ? (
        <section className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Comment ça marche
          </h3>
          <p className="text-[13px] leading-relaxed text-foreground/90">
            {renderMarkdownInline(data.pedagogyIntro)}
          </p>
        </section>
      ) : null}

      {/* Différenciateurs --------------------------------------------- */}
      {data.differentiators && data.differentiators.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3.5" />
            Ce que nous faisons mieux
          </h3>
          <ul className="flex flex-col gap-2">
            {data.differentiators.map((d, i) => (
              <li
                key={i}
                className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
              >
                <div className="text-[13px] font-semibold text-foreground">
                  {d.label}
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  {d.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      {/* Sources & PDFs attachés (via AssetsManager) ---------------- */}
      {assets && assets.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <FileText className="size-3.5" />
            PDFs & sources attachés ({assets.length})
          </h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {assets.map((a) => {
              const Icon =
                a.kind === "pdf"
                  ? FileText
                  : a.kind === "image"
                    ? ImageIcon
                    : Link2;
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                      >
                        <span className="truncate">{a.label}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                      {a.description ? (
                        <p className="text-[11.5px] text-muted-foreground">
                          {a.description}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        {a.year ? (
                          <span className="rounded bg-muted px-1.5 py-0.5">
                            {a.year}
                          </span>
                        ) : null}
                        {a.category ? (
                          <span className="rounded bg-muted px-1.5 py-0.5">
                            {a.category}
                          </span>
                        ) : null}
                        <span className="rounded bg-muted px-1.5 py-0.5 uppercase">
                          {a.kind}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Guide de maintenance annuelle -------------------------------- */}
      {data.maintenanceGuide && data.maintenanceGuide.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Wrench className="size-3.5" />
            Guide de maintenance annuelle
          </h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-muted/60 text-left">
                  <th className="px-3 py-2 font-semibold">Quoi surveiller</th>
                  <th className="px-3 py-2 font-semibold">Source</th>
                  <th className="px-3 py-2 font-semibold">Fréquence</th>
                  <th className="px-3 py-2 font-semibold">Où en code</th>
                </tr>
              </thead>
              <tbody>
                {data.maintenanceGuide.map((step, i) => (
                  <tr
                    key={i}
                    className="border-t border-border odd:bg-background even:bg-muted/20"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      {step.trigger}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={step.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {step.source}
                        <ExternalLink className="size-2.5" />
                      </a>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {step.frequency}
                    </td>
                    <td className="px-3 py-2">
                      {step.codeLocation ? (
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                          {step.codeLocation}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

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

/**
 * Rendu très allégé de Markdown : convertit `**bold**` en <strong> et garde
 * le reste tel quel. Pour le `pedagogyIntro` qui contient quelques bold mais
 * pas de syntaxe Markdown complète. Pas de protection XSS particulière car
 * la source est statique (sous git, écrite par nous).
 */
function renderMarkdownInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
