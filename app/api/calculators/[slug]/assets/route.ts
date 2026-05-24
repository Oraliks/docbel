import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";

/**
 * /api/calculators/[slug]/assets — endpoint PUBLIC
 *
 * Liste les sources officielles attachées à un calculateur, pour affichage
 * dans la page publique (footer du calc, page méthodologie côté admin, etc.).
 *
 * Pas d'auth — la liste des sources officielles est par nature publique
 * (URL SPF Finances, barème ONEM…). Renvoie un payload minimal (pas d'IP,
 * pas d'uploadedBy).
 */

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const rows = await withDbRetry(() =>
    prisma.calculatorAsset.findMany({
      where: { slug },
      orderBy: [{ order: "asc" }, { uploadedAt: "desc" }],
      select: {
        id: true,
        kind: true,
        label: true,
        description: true,
        url: true,
        category: true,
        year: true,
        fileSize: true,
        mimeType: true,
      },
    }),
  );

  return NextResponse.json({ assets: rows }, { headers: jsonHeaders });
}
