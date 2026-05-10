import { isValidBelgianBCE } from "./validators";

/// Données structurées d'une entreprise belge récupérée via la BCE.
/// Champs nullables car certaines entreprises ont des infos partielles.
export interface BCELookupResult {
  bce: string; // 0XXX.XXX.XXX (formaté)
  rawNumber: string; // 10 chiffres bruts
  name: string;
  shortName?: string | null;
  legalForm?: string | null;
  status?: "active" | "stopped" | "unknown";
  street?: string | null;
  streetNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  startDate?: string | null; // ISO date
  // Source utilisée pour la lookup (utile pour debug + transparence)
  source: "kbopub" | "cache" | "manual" | "unavailable";
}

/// Normalise un numéro BCE en 10 chiffres bruts.
export function normalizeBCE(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, 10);
}

/// Formate un BCE en 0XXX.XXX.XXX
export function formatBCE(raw: string): string {
  const digits = normalizeBCE(raw);
  if (digits.length !== 10) return raw;
  return `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7, 10)}`;
}

/// Lookup d'une entreprise par numéro BCE.
///
/// Sources tentées dans l'ordre :
/// 1. Cache local (à implémenter via une table BCEEntry quand le besoin sera là)
/// 2. KBO Public (HTML scraping — fragile mais gratuit)
/// 3. Échec → retourne `source: "unavailable"` avec champs vides
///
/// Note : aucune API JSON publique gratuite officielle. Pour de gros volumes,
/// envisager le téléchargement Open Data BCE (CSV) puis lookup local.
export async function lookupBCE(rawNumber: string): Promise<BCELookupResult> {
  const digits = normalizeBCE(rawNumber);

  if (!isValidBelgianBCE(digits)) {
    throw new Error("Numéro BCE invalide");
  }

  const formatted = formatBCE(digits);

  // 1. KBO public scraping (fragile — accepte que ça échoue silencieusement)
  try {
    const result = await scrapeKboPublic(digits);
    if (result && result.name) {
      return {
        ...result,
        name: result.name,
        bce: formatted,
        rawNumber: digits,
        source: "kbopub",
      };
    }
  } catch {
    // Silencieux : on tombe sur le fallback
  }

  return {
    bce: formatted,
    rawNumber: digits,
    name: "",
    source: "unavailable",
  };
}

/// Scrape la page publique KBO. Très fragile : si Bisnode change le HTML, ça casse.
/// Idéalement à remplacer par un dataset Open Data BCE en local.
async function scrapeKboPublic(digits: string): Promise<Partial<BCELookupResult> | null> {
  const url = `https://kbopub.economie.fgov.be/kbopub/toonondernemingps.html?lang=fr&ondernemingsnummer=${digits}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 BeldocBCELookup/1.0",
      Accept: "text/html",
    },
    // Timeout court pour ne pas bloquer le formulaire
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return null;
  const html = await res.text();

  // Extraction minimale — KBO utilise des labels en clair dans des <td>
  // Pattern : <td>Label</td><td>...valeur...</td>
  function extract(label: string): string | null {
    const re = new RegExp(
      `<td[^>]*>\\s*${label}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
      "i"
    );
    const m = html.match(re);
    if (!m) return null;
    // Strip HTML tags + trim
    return m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null;
  }

  const name = extract("Dénomination") || extract("Dénomination:");
  if (!name) return null; // Pas de nom = pas trouvé

  const status = html.toLowerCase().includes("entreprise active")
    ? ("active" as const)
    : html.toLowerCase().includes("radié") || html.toLowerCase().includes("stopped")
      ? ("stopped" as const)
      : ("unknown" as const);

  const legalForm = extract("Forme légale") || extract("Forme légale:");
  const addressRaw = extract("Adresse du siège social") || extract("Adresse:");

  // Parse "Rue X, 12, 1000 Bruxelles" → street/number/postalCode/city
  const parsed = parseBelgianAddress(addressRaw);

  return {
    name,
    legalForm,
    status,
    ...parsed,
    country: "BE",
  };
}

interface ParsedAddress {
  street?: string | null;
  streetNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
}

function parseBelgianAddress(raw: string | null): ParsedAddress {
  if (!raw) return {};
  // Patterns tolérants : "Rue ABC 12, 1000 Bruxelles" / "Rue ABC, 12, 1000 Bruxelles"
  const m = raw.match(/^(.+?)[,\s]+(\d+\s*[a-zA-Z]?)\s*[,\s]+(\d{4})\s+(.+)$/);
  if (!m) {
    // Fallback : juste extraire le code postal + ville
    const cp = raw.match(/(\d{4})\s+([A-Za-zÀ-ÿ' \-]+)/);
    return {
      street: raw,
      postalCode: cp?.[1] ?? null,
      city: cp?.[2]?.trim() ?? null,
    };
  }
  return {
    street: m[1].trim(),
    streetNumber: m[2].trim(),
    postalCode: m[3],
    city: m[4].trim(),
  };
}
