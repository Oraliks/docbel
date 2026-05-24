import Link from "next/link";
import { ArrowLeft, CalculatorIcon } from "lucide-react";
import { getMethodologies } from "@/lib/calculators/_methodology";
import { OverviewShell } from "@/components/admin/calculateurs/overview/overview-shell";

/**
 * Vue d'ensemble admin des méthodologies de calculateurs.
 *
 * Server component minimaliste : charge les methodologies depuis le code
 * (synchrone) et délègue tout l'UI à `<OverviewShell />` (client) qui
 * gère le filtrage par fiabilité et la recherche.
 *
 * Accessible depuis /admin/chomage/outils (parent) via le bouton
 * "Méthodologie" de chaque card calc_*. Aussi accessible directement
 * via cette URL pour un audit transversal.
 *
 * Le détail (formules, constantes, sources, limitations) vit dans
 * /admin/chomage/outils/calculateurs/[slug] — chaque card de l'overview
 * est cliquable vers cette page.
 *
 * Auth + role check : assurés par app/admin/layout.tsx.
 */
export const dynamic = "force-dynamic";

export default function CalculateursOverviewPage() {
  const methodologies = getMethodologies();

  return (
    <div className="flex flex-col gap-5 px-4 py-6 lg:px-6">
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
      <header className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalculatorIcon className="size-5" />
        </span>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold leading-tight">
            Méthodologie des calculateurs
          </h1>
          <p className="text-sm text-muted-foreground">
            {methodologies.length} calculateurs — accès aux formules,
            constantes et sources officielles.
          </p>
        </div>
      </header>

      {/* Stats + filtres + grille (client) --------------------------- */}
      <OverviewShell methodologies={methodologies} />
    </div>
  );
}
