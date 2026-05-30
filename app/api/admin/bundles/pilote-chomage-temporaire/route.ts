import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { createOrUpdatePiloteChomageTemporaire } from "@/lib/bundles/pilote-chomage-temporaire";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST — crée (idempotent) le bundle pilote « Chômage temporaire » avec
/// 3 PdfForms stub, 3 questions d'orientation, 1 avertissement critique.
/// Utile pour valider le bridge PdfForm ↔ Bundle de bout en bout.
export async function POST() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const result = await createOrUpdatePiloteChomageTemporaire(auth.user.id);
    return NextResponse.json(result, { headers: json });
  } catch (err) {
    console.error("[pilote-chomage-temporaire] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500, headers: json }
    );
  }
}
