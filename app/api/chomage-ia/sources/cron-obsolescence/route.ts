/**
 * POST /api/chomage-ia/sources/cron-obsolescence
 *
 * Cron mensuel de re-calcul des `validityStatus` pour les KnowledgeSource
 * `enabled=true`. Protégé par le header `Authorization: Bearer ${CRON_SECRET}`
 * ou `x-cron-secret`. L'absence de secret refuse tout déclenchement.
 *
 * Note : la route accepte GET (Vercel Cron par défaut envoie GET) et POST
 * (manuel via curl).
 */

import { NextRequest } from "next/server";
import { runObsolescenceScan } from "@/lib/chomage-ia/obsolescence";
import { cronAuthError } from "@/lib/booking/notify";
import { apiError, apiOk } from "@/lib/api/response";

async function handle(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return apiError(authError.status, authError.message);
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? undefined;
  try {
    const result = await runObsolescenceScan({ domain });
    return apiOk({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron-obsolescence] failed:", message);
    return apiError(500, "Obsolescence scan failed");
  }
}

export const GET = handle;
export const POST = handle;
