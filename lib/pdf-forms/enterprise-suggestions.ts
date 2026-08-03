/// Suggestions d'autocomplete d'entreprise — parsing/formatage PURS, aucun
/// accès DB (cf. lib/be-companies/kbo-lookup.ts pour la requête elle-même).
/// Consommé par la route /api/lookup/entreprise ET par le composant client
/// (via le type EnterpriseSuggestion).

import type { KboLookupResult } from "@/lib/be-companies/kbo-lookup";

export interface EnterpriseSuggestion {
  bceNumber: string;
  name: string;
  /// Adresse du SIÈGE SOCIAL, composée en une ligne (le champ PDF cible est
  /// du texte libre). Chaîne vide si l'entreprise n'a pas d'adresse
  /// exploitable dans le mirroir — jamais une adresse partielle trompeuse.
  address: string;
}

/// Compose l'adresse du siège social en une ligne unique ("Rue Gheude 56,
/// 1070 Anderlecht"). Le mirroir KBO ne porte que l'adresse REGO (siège
/// social) — pas les unités d'établissement (cf. kbo-lookup.ts,
/// ENTERPRISE_INCLUDE). L'écart avec le lieu de travail réel, pour un
/// employeur multi-sites, est assumé et dit à l'écran (aide de champ, cf.
/// seeds c1a/c1b).
export function formatEnterpriseAddress(
  office: KboLookupResult["registeredOffice"],
): string {
  if (!office?.street || !office.zipcode || !office.city) return "";
  const numero = [office.houseNumber, office.box ? `boîte ${office.box}` : null]
    .filter(Boolean)
    .join(", ");
  const ligne1 = numero ? `${office.street} ${numero}` : office.street;
  return `${ligne1}, ${office.zipcode} ${office.city}`;
}

/// Transforme les résultats bruts du lookup KBO en suggestions affichables.
/// Une entreprise sans dénomination exploitable (données incomplètes dans le
/// mirroir) est ignorée plutôt que montrée avec un nom vide.
export function parseEnterpriseSuggestions(
  results: KboLookupResult[],
): EnterpriseSuggestion[] {
  const out: EnterpriseSuggestion[] = [];
  for (const r of results) {
    const name = r.names.fr || r.names.default;
    if (!name) continue;
    out.push({
      bceNumber: r.enterpriseNumber,
      name,
      address: formatEnterpriseAddress(r.registeredOffice),
    });
  }
  return out;
}
