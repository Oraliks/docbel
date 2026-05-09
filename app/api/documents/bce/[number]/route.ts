import { NextRequest, NextResponse } from "next/server";
import { lookupBCE } from "@/lib/documents/bce-lookup";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;

  // Rate limit (par IP) — la lookup BCE peut taper sur un service externe
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bce:${ip}`, { windowMs: 60_000, max: 20 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes" },
      { status: 429 }
    );
  }

  try {
    const result = await lookupBCE(number);
    if (result.source === "unavailable") {
      return NextResponse.json(
        {
          ...result,
          message: "Aucune donnée disponible. Vous pouvez saisir manuellement les informations.",
        },
        { status: 200 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lookup" },
      { status: 400 }
    );
  }
}
