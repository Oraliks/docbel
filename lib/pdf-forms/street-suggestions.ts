/// Une ligne brute de `/api/lookup/search?tableSlug=code-rue` (cf.
/// app/api/lookup/search/route.ts) — shape minimale utilisée ici.
export interface RawLookupResult {
  id: string;
  labelFr: string;
  metadata: Record<string, string> | null;
}

export interface StreetSuggestion {
  id: string;
  street: string;
  postalCode: string;
  commune: string;
}

/// Extrait les suggestions de rue exploitables (rue + code postal + commune
/// tous présents) depuis la réponse brute de l'API de recherche générique.
/// Une entrée BeStAddress sans ces 3 infos ne peut pas servir à pré-remplir
/// le formulaire — on l'ignore plutôt que d'afficher une suggestion creuse.
export function parseStreetSuggestions(rawResults: RawLookupResult[]): StreetSuggestion[] {
  const out: StreetSuggestion[] = [];
  for (const r of rawResults) {
    const postalCode = r.metadata?.["Code postal"];
    const commune = r.metadata?.["Commune"];
    if (!r.labelFr || !postalCode || !commune) continue;
    out.push({ id: r.id, street: r.labelFr, postalCode, commune });
  }
  return out;
}

/// Fait remonter en tête les suggestions dont le code postal correspond à
/// celui déjà saisi par l'utilisateur — SANS jamais en retirer aucune (tri
/// stable par partition, pas un filtre) : si l'utilisateur a fait une faute
/// de frappe sur le code postal, ou visait une autre commune, les autres
/// rues restent visibles et sélectionnables plus bas dans la liste.
export function prioritizeByPostalCode(
  suggestions: StreetSuggestion[],
  postalCode: string | undefined
): StreetSuggestion[] {
  if (!postalCode) return suggestions;
  const matching = suggestions.filter((s) => s.postalCode === postalCode);
  const rest = suggestions.filter((s) => s.postalCode !== postalCode);
  return [...matching, ...rest];
}
