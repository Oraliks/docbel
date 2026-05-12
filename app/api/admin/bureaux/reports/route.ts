import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() ?? "pending";
  const limit = Math.min(Number(sp.get("limit")) || 50, 200);

  const where: Prisma.BureauReportWhereInput = {};
  if (status !== "all") where.status = status;

  const items = await withDbRetry(() =>
    prisma.bureauReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        bureau: {
          select: { id: true, name: true, type: true, postalCode: true, city: true },
        },
      },
    })
  );

  return NextResponse.json(
    {
      items: items.map((r) => ({
        id: r.id,
        bureauId: r.bureauId,
        bureau: r.bureau,
        category: r.category,
        message: r.message,
        reporterEmail: r.reporterEmail,
        status: r.status,
        adminNotes: r.adminNotes,
        resolvedBy: r.resolvedBy,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total: items.length,
    },
    { headers: jsonHeaders }
  );
}
