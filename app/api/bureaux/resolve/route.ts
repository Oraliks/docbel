import { NextRequest, NextResponse } from "next/server";
import { resolveBureausForPostalCode } from "@/lib/bureaus/resolve";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cp = sp.get("cp")?.trim() ?? "";
  const org = sp.get("org")?.trim() ?? null;
  const mutuelle = sp.get("mutuelle")?.trim() ?? null;

  if (!cp) {
    return NextResponse.json(
      { error: "Paramètre 'cp' (code postal) requis" },
      { status: 400, headers: jsonHeaders }
    );
  }
  try {
    const result = await resolveBureausForPostalCode(cp, {
      organismePaiement: org,
      mutuelleCode: mutuelle,
    });
    return NextResponse.json(result, { headers: jsonHeaders });
  } catch (error) {
    console.error("[bureaus/resolve] error:", error);
    return NextResponse.json(
      { error: "Échec de la résolution" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
