import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { chomageTemporaire } from "@/lib/dossiers/chomage-temporaire";
import { seedDossier } from "@/lib/dossiers/seed";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST /api/admin/bundles/pilote-chomage-temporaire[?force=1]
/// Seed du dossier codé « Chômage temporaire » à partir de son module
/// (lib/dossiers/chomage-temporaire). Idempotent.
/// `?force=1` ⇒ supprime le bundle + ses PdfForms et recrée (utile après
/// une mise à jour du mapping de widgets).
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const force = new URL(req.url).searchParams.get("force") === "1";

  try {
    const result = await seedDossier(chomageTemporaire, auth.user.id, { force });
    return NextResponse.json(result, { headers: json });
  } catch (err) {
    console.error("[pilote-chomage-temporaire] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500, headers: json }
    );
  }
}
