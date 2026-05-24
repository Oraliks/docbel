import Link from "next/link";
import { ListChecks, Sparkles, ArrowRight, Info } from "lucide-react";
import type {
  MethodologyInputDetailed,
} from "@/lib/calculators/_methodology";
import { getSectionIcon } from "./_icons";

interface MethodologyInputsOutputsProps {
  /**
   * Inputs enrichis (label + description + icône). Si vide / absent, on
   * fallback sur `inputsSimple` (liste sans description).
   */
  inputs?: MethodologyInputDetailed[];
  /** Fallback : liste simple d'inputs (legacy `data.inputs`). */
  inputsSimple?: string[];
  /** Outputs (résultats) listés à droite. Optionnel. */
  outputs?: string[];
  /**
   * URL vers l'onglet "Formules" complet (pour le bouton "Voir le détail").
   * Si non fourni, le bouton est caché.
   */
  detailUrl?: string;
}

/**
 * Zone 2 colonnes "Ce que l'outil demande" :
 *   - Gauche : inputs enrichis (icône + label + description)
 *   - Droite : bloc accent lavande avec "Résultat" + outputs listés
 *   - Bas : bouton "Voir le détail complet" → onglet Formules
 *
 * Si `inputs` ET `inputsSimple` sont vides : section non rendue.
 * Si `outputs` vide : colonne droite remplacée par un placeholder discret.
 */
export function MethodologyInputsOutputs({
  inputs,
  inputsSimple,
  outputs,
  detailUrl,
}: MethodologyInputsOutputsProps) {
  const useDetailed = Array.isArray(inputs) && inputs.length > 0;
  const useSimple =
    !useDetailed && Array.isArray(inputsSimple) && inputsSimple.length > 0;

  if (!useDetailed && !useSimple) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <ListChecks className="size-3.5" />
        Ce que l&apos;outil demande
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Colonne gauche : inputs ----------------------------------- */}
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Inputs
          </div>
          {useDetailed ? (
            <ul className="flex flex-col gap-2">
              {inputs!.map((inp, i) => {
                const Icon = getSectionIcon(inp.icon) ?? Info;
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg border border-border bg-background/60 p-2.5"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13px] font-semibold text-foreground">
                        {inp.label}
                      </span>
                      <span className="text-[11.5px] leading-relaxed text-muted-foreground">
                        {inp.description}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {inputsSimple!.map((label, i) => (
                <li
                  key={i}
                  className="rounded-md bg-muted/40 px-3 py-1.5 text-[12.5px] text-foreground"
                >
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Colonne droite : outputs ---------------------------------- */}
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Résultat
          </div>
          {outputs && outputs.length > 0 ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-primary">
                <Sparkles className="size-3.5" />
                Ce que l&apos;outil renvoie
              </div>
              <ul className="flex flex-col gap-1 text-[12.5px] text-foreground">
                {outputs.map((out, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/70"
                    />
                    <span>{out}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-background/40 p-4 text-[12px] text-muted-foreground">
              Outputs non documentés
            </div>
          )}
        </div>
      </div>

      {detailUrl ? (
        <div className="mt-4 flex justify-end">
          <Link
            href={detailUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-muted"
          >
            Voir le détail complet
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
