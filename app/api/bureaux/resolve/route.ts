import { NextRequest, NextResponse } from "next/server";
import { resolveBureausForPostalCode } from "@/lib/bureaus/resolve";
import { memoCache } from "@/lib/memo-cache";
import { BUREAUX_RESOLVE_CACHE_PREFIX } from "@/lib/bureaus/cache-invalidation";

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
  // Cache mémoire 60s. Le résolveur fait 7+ queries Prisma et les bureaux
  // changent rarement (édition admin uniquement, qui invalide via
  // invalidateBureauCaches). Les CP les plus consultés bénéficient
  // énormément, et le ping monitoring (?cp=1000) ne paie plus la DB.
  const cacheKey = `${BUREAUX_RESOLVE_CACHE_PREFIX}${cp}:${org ?? ""}:${mutuelle ?? ""}`;
  try {
    const result = await memoCache(cacheKey, 60_000, () =>
      resolveBureausForPostalCode(cp, {
        organismePaiement: org,
        mutuelleCode: mutuelle,
      })
    );
    return NextResponse.json(result, { headers: jsonHeaders });
  } catch (error) {
    console.error("[bureaus/resolve] error:", error);
    return NextResponse.json(
      { error: "Échec de la résolution" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
