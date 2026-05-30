import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkVat } from "@/lib/be-companies/vies";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET /api/admin/lookup/vat?country=BE&number=0123456789
/// Vérifie un numéro de TVA via VIES (gratuit). Pour BE, renvoie aussi
/// le nom et l'adresse découpée.
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  // VIES throttle agressivement ; on protège côté docbel.
  const rl = checkRateLimit(`vat-lookup:${getClientIp(req)}`, { windowMs: 60_000, max: 20 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429, headers: json });
  }

  const url = new URL(req.url);
  const country = url.searchParams.get("country") ?? "";
  const number = url.searchParams.get("number") ?? "";
  if (!country || !number) {
    return NextResponse.json({ error: "Paramètres `country` et `number` requis" }, { status: 400, headers: json });
  }

  try {
    const result = await checkVat(country, number);
    return NextResponse.json(result, { headers: json });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur VIES";
    const status = msg.includes("mal formé") ? 400 : 502;
    return NextResponse.json({ error: msg }, { status, headers: json });
  }
}
