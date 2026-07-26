/**
 * Vérification du numéro d'entreprise (BCE) d'un organisme candidat.
 *
 * Stratégie en cascade — jamais bloquante (principe « informatif jamais
 * bloquant ») : une vérification qui échoue n'empêche PAS la soumission,
 * elle informe simplement l'admin qui validera.
 *
 *   1. Checksum mod-97 local (instantané, hors-ligne)   → `checksum`
 *   2. VIES (API Commission européenne, gratuite, sans compte, opérationnelle
 *      aujourd'hui : renvoie nom + adresse pour la Belgique) → `vies`
 *   3. Miroir KBO local (`KboEnterprise`) — ⚠️ tables VIDES tant que
 *      l'ingestion KBO Open Data n'est pas activée (cf.
 *      docs/TODO-kbo-activation.md) : sert de complément, pas de source
 *      principale.                                        → `kbo`
 */
import "server-only";
import { parseEnterpriseNumber } from "./enterprise-number";
import { checkVat } from "@/lib/be-companies/vies";
import { lookupByEnterpriseNumber } from "@/lib/be-companies/kbo-lookup";

export interface OrgVerificationResult {
  /** true si le numéro est confirmé par une source externe (VIES ou KBO). */
  verified: boolean;
  /** Le checksum mod-97 est-il correct ? (validité de forme) */
  checksumValid: boolean;
  /** Source ayant confirmé, ou `none`. */
  source: "vies" | "kbo" | "none";
  /** Forme canonique 10 chiffres (null si non normalisable). */
  enterpriseNumber: string | null;
  /** Dénomination officielle si disponible. */
  legalName: string | null;
  /** Adresse officielle si disponible. */
  street: string | null;
  postalCode: string | null;
  city: string | null;
  /** Message court destiné à l'utilisateur (jamais bloquant). */
  message: string;
}

const EMPTY: Omit<OrgVerificationResult, "message"> = {
  verified: false,
  checksumValid: false,
  source: "none",
  enterpriseNumber: null,
  legalName: null,
  street: null,
  postalCode: null,
  city: null,
};

/**
 * Vérifie un numéro d'entreprise saisi librement. Ne lève jamais : toute
 * erreur réseau retombe sur un résultat « non vérifié ».
 */
export async function verifyEnterpriseNumber(raw: string): Promise<OrgVerificationResult> {
  const parsed = parseEnterpriseNumber(raw);

  if (!parsed.normalized) {
    return {
      ...EMPTY,
      message:
        parsed.reason === "empty"
          ? "Aucun numéro d'entreprise fourni."
          : "Le numéro doit comporter 10 chiffres (ex. 0123.456.789).",
    };
  }
  if (!parsed.ok) {
    return {
      ...EMPTY,
      enterpriseNumber: parsed.normalized,
      message:
        "Ce numéro ne semble pas valide (clé de contrôle incorrecte). Vérifiez la saisie.",
    };
  }

  const base = { ...EMPTY, checksumValid: true, enterpriseNumber: parsed.normalized };

  // 2. VIES — source externe opérationnelle aujourd'hui.
  try {
    const vies = await checkVat("BE", parsed.normalized);
    if (vies.valid) {
      const addr = vies.parsedAddress;
      return {
        ...base,
        verified: true,
        source: "vies",
        legalName: vies.name?.trim() || null,
        street: [addr?.street, addr?.houseNumber].filter(Boolean).join(" ") || null,
        postalCode: addr?.zipcode ?? null,
        city: addr?.city ?? null,
        message: vies.name
          ? `Entreprise confirmée : ${vies.name.trim()}.`
          : "Numéro d'entreprise confirmé.",
      };
    }
  } catch {
    // VIES indisponible → on continue, sans bloquer.
  }

  // 3. Miroir KBO local (vide tant que l'ETL n'est pas activé).
  try {
    const kbo = await lookupByEnterpriseNumber(parsed.normalized);
    if (kbo) {
      const office = kbo.registeredOffice;
      return {
        ...base,
        verified: true,
        source: "kbo",
        legalName: kbo.names.default || null,
        street: [office?.street, office?.houseNumber].filter(Boolean).join(" ") || null,
        postalCode: office?.zipcode ?? null,
        city: office?.city ?? null,
        message: `Entreprise trouvée : ${kbo.names.default}.`,
      };
    }
  } catch {
    // Miroir indisponible → on continue.
  }

  return {
    ...base,
    message:
      "Numéro au format valide, mais non confirmé automatiquement. Votre demande sera vérifiée manuellement.",
  };
}
