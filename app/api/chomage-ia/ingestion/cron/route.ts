/**
 * GET|POST /api/chomage-ia/ingestion/cron
 *
 * Cron Vercel : itère sur les IngestionSource `enabled=true` et déclenche
 * runIngestionCheck pour chacune. Protégé par CRON_SECRET (header Authorization
 * Bearer ou query ?secret=).
 *
 * Court-circuite si le setting `CHOMAGE_IA_INGESTION_ENABLED` est "false".
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { runIngestionCheck } from "@/lib/chomage-ia/ingestion";

function checkCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    const ua = req.headers.get("user-agent") ?? "";
    return ua.toLowerCase().includes("vercel");
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

async function handle(req: NextRequest) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabledSetting = await getSetting(SETTING_KEYS.CHOMAGE_IA_INGESTION_ENABLED);
  if (enabledSetting !== "true") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Ingestion désactivée dans les settings admin.",
    });
  }

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? undefined;
  const sources = await prisma.ingestionSource.findMany({
    where: { enabled: true, ...(domain ? { domain } : {}) },
  });

  const results: Array<{
    sourceId: string;
    name: string;
    created: number;
    skipped: number;
    detected: number;
    error: string | null;
  }> = [];

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

  return NextResponse.json({
    ok: true,
    scanned: results.length,
    totalCreated: results.reduce((acc, r) => acc + r.created, 0),
    results,
  });
}

export const GET = handle;
export const POST = handle;
