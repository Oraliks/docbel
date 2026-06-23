import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getUserLocale } from "@/i18n/locale";
import { localizeRecords } from "@/lib/i18n/content";

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

// Cache partagé réservé à la locale canonique FR ; variantes traduites en
// `private` + `Vary: Cookie` (la locale vit dans le cookie BELDOC_LOCALE) pour
// que le CDN ne serve pas l'entrée FR à un visiteur NL/EN.
function jsonHeaders(locale: string) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control":
      locale === "fr"
        ? "public, max-age=60, stale-while-revalidate=300"
        : "private, no-store",
    Vary: "Cookie",
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const locale = await getUserLocale();

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

  // Traductions contenu DB (NL/EN…), fallback FR, no-op si locale=fr.
  const assets = await localizeRecords(
    "CalculatorAsset",
    rows,
    ["label", "description"],
    locale,
  );

  return NextResponse.json({ assets }, { headers: jsonHeaders(locale) });
}
