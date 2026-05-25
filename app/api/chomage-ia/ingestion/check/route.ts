/**
 * POST /api/chomage-ia/ingestion/check?sourceId=…
 *
 * Déclenche manuellement un check sur une IngestionSource (bouton "Vérifier
 * maintenant" dans l'UI admin). Retourne le résultat de runIngestionCheck.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { runIngestionCheck } from "@/lib/chomage-ia/ingestion";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const sourceId = url.searchParams.get("sourceId");
  if (!sourceId) {
    return NextResponse.json({ error: "sourceId requis" }, { status: 400 });
  }

  const source = await prisma.ingestionSource.findUnique({
    where: { id: sourceId },
  });
  if (!source) {
    return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
  }
  if (!source.enabled) {
    return NextResponse.json(
      { error: "Source désactivée" },
      { status: 400 },
    );
  }

  const result = await runIngestionCheck(source);
  return NextResponse.json({ ok: result.error === null, result });
}
