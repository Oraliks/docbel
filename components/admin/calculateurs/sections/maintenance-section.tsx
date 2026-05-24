import { ExternalLink, Wrench } from "lucide-react";
import type { MaintenanceStep } from "@/lib/calculators/_methodology";
import { ReviewBanner } from "@/components/admin/calculateurs/review-banner";

interface MethodologyMaintenanceSectionProps {
  /** Liste des étapes du guide annuel (data.maintenanceGuide). */
  guide?: MaintenanceStep[];
  /** Slug pour le ReviewBanner (POST /api/admin/calculators/[slug]/review). */
  slug: string;
  /** ISO de la dernière revue (col `lastReviewedAt`). */
  lastReviewedAt: string | null;
  /** ISO de la prochaine revue prévue. */
  nextReviewDue: string | null;
}

/**
 * Onglet "Maintenance" : banner de revue annuelle + table du guide.
 *
 * Le banner est interactif (client component existant) ; la table est
 * server-rendered.
 */
export function MethodologyMaintenanceSection({
  guide,
  slug,
  lastReviewedAt,
  nextReviewDue,
}: MethodologyMaintenanceSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <ReviewBanner
        slug={slug}
        lastReviewedAt={lastReviewedAt}
        nextReviewDue={nextReviewDue}
      />
      {guide && guide.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Wrench className="size-3.5" />
            Guide de maintenance annuelle ({guide.length} étapes)
          </h2>
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
                {guide.map((step, i) => (
                  <tr
                    key={i}
                    className="border-t border-border align-top odd:bg-background even:bg-muted/20"
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
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-[12.5px] text-muted-foreground">
          Pas de guide de maintenance documenté pour ce calculateur. À ajouter
          dans <code className="font-mono">lib/calculators/_methodology.ts</code>{" "}
          (champ <code className="font-mono">maintenanceGuide</code>).
        </section>
      )}
    </div>
  );
}
