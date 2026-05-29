import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Autocomplete d'adresses **belges uniquement** (via Nominatim).
 *
 * On limite avec `countrycodes=be` côté Nominatim et on filtre encore
 * côté serveur (par sécurité) pour ne renvoyer que des adresses BE.
 * Cache mémoire 30 min — Nominatim demande 1 req/s max.
 *
 * Input  : ?q=adresse (au moins 4 chars)
 * Output : { items: AddressSuggestion[] }
 */

type CacheEntry = { value: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000;

function cacheGet(key: string): unknown | null {
  const e = cache.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return e.value;
}

function cacheSet(key: string, value: unknown) {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  if (cache.size > 300) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

export type AddressSuggestion = {
  label: string; // "Rue Haute 298, 1000 Bruxelles"
  street?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  lat: number;
  lng: number;
};

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  county?: string;
  country_code?: string;
};

type NominatimItem = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
};

export async function GET(req: NextRequest) {
  // Rate-limit anti-abus du proxy Nominatim : 30 req / min / IP
  const ip = getClientIp(req);
  const rl = checkRateLimit(`geocode-suggest:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429, headers: jsonHeaders }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 4) {
    return NextResponse.json({ items: [] }, { headers: jsonHeaders });
  }

  const key = `s:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached !== null) {
    return NextResponse.json(
      { cached: true, items: cached },
      { headers: jsonHeaders }
    );
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=be&limit=6&q=${encodeURIComponent(q)}`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "DocBel/1.0 (bureau locator)",
        "Accept-Language": "fr,nl,en",
      },
      next: { revalidate: 1800 },
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `Nominatim ${r.status}`, items: [] },
        { status: 502, headers: jsonHeaders }
      );
    }
    const raw: unknown = await r.json();
    const items: AddressSuggestion[] = Array.isArray(raw)
      ? (raw as NominatimItem[])
          .filter((x) => x && x.address && (!x.address.country_code || x.address.country_code === "be"))
          .map((x): AddressSuggestion | null => {
            const a = x.address!;
            const city = a.city || a.town || a.village || a.municipality || a.suburb || a.county || "";
            const street = a.road || a.pedestrian || a.footway || a.path || "";
            const houseNumber = a.house_number || "";
            const postcode = a.postcode || "";
            const parts: string[] = [];
            if (street) parts.push(houseNumber ? `${street} ${houseNumber}` : street);
            const cityLine = [postcode, city].filter(Boolean).join(" ");
            if (cityLine) parts.push(cityLine);
            const label =
              parts.length > 0
                ? parts.join(", ")
                : (x.display_name?.split(",").slice(0, 3).join(",") ?? "");
            if (!label || !/^\d{4}$/.test(postcode)) return null;
            return {
              label,
              street: street || undefined,
              houseNumber: houseNumber || undefined,
              postcode,
              city: city || undefined,
              lat: Number(x.lat),
              lng: Number(x.lon),
            };
          })
          .filter((it): it is AddressSuggestion => it !== null)
      : [];
    cacheSet(key, items);
    return NextResponse.json(
      { cached: false, items },
      { headers: jsonHeaders }
    );
  } catch (err) {
    console.error("[geocode/suggest] error:", err);
    return NextResponse.json(
      { error: "Échec de l'appel Nominatim", items: [] },
      { status: 502, headers: jsonHeaders }
    );
  }
}
