import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** GET — historique des 20 dernières sauvegardes d'une ligne de traduction. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;

  const history = await withDbRetry(() =>
    prisma.contentTranslationHistory.findMany({
      where: { translationId: id },
      orderBy: { editedAt: "desc" },
      take: 20,
    })
  );

  return NextResponse.json(history, { headers: json });
}
