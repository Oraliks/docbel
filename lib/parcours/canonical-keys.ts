/**
 * Registre du vocabulaire de clés canoniques partagé entre orientation
 * (options d'arbre) et pré-qualification (questions d'éligibilité).
 *
 * ⚠️ STARTER À VALIDER par Oraliks (expertise chômage). Les seuils (ex. 21/25
 * ans selon les règles ONEM d'insertion) et les valeurs sont un point de
 * départ, pas une vérité figée. Ajouter une clé = éditer ce fichier.
 */

export interface CanonicalKeyDef {
  key: string;
  label: string;
  values: { value: string; label: string }[];
}

export const CANONICAL_KEYS: CanonicalKeyDef[] = [
  {
    key: "age_bracket",
    label: "Tranche d'âge",
    values: [
      { value: "under_25", label: "Moins de 25 ans" },
      { value: "25_plus", label: "25 ans ou plus" },
    ],
  },
  {
    key: "situation_familiale",
    label: "Situation familiale",
    values: [
      { value: "isole", label: "Isolé" },
      { value: "cohabitant", label: "Cohabitant" },
      { value: "chef_menage", label: "Chef de ménage" },
    ],
  },
  {
    key: "a_deja_travaille",
    label: "A déjà travaillé",
    values: [
      { value: "oui", label: "Oui" },
      { value: "non", label: "Non" },
    ],
  },
];

const BY_KEY = new Map(CANONICAL_KEYS.map((d) => [d.key, d]));

export function getCanonicalKey(key: string): CanonicalKeyDef | undefined {
  return BY_KEY.get(key);
}

export function canonicalValues(key: string): { value: string; label: string }[] {
  return BY_KEY.get(key)?.values ?? [];
}

export function isValidCanonicalPair(key: string, value: string): boolean {
  const def = BY_KEY.get(key);
  return !!def && def.values.some((v) => v.value === value);
}
