/**
 * POST /api/chomage-ia/web-search
 *
 * Proxy serveur vers Brave Search avec rate-limit (10/min/admin) + cache 1h.
 *
 * Body : { query, count? } — `count` cap à 5.
 * Réponse : { results: WebSearchResult[], cached: bool }
 *
 * Utilisé indépendamment du chat pour debug / preview admin (la pipeline chat
 * appelle `searchWeb` directement côté serveur, pas via cette route HTTP).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { WebSearchRequestSchema } from "@/lib/chomage-ia/types";
import { isWebSearchAvailable, searchWeb } from "@/lib/chomage-ia/web-search";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:web-search:${ip}`, {
    windowMs: 60_000,
    max: 10,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 },
    );
  }

  if (!(await isWebSearchAvailable())) {
    return NextResponse.json(
      {
        error:
          "Web search désactivé : BRAVE_SEARCH_API_KEY manquante ou toggle admin off.",
      },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = WebSearchRequestSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Validation error"
            : "Validation error",
      },
      { status: 400 },
    );
  }

  try {
    const results = await searchWeb(parsed.query, parsed.count ?? 3);
    return NextResponse.json({ results, count: results.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[web-search] failed:", message);
    return NextResponse.json(
      { error: `Web search failed : ${message}` },
      { status: 502 },
    );
  }
}
