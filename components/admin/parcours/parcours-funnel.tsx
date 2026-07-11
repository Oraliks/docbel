import { FileText } from "lucide-react";
import {
  stageConversions,
  type ParcoursPhase,
  type ParcoursStage,
} from "@/lib/admin/parcours-funnel-core";

const nf = new Intl.NumberFormat("fr-BE");

const PHASE: Record<ParcoursPhase, { bar: string; dot: string; label: string }> = {
  orientation: { bar: "bg-primary", dot: "bg-primary", label: "Orientation" },
  dossier: {
    bar: "bg-indigo-500",
    dot: "bg-indigo-500",
    label: "Dossier",
  },
  documents: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    label: "Documents",
  },
};

/**
 * Funnel « Parcours » unifié : recherche → orientation → dossier → documents,
 * en une seule séquence colorée par phase, avec le taux de conversion entre
 * chaque étape. Présentational (les comptes viennent de `getParcoursFunnel`).
 */
export function ParcoursFunnel({
  stages,
  totalPdfGenerated,
}: {
  stages: ParcoursStage[];
  totalPdfGenerated: number;
}) {
  const conversions = stageConversions(stages);
  const max = Math.max(...stages.map((s) => s.count), 1);
  const empty = stages.every((s) => s.count === 0);
  const first = stages[0]?.count ?? 0;
  const last = stages[stages.length - 1]?.count ?? 0;
  const overall = first > 0 ? Math.round((last / first) * 100) : null;

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Funnel du parcours</h2>
          <p className="text-xs text-muted-foreground">
            De la recherche à la récupération des documents.
          </p>
        </div>
        {overall !== null && !empty && (
          <div className="text-right">
            <div className="font-mono text-xl font-semibold tabular-nums text-primary">
              {overall} %
            </div>
            <div className="text-[11px] text-muted-foreground">
              recherche → documents
            </div>
          </div>
        )}
      </div>

      {/* Légende des phases */}
      <div className="mb-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        {(Object.keys(PHASE) as ParcoursPhase[]).map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${PHASE[p].dot}`} />
            {PHASE[p].label}
          </span>
        ))}
      </div>

      {empty ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun événement sur la période. Les données se remplissent au fil de
          l&apos;usage réel de /mon-dossier.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {stages.map((stage, i) => (
            <div key={stage.key}>
              {i > 0 && (
                <div className="py-1 pl-0.5 text-[11px] tabular-nums text-muted-foreground">
                  ↓{" "}
                  {conversions[i - 1] === null
                    ? "—"
                    : `${conversions[i - 1]} %`}
                </div>
              )}
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-sm">{stage.label}</span>
                <span className="font-mono text-sm font-medium tabular-nums">
                  {nf.format(stage.count)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-sm bg-muted">
                <div
                  className={`h-full rounded-sm ${PHASE[stage.phase].bar}`}
                  style={{ width: `${Math.max((stage.count / max) * 100, 1.5)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contexte : volume PDF total (hors funnel car non attribuable à un run). */}
      <div className="mt-5 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <FileText className="size-3.5" />
        <span>
          {nf.format(totalPdfGenerated)} document(s) PDF générés sur la période
          (tous formulaires confondus).
        </span>
      </div>
    </section>
  );
}
