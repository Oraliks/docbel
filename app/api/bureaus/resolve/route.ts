import { NextRequest, NextResponse } from "next/server";
import { resolveBureausForPostalCode } from "@/lib/bureaus/resolve";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

// Public endpoint — pas d'auth. Cache léger côté Next.
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get("cp")?.trim() ?? "";
  if (!cp) {
    return NextResponse.json(
      { error: "Paramètre 'cp' (code postal) requis" },
      { status: 400, headers: jsonHeaders }
    );
  }
  try {
    const result = await resolveBureausForPostalCode(cp);
    return NextResponse.json(result, { headers: jsonHeaders });
  } catch (error) {
    console.error("[bureaus/resolve] error:", error);
    return NextResponse.json(
      { error: "Échec de la résolution" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
