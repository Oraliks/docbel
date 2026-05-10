import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const region = sp.get("region")?.trim() ?? "";
  const limit = Math.min(Number(sp.get("limit")) || 50, 600);

  const where: Prisma.CommuneWhereInput = {};
  if (q) {
    where.OR = [
      { nameFr: { contains: q, mode: "insensitive" } },
      { nameNl: { contains: q, mode: "insensitive" } },
      { insCode: { contains: q } },
    ];
  }
  if (region) where.region = region as Prisma.CommuneWhereInput["region"];

  const items = await withDbRetry(() =>
    prisma.commune.findMany({
      where,
      orderBy: [{ nameFr: "asc" }],
      take: limit,
      include: { postalCodes: { select: { code: true } } },
    })
  );

  return NextResponse.json(
    {
      items: items.map((c) => ({
        id: c.id,
        insCode: c.insCode,
        nameFr: c.nameFr,
        nameNl: c.nameNl,
        nameDe: c.nameDe,
        region: c.region,
        province: c.province,
        lat: c.lat,
        lng: c.lng,
        postalCodes: c.postalCodes.map((p) => p.code),
      })),
      total: items.length,
    },
    { headers: jsonHeaders }
  );
}
