import { isValidInternationalIBAN } from "./validators";

// Le paquet est CommonJS et ne publie pas de types. La donnée est embarquée
// dans le bundle client : aucun IBAN ne quitte le navigateur.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ibanToBic } = require("iban-to-bic") as {
  ibanToBic: (iban: string) => string | undefined;
};

const LOCAL_BIC_COUNTRIES = new Set(["AT", "BE", "DE", "ES", "FR", "LU", "NL"]);
const BIC_PATTERN = /^[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/;

// Correctifs ciblés pour des couples banque + agence absents du référentiel
// embarqué. En France, le code guichet peut distinguer une agence et son BIC.
const LOCAL_BIC_OVERRIDES: Record<string, string> = {
  // Banque de France, agence de Sélestat (code banque 30001, guichet 00794).
  FR3000100794: "BDFEFRPPCCT",
};

/**
 * Propose un BIC pour les IBAN étrangers couverts par la table locale.
 *
 * Les BIC belges ne sont jamais nécessaires dans le C1 et les pays non
 * couverts conservent une saisie manuelle. `null` signifie simplement
 * qu'aucune proposition fiable n'est disponible.
 */
export function bicFromForeignIban(raw: string): string | null {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  const country = iban.slice(0, 2);

  if (
    country === "BE" ||
    !LOCAL_BIC_COUNTRIES.has(country) ||
    !isValidInternationalIBAN(iban)
  ) {
    return null;
  }

  const localKey = country === "FR" ? `${country}${iban.slice(4, 14)}` : "";
  const bic = LOCAL_BIC_OVERRIDES[localKey] ?? ibanToBic(iban);
  return typeof bic === "string" && BIC_PATTERN.test(bic) ? bic : null;
}
