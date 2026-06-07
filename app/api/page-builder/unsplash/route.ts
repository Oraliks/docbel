/**
 * GET /api/page-builder/unsplash?q=<query>
 *
 * Proxy de recherche d'images Unsplash pour le contrôle d'upload de l'éditeur de
 * pages. Admin-only, rate-limité, fail-soft si UNSPLASH_ACCESS_KEY absente
 * (renvoie `{ disabled: true }` en 200 — cas normal en dev).
 *
 * Mappe la réponse Unsplash en une forme minimale et stable pour le client :
 *   { results: [{ thumb, url, alt, credit }] }
 *   - thumb  = urls.thumb (vignette de la grille)
 *   - url    = urls.regular (valeur image appliquée au clic)
 *   - alt    = alt_description
 *   - credit = user.name (attribution photographe)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

interface UnsplashPhoto {
  urls?: { thumb?: string; regular?: string };
  alt_description?: string | null;
  user?: { name?: string | null } | null;
}

interface UnsplashSearchResponse {
  results?: UnsplashPhoto[];
}

export interface UnsplashResult {
  thumb: string;
  url: string;
  alt: string;
  credit: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`pagebuilder:unsplash:${ip}`, {
    windowMs: 60_000,
    max: 30,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return NextResponse.json({ disabled: true }, { status: 200 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  const endpoint = new URL("https://api.unsplash.com/search/photos");
  endpoint.searchParams.set("query", q);
  endpoint.searchParams.set("per_page", "24");
  endpoint.searchParams.set("content_filter", "high");

  let res: Response;
  try {
    res = await fetch(endpoint, {
      headers: {
        Authorization: `Client-ID ${key}`,
        "Accept-Version": "v1",
      },
      // Pas de cache : les recherches sont éphémères et propres à l'éditeur.
      cache: "no-store",
    });
  } catch (err) {
    console.error("[unsplash] network error:", err);
    return NextResponse.json(
      { error: "Service Unsplash injoignable" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    console.error("[unsplash] upstream error:", res.status);
    return NextResponse.json(
      { error: `Erreur Unsplash (HTTP ${res.status})` },
      { status: 502 }
    );
  }

  let data: UnsplashSearchResponse;
  try {
    data = (await res.json()) as UnsplashSearchResponse;
  } catch (err) {
    console.error("[unsplash] invalid JSON:", err);
    return NextResponse.json(
      { error: "Réponse Unsplash invalide" },
      { status: 502 }
    );
  }

  const results: UnsplashResult[] = (data.results ?? [])
    .map((p) => ({
      thumb: p.urls?.thumb ?? "",
      url: p.urls?.regular ?? "",
      alt: p.alt_description ?? "",
      credit: p.user?.name ?? "",
    }))
    .filter((r) => r.thumb && r.url);

  return NextResponse.json({ results }, { status: 200 });
}
