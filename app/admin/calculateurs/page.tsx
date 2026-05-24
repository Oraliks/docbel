import { CalculatorIcon, FileCode2 } from "lucide-react";
import { getMethodologies, RELIABILITY_LABELS } from "@/lib/calculators/_methodology";
import { MethodologyCard } from "@/components/admin/calculateurs/methodology-card";

/**
 * Page admin : méthodologie des 9 calculateurs citoyens.
 *
 * But : permettre à l'admin (et notamment à un expert métier comme Oraliks
 * sur le volet chômage) de vérifier d'un coup d'œil chaque chiffre, chaque
 * formule et chaque source utilisée par les calcs publics sous /outils/*.
 *
 * Le contenu vient de `lib/calculators/_methodology.ts` qui importe les
 * constantes exportées par les fichiers calc (sync par construction pour ce
 * qui est exporté). Les autres chiffres sont redéclarés avec mention "SYNC".
 *
 * Côté layout : le wrap admin (auth + role check) est fait par
 * app/admin/layout.tsx. Cette page est donc déjà protégée.
 */
export const dynamic = "force-dynamic";

export default function CalculateursPage() {
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
      {/* En-tête -------------------------------------------------------- */}
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
              {methodologies.length} calculateurs citoyens — vérifie ici chaque
              formule, chaque chiffre et chaque source.
            </p>
          </div>
        </div>

        {/* Barre de stats fiabilité ----------------------------------- */}
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

        {/* Mode d'emploi ---------------------------------------------- */}
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
              Modifications uniquement si nouvelle indexation.
            </li>
            <li>
              <strong className="font-semibold text-foreground">
                Statut « {RELIABILITY_LABELS.medium} »
              </strong>{" "}
              : formule correcte mais simplifications volontaires (taux
              moyens, barème allégé). Disclaimer suffit côté public.
            </li>
            <li>
              <strong className="font-semibold text-foreground">
                Statut « {RELIABILITY_LABELS.low} »
              </strong>{" "}
              : à auditer en priorité. Les chiffres peuvent être obsolètes
              ou approximatifs au point d&apos;induire en erreur.
            </li>
            <li>
              Pour corriger une valeur : ouvre le fichier .ts indiqué dans la
              carte, modifie la constante, puis mets aussi à jour{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11.5px]">
                lib/calculators/_methodology.ts
              </code>
              .
            </li>
          </ul>
        </div>
      </header>

      {/* Cartes ---------------------------------------------------------- */}
      <div className="flex flex-col gap-6">
        {methodologies.map((m) => (
          <MethodologyCard key={m.slug} data={m} />
        ))}
      </div>
    </div>
  );
}
