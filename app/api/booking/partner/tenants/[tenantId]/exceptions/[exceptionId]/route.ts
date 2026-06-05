import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; exceptionId: string }> },
) {
  const { tenantId, exceptionId } = await ctx.params;
  const guard = await guardTenant(tenantId, "config");
  if (!guard.ok) return guard.response;

  const exists = await prisma.bookingException.findFirst({
    where: { id: exceptionId, location: { tenantId } },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Exception introuvable" }, { status: 404, headers: json });
  }

  await prisma.bookingException.delete({ where: { id: exceptionId } });
  return NextResponse.json({ ok: true }, { headers: json });
}
