import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await ctx.params;
  const items = await withDbRetry(() =>
    prisma.bureauRevision.findMany({
      where: { bureauId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  );
  return NextResponse.json(
    {
      items: items.map((r) => ({
        id: r.id,
        diff: r.diff,
        snapshot: r.snapshot,
        changeNotes: r.changeNotes,
        changedBy: r.changedBy,
        createdAt: r.createdAt.toISOString(),
      })),
      total: items.length,
    },
    { headers: jsonHeaders }
  );
}
