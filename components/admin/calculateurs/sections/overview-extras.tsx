import { Info, Sparkles, AlertTriangle } from "lucide-react";
import type {
  CalcMethodology,
  MethodologyDifferentiator,
} from "@/lib/calculators/_methodology";

interface OverviewExtrasProps {
  pedagogyIntro?: CalcMethodology["pedagogyIntro"];
  differentiators?: MethodologyDifferentiator[];
  limitations?: string[];
}

/**
 * Petites cards optionnelles affichées sous Formules sur l'onglet Aperçu :
 *   - "Comment ça marche" (pedagogyIntro)
 *   - "Ce que nous faisons mieux" (differentiators)
 *   - "Ce que le calcul ne fait PAS" (limitations) — collapsed
 *
 * Chacune est conditionnelle (skip si data absente).
 */
export function OverviewExtras({
  pedagogyIntro,
  differentiators,
  limitations,
}: OverviewExtrasProps) {
  const hasPedagogy = !!pedagogyIntro && pedagogyIntro.trim().length > 0;
  const hasDiff = Array.isArray(differentiators) && differentiators.length > 0;
  const hasLimits = Array.isArray(limitations) && limitations.length > 0;

  if (!hasPedagogy && !hasDiff && !hasLimits) return null;

  return (
    <>
      {hasPedagogy ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Info className="size-3.5" />
            Comment ça marche
          </h2>
          <p className="text-[13px] leading-relaxed text-foreground/90">
            {renderInlineMarkdown(pedagogyIntro!)}
          </p>
        </section>
      ) : null}

      {hasDiff ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3.5" />
            Ce que nous faisons mieux
          </h2>
          <ul className="flex flex-col gap-2">
            {differentiators!.map((d, i) => (
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

      {hasLimits ? (
        <details className="rounded-2xl border border-amber-300/40 bg-amber-50/30 dark:border-amber-500/30 dark:bg-amber-950/20">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[12.5px] font-semibold text-amber-900 hover:bg-amber-100/40 dark:text-amber-200 dark:hover:bg-amber-900/20">
            <AlertTriangle className="size-3.5" />
            Ce que le calcul ne fait PAS ({limitations!.length} points)
          </summary>
          <ul className="border-t border-amber-300/30 px-5 py-3 text-[12.5px] text-amber-900/90 dark:border-amber-500/30 dark:text-amber-100/80">
            {limitations!.map((l, i) => (
              <li key={i} className="flex gap-2 py-0.5">
                <span aria-hidden className="select-none">·</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode {
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
