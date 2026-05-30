import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { getIbanNameVerifier } from "@/lib/iban-name";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST /api/iban/verify-name
/// Vérifie qu'un IBAN correspond à un nom de titulaire via le provider VOP
/// configuré (`IBAN_NAME_PROVIDER`). 503 si non configuré.
/// Admin-only car chaque appel coûte (en production).
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const verifier = getIbanNameVerifier();
  if (!verifier) {
    return NextResponse.json(
      { error: "Vérification VOP non configurée (IBAN_NAME_PROVIDER absent)" },
      { status: 503, headers: json }
    );
  }

  const rl = checkRateLimit(`iban-verify:${getClientIp(req)}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429, headers: json });
  }

  let body: { iban?: unknown; name?: unknown; accountType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }

  if (typeof body.iban !== "string" || typeof body.name !== "string") {
    return NextResponse.json({ error: "Champs `iban` et `name` requis" }, { status: 400, headers: json });
  }

  const accountType =
    body.accountType === "business" || body.accountType === "person" ? body.accountType : undefined;

  try {
    const result = await verifier.verify({ iban: body.iban, name: body.name, accountType });
    return NextResponse.json(result, { headers: json });
  } catch (err) {
    console.error("[iban-verify] provider error:", err);
    return NextResponse.json({ error: "Échec du provider VOP" }, { status: 502, headers: json });
  }
}
