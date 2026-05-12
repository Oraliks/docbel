import { NextRequest, NextResponse } from "next/server";
import { Prisma, BureauType } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Détection de doublons potentiels.
 *
 * GET /api/admin/bureaux/duplicates?type=CPAS&postalCode=1000&name=...&excludeId=...
 *   → renvoie les bureaux qui matchent (type + postalCode) ou (type + nom approximatif)
 *
 * GET /api/admin/bureaux/duplicates?scan=true
 *   → scan complet de la base, retourne les groupes suspectés (mêmes type+postalCode+name approchant)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const sp = req.nextUrl.searchParams;
  const scan = sp.get("scan") === "true";

  if (scan) {
    const all = await withDbRetry(() =>
      prisma.bureau.findMany({
        where: { active: true },
        select: { id: true, name: true, type: true, postalCode: true, city: true },
      })
    );
    // Group by [type, postalCode, normalizedName]
    const groups = new Map<string, typeof all>();
    for (const b of all) {
      const key = `${b.type}|${b.postalCode}|${normalize(b.name)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(b);
    }
    const dups = [...groups.values()].filter((g) => g.length > 1);
    return NextResponse.json(
      { groups: dups, count: dups.length },
      { headers: jsonHeaders }
    );
  }

  const type = sp.get("type")?.trim().toUpperCase() as BureauType | "";
  const postalCode = sp.get("postalCode")?.trim() ?? "";
  const name = sp.get("name")?.trim() ?? "";
  const excludeId = sp.get("excludeId")?.trim();

  const where: Prisma.BureauWhereInput = { active: true };
  if (excludeId) where.NOT = { id: excludeId };

  const orClauses: Prisma.BureauWhereInput[] = [];
  if (type && postalCode) {
    orClauses.push({ type: type as BureauType, postalCode });
  }
  if (type && name && name.length >= 3) {
    orClauses.push({
      type: type as BureauType,
      name: { contains: name, mode: "insensitive" },
    });
  }
  if (orClauses.length === 0) {
    return NextResponse.json({ items: [] }, { headers: jsonHeaders });
  }
  where.OR = orClauses;

  const items = await withDbRetry(() =>
    prisma.bureau.findMany({
      where,
      select: { id: true, name: true, type: true, postalCode: true, city: true, street: true },
      take: 10,
    })
  );

  return NextResponse.json({ items, total: items.length }, { headers: jsonHeaders });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
