import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  getSourceTexts,
  sourceKey,
  normalizeModel,
  SOURCE_MODELS,
  type SourceItem,
} from "@/lib/i18n/content-source";

/**
 * GET — export CSV des traductions avec les mêmes filtres que la liste.
 * Query : locale, model?, status?, q?, hideEmpty?
 * Colonnes : id, model, recordId, field, locale, sourceFR, translation, status, origin, updatedBy, updatedAt
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const localeParam = url.searchParams.get("locale") || "nl";
  const modelParam = url.searchParams.get("model") || "";
  const statusParam = url.searchParams.get("status") || "";
  const q = url.searchParams.get("q") || "";
  const hideEmpty = url.searchParams.get("hideEmpty") === "1";

  const locale = localeParam === "en" ? "en" : localeParam;

  const where: Record<string, unknown> = { locale };
  const normModel = normalizeModel(modelParam);
  if (modelParam && SOURCE_MODELS.includes(normModel))
    where.model = { equals: normModel, mode: "insensitive" };
  if (statusParam && ["ia", "reviewed", "published"].includes(statusParam))
    where.status = statusParam;
  if (q) where.value = { contains: q, mode: "insensitive" };

  const rows = await withDbRetry(() =>
    prisma.contentTranslation.findMany({
      where,
      orderBy: [{ model: "asc" }, { recordId: "asc" }, { field: "asc" }],
      take: 5000,
    })
  );

  const items: SourceItem[] = rows.map((r) => ({
    model: r.model,
    recordId: r.recordId,
    field: r.field,
  }));
  const sources = await getSourceTexts(items);

  const enriched = rows
    .map((r) => ({
      ...r,
      sourceText: sources.get(sourceKey(r.model, r.recordId, r.field)) ?? "",
    }))
    .filter((r) => !hideEmpty || r.sourceText.trim() !== "");

  // CSV — anti-injection : jamais de formule (=, +, -, @) en début de cellule.
  function escCsv(v: string): string {
    const s = String(v ?? "").replace(/"/g, '""');
    // Préfixe apostrophe si la valeur commence par un caractère dangereux
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe}"`;
  }

  const header = [
    "id",
    "model",
    "recordId",
    "field",
    "locale",
    "sourceFR",
    "translation",
    "status",
    "origin",
    "updatedBy",
    "updatedAt",
  ].map(escCsv).join(",");

  const lines = enriched.map((r) =>
    [
      r.id,
      r.model,
      r.recordId,
      r.field,
      r.locale,
      r.sourceText,
      r.value,
      r.status,
      r.origin ?? "ia",
      r.updatedBy ?? "",
      r.updatedAt.toISOString(),
    ]
      .map(escCsv)
      .join(",")
  );

  const csv = [header, ...lines].join("\r\n");
  const filename = `translations-${locale}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
