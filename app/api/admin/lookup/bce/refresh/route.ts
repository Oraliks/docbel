import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { isKboConfigured, runKboEtl } from "@/lib/be-companies/kbo-etl";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// Déclenche manuellement une ingestion KBO. Admin-only.
/// Cf. /api/cron/kbo-refresh pour le déclenchement automatique mensuel.
///
/// ⚠️ L'ingestion complète (~2M entreprises) dépasse les 300s de Vercel.
/// Pour la première hydratation, lancer depuis un environnement non-serverless
/// (GitHub Action, container, machine locale avec `pnpm tsx scripts/...`).
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  if (!isKboConfigured()) {
    return NextResponse.json(
      { error: "Credentials KBO non configurés (KBO_OPEN_DATA_USER/PASSWORD)" },
      { status: 503, headers: json }
    );
  }

  const url = new URL(req.url);
  const maxParam = url.searchParams.get("max");
  const maxEnterprises = maxParam ? Math.max(1, Math.min(50_000, Number(maxParam))) : undefined;

  const result = await runKboEtl({ maxEnterprises });
  return NextResponse.json(result, { status: result.ok ? 200 : 500, headers: json });
}
