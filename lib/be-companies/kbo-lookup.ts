/// Recherche d'une entreprise belge dans le miroir local KBO.
/// Utilisé par les routes admin pour l'autofill TVA/BCE des formulaires.

import { prisma } from "@/lib/prisma";
import { normalizeEnterpriseNumber } from "./kbo-csv-parser";

export interface KboLookupResult {
  enterpriseNumber: string;
  status: string | null;
  juridicalForm: string | null;
  startDate: Date | null;
  /// Dénomination principale (typeOfDenomination = "001" ou première trouvée).
  /// On renvoie une version par langue quand disponible.
  names: { fr?: string; nl?: string; de?: string; en?: string; default: string };
  /// Adresse du siège social (typeOfAddress = "REGO") si présente.
  registeredOffice?: {
    street?: string;
    houseNumber?: string;
    box?: string;
    zipcode?: string;
    city?: string;
    country?: string;
  };
  /// Code NACE principal (classification = "MAIN").
  mainNaceCode: string | null;
}

const LANG_KEY: Record<string, "fr" | "nl" | "de" | "en"> = {
  "1": "fr",
  "2": "nl",
  "3": "de",
  "4": "en",
};

export async function lookupByEnterpriseNumber(raw: string): Promise<KboLookupResult | null> {
  const num = normalizeEnterpriseNumber(raw);
  if (!num) return null;

  const enterprise = await prisma.kboEnterprise.findUnique({
    where: { enterpriseNumber: num },
    include: {
      denominations: true,
      addresses: true,
      activities: { where: { classification: "MAIN" }, take: 1 },
    },
  });
  if (!enterprise) return null;

  // Dénominations : on classe par type (001 = sociale prioritaire),
  // puis on renseigne `names` par langue avec la première disponible.
  const sorted = [...enterprise.denominations].sort((a, b) =>
    (a.typeOfDenomination ?? "999").localeCompare(b.typeOfDenomination ?? "999")
  );
  const names: KboLookupResult["names"] = { default: sorted[0]?.denomination ?? "" };
  for (const d of sorted) {
    const langKey = LANG_KEY[d.language ?? ""];
    if (langKey && !names[langKey]) names[langKey] = d.denomination;
  }

  const rego = enterprise.addresses.find((a) => a.typeOfAddress === "REGO") ?? enterprise.addresses[0];
  const registeredOffice = rego
    ? {
        street: rego.streetFR || rego.streetNL || undefined,
        houseNumber: rego.houseNumber || undefined,
        box: rego.box || undefined,
        zipcode: rego.zipcode || undefined,
        city: rego.municipalityFR || rego.municipalityNL || undefined,
        country: rego.countryFR || rego.countryNL || undefined,
      }
    : undefined;

  return {
    enterpriseNumber: enterprise.enterpriseNumber,
    status: enterprise.status,
    juridicalForm: enterprise.juridicalForm,
    startDate: enterprise.startDate,
    names,
    registeredOffice,
    mainNaceCode: enterprise.activities[0]?.naceCode ?? null,
  };
}

/// Recherche partielle par nom (préfixe). Utile pour l'autocomplete admin.
export async function searchByName(query: string, limit = 10): Promise<KboLookupResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const matches = await prisma.kboDenomination.findMany({
    where: { denomination: { startsWith: q, mode: "insensitive" } },
    distinct: ["enterpriseNumber"],
    take: limit,
    select: { enterpriseNumber: true },
  });
  const results = await Promise.all(matches.map((m) => lookupByEnterpriseNumber(m.enterpriseNumber)));
  return results.filter((r): r is KboLookupResult => r !== null);
}
