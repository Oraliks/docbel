import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const STATUSES = ["pending", "accepted", "rejected"] as const;
type Status = (typeof STATUSES)[number];

/**
 * API ADMIN : liste des suggestions de correction de traduction.
 * Filtre optionnel `?status=pending|accepted|rejected` (défaut : pending).
 * Garde admin réutilisée : `requireAdminAuth` (lib/auth-check) — même pattern
 * que toutes les routes /api/admin/*.
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const statusParam = req.nextUrl.searchParams.get("status")?.trim();
  const where: Prisma.TranslationSuggestionWhereInput = {};
  if (statusParam && (STATUSES as readonly string[]).includes(statusParam)) {
    where.status = statusParam as Status;
  }

  try {
    const items = await withDbRetry(() =>
      prisma.translationSuggestion.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: 500,
      }),
    );
    return NextResponse.json(
      { items, total: items.length },
      { headers: jsonHeaders },
    );
  } catch (error) {
    console.error("Error fetching translation suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch translation suggestions" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
