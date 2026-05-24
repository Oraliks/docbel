import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { MethodologyFormula } from "@/lib/calculators/_methodology";

interface MethodologyFormulasTableProps {
  formulas: MethodologyFormula[];
  /**
   * Si fourni : affiche les N premières formules + bouton "Voir toutes".
   * Si non fourni : affiche TOUTES les formules (mode onglet complet).
   */
  limit?: number;
  /** URL vers l'onglet "Formules" complet. Affiché si `limit` est défini. */
  fullUrl?: string;
  /** Titre de la section. Défaut : "Formules clés" si limit, "Formules" sinon. */
  title?: string;
}

/**
 * Table 2 colonnes : Formule (label) | Expression (code).
 *
 * Avec `limit` : aperçu condensé (utilisé dans l'onglet "Aperçu").
 * Sans `limit` : version complète (utilisé dans l'onglet "Formules").
 */
export function MethodologyFormulasTable({
  formulas,
  limit,
  fullUrl,
  title,
}: MethodologyFormulasTableProps) {
  if (!formulas || formulas.length === 0) return null;

  const isPreview = typeof limit === "number" && formulas.length > limit;
  const visible = isPreview ? formulas.slice(0, limit) : formulas;
  const heading =
    title ?? (isPreview ? "Formules clés (aperçu)" : "Formules appliquées");

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {heading}
      </h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-muted/60 text-left">
              <th className="w-2/5 px-3 py-2 font-semibold">Formule</th>
              <th className="px-3 py-2 font-semibold">Expression</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((f, i) => (
              <tr
                key={i}
                className="border-t border-border align-top odd:bg-background even:bg-muted/20"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {f.label}
                </td>
                <td className="px-3 py-2">
                  <code className="block whitespace-pre-wrap break-words rounded bg-muted px-2 py-1 font-mono text-[11.5px] text-foreground/90">
                    {f.expression}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isPreview && fullUrl ? (
        <div className="mt-3 flex justify-end">
          <Link
            href={fullUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-muted"
          >
            Voir toutes les formules ({formulas.length})
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
