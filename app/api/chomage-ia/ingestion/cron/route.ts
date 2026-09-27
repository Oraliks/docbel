/**
 * GET|POST /api/chomage-ia/ingestion/cron
 *
 * Cron Vercel : itère sur les IngestionSource `enabled=true` et déclenche
 * runIngestionCheck pour chacune. Protégé par CRON_SECRET (header Authorization
 * Bearer ou x-cron-secret).
 *
 * Court-circuite si le setting `CHOMAGE_IA_INGESTION_ENABLED` est "false".
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { runIngestionCheck } from "@/lib/chomage-ia/ingestion";
import { cronAuthError } from "@/lib/booking/notify";
import { apiError, apiOk } from "@/lib/api/response";

async function handle(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return apiError(authError.status, authError.message);

  const enabledSetting = await getSetting(SETTING_KEYS.CHOMAGE_IA_INGESTION_ENABLED);
  if (enabledSetting !== "true") {
    return apiOk({
      ok: true,
      skipped: true,
      reason: "Ingestion désactivée dans les settings admin.",
    });
  }

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? undefined;
  const results: Array<{
    sourceId: string;
    name: string;
    created: number;
    skipped: number;
    detected: number;
    error: string | null;
  }> = [];

  let cursor: string | undefined;
  const batchSize = 100;
  while (true) {
    const sources = await prisma.ingestionSource.findMany({
      where: { enabled: true, ...(domain ? { domain } : {}) },
      take: batchSize,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const s of sources) {
      const r = await runIngestionCheck(s);
      results.push({
        sourceId: s.id,
        name: s.name,
        created: r.created,
        skipped: r.skipped,
        detected: r.detected,
        error: r.error,
      });
    }
    if (sources.length < batchSize) break;
    cursor = sources[sources.length - 1].id;
  }

  return apiOk({
    ok: true,
    scanned: results.length,
    totalCreated: results.reduce((acc, r) => acc + r.created, 0),
    results,
  });
}

export const GET = handle;
export const POST = handle;
