/// Filtre PUR des situations pour la recherche universelle du guichet
/// (/mon-dossier). Insensible à la casse et aux accents. Aucune dépendance
/// React/i18n : l'appelant construit `text` (label + description résolus).

export interface SituationSearchItem {
  value: string;
  text: string;
}

const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/// Renvoie les `value` des situations dont le texte contient la requête.
/// Requête vide/espaces → `[]` (le guichet montre alors la vue par défaut).
export function matchSituations(
  query: string,
  items: SituationSearchItem[],
): string[] {
  const q = normalize(query.trim());
  if (!q) return [];
  return items.filter((it) => normalize(it.text).includes(q)).map((it) => it.value);
}
