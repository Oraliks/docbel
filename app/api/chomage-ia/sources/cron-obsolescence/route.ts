/**
 * POST /api/chomage-ia/sources/cron-obsolescence
 *
 * Cron mensuel de re-calcul des `validityStatus` pour les KnowledgeSource
 * `enabled=true`. Protégé par le header `Authorization: Bearer ${CRON_SECRET}`
 * (Vercel Cron envoie automatiquement ce header si `crons[].headers` est set,
 * sinon on accepte aussi le query `?secret=`).
 *
 * Note : la route accepte GET (Vercel Cron par défaut envoie GET) et POST
 * (manuel via curl).
 */

import { NextRequest, NextResponse } from "next/server";
import { runObsolescenceScan } from "@/lib/chomage-ia/obsolescence";

function checkCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Pas de secret configuré → dev local. On laisse passer si user-agent
    // contient "vercel-cron" (la plateforme Vercel envoie ce UA).
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
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? undefined;
  try {
    const result = await runObsolescenceScan({ domain });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron-obsolescence] failed:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
