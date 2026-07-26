import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { verifyEnterpriseNumber } from "@/lib/formations/org-verification";

export const runtime = "nodejs";
const json = { "Content-Type": "application/json; charset=utf-8" };

/**
 * GET /api/formations/organismes/verify-bce?number=0123.456.789
 * Vérification live du numéro d'entreprise pendant la saisie du formulaire
 * public. Jamais bloquant : renvoie toujours 200 avec un verdict + un message.
 */
export async function GET(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = checkRateLimit(`bce-verify:${ip}`, { windowMs: 60_000, max: 20 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes" },
      { status: 429, headers: json },
    );
  }

  const number = new URL(req.url).searchParams.get("number") ?? "";
  if (!number.trim()) {
    return NextResponse.json(
      { verified: false, checksumValid: false, message: "" },
      { headers: json },
    );
  }

  const result = await verifyEnterpriseNumber(number);
  return NextResponse.json(result, { headers: json });
}
