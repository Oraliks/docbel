import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

/**
 * /api/admin/calculators/[slug]/review
 *
 *  POST → marque le calc comme "revu maintenant" :
 *           Tool.lastReviewedAt = now
 *           Tool.nextReviewDue  = now + 12 mois
 *
 * Sert au bandeau d'alerte annuelle (cf. ReviewBanner). Si l'outil n'existe
 * pas en DB (slug inconnu) on renvoie 404 pour que l'admin remarque que le
 * Tool doit être seedé.
 */

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function addMonths(d: Date, months: number): Date {
  const n = new Date(d);
  n.setMonth(n.getMonth() + months);
  return n;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { slug } = await params;

  const existing = await withDbRetry(() =>
    prisma.tool.findUnique({
      where: { slug },
      select: { id: true, name: true },
    }),
  );
  if (!existing) {
    return NextResponse.json(
      {
        error:
          "Outil introuvable pour ce slug. Lance scripts/seed-calculators.ts.",
      },
      { status: 404, headers: jsonHeaders },
    );
  }

  const now = new Date();
  const next = addMonths(now, 12);

  const updated = await withDbRetry(() =>
    prisma.tool.update({
      where: { slug },
      data: {
        lastReviewedAt: now,
        nextReviewDue: next,
      },
      select: {
        slug: true,
        name: true,
        lastReviewedAt: true,
        nextReviewDue: true,
      },
    }),
  );

  await logActivity(
    auth.user.email,
    "updated",
    "setting",
    `calc-review:${slug}`,
    existing.id,
    `lastReviewedAt=${now.toISOString()} nextReviewDue=${next.toISOString()}`,
  );

  return NextResponse.json({ tool: updated }, { headers: jsonHeaders });
}
