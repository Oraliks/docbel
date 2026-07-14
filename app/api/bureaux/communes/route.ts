import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoCache } from "@/lib/memo-cache";
import { rankCommuneMatches, type CommuneLite } from "@/lib/bureaus/commune-search";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export const dynamic = "force-dynamic";

// Référentiel quasi statique (~565 communes belges) : on charge tout une
// seule fois et on filtre/classe en mémoire (rankCommuneMatches gère
// l'insensibilité aux accents, que `contains` Postgres ne fait pas sans
// l'extension `unaccent`, potentiellement absente). TTL 1h largement
// suffisant — une commune ne change pas en cours de journée.
const ALL_COMMUNES_CACHE_KEY = "bureaux:communes:all";
const ALL_COMMUNES_TTL_MS = 60 * 60 * 1000;

async function loadAllCommunes(): Promise<CommuneLite[]> {
  const rows = await prisma.commune.findMany({
    where: { mergedIntoId: null },
    select: {
      insCode: true,
      nameFr: true,
      nameNl: true,
      postalCodes: { select: { code: true }, orderBy: { code: "asc" }, take: 1 },
    },
  });

  const communes: CommuneLite[] = [];
  for (const c of rows) {
    const cp = c.postalCodes[0]?.code;
    if (!cp) continue; // pas de CP représentatif → non résolvable, on l'exclut
    communes.push({ insCode: c.insCode, nameFr: c.nameFr, nameNl: c.nameNl, cp });
  }
  return communes;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ items: [] }, { headers: jsonHeaders });
  }

  try {
    const allCommunes = await memoCache(ALL_COMMUNES_CACHE_KEY, ALL_COMMUNES_TTL_MS, loadAllCommunes);
    const items = rankCommuneMatches(q, allCommunes, 8);
    return NextResponse.json({ items }, { headers: jsonHeaders });
  } catch (error) {
    // Pas de query (PII potentielle) dans le log, comme les autres routes
    // /api/bureaux/*. Dégradation gracieuse : un autocomplete qui échoue ne
    // doit jamais faire planter l'UI avec un 500, juste ne rien suggérer.
    console.error("[bureaus/communes] error:", error);
    return NextResponse.json({ items: [] }, { headers: jsonHeaders });
  }
}
