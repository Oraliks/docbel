import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

// Drapeau de fraîcheur d'une table (notre côté uniquement).
type Flag = "VIDE" | "JAMAIS IMPORTE" | "OK";

function computeFlag(entriesCount: number, lastImportedAt: Date | null): Flag {
  if (entriesCount === 0) return "VIDE";
  if (lastImportedAt === null) return "JAMAIS IMPORTE";
  return "OK";
}

/// GET /api/admin/lookup/freshness
///
/// Rapport de fraîcheur des référentiels (Lookup ONEM) côté Beldoc :
/// pour chaque table, le nombre d'entrées, la date du dernier import et un
/// drapeau (VIDE / JAMAIS IMPORTE / OK), regroupé par catégorie.
///
/// NB : la source ONEM (services.onem.be/lookupweb) est une app JSF sans API
/// publique ; ce rapport ne couvre donc que NOTRE état (pas de comparaison
/// automatique avec l'ONEM). Voir scripts/lookup-onem-freshness-audit.ts pour
/// le diff manuel via un JSON de comptes ONEM.
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const tables = await prisma.lookupTable.findMany({
    select: {
      slug: true,
      prefix: true,
      labelFr: true,
      entriesCount: true,
      lastImportedAt: true,
      category: { select: { labelFr: true } },
    },
  });

  type TableRow = {
    slug: string;
    prefix: string;
    labelFr: string;
    entriesCount: number;
    lastImportedAt: string | null;
    flag: Flag;
  };

  // Regroupement par catégorie (label FR).
  const byCategoryMap = new Map<string, TableRow[]>();
  for (const t of tables) {
    const categoryLabel = t.category.labelFr;
    const row: TableRow = {
      slug: t.slug,
      prefix: t.prefix,
      labelFr: t.labelFr,
      entriesCount: t.entriesCount,
      lastImportedAt: t.lastImportedAt ? t.lastImportedAt.toISOString() : null,
      flag: computeFlag(t.entriesCount, t.lastImportedAt),
    };
    const list = byCategoryMap.get(categoryLabel);
    if (list) list.push(row);
    else byCategoryMap.set(categoryLabel, [row]);
  }

  // Tri par catégorie puis par prefix.
  const byCategory = [...byCategoryMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([category, rows]) => ({
      category,
      tables: rows.sort((a, b) => a.prefix.localeCompare(b.prefix, "fr")),
    }));

  const totals = {
    tables: tables.length,
    entries: tables.reduce((sum, t) => sum + t.entriesCount, 0),
    empty: tables.filter((t) => t.entriesCount === 0).length,
    neverImported: tables.filter((t) => t.lastImportedAt === null).length,
  };

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      totals,
      byCategory,
    },
    { headers: jsonHeaders }
  );
}
