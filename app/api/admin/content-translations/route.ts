import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  getSourceTexts,
  sourceKey,
  SOURCE_MODELS,
  type SourceItem,
} from "@/lib/i18n/content-source";

const json = { "Content-Type": "application/json; charset=utf-8" };

const PAGE_SIZE = 50;
const STATUSES = ["ia", "reviewed", "published"];

/**
 * GET — liste paginée des traductions de contenu (admin).
 * Query :
 *   - model?   : filtre par modèle (news, tool, …) ; vide = tous
 *   - locale?  : "nl" | "en" (défaut "nl")
 *   - status?  : "ia" | "reviewed" | "published" ; vide = tous
 *   - q?       : recherche plein-texte sur la valeur traduite
 *   - page?    : 1-based, 50/page
 * Renvoie `{ rows: (ContentTranslation & { sourceText })[], total, page, pageSize }`.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const modelParam = url.searchParams.get("model")?.trim() || "";
  const localeParam = url.searchParams.get("locale")?.trim() || "nl";
  const statusParam = url.searchParams.get("status")?.trim() || "";
  const q = url.searchParams.get("q")?.trim() || "";
  const pageParam = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const locale = localeParam === "en" ? "en" : "nl";

  const where: Prisma.ContentTranslationWhereInput = { locale };
  if (modelParam && SOURCE_MODELS.includes(modelParam)) where.model = modelParam;
  if (statusParam && STATUSES.includes(statusParam)) where.status = statusParam;
  if (q) where.value = { contains: q, mode: "insensitive" };

  const [total, rows] = await withDbRetry(() =>
    prisma.$transaction([
      prisma.contentTranslation.count({ where }),
      prisma.contentTranslation.findMany({
        where,
        orderBy: [{ model: "asc" }, { recordId: "asc" }, { field: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ])
  );

  // Récupère les sources FR correspondantes pour affichage côte à côte.
  const items: SourceItem[] = rows.map((r) => ({
    model: r.model,
    recordId: r.recordId,
    field: r.field,
  }));
  const sources = await getSourceTexts(items);

  const enriched = rows.map((r) => ({
    ...r,
    sourceText: sources.get(sourceKey(r.model, r.recordId, r.field)) ?? "",
  }));

  return NextResponse.json(
    { rows: enriched, total, page, pageSize: PAGE_SIZE },
    { headers: json }
  );
}
