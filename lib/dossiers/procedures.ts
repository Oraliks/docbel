// Helpers pour les procédures opérationnelles d'un dossier.
//
// Une procédure décrit comment introduire la demande pour une nature de DA
// donnée (formulaires, délais, étapes, codes ONEM référencés). Visible
// admin/partenaires uniquement — jamais public.

import type {
  DossierDefinition,
  DossierProcedure,
  TheoryAudience,
} from "./types";

/// Filtre les procédures visibles pour une audience donnée. L'audience par
/// défaut est "admin" — un partenaire ne voit que les procédures qui
/// incluent explicitement "partner" dans `audience`.
export function visibleProcedures(
  def: DossierDefinition,
  audience: TheoryAudience
): DossierProcedure[] {
  if (!def.procedures) return [];
  return def.procedures
    .filter((p) => p.audience.includes(audience))
    .slice()
    .sort((a, b) => a.natureDA.localeCompare(b.natureDA));
}

/// Récupère une procédure par son id.
export function findProcedure(
  def: DossierDefinition,
  procedureId: string
): DossierProcedure | undefined {
  return def.procedures?.find((p) => p.id === procedureId);
}

/// Construit l'URL de deep-link vers une entrée du lookup ONEM. Si `code`
/// est fourni, on l'envoie en query string ; sinon on ouvre la table entière.
export function lookupUrl(tableSlug: string, code?: string): string {
  const base = `/outils/lookup-onem/${tableSlug}`;
  return code ? `${base}?code=${encodeURIComponent(code)}` : base;
}
