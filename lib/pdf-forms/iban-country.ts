/// Noms de pays pour les préfixes IBAN reconnus par `isValidInternationalIBAN`
/// (lib/pdf-forms/validators.ts) — même liste de 31 pays, ISO 3166 (données
/// stables, pas un registre bancaire arbitraire). Volontairement PAS de table
/// code-banque → BIC : contrairement au pays, un mauvais code banque
/// enverrait un paiement au mauvais endroit — aucune source fiable
/// disponible ici pour le garantir, donc le BIC reste une saisie manuelle
/// (aidée par son propre texte d'aide).
const COUNTRY_NAMES: Record<string, string> = {
  AT: "Autriche", BE: "Belgique", BG: "Bulgarie", CH: "Suisse", CY: "Chypre",
  CZ: "Tchéquie", DE: "Allemagne", DK: "Danemark", EE: "Estonie", ES: "Espagne",
  FI: "Finlande", FR: "France", GB: "Royaume-Uni", GR: "Grèce", HR: "Croatie",
  HU: "Hongrie", IE: "Irlande", IT: "Italie", LT: "Lituanie", LU: "Luxembourg",
  LV: "Lettonie", MC: "Monaco", MT: "Malte", NL: "Pays-Bas", NO: "Norvège",
  PL: "Pologne", PT: "Portugal", RO: "Roumanie", SE: "Suède", SI: "Slovénie",
  SK: "Slovaquie",
};

/// Renvoie le nom du pays depuis le préfixe à 2 lettres d'un IBAN (ex. "FR76..."
/// → "France"), ou `null` si le préfixe n'est pas reconnu ou l'IBAN trop court.
export function countryNameFromIban(raw: string): string | null {
  const prefix = raw.replace(/\s+/g, "").slice(0, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(prefix)) return null;
  return COUNTRY_NAMES[prefix] ?? null;
}
