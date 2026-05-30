import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { lookupByEnterpriseNumber, searchByName } from "@/lib/be-companies/kbo-lookup";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET /api/admin/lookup/bce?number=0123456789
/// GET /api/admin/lookup/bce?name=cantillon
///
/// Renvoie 404 si l'entreprise n'est pas trouvée (et 409 si la base KBO
/// est vide — déclencher une ingestion via /api/admin/lookup/bce/refresh).
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const number = url.searchParams.get("number");
  const name = url.searchParams.get("name");

  if (!number && !name) {
    return NextResponse.json({ error: "Paramètre `number` ou `name` requis" }, { status: 400, headers: json });
  }

  try {
    if (number) {
      const result = await lookupByEnterpriseNumber(number);
      if (!result) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404, headers: json });
      return NextResponse.json(result, { headers: json });
    }
    const results = await searchByName(name!, 10);
    return NextResponse.json({ results }, { headers: json });
  } catch (err) {
    console.error("[bce-lookup] error:", err);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500, headers: json });
  }
}
