import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET /api/admin/form-validation/reports?status=pending&limit=50
/// Liste les signalements de validation reçus, paginé par limite simple.
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50), 200);

  const where = status === "all" ? {} : { status };

  const [items, total] = await Promise.all([
    prisma.formValidationReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        form: { select: { id: true, slug: true, title: true } },
      },
    }),
    prisma.formValidationReport.count({ where }),
  ]);

  return NextResponse.json({ items, total }, { headers: json });
}
