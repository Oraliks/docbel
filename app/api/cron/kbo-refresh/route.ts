import { NextRequest, NextResponse } from "next/server";
import { isKboConfigured, runKboEtl } from "@/lib/be-companies/kbo-etl";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// Vercel Cron — rafraîchissement mensuel du miroir KBO.
/// Auth via CRON_SECRET (header `authorization: Bearer …` ou `x-cron-secret`).
///
/// ⚠️ Note opérationnelle : un ingest complet (~2M entreprises) excède
/// largement le timeout 300s d'une fonction Vercel Pro. Cette route est
/// dimensionnée pour un fichier "delta" quotidien, OU pour rafraîchir un
/// sous-ensemble (paramètre `?max=N`). Pour la première hydratation, utiliser
/// le déclencheur manuel `/api/admin/lookup/bce/refresh` depuis un runner
/// non-serverless (GitHub Action ou machine locale).
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500, headers: json });
  }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const customSecret = req.headers.get("x-cron-secret");
  if (bearer !== secret && customSecret !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: json });
  }

  if (!isKboConfigured()) {
    // No-op gracieux : la cron tourne mais n'a rien à faire tant que les
    // credentials KBO ne sont pas configurés.
    return NextResponse.json({ ok: true, skipped: "KBO non configuré" }, { headers: json });
  }

  const url = new URL(req.url);
  const maxParam = url.searchParams.get("max");
  const maxEnterprises = maxParam ? Math.max(1, Math.min(50_000, Number(maxParam))) : undefined;

  const result = await runKboEtl({ maxEnterprises });
  return NextResponse.json(result, { status: result.ok ? 200 : 500, headers: json });
}

/// Vercel Cron envoie un GET — on délègue à POST.
export async function GET(req: NextRequest) {
  return POST(req);
}
