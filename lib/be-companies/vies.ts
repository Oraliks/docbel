/// Client VIES (VAT Information Exchange System, Commission européenne).
/// Endpoint REST officiel — pas d'authentification, gratuit.
/// Documentation : https://ec.europa.eu/taxation_customs/vies/
///
/// Pour la Belgique : renvoie aussi `traderName` et `traderAddress`.
/// L'Allemagne et l'Espagne ne partagent PAS ces champs.

const VIES_ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";

export interface ViesResult {
  countryCode: string;
  vatNumber: string;
  valid: boolean;
  /// Nom de la société (BE uniquement). Vide si non partagé.
  name: string;
  /// Adresse brute multi-ligne (BE uniquement).
  address: string;
  /// Adresse découpée si parseable.
  parsedAddress?: {
    street?: string;
    houseNumber?: string;
    zipcode?: string;
    city?: string;
  };
  /// Horodatage de la réponse VIES.
  requestDate?: string;
}

const COUNTRY_PATTERN = /^[A-Z]{2}$/;

/// Nettoyage : majuscules, suppression des espaces, points, tirets.
export function normalizeVatInput(country: string, vatNumber: string): { country: string; vat: string } | null {
  const c = country.trim().toUpperCase();
  if (!COUNTRY_PATTERN.test(c)) return null;
  const v = vatNumber.replace(/[\s.\-]/g, "").toUpperCase();
  // Tolère "BE0123456789" → strip le préfixe pays.
  const stripped = v.startsWith(c) ? v.slice(2) : v;
  if (!/^\d{4,15}$/.test(stripped)) return null;
  return { country: c, vat: stripped };
}

/// Tentative naïve de découpage d'adresse VIES belge :
///   "Rue de la Loi 16\n1000 Bruxelles\nBelgique"
/// → { street: "Rue de la Loi", houseNumber: "16", zipcode: "1000", city: "Bruxelles" }
export function parseBelgianAddress(raw: string): ViesResult["parsedAddress"] {
  if (!raw) return undefined;
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return undefined;

  const streetLine = lines[0];
  const cityLine = lines[1];

  const streetMatch = streetLine.match(/^(.*?)\s+(\d+\w*)\s*$/);
  const cityMatch = cityLine.match(/^(\d{4})\s+(.+)$/);

  return {
    street: streetMatch?.[1]?.trim() || streetLine,
    houseNumber: streetMatch?.[2]?.trim(),
    zipcode: cityMatch?.[1],
    city: cityMatch?.[2]?.trim(),
  };
}

interface ViesRawResponse {
  countryCode?: string;
  vatNumber?: string;
  valid?: boolean;
  name?: string;
  address?: string;
  requestDate?: string;
  userError?: string;
}

/// Appelle l'API VIES REST avec timeout. Renvoie un résultat normalisé.
/// Lève une erreur en cas de 4xx/5xx ou de timeout.
export async function checkVat(country: string, vatNumber: string, timeoutMs = 8_000): Promise<ViesResult> {
  const normalized = normalizeVatInput(country, vatNumber);
  if (!normalized) throw new Error("Numéro de TVA mal formé");

  const url = `${VIES_ENDPOINT}/${normalized.country}/${normalized.vat}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
  } catch (err) {
    throw new Error(err instanceof Error && err.name === "AbortError" ? "VIES timeout" : "VIES injoignable");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`VIES HTTP ${res.status}`);

  const data = (await res.json()) as ViesRawResponse;
  if (data.userError && data.userError !== "VALID") {
    throw new Error(`VIES: ${data.userError}`);
  }

  const name = (data.name || "").trim();
  const address = (data.address || "").trim();
  const result: ViesResult = {
    countryCode: data.countryCode ?? normalized.country,
    vatNumber: data.vatNumber ?? normalized.vat,
    valid: data.valid === true,
    name: name && name !== "---" ? name : "",
    address: address && address !== "---" ? address : "",
    requestDate: data.requestDate,
  };
  if (normalized.country === "BE" && result.address) {
    result.parsedAddress = parseBelgianAddress(result.address);
  }
  return result;
}
