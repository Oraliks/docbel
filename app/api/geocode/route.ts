import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

// Cache mémoire process : suffisant pour Nominatim (1 req/s usage policy).
// Vidé sur cold start ; 1h TTL pour éviter les tempêtes.
type CacheEntry = { value: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

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
  // Cap à 500 entrées (LRU naïf : flush si trop gros)
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

/**
 * Proxy Nominatim — évite CORS côté client + ajoute cache + User-Agent.
 *
 * Modes :
 *  - ?q=...           → forward geocode (adresse → lat/lng)
 *  - ?lat=&lng=       → reverse geocode (lat/lng → adresse + CP)
 */
export async function GET(req: NextRequest) {
  // Rate-limit anti-abus du proxy Nominatim : 30 req / min / IP
  const ip = getClientIp(req);
  const rl = checkRateLimit(`geocode:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429, headers: jsonHeaders }
    );
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const lat = sp.get("lat")?.trim();
  const lng = sp.get("lng")?.trim();

  let url: string;
  let cacheKey: string;
  if (q) {
    cacheKey = `f:${q.toLowerCase()}`;
    url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  } else if (lat && lng && /^-?\d+(\.\d+)?$/.test(lat) && /^-?\d+(\.\d+)?$/.test(lng)) {
    cacheKey = `r:${lat},${lng}`;
    url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`;
  } else {
    return NextResponse.json(
      { error: "Paramètres requis : ?q=adresse ou ?lat=&lng=" },
      { status: 400, headers: jsonHeaders }
    );
  }

  const cached = cacheGet(cacheKey);
  if (cached !== null) {
    return NextResponse.json({ cached: true, data: cached }, { headers: jsonHeaders });
  }

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "DocBel/1.0 (admin geocoding)",
        "Accept-Language": "fr,nl,en",
      },
      // Server-side cache via Next
      next: { revalidate: 3600 },
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `Nominatim ${r.status}` },
        { status: 502, headers: jsonHeaders }
      );
    }
    const data = await r.json();
    cacheSet(cacheKey, data);
    return NextResponse.json({ cached: false, data }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[geocode] error:", err);
    return NextResponse.json(
      { error: "Échec de l'appel Nominatim" },
      { status: 502, headers: jsonHeaders }
    );
  }
}
